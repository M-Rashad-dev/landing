<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\BlockedCustomer;
use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->user = actingAsOwner();
});

function makeOrder(array $attributes = []): Order
{
    return asTenant(test()->user, fn () => Order::factory()->create($attributes));
}

/** An order that used a code (redemption + used_count = 1). */
function orderWithCode(): array
{
    return asTenant(test()->user, function () {
        $code = DiscountCode::factory()->create(['code' => 'EID', 'usage_limit' => 5, 'used_count' => 1]);
        $order = Order::factory()->create(['discount_code_id' => $code->id, 'discount_code' => 'EID', 'code_discount' => '20.00']);
        DiscountCodeRedemption::query()->create(['discount_code_id' => $code->id, 'order_id' => $order->id, 'phone' => $order->customer_phone, 'amount' => '20.00']);

        return [$order, $code];
    });
}

function setStatus(Order $order, string $status, array $extra = []): TestResponse
{
    return test()->postJson("/api/v1/dashboard/orders/{$order->id}/status", array_merge(['status' => $status], $extra));
}

it('follows the transition table', function () {
    $allowed = [
        'new' => ['confirmed', 'cancelled', 'fake'],
        'confirmed' => ['delivered', 'cancelled', 'damaged', 'fake'],
        'delivered' => ['returned'],
        'cancelled' => ['new'],
        'fake' => ['new'],
        'returned' => [],
        'damaged' => [],
    ];

    foreach ($allowed as $from => $targets) {
        foreach (OrderStatus::values() as $to) {
            $order = makeOrder(['status' => $from]);
            $response = setStatus($order, $to);
            if (in_array($to, $targets, true)) {
                $response->assertOk()->assertJsonPath('data.status', $to);
            } else {
                $response->assertStatus(422)->assertJsonPath('code', 'transition_not_allowed');
            }
        }
    }
});

it('records a full timeline with user and note', function () {
    $order = makeOrder();

    setStatus($order, 'confirmed', ['note' => 'اتصلت بالعميل'])->assertOk();
    setStatus($order, 'delivered')->assertOk();
    $data = setStatus($order, 'returned')->assertOk()->json('data');

    expect(array_column($data['logs'], 'to_status'))->toBe(['confirmed', 'delivered', 'returned'])
        ->and($data['logs'][0]['note'])->toBe('اتصلت بالعميل')
        ->and($data['logs'][0]['user']['id'])->toBe($this->user->id)
        ->and($data['allowed_transitions'])->toBe([])
        ->and($data['can_edit_customer'])->toBeFalse();
});

it('releases the code on fake or cancelled and does not consume it again on reopen', function (string $status) {
    [$order, $code] = orderWithCode();

    setStatus($order, $status)->assertOk();
    expect($code->fresh()->used_count)->toBe(0)
        ->and(asTenant($this->user, fn () => DiscountCodeRedemption::query()->first()->released_at))->not->toBeNull();

    setStatus($order, 'new')->assertOk();
    expect($code->fresh()->used_count)->toBe(0);
})->with(['fake', 'cancelled']);

it('blocks the phone and the IP when marking fake', function () {
    $order = makeOrder(['customer_phone' => '+201055555555', 'ip_address' => '41.5.5.5']);

    setStatus($order, 'fake', ['block_phone' => true, 'block_ip' => true])->assertOk()
        ->assertJsonPath('data.customer_history.phone_blocked', true)
        ->assertJsonPath('data.customer_history.ip_blocked', true);

    $blocked = asTenant($this->user, fn () => BlockedCustomer::query()->orderBy('id')->get());
    expect($blocked->map(fn ($b) => [$b->type->value, $b->value])->all())->toBe([['phone', '+201055555555'], ['ip', '41.5.5.5']]);

    // Blocking flags only apply to "fake".
    $other = makeOrder(['customer_phone' => '+201066666666']);
    setStatus($other, 'cancelled', ['block_phone' => true])->assertOk();
    expect(asTenant($this->user, fn () => BlockedCustomer::query()->count()))->toBe(2);
});

it('edits customer details only while new or confirmed, internal notes always', function () {
    $order = makeOrder();
    $this->patchJson("/api/v1/dashboard/orders/{$order->id}", ['customer_name' => 'اسم جديد', 'customer_phone' => '01198765432', 'internal_note' => 'اتصل بعد الظهر'])
        ->assertOk()
        ->assertJsonPath('data.customer_name', 'اسم جديد')
        ->assertJsonPath('data.customer_phone', '+201198765432');

    $this->patchJson("/api/v1/dashboard/orders/{$order->id}", ['customer_phone' => '123'])->assertStatus(422)->assertJsonValidationErrors(['customer_phone']);
    // Amounts are never editable.
    $this->patchJson("/api/v1/dashboard/orders/{$order->id}", ['total' => 1])->assertOk();
    expect($order->fresh()->total)->toBe('350.00');

    $delivered = makeOrder(['status' => 'delivered']);
    $this->patchJson("/api/v1/dashboard/orders/{$delivered->id}", ['customer_name' => 'x x'])->assertStatus(422)->assertJsonPath('code', 'edit_not_allowed');
    $this->patchJson("/api/v1/dashboard/orders/{$delivered->id}", ['internal_note' => 'تم'])->assertOk()->assertJsonPath('data.internal_note', 'تم');
});

it('changes many statuses and reports each result', function () {
    $a = makeOrder();
    $b = makeOrder(['status' => 'delivered']);
    $c = makeOrder();

    $data = $this->postJson('/api/v1/dashboard/orders/bulk-status', ['ids' => [$a->id, $b->id, $c->id, 999999], 'status' => 'confirmed'])->assertOk()->json('data');

    expect($data['succeeded'])->toBe(2)->and($data['failed'])->toBe(2)
        ->and(array_column($data['results'], 'ok'))->toBe([true, false, true, false])
        ->and($a->fresh()->status)->toBe(OrderStatus::Confirmed)
        ->and($b->fresh()->status)->toBe(OrderStatus::Delivered);

    $this->postJson('/api/v1/dashboard/orders/bulk-status', ['ids' => range(1, 101), 'status' => 'confirmed'])->assertStatus(422);
});

it('lists orders with filters', function () {
    $product = asTenant($this->user, fn () => Product::factory()->create());
    $match = makeOrder(['customer_name' => 'محمد رشاد', 'customer_phone' => '+201012340000', 'status' => 'confirmed', 'product_id' => $product->id, 'is_duplicate_suspect' => true]);
    makeOrder(['customer_name' => 'سارة', 'customer_phone' => '+201199990000']);

    $ids = fn (string $query) => collect($this->getJson('/api/v1/dashboard/orders?'.$query)->assertOk()->json('data'))->pluck('id')->all();

    expect($ids('status=confirmed'))->toBe([$match->id])
        ->and($ids('q=رشاد'))->toBe([$match->id])
        ->and($ids('q=01012340000'))->toBe([$match->id])
        ->and($ids('q='.$match->order_number))->toBe([$match->id])
        ->and($ids('product_id='.$product->id))->toBe([$match->id])
        ->and($ids('duplicate=1'))->toBe([$match->id])
        ->and($ids('from='.now('Africa/Cairo')->format('Y-m-d')))->toHaveCount(2)
        ->and($ids('to='.now('Africa/Cairo')->subDays(2)->format('Y-m-d')))->toBe([]);
});

it('counts statuses and new orders since a time', function () {
    makeOrder();
    makeOrder(['status' => 'delivered']);
    $since = now()->addSecond()->toIso8601String();
    $this->travel(2)->seconds();
    makeOrder();

    $this->getJson('/api/v1/dashboard/orders/stats?since='.urlencode($since))
        ->assertOk()
        ->assertJsonPath('data.counts.new', 2)
        ->assertJsonPath('data.counts.delivered', 1)
        ->assertJsonPath('data.all', 3)
        ->assertJsonPath('data.new_since', 1);
});

it('shows the customer history of the same phone', function () {
    $order = makeOrder(['customer_phone' => '+201077777777']);
    makeOrder(['customer_phone' => '+201077777777', 'status' => 'fake']);
    makeOrder(['customer_phone' => '+201077777777', 'status' => 'delivered']);

    $this->getJson("/api/v1/dashboard/orders/{$order->id}")
        ->assertOk()
        ->assertJsonPath('data.customer_history.total', 2)
        ->assertJsonPath('data.customer_history.counts.fake', 1)
        ->assertJsonPath('data.customer_history.bad_ratio', 50)
        ->assertJsonCount(2, 'data.customer_history.orders');
});

it('exports CSV with BOM, Arabic headers and the filters', function () {
    $page = asTenant($this->user, fn () => LandingPage::factory()->create(['title' => 'صفحة العرض']));
    $order = makeOrder(['customer_name' => '=HYPERLINK("x")', 'landing_page_id' => $page->id, 'status' => 'confirmed']);
    asTenant($this->user, fn () => $order->items()->create(['product_name' => 'تيشيرت', 'unit_price' => '350.00', 'quantity' => 1, 'options' => [['option' => 'المقاس', 'value' => 'XL', 'price_delta' => 50]], 'line_total' => '350.00']));
    makeOrder(['status' => 'new']);

    $response = $this->get('/api/v1/dashboard/orders/export?status=confirmed')->assertOk();
    $csv = $response->streamedContent();
    $lines = array_values(array_filter(explode("\n", $csv)));

    expect(str_starts_with($csv, "\xEF\xBB\xBF"))->toBeTrue()
        ->and($response->headers->get('Content-Type'))->toContain('text/csv')
        ->and(str_getcsv(substr($lines[0], 3), escape: ''))->toBe(['رقم الطلب', 'التاريخ', 'الحالة', 'الاسم', 'الموبايل', 'المحافظة', 'المدينة', 'العنوان', 'المنتج', 'الخيارات', 'الكمية', 'الإجمالي قبل الخصم', 'خصم العرض', 'خصم الكود', 'الإجمالي', 'الكود', 'الملاحظات', 'الصفحة'])
        ->and($lines)->toHaveCount(2);

    $row = str_getcsv($lines[1], escape: '');
    expect($row[0])->toBe((string) $order->order_number)
        ->and($row[2])->toBe('مؤكد')
        ->and($row[3])->toBe("'=HYPERLINK(\"x\")")
        ->and($row[8])->toBe('تيشيرت')
        ->and($row[9])->toBe('المقاس: XL')
        ->and($row[14])->toBe('350.00')
        ->and($row[17])->toBe('صفحة العرض');
});

it('refuses exports above the row limit', function () {
    config(['landing.limits.export_max_rows' => 1]);
    makeOrder();
    makeOrder();

    $this->getJson('/api/v1/dashboard/orders/export')->assertStatus(422)->assertJsonPath('code', 'export_too_large');
});

it('manages blocked customers', function () {
    $id = $this->postJson('/api/v1/dashboard/blocked-customers', ['type' => 'phone', 'value' => '٠١٠١٢٣٤٥٦٧٨', 'reason' => 'مزعج'])
        ->assertCreated()
        ->assertJsonPath('data.value', '+201012345678')
        ->json('data.id');
    $this->postJson('/api/v1/dashboard/blocked-customers', ['type' => 'phone', 'value' => '01012345678'])->assertStatus(422);
    $this->postJson('/api/v1/dashboard/blocked-customers', ['type' => 'phone', 'value' => '123'])->assertStatus(422)->assertJsonValidationErrors(['value']);
    $this->postJson('/api/v1/dashboard/blocked-customers', ['type' => 'ip', 'value' => '999.1.1.1'])->assertStatus(422);
    $this->postJson('/api/v1/dashboard/blocked-customers', ['type' => 'ip', 'value' => '2001:db8::1'])->assertCreated();

    $this->getJson('/api/v1/dashboard/blocked-customers?type=phone')->assertOk()->assertJsonCount(1, 'data');
    $this->deleteJson("/api/v1/dashboard/blocked-customers/{$id}")->assertNoContent();
    $this->getJson('/api/v1/dashboard/blocked-customers')->assertOk()->assertJsonCount(1, 'data');
});

it('summarises the home dashboard', function () {
    $page = asTenant($this->user, fn () => LandingPage::factory()->create(['title' => 'الأكثر']));
    makeOrder(['landing_page_id' => $page->id, 'status' => 'delivered', 'total' => '500.00']);
    makeOrder(['landing_page_id' => $page->id, 'status' => 'delivered', 'total' => '250.50']);
    makeOrder(['created_at' => now()->subDays(20)]);

    $data = $this->getJson('/api/v1/dashboard/overview')->assertOk()->json('data');

    expect($data['orders_today'])->toBe(2)
        ->and($data['orders_week'])->toBe(2)
        ->and($data['orders_month'])->toBe(3)
        ->and($data['revenue_delivered'])->toBe(750.5)
        ->and($data['counts']['delivered'])->toBe(2)
        ->and($data['chart'])->toHaveCount(14)
        ->and(end($data['chart'])['count'])->toBe(2)
        ->and($data['top_pages'][0])->toMatchArray(['id' => $page->id, 'title' => 'الأكثر', 'orders' => 2])
        ->and($data['latest_orders'])->toHaveCount(3);
});

it('returns the seller brand for the invoice: the page identity, else the default identity', function () {
    [$identity, $order] = asTenant($this->user, function () {
        $identity = Identity::factory()->create(['brand_name' => 'براند الصفحة', 'contact' => ['phone' => '+201012345678', 'address' => 'القاهرة']]);
        $page = LandingPage::factory()->create(['identity_id' => $identity->id]);

        return [$identity, makeOrder(['landing_page_id' => $page->id])];
    });

    $this->getJson("/api/v1/dashboard/orders/{$order->id}")
        ->assertOk()
        ->assertJsonPath('data.brand.name', 'براند الصفحة')
        ->assertJsonPath('data.brand.phone', '+201012345678')
        ->assertJsonPath('data.brand.address', 'القاهرة');

    $default = asTenant($this->user, fn () => Identity::factory()->default()->create(['brand_name' => 'الهوية الافتراضية']));
    $orphan = makeOrder(['landing_page_id' => null]);
    $this->getJson("/api/v1/dashboard/orders/{$orphan->id}")->assertJsonPath('data.brand.name', 'الهوية الافتراضية');
    expect($identity->id)->not->toBe($default->id);
});

it('logs contact attempts, schedules callbacks and orders the confirmation queue', function () {
    $this->travelTo(now()->setTime(12, 0));
    $first = makeOrder(['status' => OrderStatus::New]);
    $second = makeOrder(['status' => OrderStatus::New]);
    $third = makeOrder(['status' => OrderStatus::New]);
    $done = makeOrder(['status' => OrderStatus::Confirmed]);

    // No answer: one more attempt, callback in 2 hours, logged with the user.
    $this->postJson("/api/v1/dashboard/orders/{$first->id}/contact", ['result' => 'no_answer'])
        ->assertOk()
        ->assertJsonPath('data.contact_attempts', 1)
        ->assertJsonPath('data.events.0.type', 'no_answer')
        ->assertJsonPath('data.events.0.user.id', $this->user->id);
    expect($first->fresh()->follow_up_at->equalTo(now()->addHours(2)))->toBeTrue();

    // Postponed needs a future time (Cairo wall time) within 30 days.
    $this->postJson("/api/v1/dashboard/orders/{$second->id}/contact", ['result' => 'postponed'])->assertStatus(422)->assertJsonValidationErrors(['follow_up_at']);
    $this->postJson("/api/v1/dashboard/orders/{$second->id}/contact", ['result' => 'postponed', 'follow_up_at' => now('Africa/Cairo')->subHour()->format('Y-m-d\TH:i')])->assertStatus(422);
    $this->postJson("/api/v1/dashboard/orders/{$second->id}/contact", ['result' => 'postponed', 'follow_up_at' => now('Africa/Cairo')->addDay()->format('Y-m-d\TH:i'), 'note' => 'يكلمنا بكرة'])
        ->assertOk()
        ->assertJsonPath('data.events.0.note', 'يكلمنا بكرة');
    $this->postJson("/api/v1/dashboard/orders/{$third->id}/contact", ['result' => 'whatsapp'])->assertOk()->assertJsonPath('data.contact_attempts', 0);
    $this->postJson("/api/v1/dashboard/orders/{$done->id}/contact", ['result' => 'no_answer'])->assertStatus(422)->assertJsonPath('code', 'contact_closed');
    $this->postJson("/api/v1/dashboard/orders/{$third->id}/contact", ['result' => 'nope'])->assertStatus(422);

    // Queue: due ones first (never called), then the scheduled callbacks by time.
    $queue = $this->getJson('/api/v1/dashboard/orders/confirmation-queue')->assertOk();
    expect($queue->json('data.*.id'))->toBe([$third->id, $first->id, $second->id])
        ->and($queue->json('meta.due'))->toBe(1)
        ->and($queue->json('meta.later'))->toBe(2);

    // Two hours later the no-answer one is due again; confirming clears its callback.
    $this->travel(2)->hours();
    expect($this->getJson('/api/v1/dashboard/orders/confirmation-queue')->json('meta.due'))->toBe(2);
    setStatus($first, 'confirmed')->assertOk();
    expect($first->fresh()->follow_up_at)->toBeNull();
});

it('saves the WhatsApp confirmation template in the store settings', function () {
    $this->patchJson('/api/v1/dashboard/store', ['whatsapp_template' => "أهلًا {الاسم}\nطلبك #{رقم_الطلب}"])
        ->assertOk()
        ->assertJsonPath('data.whatsapp_template', "أهلًا {الاسم}\nطلبك #{رقم_الطلب}")
        ->assertJsonPath('data.name', $this->user->tenant->name);
    $this->getJson('/api/v1/auth/me')->assertJsonPath('data.tenant.whatsapp_template', "أهلًا {الاسم}\nطلبك #{رقم_الطلب}");
    $this->patchJson('/api/v1/dashboard/store', ['whatsapp_template' => ''])->assertJsonPath('data.whatsapp_template', null);
    $this->patchJson('/api/v1/dashboard/store', ['whatsapp_template' => str_repeat('x', 1001)])->assertStatus(422);
});

it('needs a token for the confirmation endpoints', function (string $method, string $uri) {
    app('auth')->forgetGuards();
    $this->json($method, $uri)->assertUnauthorized();
})->with([
    ['GET', '/api/v1/dashboard/orders/confirmation-queue'],
    ['POST', '/api/v1/dashboard/orders/1/contact'],
]);

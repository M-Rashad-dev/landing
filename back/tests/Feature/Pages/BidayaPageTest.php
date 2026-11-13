<?php

declare(strict_types=1);

use App\Models\Customer;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Services\FormToken;
use App\Support\OrderForm;
use App\Themes\BidayaDesign;

beforeEach(function () {
    $this->user = actingAsOwner();
    $this->user->tenant->update(['name' => 'متجر سما']);
    asTenant($this->user, fn () => Identity::factory()->default()->create());
    $this->product = asTenant($this->user, fn () => Product::factory()->create(['name' => 'ساعة ذكية', 'price' => '850.00']));
});

function bidayaPage(): array
{
    return test()->postJson('/api/v1/dashboard/pages', ['title' => 'عرض الساعة', 'slug' => 'watch', 'theme_key' => 'bidaya', 'product_id' => test()->product->id])
        ->assertCreated()->json('data');
}

function saveBidaya(array $page, array $content, int $version = 1)
{
    return test()->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => $version, 'content' => $content]);
}

it('saves a «بداية» page and keeps only what the theme knows', function () {
    $page = bidayaPage();
    $content = $page['draft_content'];
    $content['settings']['colors']['primary'] = '#1D4ED8';
    $content['settings']['unknown'] = 'x';
    $content['sections'][0]['props']['title'] = '<b>ساعتك</b> الذكية';
    $content['sections'][0]['props']['extra'] = 'x';

    $saved = saveBidaya($page, $content)->assertOk()->json('data.draft_content');

    expect($saved['settings']['colors']['primary'])->toBe('#1d4ed8')
        ->and($saved['settings'])->not->toHaveKey('unknown')
        ->and($saved['sections'][0]['props']['title'])->toBe('ساعتك الذكية')
        ->and($saved['sections'][0]['props'])->not->toHaveKey('extra')
        // Name and phone stay asked whatever is sent.
        ->and($saved['sections'][5]['props']['fields']['phone'])->toBe(['enabled' => true, 'required' => true]);
});

it('needs exactly one order form, always shown, and reports errors by their path', function () {
    $page = bidayaPage();
    $content = $page['draft_content'];

    $two = $content;
    $two['sections'][] = array_merge($content['sections'][5], ['id' => 'second-form']);
    saveBidaya($page, $two)->assertStatus(422)->assertJsonValidationErrors(['content.sections']);

    $none = $content;
    array_pop($none['sections']);
    saveBidaya($page, $none)->assertStatus(422)->assertJsonValidationErrors(['content.sections']);

    $hidden = $content;
    $hidden['sections'][5]['visible'] = false;
    saveBidaya($page, $hidden)->assertStatus(422)->assertJsonValidationErrors(['content.sections.5.visible']);

    $bad = $content;
    $bad['settings']['colors']['text'] = 'red';
    $bad['sections'][1]['props']['items'] = [['icon' => 'truck', 'title' => 'x', 'text' => null]];
    $bad['sections'][4]['props']['items'][0]['answer'] = '';
    saveBidaya($page, $bad)->assertStatus(422)->assertJsonValidationErrors(['content.settings.colors.text', 'content.sections.1.props.items', 'content.sections.4.props.items.0.answer']);
});

it('refuses images of another store', function () {
    $page = bidayaPage();
    $foreign = asTenant(createOwner(), fn () => Media::factory()->create());
    $content = $page['draft_content'];
    $content['sections'][2]['props']['image_media_ids'] = [$foreign->id];

    saveBidaya($page, $content)->assertStatus(422)->assertJsonValidationErrors(['content.sections.2.props.image_media_ids.0']);
});

it('publishes it and serves it with the store name, the product reviews and the form settings', function () {
    $page = bidayaPage();
    $host = asTenant($this->user, fn () => Domain::query()->value('host'));
    asTenant($this->user, function () {
        $customer = Customer::query()->create(['name' => 'سارة محمد', 'phone' => '+201000000009']);
        $order = Order::factory()->create(['customer_id' => $customer->id]);
        ProductReview::query()->create(['product_id' => $this->product->id, 'customer_id' => $customer->id, 'order_id' => $order->id, 'rating' => 5, 'text' => 'ممتازة', 'author_name' => 'سارة محمد', 'is_hidden' => false]);
    });

    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk()->assertJsonPath('data.has_unpublished_changes', false);
    $edited = $page['draft_content'];
    $edited['sections'][0]['props']['title'] = 'عنوان جديد';
    saveBidaya($page, $edited)->assertOk()->assertJsonPath('data.has_unpublished_changes', true);

    $data = $this->getJson("/api/v1/public/pages?host={$host}&slug=watch", internalHeaders())->assertOk()->json('data');
    expect($data['theme_key'])->toBe('bidaya')
        ->and($data['store_name'])->toBe('متجر سما')
        ->and($data['content']['settings']['button'])->toBe('rounded')
        ->and($data['reviews'][0])->toMatchArray(['rating' => 5, 'text' => 'ممتازة'])
        ->and(collect($data['content']['sections'])->firstWhere('type', 'order_form')['props']['offer_picker'])->toBeTrue();

    $this->getJson("/api/v1/dashboard/pages/{$page['id']}/preview")->assertOk()->assertJsonPath('data.store_name', 'متجر سما')->assertJsonCount(1, 'data.reviews');
});

it('takes an order with the fields the form asks for', function () {
    $page = bidayaPage();
    $host = asTenant($this->user, fn () => Domain::query()->value('host'));
    $content = $page['draft_content'];
    $content['sections'][5]['props']['fields']['governorate'] = ['enabled' => true, 'required' => true];
    $content['sections'][5]['props']['fields']['email'] = ['enabled' => false, 'required' => false];
    saveBidaya($page, $content)->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();

    $token = app(FormToken::class)->issue($page['id'], time() - 10);
    $order = fn (array $customer) => $this->postJson('/api/v1/public/orders', [
        'host' => $host, 'slug' => 'watch', 'quantity' => 1, 'form_token' => $token, 'website' => '',
        'customer' => $customer,
    ], internalHeaders());

    $order(['name' => 'أحمد علي', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع 9', 'email' => 'a@b.com'])
        ->assertStatus(422)->assertJsonValidationErrors(['customer.email']);
    $order(['name' => 'أحمد علي', 'phone' => '01012345678', 'address' => 'شارع 9'])
        ->assertStatus(422)->assertJsonValidationErrors(['customer.governorate']);
    $number = $order(['name' => 'أحمد علي', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع 9'])
        ->assertCreated()->json('data.order_number');

    expect(asTenant($this->user, fn () => Order::query()->where('order_number', $number)->value('landing_page_id')))->toBe($page['id']);
});

it('starts with the theme defaults in the shape the order form reads', function () {
    $defaults = BidayaDesign::defaults('ساعة');
    $form = collect($defaults['sections'])->firstWhere('type', 'order_form')['props'];

    expect(collect($defaults['sections'])->pluck('type')->all())->toBe(BidayaDesign::SECTION_TYPES)
        ->and($defaults['sections'][0]['props']['title'])->toBe('ساعة')
        ->and(array_keys($form['fields']))->toBe(OrderForm::BUILT_IN)
        ->and(app(BidayaDesign::class)->validate($defaults))->toBe($defaults);
});

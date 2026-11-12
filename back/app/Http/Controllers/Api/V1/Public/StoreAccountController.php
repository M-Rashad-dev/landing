<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Concerns\ServesLiveStore;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Store;
use App\Services\PhoneNormalizer;
use App\Store\Accounts\CustomerAccounts;
use App\Store\Accounts\CustomerOrders;
use App\Store\Accounts\ProductReviews;
use App\Store\SeoDefaults;
use App\Store\StoreCatalog;
use App\Tenancy\Tenancy;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The storefront customer: sign in with the phone and a one-time code, «طلباتي», saved addresses,
 * product reviews. Next forwards the customer's token (httpOnly cookie) as X-Customer-Token.
 */
final class StoreAccountController extends Controller
{
    use RespondsWithJson, ServesLiveStore;

    public const TOKEN_HEADER = 'X-Customer-Token';

    public const MAX_ADDRESSES = 10;

    public function __construct(
        private readonly CustomerAccounts $accounts,
        private readonly CustomerOrders $orders,
        private readonly ProductReviews $reviews,
    ) {}

    public function sendCode(Request $request, PhoneNormalizer $phones, SeoDefaults $seo): JsonResponse
    {
        $data = $request->validate(['phone' => ['required', 'string', 'max:30'], 'ip' => ['nullable', 'ip']]);

        return $this->inStore($request, function () use ($data, $phones, $seo) {
            $phone = $phones->normalize($data['phone']) ?? throw ValidationException::withMessages(['phone' => [__('accounts.phone_invalid')]]);

            return $this->ok($this->accounts->sendCode((int) Tenancy::id(), $phone, $data['ip'] ?? null, $seo->storeName()));
        });
    }

    public function verify(Request $request, PhoneNormalizer $phones): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'max:30'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
            'user_agent' => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->inStore($request, function () use ($data, $phones) {
            $phone = $phones->normalize($data['phone']) ?? throw ValidationException::withMessages(['phone' => [__('accounts.phone_invalid')]]);
            $signed = $this->accounts->verify($phone, $data['code'], $data['user_agent'] ?? null);

            return $this->ok(['token' => $signed['token'], 'customer' => $this->profile($signed['customer'])]);
        });
    }

    public function show(Request $request): JsonResponse
    {
        return $this->signedIn($request, fn (Customer $customer) => $this->ok($this->profile($customer)));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:80']]);

        return $this->signedIn($request, function (Customer $customer) use ($data) {
            $customer->forceFill(['name' => trim(strip_tags($data['name']))])->save();

            return $this->ok($this->profile($customer));
        });
    }

    public function signOut(Request $request): JsonResponse
    {
        return $this->signedIn($request, function () use ($request) {
            $this->accounts->signOut((string) $request->header(self::TOKEN_HEADER));

            return new JsonResponse(null, 204);
        });
    }

    public function orders(Request $request): JsonResponse
    {
        $page = (int) ($request->validate(['page' => ['nullable', 'integer', 'min:1', 'max:1000']])['page'] ?? 1);

        return $this->signedIn($request, function (Customer $customer) use ($page) {
            $rows = $this->orders->page($customer, max(1, $page));

            return $this->ok(
                $rows->getCollection()->map(fn ($o) => $this->orders->row($o))->values()->all(),
                ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total()],
            );
        });
    }

    public function order(Request $request, int $number): JsonResponse
    {
        return $this->signedIn($request, function (Customer $customer) use ($number) {
            $order = $this->orders->find($customer, $number) ?? throw new ApiException(404, 'not_found', __('landing.not_found'));

            return $this->ok($this->orders->detail($customer, $order));
        });
    }

    public function storeAddress(Request $request): JsonResponse
    {
        $data = $request->validate($this->addressRules());

        return $this->signedIn($request, function (Customer $customer) use ($data) {
            if ($customer->addresses()->count() >= self::MAX_ADDRESSES) {
                throw ValidationException::withMessages(['address' => [__('accounts.too_many_addresses', ['max' => self::MAX_ADDRESSES])]]);
            }
            $address = DB::transaction(function () use ($customer, $data) {
                $first = ! $customer->addresses()->exists();
                $address = $customer->addresses()->create([...$this->cleanAddress($data), 'is_default' => $first || ($data['is_default'] ?? false)]);
                $this->onlyDefault($customer, $address);

                return $address;
            });

            return $this->created($address->toPublic());
        });
    }

    public function updateAddress(Request $request, int $address): JsonResponse
    {
        $data = $request->validate($this->addressRules());

        return $this->signedIn($request, function (Customer $customer) use ($data, $address) {
            $row = $this->addressOf($customer, $address);
            DB::transaction(function () use ($customer, $row, $data) {
                $row->fill([...$this->cleanAddress($data), 'is_default' => $row->is_default || ($data['is_default'] ?? false)])->save();
                $this->onlyDefault($customer, $row);
            });

            return $this->ok($row->toPublic());
        });
    }

    public function destroyAddress(Request $request, int $address): JsonResponse
    {
        return $this->signedIn($request, function (Customer $customer) use ($address) {
            $row = $this->addressOf($customer, $address);
            DB::transaction(function () use ($customer, $row) {
                $row->delete();
                // Another address becomes the default.
                if ($row->is_default) {
                    $customer->addresses()->oldest('id')->first()?->forceFill(['is_default' => true])->save();
                }
            });

            return new JsonResponse(null, 204);
        });
    }

    public function review(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'min:1'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'text' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->signedIn($request, function (Customer $customer) use ($data) {
            $review = $this->reviews->write($customer, (int) $data['product_id'], (int) $data['rating'], $data['text'] ?? null);

            return $this->ok(['rating' => $review->rating, 'text' => $review->text]);
        });
    }

    /** The visible reviews of a product (newest first) with its summary. */
    public function productReviews(Request $request, StoreCatalog $catalog, string $slug): JsonResponse
    {
        $page = (int) ($request->validate(['page' => ['nullable', 'integer', 'min:1', 'max:1000']])['page'] ?? 1);

        return $this->inStore($request, function () use ($catalog, $slug, $page) {
            $product = $catalog->sellable()->where('slug', mb_strtolower($slug))->first() ?? throw new ApiException(404, 'not_found', __('landing.not_found'));
            /** @var Product $product */
            $rows = $product->reviews()->visible()->latest('id')->paginate(10, ['*'], 'page', max(1, $page));

            return $this->ok(
                $rows->getCollection()->map(fn (ProductReview $r) => $r->toPublic())->values()->all(),
                ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'summary' => $this->reviews->summary($product->id)],
            );
        });
    }

    /** @param Closure(Customer, Store): JsonResponse $callback */
    private function signedIn(Request $request, Closure $callback): JsonResponse
    {
        return $this->inStore($request, function (Store $store) use ($request, $callback) {
            $customer = $this->accounts->customer($request->header(self::TOKEN_HEADER)) ?? throw new ApiException(401, 'signed_out', __('accounts.signed_out'));

            return $callback($customer, $store);
        });
    }

    /** @return array<string, mixed> */
    private function profile(Customer $customer): array
    {
        return [
            'name' => $customer->name,
            'phone' => $customer->phone,
            'addresses' => $customer->addresses()->orderByDesc('is_default')->orderBy('id')->get()->map(fn (CustomerAddress $a) => $a->toPublic())->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function addressRules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'governorate' => ['required', 'string', Rule::in((array) config('landing.governorates'))],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['required', 'string', 'min:5', 'max:300'],
            'is_default' => ['nullable', 'boolean'],
        ];
    }

    /** @param array<string, mixed> $data @return array<string, string|null> */
    private function cleanAddress(array $data): array
    {
        $clean = fn ($v) => $v === null ? null : (trim(strip_tags((string) $v)) ?: null);

        return ['name' => (string) $clean($data['name']), 'governorate' => (string) $data['governorate'], 'city' => $clean($data['city'] ?? null), 'address' => (string) $clean($data['address'])];
    }

    private function onlyDefault(Customer $customer, CustomerAddress $address): void
    {
        if ($address->is_default) {
            $customer->addresses()->whereKeyNot($address->id)->update(['is_default' => false]);
        }
    }

    private function addressOf(Customer $customer, int $id): CustomerAddress
    {
        return $customer->addresses()->whereKey($id)->first() ?? throw new ApiException(404, 'not_found', __('landing.not_found'));
    }
}

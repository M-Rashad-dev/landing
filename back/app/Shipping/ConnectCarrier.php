<?php

declare(strict_types=1);

namespace App\Shipping;

use App\Exceptions\ApiException;
use App\Models\CarrierAccount;
use App\Models\ShippingCompany;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\CarrierProfile;
use App\Shipping\Carriers\Carriers;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Connects the store's own carrier account (its key checked with the carrier first), keeps its settings, and links
 * it to a shipping company of the store: the one the merchant picked, or a new hidden one to price and switch on.
 */
final class ConnectCarrier
{
    /** Settings every account starts with (the merchant changes them on the card). */
    public const DEFAULTS = [
        'location_id' => null,
        'allow_open' => false,
        'package_type' => 'Parcel',
        'size' => 'SMALL',
        'label_size' => 'A4',
        'auto_ship' => false,
        'notes' => null,
    ];

    public function __construct(private readonly Carriers $carriers) {}

    /** @param array<string, string> $credentials */
    public function handle(string $key, array $credentials, ?int $companyId): CarrierAccount
    {
        $profile = $this->verify($key, $credentials, 'api_key');

        return DB::transaction(function () use ($key, $credentials, $companyId, $profile): CarrierAccount {
            /** @var CarrierAccount $account */
            $account = CarrierAccount::query()->lockForUpdate()->firstOrNew(['carrier' => $key]);
            if (! $account->exists) {
                $account->webhook_token = Str::lower(Str::random(40));
                $account->webhook_secret = Str::random(48);
            }
            $settings = [...self::DEFAULTS, ...($account->settings ?? [])];
            $settings['location_id'] = collect($profile->locations)->contains('id', $settings['location_id']) ? $settings['location_id'] : $profile->defaultLocation();
            $account->fill([
                'mode' => 'own',
                'credentials' => $credentials,
                'account_name' => $profile->accountName,
                'settings' => $settings,
                'status' => CarrierAccount::ACTIVE,
                'last_error' => null,
                'checked_at' => now(),
            ])->save();

            $this->link($account, $companyId);

            return $account->load('company');
        });
    }

    /** The carrier's word on the saved key now (the card's «اختبر الربط»): the account turns failed or active. */
    public function check(CarrierAccount $account): CarrierProfile
    {
        try {
            $profile = $this->carriers->get($account->carrier)->verify($account->credentials ?? []);
        } catch (CarrierError $e) {
            if ($e->auth) {
                $account->forceFill(['status' => CarrierAccount::FAILED, 'last_error' => mb_substr($e->getMessage(), 0, 300), 'checked_at' => now()])->save();
            }
            throw new ApiException(422, $e->auth ? 'carrier_auth' : 'carrier_unreachable', $e->getMessage());
        }
        $account->forceFill(['status' => CarrierAccount::ACTIVE, 'last_error' => null, 'checked_at' => now(), 'account_name' => $profile->accountName ?? $account->account_name])->save();

        return $profile;
    }

    /** @param array<string, mixed> $settings already validated */
    public function settings(CarrierAccount $account, array $settings): CarrierAccount
    {
        $account->forceFill(['settings' => [...self::DEFAULTS, ...($account->settings ?? []), ...$settings]])->save();

        return $account;
    }

    /** Disconnects: its company stays (shipped by hand from now on); past shipments keep their tracking numbers. */
    public function disconnect(CarrierAccount $account): void
    {
        DB::transaction(function () use ($account): void {
            ShippingCompany::query()->where('carrier_account_id', $account->id)->update(['carrier_account_id' => null]);
            $account->delete();
        });
    }

    /**
     * @param  array<string, string>  $credentials
     */
    private function verify(string $key, array $credentials, string $field): CarrierProfile
    {
        try {
            return $this->carriers->get($key)->verify($credentials);
        } catch (CarrierError $e) {
            if ($e->auth) {
                throw ValidationException::withMessages([$field => [$e->getMessage()]]);
            }
            throw new ApiException(422, 'carrier_unreachable', $e->getMessage());
        }
    }

    private function link(CarrierAccount $account, ?int $companyId): void
    {
        if ($companyId !== null) {
            $company = ShippingCompany::query()->lockForUpdate()->findOrFail($companyId);
            if ($company->carrier_account_id !== null && $company->carrier_account_id !== $account->id) {
                throw ValidationException::withMessages(['company_id' => [__('shipping.carriers.linked_elsewhere')]]);
            }
            ShippingCompany::query()->where('carrier_account_id', $account->id)->whereKeyNot($company->id)->update(['carrier_account_id' => null]);
            $company->forceFill(['carrier_account_id' => $account->id])->save();

            return;
        }
        if (ShippingCompany::query()->where('carrier_account_id', $account->id)->exists()) {
            return;
        }
        // A new company named after the carrier, hidden until the merchant sets its fees and switches it on.
        ShippingCompany::query()->create([
            'name' => $this->carriers->get($account->carrier)->label(),
            'carrier_account_id' => $account->id,
            'default_fee' => 0,
            'is_active' => false,
            'position' => (int) ShippingCompany::query()->max('position') + 1,
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Actions\Admin;

use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Order;
use App\Models\OutboundMessage;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductImport;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Deletes a store for good, with everything that belongs to it (super admin only). The database
 * removes the store's rows through its tenant foreign keys (cascade); this action handles what
 * a cascade can't: landing pages (they hold restricting keys to the store's products and
 * identities), notifications and WhatsApp messages (kept without a store otherwise), sign-in
 * tokens, the store's files on both disks, and the cached pages of its hosts. The platform's own
 * data (plans, payment methods, themes, platform pages, settings) is never touched. A summary of
 * what was deleted stays in the admin audit log.
 */
final class DeleteTenant
{
    public function __construct(private readonly ManageTenant $manage) {}

    /**
     * What goes with the store (shown before the admin confirms).
     *
     * @return array<string, int|string>
     */
    public function summary(Tenant $tenant): array
    {
        return Tenancy::runAs($tenant->id, fn (): array => [
            'name' => (string) $tenant->name,
            'users' => User::query()->where('tenant_id', $tenant->id)->count(),
            'products' => Product::query()->withTrashed()->count(),
            'orders' => Order::query()->count(),
            'customers' => Customer::query()->count(),
            'landing_pages' => LandingPage::query()->withTrashed()->count(),
            'invoices' => Invoice::query()->count(),
            'payments' => Payment::query()->count(),
            'media' => Media::query()->count(),
        ]);
    }

    /** @throws ApiException when the typed name isn't the store's */
    public function delete(Tenant $tenant, string $confirmName): void
    {
        if (trim($confirmName) !== trim((string) $tenant->name)) {
            throw new ApiException(422, 'validation_failed', __('admin.delete_store.mismatch'), ['confirm' => [__('admin.delete_store.mismatch')]]);
        }

        $summary = $this->summary($tenant);
        $owner = User::query()->where('tenant_id', $tenant->id)->orderBy('id')->value('email');
        $hosts = $tenant->activeHosts();
        $imports = Tenancy::runAs($tenant->id, fn () => ProductImport::query()->whereNotNull('file_path')->pluck('file_path')->all());
        $id = $tenant->id;

        DB::transaction(function () use ($tenant, $id, $summary, $owner): void {
            // Landing pages first: they restrict deleting the products and identities they point to.
            Tenancy::runAs($id, function (): void {
                LandingPage::query()->withTrashed()->get()->each->forceDelete();
            });
            UserNotification::query()->where('tenant_id', $id)->delete();
            OutboundMessage::query()->where('tenant_id', $id)->delete();
            PersonalAccessToken::query()->where('tokenable_type', (new User)->getMorphClass())->whereIn('tokenable_id', User::query()->where('tenant_id', $id)->select('id'))->delete();
            $tenant->delete();
            $this->manage->audit('tenant.delete', (string) $id, [...$summary, 'owner' => $owner]);
        });

        // Files only once the rows are gone for sure.
        Storage::disk('public')->deleteDirectory("tenants/{$id}");
        Storage::disk('local')->deleteDirectory("receipts/{$id}");
        Storage::disk('local')->deleteDirectory("support/{$id}");
        foreach ($imports as $path) {
            Storage::disk('local')->delete((string) $path);
        }

        RevalidateTenantHosts::dispatch($id, $hosts);
    }
}

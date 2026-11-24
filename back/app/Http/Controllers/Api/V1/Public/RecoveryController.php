<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\AbandonedLead;
use App\Recovery\CartRecovery;
use App\Services\PublicSite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The links in cart reminders (docs/plans/merchant-essentials.md, stage 4): the platform's short link sent on to the
 * store, what the store refills from it (cart lines + the customer's details, only on that store's own host), and
 * the «no more reminders» link of the emails. An unknown or old link answers 404.
 */
final class RecoveryController extends Controller
{
    use RespondsWithJson;

    /** Reminder links work this long after the lead was made. */
    private const LINK_DAYS = 7;

    public function __construct(private readonly CartRecovery $recovery, private readonly PublicSite $site) {}

    /** https://{platform}/r/{token} → the store's restore page. */
    public function link(Request $request): JsonResponse
    {
        $lead = $this->lead($request);
        $url = $this->recovery->restoreUrl($lead);
        if ($url === null) {
            throw new ApiException(404, 'not_found', __('landing.not_found'));
        }

        return $this->ok(['url' => $url])->header('Cache-Control', 'no-store, private');
    }

    /** The store refills the cart (or the landing form) from the link, on its own host only. */
    public function show(Request $request): JsonResponse
    {
        $request->validate(['host' => ['required', 'string', 'max:253']]);
        $lead = $this->lead($request);
        $domain = $this->site->domain(mb_strtolower((string) $request->input('host')));
        if ($domain === null || (int) $domain->tenant_id !== $lead->tenant_id) {
            throw new ApiException(404, 'not_found', __('landing.not_found'));
        }

        return $this->ok($this->recovery->restore($lead))->header('Cache-Control', 'no-store, private');
    }

    /** «مش عايز تذكيرات تاني» from an email: this store sends this phone / email no more reminders. */
    public function unsubscribe(Request $request): JsonResponse
    {
        $lead = $this->lead($request, any: true);
        $this->recovery->optOut($lead, false);

        return $this->ok(['store' => $lead->tenant()->value('name')]);
    }

    private function lead(Request $request, bool $any = false): AbandonedLead
    {
        $data = $request->validate(['token' => ['required', 'string', 'regex:/^[a-f0-9]{24}$/']]);
        $lead = CartRecovery::find($data['token']);
        if ($lead === null || (! $any && $lead->created_at->lt(now()->subDays(self::LINK_DAYS)))) {
            throw new ApiException(404, 'not_found', __('landing.not_found'));
        }

        return $lead;
    }
}

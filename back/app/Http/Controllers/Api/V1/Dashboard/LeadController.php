<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\LeadStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\AbandonedLead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/** Abandoned order forms: the merchant calls / messages them, then marks the result. */
final class LeadController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request): JsonResponse
    {
        $status = LeadStatus::tryFrom((string) $request->query('status', '')) ?? LeadStatus::Open;

        $page = AbandonedLead::query()
            ->with(['page:id,title,slug', 'product:id,name', 'order:id,order_number'])
            ->where('status', $status)
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        $counts = AbandonedLead::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return $this->ok(
            $page->getCollection()->map(fn (AbandonedLead $lead) => $this->row($lead))->values()->all(),
            [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'counts' => collect(LeadStatus::values())->mapWithKeys(fn (string $s) => [$s => (int) ($counts[$s] ?? 0)])->all(),
            ],
        );
    }

    public function update(Request $request, AbandonedLead $lead): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([LeadStatus::Open->value, LeadStatus::Contacted->value, LeadStatus::Dismissed->value])],
        ]);
        $status = LeadStatus::from($data['status']);

        // A converted lead stays converted (the order exists).
        if ($lead->status !== LeadStatus::Converted) {
            $lead->update([
                'status' => $status,
                'contacted_at' => $status === LeadStatus::Contacted ? now() : $lead->contacted_at,
            ]);
        }

        return $this->ok($this->row($lead->load(['page:id,title,slug', 'product:id,name', 'order:id,order_number'])));
    }

    public function destroy(AbandonedLead $lead): Response
    {
        $lead->delete();

        return $this->noContent();
    }

    /** @return array<string, mixed> */
    private function row(AbandonedLead $lead): array
    {
        return [
            'id' => $lead->id,
            'customer_name' => $lead->customer_name,
            'customer_phone' => $lead->customer_phone,
            'governorate' => $lead->governorate,
            'quantity' => $lead->quantity,
            'status' => $lead->status->value,
            'page' => $lead->page ? ['id' => $lead->page->id, 'title' => $lead->page->title] : null,
            'product' => $lead->product ? ['id' => $lead->product->id, 'name' => $lead->product->name] : null,
            'order' => $lead->order ? ['id' => $lead->order->id, 'number' => $lead->order->order_number] : null,
            'contacted_at' => $lead->contacted_at?->toIso8601ZuluString(),
            'last_seen_at' => $lead->last_seen_at?->toIso8601ZuluString(),
            'created_at' => $lead->created_at->toIso8601ZuluString(),
        ];
    }
}

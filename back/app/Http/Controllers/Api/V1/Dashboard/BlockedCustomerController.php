<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\BlockType;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\BlockedCustomer;
use App\Models\Customer;
use App\Services\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class BlockedCustomerController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request): JsonResponse
    {
        $query = BlockedCustomer::query()->orderByDesc('id');
        $type = (string) $request->query('type', '');
        if (in_array($type, ['phone', 'ip'], true)) {
            $query->where('type', $type);
        }
        if ($request->query('by') === 'auto') {
            $query->whereNotNull('rule');
        } elseif ($request->query('by') === 'merchant') {
            $query->whereNull('rule');
        }
        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $digits = ltrim((string) preg_replace('/\D+/', '', $q), '0');
            $query->where(fn ($w) => $w->where('value', 'like', '%'.addcslashes($digits !== '' ? $digits : $q, '%_\\').'%')->orWhere('reason', 'like', '%'.addcslashes($q, '%_\\').'%'));
        }

        $page = $query->paginate($this->perPage($request));

        return $this->ok(
            $page->getCollection()->map(fn (BlockedCustomer $b) => $this->row($b))->values()->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        );
    }

    public function store(Request $request, PhoneNormalizer $phones): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::enum(BlockType::class)],
            'value' => ['required', 'string', 'max:45'],
            'reason' => ['nullable', 'string', 'max:200'],
        ]);

        $type = BlockType::from($data['type']);
        $value = trim($data['value']);
        if ($type === BlockType::Phone) {
            $value = $phones->normalize($value) ?? throw ValidationException::withMessages(['value' => [__('orders.invalid_phone')]]);
        } elseif (filter_var($value, FILTER_VALIDATE_IP) === false) {
            throw ValidationException::withMessages(['value' => [__('orders.invalid_ip')]]);
        }

        if (BlockedCustomer::query()->where('type', $type)->where('value', $value)->exists()) {
            throw new ApiException(422, 'validation_failed', __('orders.already_blocked'), ['value' => [__('orders.already_blocked')]]);
        }

        $blocked = BlockedCustomer::query()->create([
            'type' => $type,
            'value' => $value,
            'reason' => isset($data['reason']) ? trim(strip_tags($data['reason'])) ?: null : null,
        ]);

        return $this->created($this->row($blocked));
    }

    public function destroy(BlockedCustomer $blockedCustomer): Response
    {
        // Lifting an automatic block: the rules leave this customer alone from now on.
        if ($blockedCustomer->type === BlockType::Phone && $blockedCustomer->rule !== null) {
            Customer::query()->where('phone', $blockedCustomer->value)->update(['block_exempt' => true]);
        }
        $blockedCustomer->delete();

        return $this->noContent();
    }

    /** @return array<string, mixed> */
    private function row(BlockedCustomer $blocked): array
    {
        return [
            'id' => $blocked->id,
            'type' => $blocked->type->value,
            'value' => $blocked->value,
            'reason' => $blocked->reason,
            'rule' => $blocked->rule,
            'customer_id' => $blocked->type === BlockType::Phone ? Customer::query()->where('phone', $blocked->value)->value('id') : null,
            'created_at' => $blocked->created_at?->toIso8601ZuluString(),
        ];
    }
}

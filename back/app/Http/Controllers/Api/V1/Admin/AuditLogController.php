<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What the admins did, newest first (read only). A store's history = rows aimed at the store
 * plus rows about its payments (they carry the store in meta.tenant_id).
 */
final class AuditLogController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'tenant' => ['nullable', 'integer', 'min:1'],
            'action' => ['nullable', 'string', 'max:60', 'regex:/^[a-z_.]+$/'],
        ]);
        $tenant = $request->integer('tenant');
        $action = (string) $request->query('action', '');

        $page = AdminAuditLog::query()
            ->with('admin:id,name')
            ->when($tenant > 0, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where(fn (Builder $t) => $t->where('target_type', 'tenant')->where('target_id', (string) $tenant))
                ->orWhere('meta->tenant_id', $tenant)))
            ->when($action !== '', fn (Builder $q) => $q->where('action', 'like', addcslashes($action, '%_\\').'%'))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        $tenantIds = $page->getCollection()
            ->map(fn (AdminAuditLog $log) => $log->target_type === 'tenant' ? (int) $log->target_id : (int) ($log->meta['tenant_id'] ?? 0))
            ->filter()->unique()->values();
        $names = Tenant::query()->whereIn('id', $tenantIds)->pluck('name', 'id');

        return $this->ok(
            $page->getCollection()->map(function (AdminAuditLog $log) use ($names): array {
                $tenantId = $log->target_type === 'tenant' ? (int) $log->target_id : (int) ($log->meta['tenant_id'] ?? 0);

                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'target_type' => $log->target_type,
                    'target_id' => $log->target_id,
                    'tenant' => $tenantId > 0 ? ['id' => $tenantId, 'name' => (string) ($names[$tenantId] ?? '')] : null,
                    'meta' => $log->meta,
                    'admin' => $log->admin ? ['id' => $log->admin->id, 'name' => $log->admin->name] : null,
                    'ip' => $log->ip,
                    'created_at' => $log->created_at?->toIso8601ZuluString(),
                ];
            })->values()->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        );
    }
}

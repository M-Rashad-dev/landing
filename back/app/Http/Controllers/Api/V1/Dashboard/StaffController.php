<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Auth\PermissionCatalog;
use App\Auth\StaffAccounts;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Rules\EgyptPhone;
use App\Services\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/** «الإعدادات ← الموظفين» and «سجل النشاط». */
final class StaffController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly StaffAccounts $staff) {}

    public function index(): JsonResponse
    {
        return $this->ok($this->staff->list()->map(fn (User $u) => $this->view($u))->values()->all());
    }

    /** The permission tree for the form (pages → actions), with what the signed-in person can give. */
    public function permissions(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $groups = [];
        foreach (PermissionCatalog::PAGES as $page => $def) {
            $groups[] = [
                'page' => $page,
                'label' => $def['label'],
                'group' => $def['group'],
                'actions' => array_map(fn (string $action) => ['key' => $page.'.'.$action, 'label' => $def['actions'][$action], 'grantable' => $actor->allows($page.'.'.$action)], array_keys($def['actions'])),
            ];
        }

        return $this->ok($groups);
    }

    public function store(Request $request, PhoneNormalizer $phones): JsonResponse
    {
        if (is_string($request->input('phone'))) {
            $request->merge(['phone_e164' => $phones->normalize($request->input('phone'))]);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:191', Rule::unique('users', 'email')],
            'phone' => ['required', 'string', 'max:30', new EgyptPhone],
            'phone_e164' => ['nullable', Rule::unique('users', 'phone')],
            'permissions' => ['present', 'array', 'max:200'],
            'permissions.*' => ['string', 'max:60'],
        ], ['phone_e164.unique' => __('staff.phone_taken'), 'email.unique' => __('staff.email_taken')]);
        /** @var User $actor */
        $actor = $request->user();
        $user = $this->staff->add($actor, ['name' => trim(strip_tags($data['name'])), 'email' => mb_strtolower(trim($data['email'])), 'phone' => $data['phone'], 'permissions' => $data['permissions']]);

        return $this->created($this->view($user->load('permissions')));
    }

    public function update(Request $request, int $staff): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:100'],
            'permissions' => ['present', 'array', 'max:200'],
            'permissions.*' => ['string', 'max:60'],
        ]);
        /** @var User $actor */
        $actor = $request->user();
        $user = $this->staff->update($actor, $this->staff->find($staff), [...(isset($data['name']) ? ['name' => trim(strip_tags($data['name']))] : []), 'permissions' => $data['permissions']]);

        return $this->ok($this->view($user->load('permissions')));
    }

    public function toggle(Request $request, int $staff): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        return $this->ok($this->view($this->staff->toggle($actor, $this->staff->find($staff))->load('permissions')));
    }

    public function resend(int $staff): JsonResponse
    {
        $this->staff->invite($this->staff->find($staff));

        return $this->ok(['sent' => true]);
    }

    public function destroy(Request $request, int $staff): Response
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->staff->delete($actor, $this->staff->find($staff));

        return $this->noContent();
    }

    /** «سجل النشاط»: newest first, by person / page / day. */
    public function activity(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'area' => ['nullable', 'string', 'max:30'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $rows = ActivityLog::query()->with('user:id,name')
            ->when(isset($data['user_id']), fn ($q) => $q->where('user_id', (int) $data['user_id']))
            ->when(isset($data['area']), fn ($q) => $q->where('permission', 'like', addcslashes((string) $data['area'], '%_').'.%'))
            ->when(isset($data['from']), fn ($q) => $q->where('created_at', '>=', $data['from']))
            ->when(isset($data['to']), fn ($q) => $q->where('created_at', '<=', $data['to'].' 23:59:59'))
            ->orderByDesc('id')->paginate(30);

        return $this->ok(
            collect($rows->items())->map(fn (ActivityLog $l) => [
                'id' => $l->id,
                'user' => $l->user?->name,
                'summary' => $l->summary,
                'permission' => $l->permission,
                'created_at' => $l->created_at->toIso8601ZuluString(),
            ])->all(),
            ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total()],
        );
    }

    /** @return array<string, mixed> */
    private function view(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'state' => $user->locked_by_plan ? 'locked' : (! $user->is_active ? 'stopped' : ($user->accepted_at === null ? 'invited' : 'active')),
            'permissions' => $user->permissions->pluck('name')->values()->all(),
            'invited_at' => $user->invited_at?->toIso8601ZuluString(),
            'last_login_at' => $user->last_login_at?->toIso8601ZuluString(),
        ];
    }
}

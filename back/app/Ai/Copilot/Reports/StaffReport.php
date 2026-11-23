<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ReportResult;
use App\Auth\PermissionCatalog;
use App\Auth\StaffAccounts;
use App\Models\ActivityLog;
use App\Models\User;

/** «الموظفين»: the store's staff, their state and permissions, and what they did lately (the activity log). */
final class StaffReport extends CopilotReport
{
    public function __construct(private readonly StaffAccounts $staff) {}

    public function key(): string
    {
        return 'staff';
    }

    public function label(): string
    {
        return 'الموظفين وسجل النشاط';
    }

    public function summary(): string
    {
        return 'The store\'s staff accounts (name, state: invited / active / stopped / locked by the plan, permissions per page) and the latest activity log lines (who changed what, when). Staff are added and their permissions set on /dashboard/settings/staff.';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => ['activity' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 100, 'description' => 'Latest activity lines, default 20.']]];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $rows = $this->staff->list()->map(fn (User $u) => [
            'name' => $u->name,
            'state' => $u->locked_by_plan ? 'متوقف بسبب الباقة' : (! $u->is_active ? 'متوقف' : ($u->accepted_at === null ? 'مستني يعمل كلمة السر' : 'شغال')),
            'permissions' => $u->permissions->pluck('name')->map(fn (string $p) => PermissionCatalog::label($p))->implode('، '),
            'last_login' => $u->last_login_at?->toDateTimeString() ?? '—',
        ])->values()->all();
        $activity = ActivityLog::query()->with('user:id,name')->orderByDesc('id')->limit(max(0, min(100, (int) ($params['activity'] ?? 20))))->get()
            ->map(fn (ActivityLog $l) => ['who' => $l->user?->name ?? '—', 'what' => $l->summary, 'at' => $l->created_at->toDateTimeString()])->all();

        return new ReportResult(
            summary: ['staff' => count($rows), 'latest_activity' => $activity],
            title: 'الموظفين',
            columns: [
                ['key' => 'name', 'label' => 'الاسم', 'kind' => 'text'],
                ['key' => 'state', 'label' => 'الحالة', 'kind' => 'text'],
                ['key' => 'permissions', 'label' => 'الصلاحيات', 'kind' => 'text'],
                ['key' => 'last_login', 'label' => 'آخر دخول', 'kind' => 'text'],
            ],
            rows: $rows,
        );
    }
}

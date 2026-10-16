<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Data\EmployeeFilters;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Services\EmployeeDirectory;
use App\Http\Controllers\Controller;
use App\Http\Presenters\EmployeePresenter;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Admin › Karyawan for the Android app (Bagian 5 / B5-B), read-only: the web
 * list (EmployeeDirectory + EmployeeFilters, User::visibleTo) and profile
 * (EmployeePresenter). Same UserPolicy as the web — HR, Direksi, Super Admin
 * see the company, a Kepala Divisi their division, staff get 403. NIK
 * (masked), password status and the change history only for people who
 * manage employees (HR, Super Admin); Direksi sees the profile without them.
 * Adding/editing/importing and "Atur kata sandi" stay on the desktop.
 */
class EmployeeController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, EmployeeDirectory $directory): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        $filters = EmployeeFilters::fromRequest($request);
        $page = $directory->paginate($user, $filters);
        $canManage = Gate::allows('manage', User::class);
        $canDecideResets = Gate::allows('viewAny', PasswordResetRequest::class);

        return response()->json([
            'employees' => array_map(fn (User $employee): array => EmployeePresenter::row($employee, $user), $page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'from' => $page->firstItem(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'to' => $page->lastItem(),
                'total' => $page->total(),
            ],
            'filters' => $filters->toArray(),
            'counts' => $directory->counts($user),
            'divisions' => $this->divisionOptions($user, $directory),
            'options' => [
                'roles' => Role::options(),
                'statuses' => UserStatus::options(),
                'work_modes' => WorkMode::options(),
                'sorts' => EmployeeFilters::SORTS,
                'per_page' => EmployeeFilters::PER_PAGE,
            ],
            'password_resets_pending' => $canDecideResets
                ? PasswordResetRequest::query()->visibleTo($user)->awaitingDecision()->count()
                : null,
            'can' => [
                'manage' => $canManage,
                'decide_password_resets' => $canDecideResets,
            ],
            'web_path' => '/admin/karyawan',
        ]);
    }

    public function show(User $employee, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        // Outside the viewer's scope: 404 so the account's existence does not leak.
        abort_unless(Gate::allows('view', $employee), 404);

        $employee->load([
            'division:id,name,code,head_user_id', 'division.head:id,name',
            'team:id,name,lead_user_id', 'team.lead:id,name',
            'position:id,name,level', 'manager:id,name,avatar_url,position_id', 'manager.position:id,name',
            'profile', 'roles:id,name',
        ]);

        $canManage = Gate::allows('manage', User::class);
        $profile = $employee->profile;
        $canSetPassword = Gate::allows('setPassword', $employee);
        $privileged = $employee->hasAnyRole(Role::superAdminSetsPassword());

        return response()->json([
            'employee' => [
                ...EmployeePresenter::row($employee, $user),
                'manager' => $employee->manager === null ? null : EmployeePresenter::managerOption($employee->manager),
                'division_head' => $employee->division?->head?->only(['id', 'name']),
                'team_lead' => $employee->team?->lead?->only(['id', 'name']),
                'last_login_at' => $employee->last_login_at?->toIso8601String(),
                'deactivated_at' => $employee->deactivated_at?->toIso8601String(),
                'employee_number' => $profile?->employee_number,
                'phone' => $profile?->phone,
                // Masked, never in clear; only for HR / Super Admin (Direksi: null).
                'nik_masked' => $canManage ? EmployeePresenter::maskNik($profile?->nik) : null,
                'has_password' => $canManage ? $employee->password !== null : null,
                'password_change_required' => $canManage ? (bool) $employee->password_change_required : null,
            ],
            'direct_reports' => $employee->directReports()
                ->visibleTo($user)
                ->with('position:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'avatar_url', 'position_id', 'status'])
                ->map(fn (User $report): array => [
                    'id' => $report->id,
                    'name' => $report->name,
                    'avatar_url' => $report->avatar_url,
                    'position' => $report->position?->name,
                    'status' => $report->status->value,
                ])->all(),
            'audit' => $canManage
                ? AuditLog::query()
                    ->where('auditable_type', $employee->getMorphClass())
                    ->where('auditable_id', $employee->id)
                    ->with('user:id,name')
                    ->latest('created_at')
                    ->orderByDesc('id')
                    ->limit(15)
                    ->get()
                    ->map(fn (AuditLog $log): array => EmployeePresenter::auditEntry($log))
                    ->all()
                : null,
            'password_reset' => $this->pendingReset($user, $employee),
            // Audit R-06: Direksi/HR/Super Admin passwords are set by a Super Admin only.
            'password_rule' => $canManage && $privileged && ! $user->isSuperAdmin()
                ? 'Kata sandi akun Direksi, HR, dan Super Admin hanya bisa diatur oleh Super Admin.'
                : null,
            'can' => [
                'manage' => $canManage,
                'update' => Gate::allows('update', $employee),
                'deactivate' => Gate::allows('deactivate', $employee),
                // "Atur kata sandi" is desktop-only: the app shows the banner when true.
                'set_password' => $canSetPassword,
                'decide_password_reset' => Gate::allows('viewAny', PasswordResetRequest::class),
                // Opens Absensi › Rekap for this person (GET /absensi/tim/rekap/{id}).
                'view_attendance' => Gate::allows('viewTeam', AttendanceDay::class)
                    && AttendanceDay::visibleUserIds($user)->whereKey($employee->id)->exists(),
            ],
            'web_path' => '/admin/karyawan/'.$employee->id,
        ]);
    }

    /**
     * The employee's "Lupa kata sandi" request awaiting a decision the viewer
     * may take, or null.
     *
     * @return array<string, mixed>|null
     */
    private function pendingReset(User $viewer, User $employee): ?array
    {
        if (Gate::denies('viewAny', PasswordResetRequest::class)) {
            return null;
        }

        $request = PasswordResetRequest::query()
            ->visibleTo($viewer)
            ->awaitingDecision()
            ->where('user_id', $employee->id)
            ->with('user:id,name,avatar_url')
            ->oldest()
            ->first();

        return $request === null ? null : EmployeePresenter::passwordReset($request);
    }

    /**
     * Same as the web filter: every division for company-wide viewers,
     * otherwise only the ones the viewer leads.
     *
     * @return list<array{id: string, name: string, code: string, count: int}>
     */
    private function divisionOptions(User $user, EmployeeDirectory $directory): array
    {
        $counts = $directory->countsByDivision($user);
        $query = Division::query()->visibleTo($user)->orderBy('name');

        if (! $user->hasPermission(Permission::EmployeesView)) {
            $query->whereIn('id', $user->ledDivisionIds());
        }

        return array_values($query->get(['id', 'name', 'code'])
            ->map(fn (Division $division): array => [
                'id' => $division->id,
                'name' => $division->name,
                'code' => $division->code,
                'count' => $counts[$division->id] ?? 0,
            ])->all());
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Auth\Services\DefaultPassword;
use App\Domain\Organization\Actions\CreateEmployee;
use App\Domain\Organization\Actions\DeactivateEmployee;
use App\Domain\Organization\Actions\ReactivateEmployee;
use App\Domain\Organization\Actions\UpdateEmployee;
use App\Domain\Organization\Data\EmployeeFilters;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Services\EmployeeDirectory;
use App\Http\Controllers\Controller;
use App\Http\Presenters\EmployeePresenter;
use App\Http\Requests\Admin\DeactivateEmployeeRequest;
use App\Http\Requests\Admin\ReactivateEmployeeRequest;
use App\Http\Requests\Admin\StoreEmployeeRequest;
use App\Http\Requests\Admin\UpdateEmployeeRequest;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\PasswordResetRequest;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Karyawan. HR & Super Admin manage; Direksi and Kepala Divisi read
 * (scoped by User::visibleTo); Anggota get 403.
 */
class EmployeeController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, EmployeeDirectory $directory): Response
    {
        Gate::authorize('viewAny', User::class);

        $filters = EmployeeFilters::fromRequest($request);
        $page = $directory->paginate($user, $filters);
        $canManage = Gate::allows('manage', User::class);

        return Inertia::render('admin/employees/index', [
            'employees' => [
                'data' => array_map(fn (User $employee): array => EmployeePresenter::row($employee, $user), $page->items()),
                'meta' => [
                    'current_page' => $page->currentPage(),
                    'last_page' => $page->lastPage(),
                    'per_page' => $page->perPage(),
                    'total' => $page->total(),
                    'from' => $page->firstItem(),
                    'to' => $page->lastItem(),
                ],
            ],
            'filters' => $filters->toArray(),
            'counts' => $directory->counts($user),
            'divisions' => $this->divisionOptions($user, $directory),
            'options' => [
                'roles' => Role::options(),
                'workModes' => WorkMode::options(),
                'statuses' => UserStatus::options(),
            ],
            'can' => [
                'manage' => $canManage,
                // Only a Super Admin grants/revokes super_admin, direksi and hr (UserPolicy::assignRole).
                'assignPrivilegedRoles' => $user->isSuperAdmin(),
            ],
            'companyDomain' => Company::query()->findOrFail($user->company_id)->google_domain,
            'formOptions' => fn (): ?array => $canManage ? $this->formOptions($user) : null,
            'editing' => fn (): ?array => $this->editing($request, $user),
            'passwordResets' => fn (): array => $this->passwordResets($user),
        ]);
    }

    public function show(User $employee, #[CurrentUser] User $user): Response
    {
        Gate::authorize('viewAny', User::class);
        Gate::authorize('view', $employee);

        $employee->load([
            'division:id,name,code,head_user_id', 'division.head:id,name',
            'team:id,name,lead_user_id', 'team.lead:id,name',
            'position:id,name,level', 'manager:id,name,avatar_url,position_id', 'manager.position:id,name',
            'profile', 'roles:id,name',
        ]);

        $canManage = Gate::allows('manage', User::class);
        $profile = $employee->profile;

        return Inertia::render('admin/employees/show', [
            'employee' => [
                ...EmployeePresenter::row($employee, $user),
                'manager' => $employee->manager === null ? null : EmployeePresenter::managerOption($employee->manager),
                'division_head' => $employee->division?->head?->only(['id', 'name']),
                'team_lead' => $employee->team?->lead?->only(['id', 'name']),
                'last_login_at' => $employee->last_login_at?->toIso8601String(),
                'employee_number' => $profile?->employee_number,
                'phone' => $profile?->phone,
                'nik_masked' => $canManage ? EmployeePresenter::maskNik($profile?->nik) : null,
            ],
            'directReports' => $employee->directReports()
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
            'options' => [
                'roles' => Role::options(),
                'workModes' => WorkMode::options(),
                'statuses' => UserStatus::options(),
            ],
            'can' => [
                'manage' => $canManage,
                'update' => Gate::allows('update', $employee),
                'deactivate' => Gate::allows('deactivate', $employee),
                'setPassword' => Gate::allows('setPassword', $employee),
                // "Sandi bawaan" option of Atur kata sandi (EMPLOYEE_DEFAULT_PASSWORD set, not a Super Admin).
                'setDefaultPassword' => Gate::allows('setPassword', $employee) && app(DefaultPassword::class)->appliesTo($employee),
            ],
            'passwordReset' => fn (): ?array => $this->passwordResets($user, $employee)[0] ?? null,
            'hasPassword' => $canManage ? $employee->password !== null : null,
        ]);
    }

    public function store(StoreEmployeeRequest $request, #[CurrentUser] User $user, CreateEmployee $createEmployee): RedirectResponse
    {
        Gate::authorize('create', User::class);

        $employee = $createEmployee->handle($user, $request->employeeData());

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$employee->name} ditambahkan sebagai karyawan."]);

        return $this->backToList($request);
    }

    public function update(UpdateEmployeeRequest $request, User $employee, #[CurrentUser] User $user, UpdateEmployee $updateEmployee): RedirectResponse
    {
        Gate::authorize('update', $employee);

        $updateEmployee->handle($user, $employee, $request->employeeData());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Data {$employee->name} disimpan."]);

        return $this->backToList($request);
    }

    public function deactivate(DeactivateEmployeeRequest $request, User $employee, #[CurrentUser] User $user, DeactivateEmployee $deactivateEmployee): RedirectResponse
    {
        Gate::authorize('deactivate', $employee);

        $moved = $deactivateEmployee->handle($user, $employee, $request->status(), $request->reason(), $request->boolean('reassign_reports'));

        $message = "{$employee->name} dinonaktifkan.";

        if ($moved > 0) {
            $message .= " {$moved} bawahan langsung dipindahkan ke atasannya.";
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return $this->backToList($request);
    }

    public function reactivate(ReactivateEmployeeRequest $request, User $employee, #[CurrentUser] User $user, ReactivateEmployee $reactivateEmployee): RedirectResponse
    {
        Gate::authorize('deactivate', $employee);

        $reactivateEmployee->handle($user, $employee, $request->reason());

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$employee->name} diaktifkan kembali."]);

        return $this->backToList($request);
    }

    /**
     * "Lupa kata sandi" requests awaiting a decision that the viewer may decide
     * (all, or one employee's), oldest first.
     *
     * @return list<array<string, mixed>>
     */
    private function passwordResets(User $user, ?User $employee = null): array
    {
        if (Gate::denies('viewAny', PasswordResetRequest::class)) {
            return [];
        }

        return array_values(PasswordResetRequest::query()
            ->visibleTo($user)
            ->awaitingDecision()
            ->when($employee !== null, fn ($query) => $query->where('user_id', $employee?->id))
            ->with('user:id,name,avatar_url')
            ->oldest()
            ->limit(50)
            ->get()
            ->map(fn (PasswordResetRequest $request): array => EmployeePresenter::passwordReset($request))
            ->all());
    }

    /**
     * Back to where the action started, without the `edit` query (closes the panel).
     */
    private function backToList(Request $request): RedirectResponse
    {
        $previous = url()->previous();
        $parts = parse_url($previous);
        $path = $parts['path'] ?? '';

        if (! str_starts_with($path, '/admin/karyawan')) {
            return to_route('admin.employees.index');
        }

        parse_str($parts['query'] ?? '', $query);
        unset($query['edit'], $query['create']);

        return redirect()->to($path.($query === [] ? '' : '?'.http_build_query($query)));
    }

    /**
     * Divisions for the filter: every division for company-wide viewers, otherwise
     * only the ones the viewer leads.
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

    /**
     * Select options of the create/edit form.
     *
     * @return array<string, mixed>
     */
    private function formOptions(User $user): array
    {
        return [
            'teams' => Team::query()->visibleTo($user)->orderBy('name')->get(['id', 'name', 'division_id'])
                ->map(fn (Team $team): array => $team->only(['id', 'name', 'division_id']))->all(),
            'positions' => Position::query()->visibleTo($user)->orderBy('level')->orderBy('name')->get(['id', 'name', 'level'])
                ->map(fn (Position $position): array => $position->only(['id', 'name', 'level']))->all(),
            'managers' => User::query()->visibleTo($user)->active()->with('position:id,name')->orderBy('name')
                ->get(['id', 'name', 'avatar_url', 'position_id'])
                ->map(fn (User $manager): array => EmployeePresenter::managerOption($manager))->all(),
            // New employees get the company default password (never Super Admins).
            'defaultPassword' => app(DefaultPassword::class)->enabled(),
        ];
    }

    /**
     * The employee opened in the edit panel (`?edit={id}`), when allowed.
     *
     * @return array<string, mixed>|null
     */
    private function editing(Request $request, User $user): ?array
    {
        $id = $request->string('edit')->toString();

        if ($id === '') {
            return null;
        }

        $employee = User::query()->visibleTo($user)->with(['division', 'team', 'position', 'roles'])->find($id);

        if ($employee === null || Gate::denies('update', $employee)) {
            return null;
        }

        return EmployeePresenter::form($employee, $user);
    }
}

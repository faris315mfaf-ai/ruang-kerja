<?php

namespace App\Http\Controllers\RoleDashboards;

use App\Domain\Requests\Actions\ApproveStep;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\RequestRevision;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\RoleDashboards\DecideFromRoleDashboardRequest;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Approvals from the Direktur and HR job dashboards: the Fase 1 actions
 * (ApproveStep / RejectStep / RequestRevision) behind EmployeeRequestPolicy::decide,
 * so notifications, balances, attendance effects and audit stay identical
 * to /persetujuan. Back to the dashboard afterwards.
 */
class RoleApprovalController extends Controller
{
    public function approve(DecideFromRoleDashboardRequest $form, #[CurrentUser] User $user, DashboardRole $role, EmployeeRequest $employeeRequest, ApproveStep $approve): RedirectResponse
    {
        $this->authorizeDecision($role, $employeeRequest);

        $request = $approve->handle($user, $employeeRequest, $form->note());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Pengajuan {$request->number} disetujui."]);

        return back();
    }

    public function reject(DecideFromRoleDashboardRequest $form, #[CurrentUser] User $user, DashboardRole $role, EmployeeRequest $employeeRequest, RejectStep $reject): RedirectResponse
    {
        $this->authorizeDecision($role, $employeeRequest);

        $request = $reject->handle($user, $employeeRequest, (string) $form->note());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Pengajuan {$request->number} ditolak."]);

        return back();
    }

    public function revise(DecideFromRoleDashboardRequest $form, #[CurrentUser] User $user, DashboardRole $role, EmployeeRequest $employeeRequest, RequestRevision $revision): RedirectResponse
    {
        $this->authorizeDecision($role, $employeeRequest);

        $request = $revision->handle($user, $employeeRequest, (string) $form->note());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Revisi diminta untuk {$request->number}."]);

        return back();
    }

    private function authorizeDecision(DashboardRole $role, EmployeeRequest $request): void
    {
        Gate::authorize('viewRoleDashboard', $role);
        abort_unless($role->decidesRequests(), 404);
        Gate::authorize('decide', $request);
    }
}

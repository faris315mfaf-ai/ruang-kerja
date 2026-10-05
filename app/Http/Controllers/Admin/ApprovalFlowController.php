<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Requests\Actions\DeleteApprovalFlow;
use App\Domain\Requests\Actions\SaveApprovalFlow;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveApprovalFlowRequest;
use App\Models\ApprovalFlow;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ApprovalFlowController extends Controller
{
    public function store(SaveApprovalFlowRequest $form, #[CurrentUser] User $user, SaveApprovalFlow $save): RedirectResponse
    {
        Gate::authorize('create', ApprovalFlow::class);

        $flow = $save->handle($user, $form->flowData());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Alur {$flow->name} disimpan."]);

        return to_route('admin.request-types.index', ['jenis' => $form->input('leave_type_id')]);
    }

    public function update(SaveApprovalFlowRequest $form, #[CurrentUser] User $user, ApprovalFlow $approvalFlow, SaveApprovalFlow $save): RedirectResponse
    {
        Gate::authorize('update', $approvalFlow);

        $save->handle($user, $form->flowData(), $approvalFlow);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Alur {$approvalFlow->name} disimpan."]);

        return to_route('admin.request-types.index', ['jenis' => $form->input('leave_type_id')]);
    }

    public function destroy(#[CurrentUser] User $user, ApprovalFlow $approvalFlow, DeleteApprovalFlow $delete): RedirectResponse
    {
        Gate::authorize('delete', $approvalFlow);

        $delete->handle($user, $approvalFlow);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Alur {$approvalFlow->name} dihapus."]);

        return to_route('admin.request-types.index');
    }
}

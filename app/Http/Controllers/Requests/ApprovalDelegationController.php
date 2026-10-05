<?php

namespace App\Http\Controllers\Requests;

use App\Domain\Requests\Actions\DeleteApprovalDelegation;
use App\Domain\Requests\Actions\SaveApprovalDelegation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Requests\SaveApprovalDelegationRequest;
use App\Models\ApprovalDelegation;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ApprovalDelegationController extends Controller
{
    public function store(SaveApprovalDelegationRequest $form, #[CurrentUser] User $user, SaveApprovalDelegation $save): RedirectResponse
    {
        Gate::authorize('create', ApprovalDelegation::class);

        $delegation = $save->handle($user, $form->delegationData());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Persetujuan Anda didelegasikan ke {$delegation->delegate->name}."]);

        return back();
    }

    public function destroy(#[CurrentUser] User $user, ApprovalDelegation $delegation, DeleteApprovalDelegation $delete): RedirectResponse
    {
        Gate::authorize('delete', $delegation);

        $delete->handle($user, $delegation);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Delegasi dihentikan.']);

        return back();
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Requests\Actions\DeleteLeaveType;
use App\Domain\Requests\Actions\SaveLeaveType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveLeaveTypeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class LeaveTypeController extends Controller
{
    public function store(SaveLeaveTypeRequest $form, #[CurrentUser] User $user, SaveLeaveType $save): RedirectResponse
    {
        Gate::authorize('create', LeaveType::class);

        $type = $save->handle($user, $form->validated());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Jenis {$type->name} dibuat."]);

        return to_route('admin.request-types.index', ['jenis' => $type->id]);
    }

    public function update(SaveLeaveTypeRequest $form, #[CurrentUser] User $user, LeaveType $leaveType, SaveLeaveType $save): RedirectResponse
    {
        Gate::authorize('update', $leaveType);

        $save->handle($user, $form->validated(), $leaveType);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Jenis {$leaveType->name} disimpan."]);

        return to_route('admin.request-types.index', ['jenis' => $leaveType->id]);
    }

    public function destroy(#[CurrentUser] User $user, LeaveType $leaveType, DeleteLeaveType $delete): RedirectResponse
    {
        Gate::authorize('delete', $leaveType);

        $delete->handle($user, $leaveType);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Jenis {$leaveType->name} dihapus."]);

        return to_route('admin.request-types.index');
    }
}

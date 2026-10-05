<?php

namespace App\Http\Controllers\Attendance\Admin;

use App\Domain\Attendance\Actions\DeleteShift;
use App\Domain\Attendance\Actions\SaveShift;
use App\Domain\Attendance\Models\Shift;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\ShiftRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ShiftController extends Controller
{
    public function store(ShiftRequest $request, #[CurrentUser] User $user, SaveShift $save): RedirectResponse
    {
        Gate::authorize('create', Shift::class);

        $shift = $save->handle($user, $request->attributesForAction());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Shift {$shift->name} ditambahkan."]);

        return back();
    }

    public function update(ShiftRequest $request, Shift $shift, #[CurrentUser] User $user, SaveShift $save): RedirectResponse
    {
        Gate::authorize('update', $shift);

        $save->handle($user, $request->attributesForAction(), $shift);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Shift disimpan.']);

        return back();
    }

    public function destroy(Shift $shift, DeleteShift $delete): RedirectResponse
    {
        Gate::authorize('delete', $shift);

        $delete->handle($shift);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Shift {$shift->name} dihapus."]);

        return back();
    }
}

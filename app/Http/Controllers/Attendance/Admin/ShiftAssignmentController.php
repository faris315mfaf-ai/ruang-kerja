<?php

namespace App\Http\Controllers\Attendance\Admin;

use App\Domain\Attendance\Actions\AssignShiftPattern;
use App\Domain\Attendance\Actions\DeleteShiftAssignment;
use App\Domain\Attendance\Actions\SaveShiftOverride;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\WorkMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\AssignShiftPatternRequest;
use App\Http\Requests\Attendance\ShiftOverrideRequest;
use App\Http\Resources\Attendance\ShiftAssignmentData;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Penugasan shift: weekly patterns (bulk per employee or division)
 * and per-date overrides.
 */
class ShiftAssignmentController extends Controller
{
    public function index(#[CurrentUser] User $user, ShiftAssignmentData $data): Response
    {
        Gate::authorize('viewAny', ShiftAssignment::class);

        return Inertia::render('admin/attendance/assignments', [
            'employees' => $data->employees($user),
            'divisions' => $data->divisions($user),
            'shifts' => $data->shifts($user),
            'workModes' => WorkMode::options(),
        ]);
    }

    public function store(AssignShiftPatternRequest $request, #[CurrentUser] User $user, AssignShiftPattern $assign): RedirectResponse
    {
        Gate::authorize('create', ShiftAssignment::class);

        $employees = $request->employees($user);

        if ($employees->isEmpty()) {
            throw ValidationException::withMessages(['user_ids' => 'Tidak ada karyawan aktif yang dipilih.']);
        }

        foreach ($employees as $employee) {
            Gate::authorize('create', [ShiftAssignment::class, $employee]);
        }

        $count = $assign->handle(
            $employees,
            $request->shift(),
            $request->weekdays(),
            $request->validFrom(),
            $request->validUntil(),
            $request->workModeOverride(),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "Pola shift diterapkan ke {$count} karyawan."]);

        return back();
    }

    public function override(ShiftOverrideRequest $request, SaveShiftOverride $save): RedirectResponse
    {
        $employee = $request->employee();

        Gate::authorize('create', [ShiftAssignment::class, $employee]);

        $save->handle($employee, $request->overrideDate(), $request->shift(), $request->workModeOverride());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Jadwal khusus {$employee->name} disimpan."]);

        return back();
    }

    public function destroy(ShiftAssignment $shiftAssignment, DeleteShiftAssignment $delete): RedirectResponse
    {
        Gate::authorize('delete', $shiftAssignment);

        $delete->handle($shiftAssignment);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Penugasan dihapus.']);

        return back();
    }
}

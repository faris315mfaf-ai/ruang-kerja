<?php

namespace App\Http\Controllers\Attendance\Admin;

use App\Domain\Attendance\Actions\DeleteHoliday;
use App\Domain\Attendance\Actions\ImportHolidays;
use App\Domain\Attendance\Actions\SaveHoliday;
use App\Domain\Attendance\Models\Holiday;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\HolidayImportRequest;
use App\Http\Requests\Attendance\HolidayRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class HolidayController extends Controller
{
    public function store(HolidayRequest $request, #[CurrentUser] User $user, SaveHoliday $save): RedirectResponse
    {
        Gate::authorize('create', Holiday::class);

        $holiday = $save->handle($user, $request->holidayDate(), $request->string('name')->toString(), $request->type());

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$holiday->name} ditambahkan."]);

        return back();
    }

    public function update(HolidayRequest $request, Holiday $holiday, #[CurrentUser] User $user, SaveHoliday $save): RedirectResponse
    {
        Gate::authorize('update', $holiday);

        $save->handle($user, $request->holidayDate(), $request->string('name')->toString(), $request->type(), $holiday);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Hari libur disimpan.']);

        return back();
    }

    public function destroy(Holiday $holiday, DeleteHoliday $delete): RedirectResponse
    {
        Gate::authorize('delete', $holiday);

        $delete->handle($holiday);

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$holiday->name} dihapus."]);

        return back();
    }

    /**
     * CSV import, all-or-nothing; errors are reported per line.
     */
    public function import(HolidayImportRequest $request, #[CurrentUser] User $user, ImportHolidays $import): RedirectResponse
    {
        Gate::authorize('create', Holiday::class);

        $report = $import->handle($user, $request->csv());

        if ($report->failed()) {
            Inertia::flash('holidayImport', ['errors' => $report->errors]);

            return back()->withErrors(['file' => 'Impor dibatalkan: ada '.count($report->errors).' baris bermasalah.']);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Impor selesai: {$report->created} ditambahkan, {$report->updated} diperbarui.",
        ]);

        return back();
    }
}

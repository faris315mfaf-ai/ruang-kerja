<?php

namespace App\Http\Controllers\Attendance\Admin;

use App\Domain\Attendance\Actions\DeleteOfficeLocation;
use App\Domain\Attendance\Actions\SaveOfficeLocation;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\OfficeLocationRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class OfficeLocationController extends Controller
{
    public function store(OfficeLocationRequest $request, #[CurrentUser] User $user, SaveOfficeLocation $save): RedirectResponse
    {
        Gate::authorize('create', OfficeLocation::class);

        $location = $save->handle($user, $request->attributesForAction());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Lokasi {$location->name} ditambahkan."]);

        return back();
    }

    public function update(OfficeLocationRequest $request, OfficeLocation $officeLocation, #[CurrentUser] User $user, SaveOfficeLocation $save): RedirectResponse
    {
        Gate::authorize('update', $officeLocation);

        $save->handle($user, $request->attributesForAction(), $officeLocation);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Lokasi disimpan.']);

        return back();
    }

    public function destroy(OfficeLocation $officeLocation, DeleteOfficeLocation $delete): RedirectResponse
    {
        Gate::authorize('delete', $officeLocation);

        $delete->handle($officeLocation);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Lokasi {$officeLocation->name} dihapus."]);

        return back();
    }
}

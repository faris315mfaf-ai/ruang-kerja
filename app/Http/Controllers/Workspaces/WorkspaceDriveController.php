<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\CreateDriveFolder;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Http\Controllers\Controller;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Pengaturan › Integrasi Drive › "Sinkronkan ulang" (workspace admins):
 * creates a missing folder or re-applies member permissions (queued).
 */
class WorkspaceDriveController extends Controller
{
    public function sync(Workspace $workspace): RedirectResponse
    {
        Gate::authorize('update', $workspace);
        GoogleFeatures::ensureEnabled();

        if ($workspace->drive_folder_id === null) {
            CreateDriveFolder::dispatch($workspace);
        } else {
            SyncDrivePermissions::dispatch($workspace);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Sinkronisasi akses Drive dijadwalkan.']);

        return back();
    }
}

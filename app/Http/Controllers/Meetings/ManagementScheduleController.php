<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Queries\ManagementSchedule;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /manajemen/jadwal (F2-3): leadership meetings, their minutes and open
 * follow-ups for Direksi, HR and Super Admin (Gate viewManagementDashboard =
 * dashboard.view_company).
 */
class ManagementScheduleController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, ManagementSchedule $schedule): Response
    {
        Gate::authorize('viewManagementDashboard');

        return Inertia::render('meetings/management-schedule', [
            'schedule' => [...$schedule->forUser($user), 'viewer_id' => $user->id],
        ]);
    }
}

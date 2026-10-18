<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Queries\ManagementSchedule;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use DateTimeImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/manajemen/jadwal[?minggu=YYYY-MM-DD] — leadership meetings of
 * the week (and the weeks before, as the web), their minutes and the people
 * they name, read-only. Same query (ManagementSchedule) and gate
 * (viewManagementDashboard = dashboard.view_company: Direksi, HR, Super
 * Admin) as the web /manajemen/jadwal; anyone else gets 403. `minggu` picks
 * the week containing that date (default: this week).
 */
class ManagementScheduleController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, ManagementSchedule $schedule): JsonResponse
    {
        Gate::authorize('viewManagementDashboard');

        return response()->json([
            ...$schedule->forUser($user, $this->week($request)),
            'viewer_id' => $user->id,
        ]);
    }

    private function week(Request $request): ?CarbonImmutable
    {
        $date = $request->query('minggu');

        if (! is_string($date) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1) {
            return null;
        }

        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);

        return $parsed !== false && $parsed->format('Y-m-d') === $date
            ? CarbonImmutable::parse($date.' 12:00', CurrentCompany::timezone())
            : null;
    }
}

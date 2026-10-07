<?php

namespace App\Http\Controllers\Automation;

use App\Domain\Automation\Queries\PersonalPerformance;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /kinerja (own) and /kinerja/{user} (direct manager, HR; PerformancePolicy).
 * `?periode=8-minggu|bulan|kuartal`. Opening someone else's page is audited
 * (`performance.viewed`).
 */
class PerformanceController extends Controller
{
    private const array PERIODS = ['8-minggu' => '8w', 'bulan' => 'month', 'kuartal' => 'quarter'];

    public function show(Request $request, #[CurrentUser] User $user, PersonalPerformance $performance): Response
    {
        Gate::authorize('viewPerformance', $user);

        return $this->render($request, $user, $user, $performance);
    }

    public function user(Request $request, string $subject, #[CurrentUser] User $user, PersonalPerformance $performance, AuditLogger $audit): Response
    {
        $person = User::query()->where('company_id', $user->company_id)->findOrFail($subject);
        Gate::authorize('viewPerformance', $person);

        if (! $person->is($user)) {
            $audit->log('performance.viewed', $person, null, ['period' => $this->period($request)], $user);
        }

        return $this->render($request, $user, $person, $performance);
    }

    private function render(Request $request, User $viewer, User $subject, PersonalPerformance $performance): Response
    {
        return Inertia::render('automation/performance', [
            'performance' => $performance->for($viewer, $subject, $this->period($request), CarbonImmutable::now()),
        ]);
    }

    private function period(Request $request): string
    {
        $value = $request->query('periode');

        return self::PERIODS[is_string($value) ? $value : ''] ?? '8w';
    }
}

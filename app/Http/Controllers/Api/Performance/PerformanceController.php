<?php

namespace App\Http\Controllers\Api\Performance;

use App\Domain\Automation\Queries\PersonalPerformance;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * "Kinerja saya" for the Android app (Bagian 2 / B2-B): PersonalPerformance
 * (PRD M7 output metrics side by side — never a combined score, ADR #8) behind
 * the `viewPerformance` gate (PerformancePolicy: myself; the direct manager
 * and HR see an employee; anyone else gets 404) and the `automation` feature
 * flag, exactly like the web /kinerja. Opening another person's page is
 * audited (`performance.viewed`).
 */
class PerformanceController extends Controller
{
    /** API slug → PersonalPerformance period key. `minggu` is the 8-week view. */
    private const array PERIODS = ['minggu' => '8w', '8-minggu' => '8w', 'bulan' => 'month', 'kuartal' => 'quarter'];

    public function show(Request $request, #[CurrentUser] User $user, PersonalPerformance $performance): JsonResponse
    {
        Gate::authorize('viewPerformance', $user);

        return $this->respond($request, $user, $user, $performance);
    }

    public function user(Request $request, string $subject, #[CurrentUser] User $user, PersonalPerformance $performance, AuditLogger $audit): JsonResponse
    {
        $person = User::query()->where('company_id', $user->company_id)->findOrFail($subject);
        Gate::authorize('viewPerformance', $person);

        if (! $person->is($user)) {
            $audit->log('performance.viewed', $person, null, ['period' => $this->period($request)], $user);
        }

        return $this->respond($request, $user, $person, $performance);
    }

    private function respond(Request $request, User $viewer, User $subject, PersonalPerformance $performance): JsonResponse
    {
        $key = $this->period($request);

        return response()->json([
            'periode' => array_search($key, ['minggu' => '8w', 'bulan' => 'month', 'kuartal' => 'quarter'], true),
            'kinerja' => $performance->for($viewer, $subject, $key, CarbonImmutable::now()),
        ]);
    }

    private function period(Request $request): string
    {
        $value = $request->query('periode');

        return self::PERIODS[is_string($value) ? $value : ''] ?? '8w';
    }
}

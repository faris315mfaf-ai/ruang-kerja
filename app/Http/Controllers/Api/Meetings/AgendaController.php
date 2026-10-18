<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\MeetingSummary;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/rapat — the token owner's meeting agenda, the same
 * MeetingFeed machinery as the web /rapat page (series expanded into
 * occurrences, minutes preloaded, fixed query count) behind three ranges:
 * `hari-ini` (today), `minggu-ini` (the office week Mon–Sun, the default)
 * and `akan-datang` (from now, 30 days ahead). Like the web agenda, this is
 * "rapat saya" — meetings the viewer organizes, takes minutes of or is
 * invited to; a leadership meeting seen only through the permission stays
 * on /manajemen/jadwal (web). Times are UTC ISO instants; the app renders
 * WIB from `server_time` and the instants.
 */
class AgendaController extends Controller
{
    /** Horizon of ?rentang=akan-datang. */
    public const int UPCOMING_DAYS = 30;

    public function __invoke(Request $request, #[CurrentUser] User $user, MeetingFeed $feed, MeetingPolicy $policy): JsonResponse
    {
        Gate::authorize('viewAny', Meeting::class);

        $rentang = $this->rentang($request);
        $now = CarbonImmutable::now();
        $timezone = CurrentCompany::timezone();
        $today = $now->setTimezone($timezone);

        [$from, $to] = match ($rentang) {
            'hari-ini' => [$today->startOfDay(), $today->startOfDay()->addDay()],
            'akan-datang' => [$now, $now->addDays(self::UPCOMING_DAYS)],
            default => [$today->startOfWeek(CarbonImmutable::MONDAY)->startOfDay(), $today->startOfWeek(CarbonImmutable::MONDAY)->startOfDay()->addWeek()], // minggu-ini
        };

        $occurrences = $feed->occurrences(
            Meeting::query()->involving($user)->active(),
            $from->utc(),
            $to->utc(),
        );
        $minutes = $feed->minutesFor($occurrences);
        $names = MeetingSummary::namesFor($occurrences);

        return response()->json([
            'rentang' => $rentang,
            'from' => $from->setTimezone($timezone)->toDateString(),
            'to' => $to->setTimezone($timezone)->subDay()->toDateString(),
            'hari_ini' => $today->toDateString(),
            'server_time' => $now->toIso8601ZuluString(),
            'items' => $occurrences
                ->map(fn ($occurrence): array => MeetingSummary::agenda($occurrence, $minutes[$occurrence->key()] ?? null, $user, $policy, $names, $today->toDateString()))
                ->values()
                ->all(),
        ]);
    }

    /** `hari-ini` · `minggu-ini` (default) · `akan-datang`; anything else falls back to the week. */
    private function rentang(Request $request): string
    {
        $value = $request->query('rentang');

        return is_string($value) && in_array($value, ['hari-ini', 'minggu-ini', 'akan-datang'], true) ? $value : 'minggu-ini';
    }
}

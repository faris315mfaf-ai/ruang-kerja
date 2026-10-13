<?php

namespace App\Http\Controllers\Api\Beranda;

use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\Queries\PersonalDashboard;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Announcements\Queries\AnnouncementFeed;
use App\Domain\Announcements\Services\AnnouncementTargets;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Briefings\Queries\BriefingWindow;
use App\Domain\Briefings\Queries\LatestBriefing;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Reports\Queries\MyDailyReports;
use App\Domain\Tasks\Queries\TugasHariIni;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\MeetingSummary;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Throwable;

/**
 * GET /api/v1/beranda — one aggregated payload for the "Beranda saya" screen
 * of the Android app (Bagian 2 / B2-B). Every section is the web query the
 * personal dashboard already uses (PersonalDashboard, TugasHariIni,
 * LatestBriefing, BriefingWindow, AnnouncementFeed, MyDailyReports,
 * MyAttendance::status, MeetingFeed) — nothing is recomputed here. A section
 * that throws is reported and answered as null with its key in
 * `bagian_gagal`, so the app can show a partial-failure card instead of
 * losing the whole screen. Staff (`isStaffOnly`) never get the annual leave
 * balance (keputusan pemilik 6 Okt 2026).
 */
class BerandaController extends Controller
{
    /** Horizon of the "Rapat berikutnya" card. */
    public const int NEXT_MEETING_DAYS = 30;

    public function __construct(
        private readonly DashboardAccess $access,
        private readonly PersonalDashboard $personal,
        private readonly TugasHariIni $tugasHariIni,
        private readonly LatestBriefing $latestBriefing,
        private readonly BriefingWindow $briefingWindow,
        private readonly AnnouncementFeed $announcements,
        private readonly AnnouncementTargets $announcementTargets,
        private readonly MyDailyReports $reports,
        private readonly MyAttendance $attendance,
        private readonly MeetingFeed $meetings,
        private readonly MeetingPolicy $meetingPolicy,
    ) {}

    public function __invoke(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewDashboard', DashboardView::Personal);

        $now = CarbonImmutable::now();
        $failed = [];
        $preset = self::preset($request->query('periode'));
        $filters = new DashboardFilters(Period::resolve($preset, null, null, $now));
        $staff = $user->isStaffOnly();

        $live = $this->section($failed, 'ringkasan', fn (): array => $this->personal->live($user, $now));
        $card = $this->section($failed, 'briefing_catat', fn (): ?array => $this->briefingWindow->card($user, $now));

        if (is_array($card)) {
            unset($card['urls']); // web paths of the dashboard card; the app uses /briefing and /briefing/delegasi
        }

        $views = $this->access->views($user);
        $default = $this->access->defaultView($user);

        return response()->json([
            'server_time' => $now->toIso8601ZuluString(),
            'today' => Period::officeDate($now)->toDateString(),
            'pengguna' => ['id' => $user->id, 'name' => $user->name, 'is_staff_only' => $staff],
            // Dashboard picker: the app serves saya/divisi/hr; `direksi` is listed
            // but `tersedia` is false until its API exists (Bagian 5).
            'tampilan' => [
                'awal' => $default->value,
                'tersedia' => array_map(fn (DashboardView $view): array => [
                    'key' => $view->value,
                    'label' => $view->label(),
                    'tersedia' => in_array($view, [DashboardView::Personal, DashboardView::Division, DashboardView::Hr], true),
                ], $views),
            ],
            'flags' => [
                'rapat' => (bool) config('features.meetings'),
                'kinerja' => (bool) config('features.automation'),
                'saldo_cuti' => ! $staff,
                'briefing_catat' => $card !== null,
                'pengumuman_buat' => $this->announcementTargets->canAnnounce($user),
            ],
            'attendance_status' => $this->section($failed, 'attendance_status', fn (): ?array => Gate::forUser($user)->allows('viewAny', AttendanceDay::class)
                ? $this->attendance->status($user, $now)
                : null),
            'rapat_berikutnya' => $this->section($failed, 'rapat_berikutnya', fn (): ?array => $this->nextMeeting($user, $now)),
            'tugas_hari_ini' => $this->section($failed, 'tugas_hari_ini', fn (): array => $this->tugasHariIni->for($user, $now)),
            'briefing_terakhir' => $this->section($failed, 'briefing_terakhir', fn (): ?array => $this->latestBriefing->for($user)),
            'briefing_catat' => $card,
            'pengumuman' => $this->section($failed, 'pengumuman', fn (): array => $this->announcements->banner($user)),
            'laporan_hari_ini' => $this->section($failed, 'laporan_hari_ini', fn (): array => $this->reports->status($user, $now)),
            'ringkasan' => $this->section($failed, 'ringkasan', fn (): array => $this->personal->metrics($user, $filters, $now)),
            'profil' => $live['profile'] ?? null,
            // Staff: always null — never queried for them (PersonalDashboard::live).
            'saldo_cuti' => $staff ? null : ($live['leave_balance'] ?? null),
            'pengajuan_terbaru' => $live['requests'] ?? [],
            'bagian_gagal' => array_values(array_unique($failed)),
        ]);
    }

    /**
     * The viewer's next meeting (running or upcoming within 30 days) as the
     * agenda row of GET /rapat; null when the meetings module is off or
     * nothing is scheduled.
     *
     * @return array<string, mixed>|null
     */
    private function nextMeeting(User $user, CarbonImmutable $now): ?array
    {
        if (! config('features.meetings') || ! Gate::forUser($user)->allows('viewAny', Meeting::class)) {
            return null;
        }

        $occurrences = $this->meetings->occurrences(
            Meeting::query()->involving($user)->active(),
            $now,
            $now->addDays(self::NEXT_MEETING_DAYS),
        );

        $next = $occurrences
            ->filter(fn ($occurrence): bool => $occurrence->endsAt->gt($now))
            ->sortBy(fn ($occurrence): int => $occurrence->startsAt->getTimestamp())
            ->first();

        if ($next === null) {
            return null;
        }

        $single = collect([$next]);
        $today = $now->setTimezone(config()->string('app.office_timezone'))->toDateString();

        return MeetingSummary::agenda(
            $next,
            $this->meetings->minutesFor($single)[$next->key()] ?? null,
            $user,
            $this->meetingPolicy,
            MeetingSummary::namesFor($single),
            $today,
        );
    }

    /**
     * Runs one section; a failure is reported and becomes null so the rest
     * of the screen still loads.
     *
     * @template T
     *
     * @param  list<string>  $failed
     * @param  Closure(): T  $callback
     * @return T|null
     */
    private function section(array &$failed, string $key, Closure $callback): mixed
    {
        try {
            return $callback();
        } catch (Throwable $exception) {
            report($exception);
            $failed[] = $key;

            return null;
        }
    }

    /** `minggu` · `bulan` (default) · `kuartal`. */
    private static function preset(mixed $value): PeriodPreset
    {
        $preset = is_string($value) ? PeriodPreset::tryFrom($value) : null;

        return $preset === null || $preset === PeriodPreset::Custom ? PeriodPreset::Month : $preset;
    }
}

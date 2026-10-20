<?php

use App\Domain\Attendance\Jobs\PurgeExpiredSelfiesJob;
use App\Domain\Attendance\Jobs\SendCheckInReminders;
use App\Domain\Auth\Jobs\ExpirePasswordResetRequests;
use App\Domain\Automation\Jobs\CreateRecurringTasks;
use App\Domain\Automation\Jobs\RunOverdueAutomations;
use App\Domain\Hiring\Jobs\PurgeExpiredApplicantData;
use App\Domain\HrHub\Actions\EnsureHrWorkspaces;
use App\Domain\Meetings\Jobs\PruneSpeakingTimes;
use App\Domain\Meetings\Jobs\SendActionItemReminders;
use App\Domain\Meetings\Jobs\SendMeetingReminders;
use App\Domain\Meetings\Transcripts\Jobs\PurgeExpiredMeetingTranscripts;
use App\Domain\Okr\Jobs\SendKeyResultCheckinReminders;
use App\Domain\Projects\Jobs\SendProjectUpdateReminders;
use App\Domain\Projects\Jobs\TakeProjectProgressSnapshots;
use App\Domain\Reports\Jobs\SendDailyReportReminders;
use App\Domain\Tenancy\Scheduling\CompanySchedule;
use App\Domain\Tenancy\Scheduling\LocalTask;
use App\Models\Company;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\CallbackEvent;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Multi-perusahaan (Fase 1, Langkah 2b; docs/ARCHITECTURE.md §3.9):
 *
 * - Work at a local office time (00:30, 07:00, Friday 15:00 …) is a LocalTask of
 *   CompanySchedule: the event fires every five minutes, and the task runs for each
 *   company whose own clock (companies.timezone) has reached that time, once per
 *   company and local date (claimed in scheduled_runs), inside the company's context.
 * - Work at an instant (every 1–5 minutes) runs per company inside the job/command
 *   (ForEachCompany), each in its own timezone.
 * - Retention & infrastructure clean-up stays global (app office timezone).
 */
$companies = app(CompanySchedule::class);
$perCompany = fn (LocalTask $task): CallbackEvent => Schedule::call($task)
    ->name($task->name)
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->onOneServer();

// Requests & approvals (Sprint 4): yearly balances 1 Jan 00.05, delegations 00.10.
$perCompany($companies->daily('requests:generate-balances', '00:05', fn () => Artisan::call('requests:generate-balances'))->yearlyOn(1, 1)->catchUp(23 * 60));
$perCompany($companies->daily('requests:route-delegations', '00:10', fn () => Artisan::call('requests:route-delegations'))->catchUp(12 * 60));
// Sprint 2 — attendance: close the day 00.30; check-in reminders every five minutes (per company inside the job).
$perCompany($companies->daily('attendance:close-day', '00:30', fn () => Artisan::call('attendance:close-day'))->catchUp(12 * 60));
Schedule::job(new SendCheckInReminders)->everyFiveMinutes()->withoutOverlapping()->onOneServer();
// Sprint 3 — selfie retention (monthly) and unscanned kiosk QR codes (daily).
Schedule::job(new PurgeExpiredSelfiesJob)->monthlyOn(1, '02:30')->timezone(config()->string('app.office_timezone'))->onOneServer();
Schedule::command('attendance:prune-qr-tokens')->dailyAt('03:10')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
// Kunci idempotensi API (aplikasi offline-first, 14 Okt 2026): simpan 72 jam.
Schedule::command('api:prune-idempotency')->dailyAt('03:30')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
// Claims of the per-company tasks above.
Schedule::call(fn (): int => $companies->prune())->name('tenancy:prune-scheduled-runs')->dailyAt('03:40')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();

// Sprint 8 — notifications: daily digest at each person's time (per company inside the command).
Schedule::command('notifications:send-daily-digests')->everyFiveMinutes()->withoutOverlapping()->onOneServer();
Schedule::command('notifications:prune')->dailyAt('02:15')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
// Sprint 7 — abandoned chunked uploads to Google Drive.
Schedule::command('ruangkerja:drive-uploads:prune')->dailyAt('03:10')->timezone(config()->string('app.office_timezone'))->onOneServer();

// Sprint 6 — task deadline reminders (H-1 & overdue), 07.00.
$perCompany($companies->daily('tasks:notify-deadlines', '07:00', fn () => Artisan::call('tasks:notify-deadlines')));

// Sprint 1 — uploaded employee import files contain NIK: never keep them past their session.
Schedule::command('employee-imports:prune')->hourly()->withoutOverlapping();

// Sprint 9 — project tracking: burn-up snapshot 23.55 (of the company's office date), PIC reminder Friday 15.00.
// The office date of the run, also when catching up after midnight (LocalTask::dueTarget).
$perCompany($companies->daily(TakeProjectProgressSnapshots::class, '23:55', fn (Company $company, CarbonImmutable $target) => TakeProjectProgressSnapshots::dispatch($target->toDateString())));
$perCompany($companies->daily(SendProjectUpdateReminders::class, '15:00', fn () => SendProjectUpdateReminders::dispatch())->weeklyOn(5));

// F3-3 — OKR: weekly key result check-in reminder, Friday 15.00.
$perCompany($companies->daily(SendKeyResultCheckinReminders::class, '15:00', fn () => SendKeyResultCheckinReminders::dispatch())->weeklyOn(5));
// F2-4 Otomasi: recurring tasks 07.00, "lewat tenggat" rules 07.05 (after the deadline reminders).
$perCompany($companies->daily(CreateRecurringTasks::class, '07:00', fn () => CreateRecurringTasks::dispatch()));
$perCompany($companies->daily(RunOverdueAutomations::class, '07:05', fn () => RunOverdueAutomations::dispatch()));
// F2-3 — meetings (FEATURE_MEETINGS): "rapat segera dimulai" every minute (per company inside the job), follow-up reminders 07.05.
Schedule::job(new SendMeetingReminders)->everyMinute()->when(fn (): bool => (bool) config('features.meetings'))->withoutOverlapping()->onOneServer();
$perCompany($companies->daily(SendActionItemReminders::class, '07:05', fn () => SendActionItemReminders::dispatch()))->when(fn (): bool => (bool) config('features.meetings'));
// Video room "Waktu bicara": expires with the transcript retention (MINUTES_TRANSCRIPT_RETENTION_DAYS).
Schedule::job(new PruneSpeakingTimes)->dailyAt('03:20')->timezone(config()->string('app.office_timezone'))->when(fn (): bool => (bool) config('features.meetings'))->withoutOverlapping()->onOneServer();
// Akun & kata sandi (6 Okt 2026) — expire unanswered "Lupa kata sandi" requests, prune old ones.
Schedule::job(new ExpirePasswordResetRequests)->hourly()->withoutOverlapping()->onOneServer();
// Hiring (keputusan pemilik 6 Okt 2026): applicant data kept 30 days after decision / deletion / position closed.
Schedule::job(new PurgeExpiredApplicantData)->dailyAt('02:30')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
// Laporan progres harian (keputusan pemilik 6 Okt 2026): reminder 16.30 office time on weekdays.
$perCompany($companies->daily(SendDailyReportReminders::class, '16:30', fn () => SendDailyReportReminders::dispatch())->weekdays());
// Notulen otomatis (7 Okt 2026): meeting transcripts deleted after MINUTES_TRANSCRIPT_RETENTION_DAYS (UU PDP).
Schedule::job(new PurgeExpiredMeetingTranscripts)->dailyAt('02:45')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
// Ruang HR (keputusan pemilik 20 Okt 2026): system workspaces Tim HR / Penugasan HR follow the HR role, 01.00.
$perCompany($companies->daily(EnsureHrWorkspaces::class, '01:00', fn (Company $company) => app(EnsureHrWorkspaces::class)->handle($company)));

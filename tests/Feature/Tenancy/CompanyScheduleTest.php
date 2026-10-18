<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Notifications\CheckInReminderNotification;
use App\Domain\Notifications\Digest\DailyDigestMail;
use App\Domain\Organization\Enums\Role;
use App\Domain\Reports\Jobs\SendDailyReportReminders;
use App\Domain\Reports\Notifications\DailyReportReminder;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Notifications\TaskDueSoonNotification;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Scheduling\CompanySchedule;
use App\Domain\Tenancy\Scheduling\ForEachCompany;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Factories\CompanyFactory;
use Database\Seeders\RoleSeeder;
use Illuminate\Console\Scheduling\CallbackEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

/*
 * Fase 1 multi-perusahaan, Langkah 2b: scheduled work runs per company at the
 * company's own local time (companies.timezone), once per company and office
 * date, without touching the other companies.
 *
 * A = Asia/Jakarta (WIB, UTC+7), B = Asia/Makassar (WITA, UTC+8),
 * C = Asia/Jayapura (WIT, UTC+9).
 */

/** Every scheduled entry once, in-process (same approach as BackgroundLeakTest). */
function runScheduleTick(): void
{
    foreach (app(Schedule::class)->events() as $event) {
        if ($event instanceof CallbackEvent) {
            $event->run(app());

            continue;
        }

        if (preg_match("/artisan'?\\s+(.+)$/", (string) $event->command, $match) === 1) {
            Artisan::call(trim($match[1], "' "));
        }
    }
}

/**
 * One company with an employee on an 08.00–17.00 weekday shift, a task due on
 * Wednesday 21 Oct (digest "due today") and one due Thursday (H-1 reminder).
 */
function scheduleCompany(string $timezone): object
{
    $company = Company::factory()->create(['timezone' => $timezone]);

    return CompanyFactory::within($company, function () use ($company): object {
        $user = User::factory()->forCompany($company)->withRole(Role::Anggota)->create();
        $shift = Shift::factory()->atLocation(OfficeLocation::factory()->create())->create();
        ShiftAssignment::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'valid_from' => '2026-01-01']);
        $workspace = Workspace::factory()->team()->ownedBy($user)->create();

        foreach (['2026-10-21', '2026-10-22'] as $due) {
            app(CreateTask::class)->handle($workspace, $user, ['title' => "Tugas {$due}", 'assignee_ids' => [$user->id], 'due_date' => $due]);
        }

        return (object) ['company' => $company, 'user' => $user];
    });
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    // Tuesday 20 Oct 2026, 19.00 WIB.
    $this->travelTo(CarbonImmutable::parse('2026-10-20 12:00', 'UTC'));
});

test('a local-time task runs at each company\'s own clock, once per local date', function () {
    $jakarta = Company::factory()->create(['timezone' => 'Asia/Jakarta']);
    $makassar = Company::factory()->create(['timezone' => 'Asia/Makassar']);
    $jayapura = Company::factory()->create(['timezone' => 'Asia/Jayapura']);
    $seen = [];
    $task = app(CompanySchedule::class)->daily('uji:pagi', '07:00', function (Company $company) use (&$seen): void {
        $seen[] = [$company->id, CurrentCompany::id(), CurrentCompany::timezone(), CarbonImmutable::now(CurrentCompany::timezone())->format('Y-m-d H:i')];
    });
    $tick = function (string $utc) use ($task, &$seen): array {
        $this->travelTo(CarbonImmutable::parse($utc, 'UTC'));
        $seen = [];
        $task();

        return $seen;
    };

    // 06.59 WIT: nobody yet. 07.00 WIT = 06.00 WITA = 05.00 WIB: only Jayapura.
    expect($tick('2026-10-20 21:59'))->toBe([])
        ->and($tick('2026-10-20 22:00'))->toBe([[$jayapura->id, $jayapura->id, 'Asia/Jayapura', '2026-10-21 07:00']])
        ->and($tick('2026-10-20 22:05'))->toBe([])
        ->and($tick('2026-10-20 23:00'))->toBe([[$makassar->id, $makassar->id, 'Asia/Makassar', '2026-10-21 07:00']])
        ->and($tick('2026-10-21 00:00'))->toBe([[$jakarta->id, $jakarta->id, 'Asia/Jakarta', '2026-10-21 07:00']])
        ->and($tick('2026-10-21 00:05'))->toBe([])
        // More than two hours late is not caught up (e.g. a deploy in the evening).
        ->and(DB::table('scheduled_runs')->where('task', 'uji:pagi')->count())->toBe(3)
        ->and(app(CompanyContext::class)->has())->toBeFalse();

    $late = Company::factory()->create(['timezone' => 'Asia/Jakarta']);
    expect($tick('2026-10-21 02:01'))->toBe([])
        ->and($tick('2026-10-21 01:59'))->toBe([[$late->id, $late->id, 'Asia/Jakarta', '2026-10-21 08:59']]);

    // The next local day runs again.
    expect(collect($tick('2026-10-21 22:00'))->pluck(0)->all())->toBe([$jayapura->id]);
});

test('a failing company releases its claim and does not stop the others', function () {
    $broken = Company::factory()->create(['timezone' => 'Asia/Jakarta']);
    $fine = Company::factory()->create(['timezone' => 'Asia/Jakarta']);
    $ran = [];
    $task = app(CompanySchedule::class)->daily('uji:rapuh', '07:00', function (Company $company) use ($broken, &$ran): void {
        throw_if($company->is($broken) && $ran === [], RuntimeException::class, 'gagal');
        $ran[] = $company->id;
    });
    $this->travelTo(CarbonImmutable::parse('2026-10-21 07:00', 'Asia/Jakarta'));

    $task();
    expect($ran)->toBe([$fine->id])
        ->and(DB::table('scheduled_runs')->where('task', 'uji:rapuh')->pluck('company_id')->all())->toBe([$fine->id]);

    // Five minutes later the broken company is retried, the other one is done.
    $this->travelTo(CarbonImmutable::parse('2026-10-21 07:05', 'Asia/Jakarta'));
    $task();
    expect($ran)->toBe([$fine->id, $broken->id]);
});

test('ForEachCompany runs for the current company, or for every company in its own context', function () {
    $jakarta = Company::factory()->create(['timezone' => 'Asia/Jakarta']);
    $jayapura = Company::factory()->create(['timezone' => 'Asia/Jayapura']);
    Company::factory()->create()->delete();
    $probe = fn (Company $company): array => [$company->id, CurrentCompany::id(), CurrentCompany::timezone()];

    expect(ForEachCompany::run($probe))->toEqualCanonicalizing([
        [$jakarta->id, $jakarta->id, 'Asia/Jakarta'],
        [$jayapura->id, $jayapura->id, 'Asia/Jayapura'],
    ])
        ->and(app(CompanyContext::class)->run($jayapura, fn (): array => ForEachCompany::run($probe)))->toBe([[$jayapura->id, $jayapura->id, 'Asia/Jayapura']])
        ->and(app(CompanyContext::class)->has())->toBeFalse();
});

test('a scheduled job queued for two companies keeps one unique lock per company', function () {
    Queue::fake();
    $a = Company::factory()->create();
    $b = Company::factory()->create(['timezone' => 'Asia/Makassar']);
    $context = app(CompanyContext::class);

    foreach ([$a, $b, $a] as $company) {
        $context->run($company, function (): void {
            SendDailyReportReminders::dispatch();
        });
    }

    expect(collect(Queue::pushed(SendDailyReportReminders::class))->map(fn (SendDailyReportReminders $job): ?string => $job->tenantCompanyId)->all())
        ->toBe([$a->id, $b->id]);
});

test('close-day, check-in reminders, digest, deadlines and daily reports follow each company\'s clock', function () {
    Notification::fake();
    Mail::fake();
    $companies = ['A' => scheduleCompany('Asia/Jakarta'), 'B' => scheduleCompany('Asia/Makassar'), 'C' => scheduleCompany('Asia/Jayapura')];

    $happened = fn (object $world): array => [
        'close-day' => AttendanceDay::query()->where('user_id', $world->user->id)->whereDate('work_date', '2026-10-20')->where('status', AttendanceStatus::Absent->value)->count(),
        'check-in' => Notification::sent($world->user, CheckInReminderNotification::class)->count(),
        'digest' => Mail::sent(DailyDigestMail::class, fn (DailyDigestMail $mail): bool => $mail->hasTo($world->user->email))->count(),
        'deadline' => Notification::sent($world->user, TaskDueSoonNotification::class)->count(),
        'report' => Notification::sent($world->user, DailyReportReminder::class)->count(),
    ];

    // UTC ticks around 00.30, 07.00, 07.30, 08.15 and 16.30 of WIT, WITA and WIB; the last ones repeat.
    $ticks = [
        '2026-10-20 15:31', '2026-10-20 16:31', '2026-10-20 17:31',
        '2026-10-20 22:01', '2026-10-20 22:31', '2026-10-20 23:01', '2026-10-20 23:16', '2026-10-20 23:31',
        '2026-10-21 00:01', '2026-10-21 00:16', '2026-10-21 00:31', '2026-10-21 01:16',
        '2026-10-21 07:31', '2026-10-21 08:31', '2026-10-21 09:31', '2026-10-21 09:36', '2026-10-21 09:41',
    ];
    $first = [];

    foreach ($ticks as $tick) {
        $this->travelTo(CarbonImmutable::parse($tick, 'UTC'));
        runScheduleTick();

        foreach ($companies as $name => $world) {
            foreach ($happened($world) as $kind => $count) {
                if ($count > 0 && ! isset($first[$kind][$name])) {
                    $first[$kind][$name] = substr($tick, 11);
                }
            }
        }
    }

    // First tick (UTC) at which it happened: 00.31 / 07.01 / 07.31 / 08.16 / 16.31 local time.
    expect($first)->toEqual([
        'close-day' => ['C' => '15:31', 'B' => '16:31', 'A' => '17:31'],
        'deadline' => ['C' => '22:01', 'B' => '23:01', 'A' => '00:01'],
        'digest' => ['C' => '22:31', 'B' => '23:31', 'A' => '00:31'],
        'check-in' => ['C' => '23:16', 'B' => '00:16', 'A' => '01:16'],
        'report' => ['C' => '07:31', 'B' => '08:31', 'A' => '09:31'],
    ]);

    // Exactly once each, however often the scheduler ran.
    foreach ($companies as $world) {
        expect($happened($world))->toBe(['close-day' => 1, 'check-in' => 1, 'digest' => 1, 'deadline' => 1, 'report' => 1]);
    }
});

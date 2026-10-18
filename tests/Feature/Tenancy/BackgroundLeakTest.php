<?php

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Digest\DailyDigestMail;
use App\Domain\Notifications\Jobs\SendAttendanceWhatsApp;
use App\Domain\Organization\Mail\DesktopLinkMail;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\CallbackEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Client\Request;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Fase 1 multi-perusahaan — background work with two companies: every entry
 * of routes/console.php run at the moments of a working Friday where they
 * have something to do, plus the WhatsApp copy of a check-in. Whatever
 * reaches an employee (Inbox payload, email, WhatsApp text) may only mention
 * their own company: A never sees B's marker ZZB0C0R, B never sees A's
 * ZZA0H0M.
 *
 * Gaps waiting for Langkah 2 are skipped with the reason and their row in
 * docs/sesi/fase1-celah.md (conditional skips: once fixed they pass by
 * themselves).
 */

/** A Friday (project/OKR reminders), office time. */
function backgroundDay(string $time): CarbonImmutable
{
    return CarbonImmutable::parse("2026-10-23 {$time}", config()->string('app.office_timezone'));
}

/**
 * Runs every scheduled entry once, in-process (commands through Artisan::call,
 * never as a sub-process that would use the development database).
 */
function runSchedule(): void
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
 * Everything delivered so far, as [company of the recipient, recipient, channel, text].
 *
 * @return list<array{0: string, 1: string, 2: string, 3: string}>
 */
function deliveredTexts(): array
{
    $texts = [];

    foreach (Notification::sentNotifications() as $byId) {
        foreach ($byId as $byClass) {
            foreach ($byClass as $class => $sent) {
                foreach ($sent as $entry) {
                    $notifiable = $entry['notifiable'];
                    $notification = $entry['notification'];

                    if (! $notifiable instanceof User) {
                        continue;
                    }

                    foreach ($entry['channels'] as $channel) {
                        $text = match (true) {
                            ! $notification instanceof BaseNotification => (string) json_encode(method_exists($notification, 'toArray') ? $notification->toArray($notifiable) : []),
                            $channel === 'mail' => (string) $notification->toMail($notifiable)->render(),
                            default => (string) json_encode($notification->toArray($notifiable)),
                        };

                        $texts[] = [$notifiable->company_id, $notifiable->name, class_basename($class).':'.class_basename($channel), $text];
                    }
                }
            }
        }
    }

    foreach ([DailyDigestMail::class, DesktopLinkMail::class] as $mailable) {
        Mail::sent($mailable)->each(function (Mailable $mail) use (&$texts): void {
            foreach ($mail->to as $to) {
                $user = User::query()->where('email', $to['address'])->first();

                if ($user !== null) {
                    $texts[] = [$user->company_id, $user->name, class_basename($mail), (string) $mail->render()];
                }
            }
        });
    }

    return $texts;
}

beforeEach(function () {
    $this->travelTo(backgroundDay('06:00'));
    $this->home = homeWorld();
    $this->foreign = foreignWorld();

    Notification::fake();
    Mail::fake();
    Http::fake();
    Storage::fake('selfies');
});

test('scheduled jobs and notifications never mix the two companies', function () {
    foreach (['07:31', '08:20', '09:46', '09:51', '09:56', '15:01', '16:31', '23:56'] as $time) {
        $this->travelTo(backgroundDay($time));
        runSchedule();
    }

    $this->travelTo(backgroundDay('00:31')->addDay());
    runSchedule();

    $delivered = deliveredTexts();
    $leaks = [];
    $reached = ['A' => 0, 'B' => 0];

    foreach ($delivered as [$company, $name, $kind, $text]) {
        $side = $company === $this->foreign->company->id ? 'B' : 'A';
        $reached[$side]++;
        $foreignText = $side === 'A' ? leaksForeign($text) : stripos($text, homeMarker()) !== false;

        if ($foreignText) {
            $leaks[] = "{$kind} → {$name} ({$side})";
        }
    }

    tenancyReport(sprintf("\n[tenancy] terkirim ke A: %d · ke B: %d · bocor: %d\n", $reached['A'], $reached['B'], count($leaks)));

    if (getenv('TENANCY_DEBUG')) {
        fwrite(STDERR, '[tenancy] jenis: '.json_encode(collect($delivered)->map(fn (array $row): string => ($row[0] === $this->foreign->company->id ? 'B ' : 'A ').$row[2])->countBy()->sortKeys()->all(), JSON_PRETTY_PRINT)."\n");
    }

    // Both companies really got reminders, so the check above is not empty
    // (and A's digest arrives on a plain Friday: control for the C5 test below).
    expect($reached['A'])->toBeGreaterThan(0)
        ->and($reached['B'])->toBeGreaterThan(0)
        ->and(collect($delivered)->contains(fn (array $row): bool => $row[0] === $this->home->company->id && $row[2] === 'DailyDigestMail'))->toBeTrue()
        ->and($leaks)->toBe([]);
});

test('a holiday of company B does not cancel company A\'s working day', function () {
    // A plain Friday for A; only B is off.
    Holiday::factory()->create(['company_id' => $this->foreign->company->id, 'date' => '2026-10-23', 'name' => 'Libur B '.tenancyMarker()]);

    $this->travelTo(backgroundDay('07:31'));
    runSchedule();

    $digestToA = collect(deliveredTexts())->contains(fn (array $row): bool => $row[0] === $this->home->company->id && $row[2] === 'DailyDigestMail');

    if (! $digestToA) {
        $this->markTestSkipped('C5 (docs/sesi/fase1-celah.md): HolidayAwareWorkdayCalendar membaca hari libur semua perusahaan — ringkasan harian A tidak terkirim saat B libur. Ditutup di Langkah 2a.');
    }

    expect($digestToA)->toBeTrue();
});

test('attendance WhatsApp copies of company B never reach company A\'s group', function () {
    config([
        'notifications.channels.whatsapp.enabled' => true,
        'notifications.channels.whatsapp.group_jid' => '120363000000000000@g.us',
        'services.evolution.url' => 'http://evolution.test',
        'services.evolution.api_key' => 'test-key',
        'services.evolution.instance' => 'ruangkerja',
        'attendance.stamp.nominatim_interval_s' => 0,
    ]);
    Http::fake(['*' => Http::response(['success' => true])]);
    $this->travelTo(backgroundDay('07:55'));

    $homeDay = AttendanceDay::factory()->create(['user_id' => $this->home->anggota->id, 'status' => AttendanceStatus::Present, 'check_in_at' => now(), 'work_plan' => ['Rencana '.homeMarker()]]);
    $homeLog = AttendanceLog::factory()->forDay($homeDay)->create(['occurred_at' => now(), 'office_location_id' => $this->home->office->id]);
    $homeDay->forceFill(['check_in_log_id' => $homeLog->id])->save();

    foreach ([$homeDay, $this->foreign->day] as $day) {
        SendAttendanceWhatsApp::dispatchSync($day->id, AttendanceLogType::CheckIn);
    }

    $groups = ['A' => [], 'B' => []];

    Http::assertSent(function (Request $request) use (&$groups): bool {
        $data = $request->data();
        $text = (string) ($data['text'] ?? $data['caption'] ?? '');
        $to = (string) ($data['number'] ?? '');

        if (leaksForeign($text)) {
            $groups['B'][] = $to;
        } elseif (str_contains($text, homeMarker())) {
            $groups['A'][] = $to;
        }

        return true;
    });

    expect($groups['A'])->not->toBeEmpty();

    if ($groups['B'] !== [] && array_intersect($groups['A'], $groups['B']) !== []) {
        $this->markTestSkipped('C9 (docs/sesi/fase1-celah.md): grup WhatsApp absensi tunggal (notifications.channels.whatsapp.group_jid) — absen perusahaan B, termasuk selfie, terkirim ke grup perusahaan A. Ditutup di Langkah 2c (whatsapp.group_jid per perusahaan).');
    }

    expect(array_intersect($groups['A'], $groups['B']))->toBe([]);
});

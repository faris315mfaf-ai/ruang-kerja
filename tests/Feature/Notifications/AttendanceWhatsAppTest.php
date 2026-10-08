<?php

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Notifications\Jobs\SendAttendanceWhatsApp;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use App\Domain\Organization\Enums\WorkMode;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

/*
 * The management WhatsApp group copies via the Evolution API gateway
 * (docs/fitur/absensi-whatsapp.md, format 9 Oct 2026): 🟢 masuk with the
 * work-plan points, 🔴 pulang with the worked duration; queued on success
 * only, correct payload, silent while the channel is off.
 */
beforeEach(function () {
    Storage::fake('selfies');
    Event::fake();
    $this->office = F::office();
});

function whatsappOn(): void
{
    config([
        'notifications.channels.whatsapp.enabled' => true,
        'notifications.channels.whatsapp.group_jid' => '120363000000000000@g.us',
        'services.evolution.url' => 'http://evolution.test',
        'services.evolution.api_key' => 'test-key',
        'services.evolution.instance' => 'ruangkerja',
    ]);
}

test('a successful check-in queues the morning message', function () {
    Queue::fake();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();

    $day = AttendanceDay::query()->sole();
    Queue::assertPushed(SendAttendanceWhatsApp::class, fn (SendAttendanceWhatsApp $job): bool => $job->dayId === $day->id && $job->type === AttendanceLogType::CheckIn);
});

test('a successful check-out queues the afternoon message too', function () {
    Queue::fake();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:01'));
    F::checkIn($user, [], 'out')->assertCreated();

    Queue::assertPushed(SendAttendanceWhatsApp::class, 2);
    Queue::assertPushed(SendAttendanceWhatsApp::class, fn (SendAttendanceWhatsApp $job): bool => $job->type === AttendanceLogType::CheckOut);
});

test('nothing is queued while the channel is off', function () {
    Queue::fake();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();

    Queue::assertNotPushed(SendAttendanceWhatsApp::class);
});

test('the morning message follows the agreed format', function () {
    Http::fake(['evolution.test/*' => Http::response(['success' => true])]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan', 'Meeting klien 14.00']])->assertCreated();

    $day = AttendanceDay::query()->with('user:id,name')->sole();
    (new SendAttendanceWhatsApp($day->id, AttendanceLogType::CheckIn))->handle(app(EvolutionWhatsApp::class));

    Http::assertSent(function (Request $request) use ($day): bool {
        $text = (string) $request->data()['text'];

        return $request->hasHeader('apikey', 'test-key')
            && $request->url() === 'http://evolution.test/message/sendText/ruangkerja'
            && $request->data()['number'] === '120363000000000000@g.us'
            && str_starts_with($text, '🟢 ABSEN MASUK')
            && str_contains($text, 'Nama: '.$day->user->name)
            && str_contains($text, 'Tanggal: Senin, 05 Oktober 2026')
            && str_contains($text, 'Jam: 07.52')
            && str_contains($text, 'Lokasi: Kantor Pusat')
            && str_contains($text, "📝 Rencana/Laporan Kerja Hari Ini:\n1. Selesaikan laporan mingguan\n2. Meeting klien 14.00");
    });
});

test('the afternoon message shows the duration instead of the plan', function () {
    Http::fake(['evolution.test/*' => Http::response(['success' => true])]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:01'));
    F::checkIn($user, [], 'out')->assertCreated();

    $day = AttendanceDay::query()->sole();
    (new SendAttendanceWhatsApp($day->id, AttendanceLogType::CheckOut))->handle(app(EvolutionWhatsApp::class));

    Http::assertSent(function (Request $request): bool {
        $text = (string) $request->data()['text'];

        return str_starts_with($text, '🔴 ABSEN PULANG')
            && str_contains($text, 'Tanggal: Senin, 05 Oktober 2026')
            && str_contains($text, 'Jam: 17.01')
            && str_contains($text, 'Durasi kerja: ')
            && ! str_contains($text, 'Rencana/Laporan');
    });
});

test('a WFH check-in describes the location with its note', function () {
    Http::fake(['evolution.test/*' => Http::response(['success' => true])]);
    whatsappOn();
    $user = F::employee(WorkMode::Wfh);
    $this->travelTo(F::at('2026-10-05 07:58'));
    F::checkIn($user, ['latitude' => F::northOfOffice(25_000), 'note' => 'Rumah, menyusun laporan', 'work_plan' => ['Penyusunan laporan']])->assertCreated();

    $day = AttendanceDay::query()->sole();
    (new SendAttendanceWhatsApp($day->id, AttendanceLogType::CheckIn))->handle(app(EvolutionWhatsApp::class));

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request->data()['text'], 'Lokasi: WFH — Rumah, menyusun laporan'));
});

test('a plan-less check-in says so in the message', function () {
    Http::fake(['evolution.test/*' => Http::response(['success' => true])]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    $day = AttendanceDay::query()->sole();
    (new SendAttendanceWhatsApp($day->id, AttendanceLogType::CheckIn))->handle(app(EvolutionWhatsApp::class));

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request->data()['text'], '_(tidak diisi — absen lewat QR/kiosk)_'));
});

test('the job is a no-op without a group jid or a disabled channel', function () {
    Http::fake();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();
    $day = AttendanceDay::query()->sole();

    // Enabled channel but no group configured.
    config([
        'notifications.channels.whatsapp.enabled' => true,
        'notifications.channels.whatsapp.group_jid' => null,
        'services.evolution.url' => 'http://evolution.test',
        'services.evolution.api_key' => 'test-key',
    ]);
    (new SendAttendanceWhatsApp($day->id, AttendanceLogType::CheckIn))->handle(app(EvolutionWhatsApp::class));

    // Group set but the channel off.
    config(['notifications.channels.whatsapp.enabled' => false, 'notifications.channels.whatsapp.group_jid' => '123@g.us']);
    (new SendAttendanceWhatsApp($day->id, AttendanceLogType::CheckIn))->handle(app(EvolutionWhatsApp::class));

    Http::assertNothingSent();
});

test('a gateway error bubbles so the queue retries', function () {
    Queue::fake();
    Http::fake(['evolution.test/*' => Http::response(status: 500)]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();
    $day = AttendanceDay::query()->sole();

    expect(fn (): bool => (new SendAttendanceWhatsApp($day->id, AttendanceLogType::CheckIn))->handle(app(EvolutionWhatsApp::class)))
        ->toThrow(RequestException::class);
});

<?php

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\StampedSelfie;
use App\Domain\Notifications\Jobs\SendAttendanceWhatsApp;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use App\Domain\Organization\Enums\WorkMode;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

/*
 * The management WhatsApp group copies via the Evolution API gateway
 * (docs/fitur/absensi-whatsapp.md, format 13 Oct 2026): 🟢 masuk with
 * "Rencana Kerja", 🔴 pulang with "Laporan Kerja" + duration; the selfie goes
 * out as a stamped photo with that text as caption (plain text without a
 * selfie); queued on success only, silent while the channel is off.
 */
beforeEach(function () {
    Storage::fake('selfies');
    Event::fake();
    Queue::fake();
    Cache::flush();
    config(['attendance.stamp.nominatim_interval_s' => 0]);
    $this->office = F::office();
});

/** Gateway + OpenStreetMap fakes; any other request fails the test. */
function fakeGateway(): void
{
    $tile = imagecreatetruecolor(256, 256);
    imagefill($tile, 0, 0, imagecolorallocate($tile, 240, 236, 228));
    ob_start();
    imagepng($tile);
    $png = (string) ob_get_clean();

    Http::preventStrayRequests();
    Http::fake([
        'evolution.test/*' => Http::response(['success' => true]),
        'tile.openstreetmap.org/*' => Http::response($png, 200, ['Content-Type' => 'image/png']),
        'nominatim.openstreetmap.org/*' => Http::response(['address' => ['suburb' => 'Tebet Barat']]),
    ]);
}

/** Runs the queued job synchronously. */
function runWhatsApp(AttendanceDay $day, AttendanceLogType $type, string $part = SendAttendanceWhatsApp::PART_FULL): void
{
    (new SendAttendanceWhatsApp($day->id, $type, $part))->handle(app(EvolutionWhatsApp::class), app(StampedSelfie::class));
}

/** The caption of the (single) sendMedia request. */
function sentCaption(): string
{
    $caption = null;
    Http::assertSent(function (Request $request) use (&$caption): bool {
        if (str_contains($request->url(), '/message/sendMedia/')) {
            $caption = (string) $request->data()['caption'];
        }

        return true;
    });

    return (string) $caption;
}

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
    F::checkIn($user, ['work_report' => ['Selesai']], 'out')->assertCreated();

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

test('the morning photo carries the Rencana Kerja caption and a stamped JPEG', function () {
    fakeGateway();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan', 'Meeting klien 14.00']])->assertCreated();

    $day = AttendanceDay::query()->with('user:id,name')->sole();
    runWhatsApp($day, AttendanceLogType::CheckIn);

    Http::assertSent(function (Request $request) use ($day): bool {
        $data = $request->data();
        $image = base64_decode((string) ($data['media'] ?? ''), true);

        return $request->hasHeader('apikey', 'test-key')
            && $request->url() === 'http://evolution.test/message/sendMedia/ruangkerja'
            && $data['number'] === '120363000000000000@g.us'
            && $data['mediatype'] === 'image'
            && $data['mimetype'] === 'image/jpeg'
            && $data['fileName'] === 'absensi.jpg'
            && is_string($image) && getimagesizefromstring($image)['mime'] === 'image/jpeg'
            && str_starts_with($data['caption'], '🟢 ABSEN MASUK')
            && str_contains($data['caption'], 'Nama: '.$day->user->name)
            && str_contains($data['caption'], 'Tanggal: Senin, 05 Oktober 2026')
            && str_contains($data['caption'], 'Jam: 07.52')
            && str_contains($data['caption'], 'Lokasi: Kantor Pusat')
            && str_contains($data['caption'], "📝 Rencana Kerja:\n1. Selesaikan laporan mingguan\n2. Meeting klien 14.00");
    });
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), '/sendText/'));
});

test('the afternoon photo carries the Laporan Kerja points and the duration', function () {
    fakeGateway();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:01'));
    F::checkIn($user, ['work_report' => ['Laporan mingguan selesai', 'Meeting klien beres']], 'out')->assertCreated();
    $day = AttendanceDay::query()->sole();

    runWhatsApp($day->refresh(), AttendanceLogType::CheckOut);

    $caption = sentCaption();
    expect($caption)->toStartWith('🔴 ABSEN PULANG')
        ->and($caption)->toContain('Tanggal: Senin, 05 Oktober 2026')
        ->and($caption)->toContain('Jam: 17.01')
        ->and($caption)->toContain("📝 Laporan Kerja:\n1. Laporan mingguan selesai\n2. Meeting klien beres")
        ->and($caption)->toContain('Durasi kerja: ')
        ->and($caption)->not->toContain('Rencana');
});

test('an empty report says it was not filled in', function () {
    fakeGateway();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Rencana']])->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:01'));
    F::checkIn($user, ['work_report' => ['Apa saja']], 'out')->assertCreated();
    $day = AttendanceDay::query()->sole();
    $day->update(['work_report' => null]);

    runWhatsApp($day->refresh(), AttendanceLogType::CheckOut);

    expect(sentCaption())->toContain("📝 Laporan Kerja:\n_(tidak diisi — absen lewat QR/kiosk)_");
});

test('a plan-less check-in says so in the caption', function () {
    fakeGateway();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    runWhatsApp(AttendanceDay::query()->sole(), AttendanceLogType::CheckIn);

    expect(sentCaption())->toContain("📝 Rencana Kerja:\n_(tidak diisi — absen lewat QR/kiosk)_");
});

test('a WFH check-in describes the location with its note', function () {
    fakeGateway();
    whatsappOn();
    $user = F::employee(WorkMode::Wfh);
    $this->travelTo(F::at('2026-10-05 07:58'));
    F::checkIn($user, ['latitude' => F::northOfOffice(25_000), 'note' => 'Rumah, menyusun laporan', 'work_plan' => ['Penyusunan laporan']])->assertCreated();

    runWhatsApp(AttendanceDay::query()->sole(), AttendanceLogType::CheckIn);

    expect(sentCaption())->toContain('Lokasi: WFH — Rumah, menyusun laporan');
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'nominatim'));
});

test('a check-in without a selfie (QR) goes out as plain text', function () {
    fakeGateway();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Rencana']])->assertCreated();
    $log = AttendanceLog::query()->sole();
    $log->selfie_path = null;
    $log->save();

    runWhatsApp(AttendanceDay::query()->sole(), AttendanceLogType::CheckIn);

    Http::assertSent(function (Request $request): bool {
        return $request->url() === 'http://evolution.test/message/sendText/ruangkerja'
            && str_starts_with((string) $request->data()['text'], '🟢 ABSEN MASUK')
            && str_contains((string) $request->data()['text'], "📝 Rencana Kerja:\n1. Rencana");
    });
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'sendMedia') || str_contains($request->url(), 'openstreetmap'));
});

test('when stamping fails the text still goes out', function () {
    fakeGateway();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Rencana']])->assertCreated();
    $log = AttendanceLog::query()->sole();
    Storage::disk('selfies')->delete($log->selfie_path);

    runWhatsApp(AttendanceDay::query()->sole(), AttendanceLogType::CheckIn);

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/sendText/'));
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), '/sendMedia/'));
});

test('a long report posts the photo with the header and sends the points as a follow-up job', function () {
    Queue::fake();
    fakeGateway();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Rencana']])->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:01'));
    $points = array_map(fn (int $i): string => "Butir $i ".str_repeat('kerja ', 40), range(1, 6));
    F::checkIn($user, ['work_report' => $points], 'out')->assertCreated();
    $day = AttendanceDay::query()->sole();

    runWhatsApp($day, AttendanceLogType::CheckOut);

    $caption = sentCaption();
    expect(mb_strlen(SendAttendanceWhatsApp::message($day, $day->checkOutLog)))->toBeGreaterThan(900)
        ->and($caption)->toStartWith('🔴 ABSEN PULANG')
        ->and($caption)->toContain('Durasi kerja: ')
        ->and($caption)->not->toContain('Laporan Kerja:');
    Queue::assertPushed(SendAttendanceWhatsApp::class, fn (SendAttendanceWhatsApp $job): bool => $job->part === SendAttendanceWhatsApp::PART_POINTS && $job->type === AttendanceLogType::CheckOut);

    // The follow-up job sends only text — a retry can never repost the photo.
    Http::fake(['evolution.test/*' => Http::response(['success' => true])]);
    runWhatsApp($day, AttendanceLogType::CheckOut, SendAttendanceWhatsApp::PART_POINTS);

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/sendText/')
        && str_starts_with((string) $request->data()['text'], "\n📝 Laporan Kerja:\n1. Butir 1")
        && str_contains((string) $request->data()['text'], '6. Butir 6'));
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
    runWhatsApp($day, AttendanceLogType::CheckIn);

    // Group set but the channel off.
    config(['notifications.channels.whatsapp.enabled' => false, 'notifications.channels.whatsapp.group_jid' => '123@g.us']);
    runWhatsApp($day, AttendanceLogType::CheckIn);

    Http::assertNothingSent();
});

test('a gateway error on the photo bubbles so the queue retries', function () {
    Http::preventStrayRequests();
    Http::fake([
        'evolution.test/*' => Http::response(status: 500),
        'tile.openstreetmap.org/*' => Http::response(status: 500),
        'nominatim.openstreetmap.org/*' => Http::response(status: 500),
    ]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();
    $day = AttendanceDay::query()->sole();

    expect(fn () => runWhatsApp($day, AttendanceLogType::CheckIn))->toThrow(RequestException::class);
});

test('a gateway error on a plain text message bubbles too', function () {
    Http::fake(['evolution.test/*' => Http::response(status: 500)]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Rencana']])->assertCreated();
    $log = AttendanceLog::query()->sole();
    $log->selfie_path = null;
    $log->save();

    expect(fn () => runWhatsApp(AttendanceDay::query()->sole(), AttendanceLogType::CheckIn))->toThrow(RequestException::class);
});

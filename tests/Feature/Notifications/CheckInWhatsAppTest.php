<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Notifications\Jobs\SendCheckInWhatsApp;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

/*
 * The management WhatsApp group copy of a check-in via the Evolution API
 * gateway (docs/fitur/absensi-whatsapp.md): dispatched on success only,
 * correct payload, silent while the channel is off.
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

test('a successful check-in queues the group message', function () {
    Queue::fake();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => '1) Laporan mingguan'])->assertCreated();

    $day = AttendanceDay::query()->with('user:id,name')->sole();
    Queue::assertPushed(SendCheckInWhatsApp::class, fn (SendCheckInWhatsApp $job): bool => $job->dayId === $day->id);
});

test('nothing is queued while the channel is off', function () {
    Queue::fake();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => '1) Laporan mingguan'])->assertCreated();

    Queue::assertNotPushed(SendCheckInWhatsApp::class);
});

test('a check-out does not queue the group message', function () {
    Queue::fake();
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => '1) Laporan mingguan'])->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:01'));
    F::checkIn($user, [], 'out')->assertCreated();

    Queue::assertPushed(SendCheckInWhatsApp::class, 1);
});

test('the job sends the plan to the gateway group', function () {
    Http::fake(['evolution.test/*' => Http::response(['status', 'success' => true])]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => '1) Laporan mingguan'])->assertCreated();

    $day = AttendanceDay::query()->with('user:id,name')->sole();
    (new SendCheckInWhatsApp($day->id))->handle(app(EvolutionWhatsApp::class));

    Http::assertSent(function (Request $request) use ($day): bool {
        $body = $request->data();

        return $request->hasHeader('apikey', 'test-key')
            && $request->url() === 'http://evolution.test/message/sendText/ruangkerja'
            && $body['number'] === '120363000000000000@g.us'
            && str_contains((string) $body['text'], '*'.$day->user->name.'*')
            && str_contains((string) $body['text'], '07.52 WIB')
            && str_contains((string) $body['text'], '1) Laporan mingguan');
    });
});

test('the job is a no-op without a group jid or a disabled channel', function () {
    Http::fake();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => '1) Laporan mingguan'])->assertCreated();
    $day = AttendanceDay::query()->with('user:id,name')->sole();

    // Enabled channel but no group configured.
    config([
        'notifications.channels.whatsapp.enabled' => true,
        'notifications.channels.whatsapp.group_jid' => null,
        'services.evolution.url' => 'http://evolution.test',
        'services.evolution.api_key' => 'test-key',
    ]);
    (new SendCheckInWhatsApp($day->id))->handle(app(EvolutionWhatsApp::class));

    // Group set but the channel off.
    config(['notifications.channels.whatsapp.enabled' => false, 'notifications.channels.whatsapp.group_jid' => '123@g.us']);
    (new SendCheckInWhatsApp($day->id))->handle(app(EvolutionWhatsApp::class));

    Http::assertNothingSent();
});

test('a gateway error bubbles so the queue retries', function () {
    Queue::fake();
    Http::fake(['evolution.test/*' => Http::response(status: 500)]);
    whatsappOn();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => '1) Laporan mingguan'])->assertCreated();
    $day = AttendanceDay::query()->with('user:id,name')->sole();

    expect(fn (): bool => (new SendCheckInWhatsApp($day->id))->handle(app(EvolutionWhatsApp::class)))
        ->toThrow(RequestException::class);
});

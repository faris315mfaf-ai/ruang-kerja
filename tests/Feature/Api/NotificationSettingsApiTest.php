<?php

use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Notifications\TestNotification;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

/*
| API v1 — Pengaturan notifikasi untuk aplikasi: matriks kejadian x kanal,
| ringkasan harian, jam tenang, tahan saat cuti. Action, aturan kunci, dan
| Policy sama dengan layar web; sakelar push mengikuti kolom In-app.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

function settingsCell(array $matrix, string $event, string $channel): array
{
    return collect($matrix)->firstWhere('event', $event)['channels'][$channel];
}

test('the read returns the matrix with defaults, locks, settings and the Android channel catalogue', function () {
    $response = $this->getJson('/api/v1/pengaturan/notifikasi')->assertOk();
    $matrix = $response->json('matrix');

    expect($matrix)->toHaveCount(count(NotificationEvent::matrix()))
        ->and(settingsCell($matrix, 'task.assigned', 'in_app'))->toBe(['enabled' => true, 'configurable' => true, 'supported' => true])
        ->and(settingsCell($matrix, 'task.assigned', 'email')['enabled'])->toBeTrue()
        ->and(settingsCell($matrix, 'task.commented', 'email')['enabled'])->toBeFalse()
        // Locked rows: not configurable, always on.
        ->and(settingsCell($matrix, 'account.security', 'in_app'))->toBe(['enabled' => true, 'configurable' => false, 'supported' => true])
        ->and(settingsCell($matrix, 'account.security', 'email')['configurable'])->toBeFalse()
        ->and(settingsCell($matrix, 'request.pending', 'in_app')['configurable'])->toBeFalse()
        // WhatsApp stays "Segera hadir".
        ->and(settingsCell($matrix, 'task.assigned', 'whatsapp'))->toBe(['enabled' => false, 'configurable' => false, 'supported' => true]);

    $response
        ->assertJsonPath('settings', ['digest_enabled' => true, 'digest_time' => '07:30', 'quiet_hours' => true, 'pause_while_on_leave' => false])
        ->assertJsonPath('quiet_window', ['start' => '17:30', 'end' => '07:00'])
        ->assertJsonPath('email', $this->user->email)
        ->assertJsonPath('channels.2', ['value' => 'whatsapp', 'label' => 'WhatsApp', 'available' => false])
        ->assertJsonPath('push.follows', 'in_app')
        ->assertJsonPath('push.server_ready', false)
        ->assertJsonCount(10, 'push.android_channels')
        ->assertJsonPath('push.android_channels.0.id', 'rk_mendesak')
        ->assertJsonPath('push.android_channels.0.importance', 'high');
});

test('the write changes cells, digest, quiet hours and leave hold in one atomic call and echoes the screen', function () {
    $response = $this->putJson('/api/v1/pengaturan/notifikasi', [
        'digest_time' => '08:15',
        'digest_enabled' => false,
        'quiet_hours' => false,
        'pause_while_on_leave' => true,
        'preferences' => [
            ['event' => 'task.assigned', 'channel' => 'email', 'enabled' => false],
            ['event' => 'task.commented', 'channel' => 'in_app', 'enabled' => false],
        ],
    ])->assertOk();

    $response->assertJsonPath('settings', ['digest_enabled' => false, 'digest_time' => '08:15', 'quiet_hours' => false, 'pause_while_on_leave' => true]);
    expect(settingsCell($response->json('matrix'), 'task.assigned', 'email')['enabled'])->toBeFalse()
        ->and(settingsCell($response->json('matrix'), 'task.commented', 'in_app')['enabled'])->toBeFalse();

    $setting = NotificationSetting::for($this->user);
    expect($setting->digestTimeShort())->toBe('08:15')->and($setting->quiet_hours)->toBeFalse()->and($setting->pause_while_on_leave)->toBeTrue();
    expect(NotificationPreference::query()->where('user_id', $this->user->id)->count())->toBe(3);
});

test('a locked or unavailable cell answers 422 and rolls back the whole call', function () {
    $this->putJson('/api/v1/pengaturan/notifikasi', [
        'quiet_hours' => false,
        'preferences' => [
            ['event' => 'task.assigned', 'channel' => 'email', 'enabled' => false],
            ['event' => 'account.security', 'channel' => 'email', 'enabled' => false],
        ],
    ])->assertUnprocessable()->assertJsonValidationErrors(['channel']);

    $this->putJson('/api/v1/pengaturan/notifikasi', [
        'preferences' => [['event' => 'task.assigned', 'channel' => 'whatsapp', 'enabled' => true]],
    ])->assertUnprocessable();

    expect(NotificationPreference::query()->where('user_id', $this->user->id)->count())->toBe(0)
        ->and(NotificationSetting::for($this->user)->quiet_hours)->toBeTrue();
});

test('the write validates times and values in Indonesian', function () {
    $this->putJson('/api/v1/pengaturan/notifikasi', ['digest_time' => '07:31'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.digest_time.0', 'Jam kirim harus berformat JJ:MM dengan kelipatan 5 menit, mis. 07:30.');
    $bad = $this->putJson('/api/v1/pengaturan/notifikasi', ['preferences' => [['event' => 'ngawur', 'channel' => 'email', 'enabled' => true]]])
        ->assertUnprocessable();
    expect($bad->json('errors')['preferences.0.event'][0])->toBe('Kejadian tidak dikenal.');
    $this->putJson('/api/v1/pengaturan/notifikasi', ['quiet_hours' => 'mungkin'])->assertUnprocessable()->assertJsonValidationErrors(['quiet_hours']);

    // An empty write is a no-op that still answers the screen.
    $this->putJson('/api/v1/pengaturan/notifikasi', [])->assertOk()->assertJsonPath('settings.digest_time', '07:30');
});

test('the digest preview is JSON and says when nothing would be sent', function () {
    $this->getJson('/api/v1/pengaturan/notifikasi/ringkasan')
        ->assertOk()
        ->assertJsonPath('empty', true)
        ->assertJsonPath('digest.sections', [])
        ->assertJsonPath('digest_time', '07:30')
        ->assertJsonStructure(['digest' => ['date', 'sections']]);
});

test('the test notification goes through the users own channels', function () {
    Notification::fake();

    $this->postJson('/api/v1/pengaturan/notifikasi/uji')->assertOk()->assertJsonStructure(['message']);

    Notification::assertSentTo($this->user, TestNotification::class);
});

test('settings endpoints reject requests without a token', function () {
    $this->refreshApplication();

    $this->getJson('/api/v1/pengaturan/notifikasi')->assertUnauthorized();
    $this->putJson('/api/v1/pengaturan/notifikasi', [])->assertUnauthorized();
    $this->getJson('/api/v1/pengaturan/notifikasi/ringkasan')->assertUnauthorized();
    $this->postJson('/api/v1/pengaturan/notifikasi/uji')->assertUnauthorized();

    expect(NotificationChannel::InApp->value)->toBe('in_app');
});

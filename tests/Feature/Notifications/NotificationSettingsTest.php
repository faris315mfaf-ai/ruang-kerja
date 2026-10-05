<?php

use App\Domain\Notifications\Actions\UpdateNotificationPreference;
use App\Domain\Notifications\Actions\UpdateNotificationSettings;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\InboxNotification;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

it('requires authentication', function () {
    $this->get('/pengaturan/notifikasi')->assertRedirect(route('login'));
    $this->patchJson('/pengaturan/notifikasi/preferensi', [])->assertUnauthorized();
});

it('renders the matrix with defaults, locks and the WhatsApp placeholder', function () {
    $user = User::factory()->create(['email' => 'dimas@demo.test']);

    $this->actingAs($user)
        ->get('/pengaturan/notifikasi')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('notifications/settings')
            ->has('matrix', count(NotificationEvent::matrix()))
            ->where('matrix.0.event', 'task.assigned')
            ->where('matrix.0.label', 'Ditugaskan ke saya')
            ->where('matrix.0.channels.in_app', ['enabled' => true, 'configurable' => true, 'supported' => true])
            ->where('matrix.0.channels.email', ['enabled' => true, 'configurable' => true, 'supported' => true])
            ->where('matrix.0.channels.whatsapp', ['enabled' => false, 'configurable' => false, 'supported' => true])
            ->where('matrix.5.event', 'request.pending')
            ->where('matrix.5.channels.in_app.configurable', false)
            ->where('settings', [
                'digest_enabled' => true,
                'digest_time' => '07:30',
                'quiet_hours' => true,
                'pause_while_on_leave' => false,
            ])
            ->where('email', 'dimas@demo.test')
            ->missing('digestPreview')); // deferred
});

it('loads the digest preview as a deferred prop', function () {
    $user = User::factory()->create();
    InboxNotification::factory()->recipient($user)->needsAction()->withData(['title' => 'Pengajuan lembur menunggu Anda'])->create();

    $this->actingAs($user)
        ->get('/pengaturan/notifikasi', [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
            'X-Inertia-Partial-Component' => 'notifications/settings',
            'X-Inertia-Partial-Data' => 'digestPreview',
        ])
        ->assertOk()
        ->assertJsonPath('props.digestPreview.sections.0.key', 'inbox.action')
        ->assertJsonPath('props.digestPreview.sections.0.items.0.title', 'Pengajuan lembur menunggu Anda');
});

it('saves one cell immediately', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson('/pengaturan/notifikasi/preferensi', ['event' => 'task.commented', 'channel' => 'email', 'enabled' => true])
        ->assertOk()
        ->assertJson(['event' => 'task.commented', 'channel' => 'email', 'enabled' => true]);

    $this->assertDatabaseHas('notification_preferences', [
        'user_id' => $user->id, 'event' => 'task.commented', 'channel' => 'email', 'enabled' => true,
    ]);

    // Toggling again updates the same row.
    $this->actingAs($user)
        ->patchJson('/pengaturan/notifikasi/preferensi', ['event' => 'task.commented', 'channel' => 'email', 'enabled' => false])
        ->assertOk();

    expect(NotificationPreference::query()->where('user_id', $user->id)->count())->toBe(1)
        ->and(NotificationPreference::query()->sole()->enabled)->toBeFalse();
});

it('toggles the daily digest through the preference endpoint', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson('/pengaturan/notifikasi/preferensi', ['event' => 'digest.daily', 'channel' => 'email', 'enabled' => false])
        ->assertOk();

    $this->actingAs($user)
        ->get('/pengaturan/notifikasi')
        ->assertInertia(fn (Assert $page) => $page->where('settings.digest_enabled', false));
});

it('refuses locked, unsupported or unavailable cells', function (string $event, string $channel) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson('/pengaturan/notifikasi/preferensi', ['event' => $event, 'channel' => $channel, 'enabled' => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('channel');

    $this->assertDatabaseCount('notification_preferences', 0);
})->with([
    'approvals stay in the Inbox' => ['request.pending', 'in_app'],
    'system notices stay in the Inbox' => ['system', 'in_app'],
    'WhatsApp is Phase 2' => ['task.assigned', 'whatsapp'],
    'digest is email-only' => ['digest.daily', 'in_app'],
]);

it('validates the preference payload in Indonesian', function () {
    $this->actingAs(User::factory()->create())
        ->patchJson('/pengaturan/notifikasi/preferensi', ['event' => 'gosip', 'channel' => 'sms'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'event' => 'Kejadian tidak dikenal.',
            'channel' => 'Kanal tidak dikenal.',
            'enabled' => 'Status aktif wajib diisi.',
        ]);
});

it('updates digest time, quiet hours and hold-while-on-leave', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson('/pengaturan/notifikasi', ['digest_time' => '08:15', 'quiet_hours' => false, 'pause_while_on_leave' => true])
        ->assertOk()
        ->assertJson(['digest_time' => '08:15', 'quiet_hours' => false, 'pause_while_on_leave' => true]);

    $setting = NotificationSetting::query()->findOrFail($user->id);
    expect($setting->digest_time)->toBe('08:15:00')
        ->and($setting->quiet_hours)->toBeFalse()
        ->and($setting->pause_while_on_leave)->toBeTrue();
});

it('updates only the given settings', function () {
    $user = User::factory()->create();
    NotificationSetting::query()->create(['user_id' => $user->id, 'digest_time' => '06:00', 'quiet_hours' => false]);

    $this->actingAs($user)->patchJson('/pengaturan/notifikasi', ['pause_while_on_leave' => true])->assertOk();

    $setting = NotificationSetting::query()->findOrFail($user->id);
    expect($setting->digest_time)->toBe('06:00:00')
        ->and($setting->quiet_hours)->toBeFalse()
        ->and($setting->pause_while_on_leave)->toBeTrue();
});

it('rejects invalid digest times', function (string $time) {
    $this->actingAs(User::factory()->create())
        ->patchJson('/pengaturan/notifikasi', ['digest_time' => $time])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['digest_time' => 'Jam kirim harus berformat JJ:MM dengan kelipatan 5 menit, mis. 07:30.']);
})->with(['24:00', '7:30', '07:32', 'pagi', '07:30:00']);

it('only changes the signed-in user\'s preferences', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->actingAs($user)->patchJson('/pengaturan/notifikasi/preferensi', ['event' => 'mention', 'channel' => 'email', 'enabled' => false]);

    $this->assertDatabaseMissing('notification_preferences', ['user_id' => $other->id]);
});

it('resets today\'s digest run when the time changes', function () {
    $user = User::factory()->create();
    NotificationSetting::query()->create(['user_id' => $user->id, 'digest_last_run_on' => now()->toDateString()]);

    app(UpdateNotificationSettings::class)->handle($user, ['digest_time' => '09:00']);
    expect(NotificationSetting::query()->findOrFail($user->id)->digest_last_run_on)->toBeNull();
});

it('throws a validation error from the action for locked cells', function () {
    app(UpdateNotificationPreference::class)->handle(User::factory()->create(), NotificationEvent::RequestPending, NotificationChannel::InApp, false);
})->throws(ValidationException::class);

it('renders the digest email preview in the browser', function () {
    $user = User::factory()->create(['name' => 'Dimas Pratama']);
    InboxNotification::factory()->recipient($user)->needsAction()->withData(['title' => 'Pengajuan cuti Maya'])->create();

    $this->actingAs($user)
        ->get('/pengaturan/notifikasi/pratinjau-ringkasan')
        ->assertOk()
        ->assertSee('Dimas.')
        ->assertSee('Pengajuan cuti Maya')
        ->assertSee('Buka RuangKerja');
});

it('sends a test notification (rate limited)', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->from('/pengaturan/notifikasi')
        ->post('/pengaturan/notifikasi/uji')
        ->assertRedirect('/pengaturan/notifikasi')
        ->assertSessionHas('toast.type', 'success');

    expect(InboxNotification::query()->visibleTo($user)->count())->toBe(1);

    foreach (range(1, 4) as $ignored) {
        $this->actingAs($user)->post('/pengaturan/notifikasi/uji');
    }

    $this->actingAs($user)->post('/pengaturan/notifikasi/uji')->assertTooManyRequests();
});

it('keeps separate rate limits for polling, search and test notifications', function () {
    $user = User::factory()->create();

    foreach (range(1, 8) as $ignored) {
        $this->actingAs($user)->getJson('/inbox/feed')->assertOk();
        $this->actingAs($user)->getJson('/cari/hasil?q=ab')->assertOk();
    }

    $this->actingAs($user)->post('/pengaturan/notifikasi/uji')->assertRedirect();
});

it('rate limits the polling feed', function () {
    $user = User::factory()->create();

    foreach (range(1, 10) as $ignored) {
        $this->actingAs($user)->getJson('/inbox/feed')->assertOk();
    }

    $this->actingAs($user)->getJson('/inbox/feed')->assertTooManyRequests();
});

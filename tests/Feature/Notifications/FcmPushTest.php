<?php

use App\Domain\Chat\Notifications\DirectMessageNotification;
use App\Domain\Devices\Models\Device;
use App\Domain\Notifications\Channels\FcmChannel;
use App\Domain\Notifications\Channels\InAppChannel;
use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Notifications\Enums\AndroidChannel;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Channel;
use App\Models\Message;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\Support\FakeModuleNotification;
use Tests\Support\FakeSensitivePushNotification;
use Tests\Support\FakeTaskPushNotification;

/*
| Push Android (FCM HTTP v1): kanal mengikuti preferensi In-app, jam tenang
| seperti email, no-op yang dicatat bila belum dikonfigurasi, token mati
| dihapus saat FCM menjawab UNREGISTERED, dan kegagalan push tidak pernah
| menggagalkan notifikasi.
*/

/** Writes a service-account JSON with a throwaway RSA key and points config at it. */
function configureFcm(): string
{
    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($key, $pem);
    $path = tempnam(sys_get_temp_dir(), 'fcm-sa-').'.json';
    file_put_contents($path, json_encode([
        'type' => 'service_account',
        'project_id' => 'ruangkerja-test',
        'client_email' => 'push@ruangkerja-test.iam.gserviceaccount.com',
        'private_key' => $pem,
        'token_uri' => 'https://oauth2.googleapis.com/token',
    ]));
    config(['services.fcm.project_id' => 'ruangkerja-test', 'services.fcm.service_account_json' => $path]);
    Cache::forget('fcm.access-token');

    return $path;
}

function fcmSends(): array
{
    return Http::recorded(fn (Request $request) => str_contains($request->url(), 'fcm.googleapis.com'))
        ->map(fn (array $pair) => $pair[0])->values()->all();
}

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00', 'Asia/Jakarta')); // Senin jam kerja
    $this->user = User::factory()->create();
    $this->device = Device::factory()->create(['user_id' => $this->user->id, 'push_token' => 'tok-'.str_repeat('a', 60)]);
});

afterEach(function () {
    $path = config('services.fcm.service_account_json');

    if (is_string($path) && str_contains($path, 'fcm-sa-') && is_file($path)) {
        @unlink($path);
    }
});

it('adds the FCM channel next to the in-app one only for users with a push token', function () {
    $notification = new FakeModuleNotification(NotificationType::TaskAssigned);
    $withoutDevice = User::factory()->create();
    $deviceless = User::factory()->create();
    Device::factory()->withoutPushToken()->create(['user_id' => $deviceless->id]);

    expect($notification->via($this->user))->toBe([InAppChannel::class, 'broadcast', FcmChannel::class, 'mail'])
        ->and($notification->via($withoutDevice))->toBe([InAppChannel::class, 'broadcast', 'mail'])
        ->and($notification->via($deviceless))->toBe([InAppChannel::class, 'broadcast', 'mail']);
});

it('follows the in-app preference: switching in-app off removes push too', function () {
    NotificationPreference::query()->create(['user_id' => $this->user->id, 'event' => NotificationEvent::TaskAssigned->value, 'channel' => NotificationChannel::InApp->value, 'enabled' => false]);

    expect((new FakeModuleNotification(NotificationType::TaskAssigned))->via($this->user))->toBe(['mail']);
});

it('is not used while notifications are held for leave', function () {
    NotificationSetting::query()->create(['user_id' => $this->user->id, 'digest_time' => '07:30:00', 'quiet_hours' => true, 'pause_while_on_leave' => true]);
    app()->instance(UserAvailability::class, new class implements UserAvailability
    {
        public function isOnLeave(User $user, CarbonInterface $at): bool
        {
            return true;
        }
    });

    expect((new FakeModuleNotification(NotificationType::TaskAssigned))->via($this->user))->toBe([InAppChannel::class]);
});

it('is delayed in quiet hours like email and sent at once outside them', function () {
    $notification = new FakeModuleNotification(NotificationType::TaskAssigned);

    expect($notification->withDelay($this->user, FcmChannel::class))->toBeNull();

    $this->travelTo(CarbonImmutable::parse('2026-10-05 21:00', 'Asia/Jakarta'));
    $delay = $notification->withDelay($this->user, FcmChannel::class);

    expect($delay)->not->toBeNull()
        ->and(CarbonImmutable::instance($delay)->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'))->toBe('2026-10-06 07:00');

    NotificationSetting::query()->create(['user_id' => $this->user->id, 'digest_time' => '07:30:00', 'quiet_hours' => false, 'pause_while_on_leave' => false]);

    expect($notification->withDelay($this->user, FcmChannel::class))->toBeNull();
});

it('is a logged no-op when FCM is not configured and never touches the network', function () {
    Http::fake();
    Log::spy();
    config(['services.fcm.project_id' => null, 'services.fcm.service_account_json' => null]);

    $this->user->notify(new FakeModuleNotification(NotificationType::TaskAssigned));

    Http::assertNothingSent();
    Log::shouldHaveReceived('info')->withArgs(fn (string $message) => str_contains($message, 'FCM belum dikonfigurasi'))->once();
    expect($this->device->fresh()->push_token)->not->toBeNull();
});

it('sends the contract payload to every device with a push token', function () {
    configureFcm();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.fake', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => Http::response(['name' => 'projects/ruangkerja-test/messages/1']),
    ]);
    $second = Device::factory()->create(['user_id' => $this->user->id, 'push_token' => 'tok-'.str_repeat('b', 60)]);
    Device::factory()->withoutPushToken()->create(['user_id' => $this->user->id]);
    $task = Task::factory()->create();

    $this->user->notify(new FakeTaskPushNotification($task));

    $sends = fcmSends();
    expect($sends)->toHaveCount(2);

    $first = $sends[0];
    $message = $first->data()['message'];

    expect($first->url())->toBe('https://fcm.googleapis.com/v1/projects/ruangkerja-test/messages:send')
        ->and($first->hasHeader('Authorization', 'Bearer ya29.fake'))->toBeTrue()
        ->and(collect($sends)->map(fn (Request $r) => $r->data()['message']['token'])->sort()->values()->all())
        ->toBe(collect([$this->device->push_token, $second->push_token])->sort()->values()->all())
        ->and($message['notification'])->toBe(['title' => 'Komentar baru di TMS-7', 'body' => 'Sari: tolong cek angkanya'])
        ->and($message['data']['type'])->toBe('task.commented')
        ->and($message['data']['target'])->toBe('tugas')
        ->and($message['data']['id'])->toBe($task->id)
        ->and($message['data']['anchor'])->toBe('komentar-01CMT')
        ->and($message['data']['params'])->toBe('{}')
        ->and($message['data']['android_channel'])->toBe('rk_tugas')
        ->and($message['data']['notification_id'])->toBeString()->not->toBe('')
        ->and($message['android']['priority'])->toBe('HIGH')
        ->and($message['android']['notification']['channel_id'])->toBe('rk_tugas');

    // Every data value is a string (FCM requirement).
    foreach ($message['data'] as $value) {
        expect($value)->toBeString();
    }

    // The same notification landed in the Inbox with the id the push carries.
    expect($this->user->notifications()->count())->toBe(1);
    expect($this->user->notifications()->first()->id)->toBe($message['data']['notification_id']);
});

it('opens the Inbox detail when the notification has no target and picks the quiet channel for info', function () {
    configureFcm();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.fake', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => Http::response([]),
    ]);

    $this->user->notify(new FakeModuleNotification(NotificationType::SystemAnnouncement));

    $message = fcmSends()[0]->data()['message'];
    $inboxId = $this->user->notifications()->first()->id;

    expect($message['data']['target'])->toBe('inbox')
        ->and($message['data']['id'])->toBe($inboxId)
        ->and($message['data']['android_channel'])->toBe('rk_info')
        ->and($message['android']['priority'])->toBe('NORMAL');
});

it('reuses the cached OAuth token and refreshes it once when FCM answers 401', function () {
    configureFcm();
    $fcmCalls = 0;
    Http::fake([
        'oauth2.googleapis.com/*' => Http::sequence()
            ->push(['access_token' => 'ya29.old', 'expires_in' => 3599])
            ->push(['access_token' => 'ya29.new', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => function (Request $request) use (&$fcmCalls) {
            $fcmCalls++;

            return $request->hasHeader('Authorization', 'Bearer ya29.new')
                ? Http::response(['name' => 'ok'])
                : Http::response(['error' => ['code' => 401, 'status' => 'UNAUTHENTICATED']], 401);
        },
    ]);

    $this->user->notify(new FakeModuleNotification(NotificationType::TaskAssigned));

    expect($fcmCalls)->toBe(2)
        ->and(Http::recorded(fn (Request $r) => str_contains($r->url(), 'oauth2.googleapis.com')))->toHaveCount(2)
        ->and(Cache::get('fcm.access-token'))->toBe('ya29.new');
});

it('removes the push token when FCM says UNREGISTERED but keeps it on other failures', function () {
    configureFcm();
    $dead = Device::factory()->create(['user_id' => $this->user->id, 'push_token' => 'dead-'.str_repeat('c', 60)]);
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.fake', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => function (Request $request) use ($dead) {
            return $request->data()['message']['token'] === $dead->push_token
                ? Http::response(['error' => ['code' => 404, 'status' => 'NOT_FOUND', 'details' => [['@type' => 'type.googleapis.com/google.firebase.fcm.v1.FcmError', 'errorCode' => 'UNREGISTERED']]]], 404)
                : Http::response(['error' => ['code' => 503, 'status' => 'UNAVAILABLE']], 503);
        },
    ]);

    $this->user->notify(new FakeModuleNotification(NotificationType::TaskAssigned));

    expect($dead->fresh()->push_token)->toBeNull()
        ->and($this->device->fresh()->push_token)->not->toBeNull()
        // The Inbox record is unaffected by push failures.
        ->and($this->user->notifications()->count())->toBe(1);
});

it('never fails the notification when the push transport throws', function () {
    configureFcm();
    Http::fake(['*' => fn () => throw new RuntimeException('jaringan putus')]);

    $this->user->notify(new FakeModuleNotification(NotificationType::TaskAssigned));

    expect($this->user->notifications()->count())->toBe(1)
        ->and($this->device->fresh()->push_token)->not->toBeNull();
});

it('uses the neutral external text for sensitive notifications', function () {
    configureFcm();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.fake', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => Http::response([]),
    ]);
    $notification = new FakeSensitivePushNotification;

    $this->user->notify($notification);

    $message = fcmSends()[0]->data()['message'];

    expect($message['notification']['title'])->toBe('Ada kandidat yang menunggu keputusan Anda')
        ->and($message['notification']['title'])->not->toContain('Budi')
        ->and($message['android']['notification']['channel_id'])->toBe('rk_mendesak');
});

it('puts every notification type on the FCM channel with a channel, a target and a group key', function () {
    $fcm = app(FcmChannel::class);
    $withoutPush = [];

    foreach (NotificationType::cases() as $type) {
        $notification = new FakeModuleNotification($type);

        if (! in_array(FcmChannel::class, $notification->via($this->user), true)) {
            $withoutPush[] = $type->value;
        }

        $message = $fcm->message($this->user, $notification);
        $channel = AndroidChannel::forType($type);

        expect($message['data']['type'])->toBe($type->value)
            ->and($message['data']['android_channel'])->toBe($channel->value)
            ->and($message['android']['notification']['channel_id'])->toBe($channel->value)
            ->and($message['data']['group_key'])->toBeString()->not->toBe('')
            ->and($message['data']['notification_id'])->toBeString();

        foreach ($message['data'] as $value) {
            expect($value)->toBeString();
        }
    }

    expect($withoutPush)->toBe([]);
});

it('collapses chat pushes per conversation and points follow-ups at the existing Inbox row', function () {
    $fcm = app(FcmChannel::class);
    $sender = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'dm', 'name' => null, 'direct_key' => str_repeat('c', 64)]);
    $message = Message::factory()->create(['channel_id' => $channel->id, 'user_id' => $sender->id]);

    $first = new DirectMessageNotification($channel, $message, $sender);
    $followUp = new DirectMessageNotification($channel, $message, $sender, 'inbox-row-1');

    expect($first->pushOnly())->toBeFalse()
        ->and($first->via($this->user))->toContain(InAppChannel::class, FcmChannel::class)
        ->and($followUp->pushOnly())->toBeTrue()
        ->and($followUp->via($this->user))->toBe([FcmChannel::class]);

    $data = $fcm->message($this->user, $followUp);

    expect($data['android']['notification']['tag'])->toBe('chat:'.$channel->id)
        ->and($data['data']['group_key'])->toBe('chat:'.$channel->id)
        ->and($data['data']['notification_id'])->toBe('inbox-row-1')
        ->and($data['data']['target'])->toBe('obrolan')
        ->and($data['data']['id'])->toBe($channel->id)
        ->and($data['data']['android_channel'])->toBe('rk_obrolan');
    expect($fcm->message($this->user, $first)['android']['notification']['tag'])->toBe('chat:'.$channel->id);
});

it('drops a push-only follow-up when the user switched in-app off or has no phone', function () {
    $sender = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'dm', 'name' => null, 'direct_key' => str_repeat('d', 64)]);
    $message = Message::factory()->create(['channel_id' => $channel->id, 'user_id' => $sender->id]);
    $followUp = new DirectMessageNotification($channel, $message, $sender, 'inbox-row-2');

    expect($followUp->via(User::factory()->create()))->toBe([]);

    NotificationPreference::query()->create(['user_id' => $this->user->id, 'event' => NotificationEvent::ChatMessage->value, 'channel' => NotificationChannel::InApp->value, 'enabled' => false]);

    expect($followUp->via($this->user))->toBe([]);
});

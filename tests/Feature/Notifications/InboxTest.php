<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Models\InboxNotification;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

function inboxUser(Role $role = Role::Anggota): User
{
    $user = User::factory()->create();
    $user->assignRole($role->value);

    return $user;
}

it('requires authentication', function () {
    $this->get('/inbox')->assertRedirect(route('login'));
    $this->getJson('/inbox/feed')->assertUnauthorized();
});

it('lists only the signed-in user\'s notifications, newest first', function () {
    $user = inboxUser();
    $old = InboxNotification::factory()->recipient($user)->create(['created_at' => now()->subHour()]);
    $new = InboxNotification::factory()->recipient($user)->create(['created_at' => now()]);
    InboxNotification::factory()->create(); // someone else's

    $this->actingAs($user)
        ->get('/inbox')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('inbox/index')
            ->has('items.data', 2)
            ->where('items.data.0.id', $new->id)
            ->where('items.data.1.id', $old->id)
            ->where('counts', ['all' => 2, 'unread' => 2, 'action' => 0])
            ->where('filters', ['tab' => 'all', 'kind' => null, 'archived' => false])
            ->where('inbox.unread', 2));
});

it('presents the uniform item shape', function () {
    $user = inboxUser();
    InboxNotification::factory()->recipient($user)->ofType(NotificationType::RequestSubmitted)->withData([
        'title' => 'Maya Lestari mengajukan cuti 12–14 Okt',
        'actor' => ['id' => 'x', 'name' => 'Maya Lestari', 'avatar' => null],
        'subject' => ['type' => 'request', 'id' => '01ABC', 'code' => 'CUT-2026-10-0014', 'title' => 'Cuti tahunan'],
    ])->create();

    $this->actingAs($user)
        ->get('/inbox')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.data.0.type', 'request.submitted')
            ->where('items.data.0.category', 'request')
            ->where('items.data.0.icon', 'check-check')
            ->where('items.data.0.tone', 'info')
            ->where('items.data.0.title', 'Maya Lestari mengajukan cuti 12–14 Okt')
            ->where('items.data.0.actor.name', 'Maya Lestari')
            ->where('items.data.0.subject.code', 'CUT-2026-10-0014')
            ->where('items.data.0.action_required', true)
            ->where('items.data.0.read_at', null));
});

it('filters by tab, kind and archive', function (array $query, int $expected) {
    $user = inboxUser();
    InboxNotification::factory()->recipient($user)->ofType(NotificationType::Mention)->create();
    InboxNotification::factory()->recipient($user)->ofType(NotificationType::TaskAssigned)->read()->create();
    InboxNotification::factory()->recipient($user)->ofType(NotificationType::RequestSubmitted)->create();
    InboxNotification::factory()->recipient($user)->ofType(NotificationType::RequestSubmitted)->create(['resolved_at' => now()]);
    InboxNotification::factory()->recipient($user)->ofType(NotificationType::CheckInReminder)->archived()->create();

    $this->actingAs($user)
        ->get('/inbox?'.http_build_query($query))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('items.data', $expected));
})->with([
    'all' => [[], 4],
    'unread' => [['tab' => 'unread'], 3],
    'needs action' => [['tab' => 'action'], 1],
    'mentions' => [['kind' => 'mention'], 1],
    'task category' => [['kind' => 'task'], 2],
    'request category' => [['kind' => 'request'], 2],
    'archive' => [['archived' => 1], 1],
    'archive + attendance' => [['archived' => 1, 'kind' => 'attendance'], 1],
]);

it('rejects unknown filters', function () {
    $this->actingAs(inboxUser())
        ->getJson('/inbox?tab=semua&kind=gosip')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['tab', 'kind']);
});

it('marks a notification read and unread', function () {
    $user = inboxUser();
    $notification = InboxNotification::factory()->recipient($user)->create();

    $this->actingAs($user)->postJson("/inbox/{$notification->id}/read")->assertOk()->assertJson(['unread' => 0]);
    expect($notification->refresh()->read_at)->not->toBeNull();

    $this->actingAs($user)->deleteJson("/inbox/{$notification->id}/read")->assertOk()->assertJson(['unread' => 1]);
    expect($notification->refresh()->read_at)->toBeNull();
});

it('archives (and reads) a notification, then restores it', function () {
    $user = inboxUser();
    $notification = InboxNotification::factory()->recipient($user)->create();

    $this->actingAs($user)->from('/inbox')->post("/inbox/{$notification->id}/archive")->assertRedirect('/inbox');
    $notification->refresh();
    expect($notification->archived_at)->not->toBeNull()->and($notification->read_at)->not->toBeNull();

    $this->actingAs($user)->deleteJson("/inbox/{$notification->id}/archive")->assertOk();
    expect($notification->refresh()->archived_at)->toBeNull();
});

it('marks all active notifications read', function () {
    $user = inboxUser();
    InboxNotification::factory()->recipient($user)->count(3)->create();
    $archived = InboxNotification::factory()->recipient($user)->create(['archived_at' => now()]);
    $foreign = InboxNotification::factory()->create();

    $this->actingAs($user)->postJson('/inbox/read-all')->assertOk()->assertJson(['unread' => 0, 'marked' => 3]);

    expect($archived->refresh()->read_at)->toBeNull()
        ->and($foreign->refresh()->read_at)->toBeNull();
});

it('flashes a toast after marking all read from the Inbox page', function () {
    $user = inboxUser();
    InboxNotification::factory()->recipient($user)->create();

    $this->actingAs($user)->from('/inbox')->post('/inbox/read-all')
        ->assertRedirect('/inbox')
        ->assertSessionHas('toast', ['type' => 'success', 'message' => '1 notifikasi ditandai dibaca.']);
});

it('forbids every role from touching another user\'s notification', function (Role $role, string $method, string $suffix) {
    $actor = inboxUser($role);
    $notification = InboxNotification::factory()->create();

    $this->actingAs($actor)->json($method, "/inbox/{$notification->id}/{$suffix}")->assertForbidden();

    expect($notification->refresh()->read_at)->toBeNull()
        ->and($notification->archived_at)->toBeNull();
})->with(Role::cases())->with([
    'read' => ['POST', 'read'],
    'unread' => ['DELETE', 'read'],
    'archive' => ['POST', 'archive'],
    'unarchive' => ['DELETE', 'archive'],
    'open' => ['GET', 'open'],
]);

it('opens a notification: marks it read and redirects to its page', function () {
    $user = inboxUser();
    $notification = InboxNotification::factory()->recipient($user)->withData(['url' => '/pengaturan/notifikasi'])->create();

    $this->actingAs($user)->get("/inbox/{$notification->id}/open")->assertRedirect('/pengaturan/notifikasi');

    expect($notification->refresh()->read_at)->not->toBeNull();
});

it('falls back to the Inbox for missing or external URLs', function (?string $url) {
    $user = inboxUser();
    $notification = InboxNotification::factory()->recipient($user)->withData(['url' => $url])->create();

    $this->actingAs($user)->get("/inbox/{$notification->id}/open")->assertRedirect('/inbox');
})->with([null, 'https://evil.test/phish', '//evil.test']);

it('returns 404 for unknown or malformed ids', function (string $id) {
    $this->actingAs(inboxUser())->postJson("/inbox/{$id}/read")->assertNotFound();
})->with(['not-a-uuid', (string) Str::uuid()]);

it('serves the polling feed with the counter and new notifications only', function () {
    $user = inboxUser();
    $this->travelTo(now()->subMinutes(10));
    InboxNotification::factory()->recipient($user)->create(['created_at' => now()]);
    $this->travelBack();
    $cursor = now()->subMinute();
    $fresh = InboxNotification::factory()->recipient($user)->create(['created_at' => now()]);
    InboxNotification::factory()->create(['created_at' => now()]);

    $this->actingAs($user)
        ->getJson('/inbox/feed?after='.urlencode($cursor->toIso8601String()))
        ->assertOk()
        ->assertJsonPath('unread', 2)
        ->assertJsonCount(1, 'notifications')
        ->assertJsonPath('notifications.0.id', $fresh->id);
});

it('shares the unread counter with every page', function () {
    $user = inboxUser();
    InboxNotification::factory()->recipient($user)->count(2)->create();
    InboxNotification::factory()->recipient($user)->read()->create();
    InboxNotification::factory()->recipient($user)->archived()->create();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page->where('inbox.unread', 2));
});

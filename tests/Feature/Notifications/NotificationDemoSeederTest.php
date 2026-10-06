<?php

use App\Models\InboxNotification;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\NotificationDemoSeeder;

it('seeds demo Inbox content idempotently', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(NotificationDemoSeeder::class);

    $dimas = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();
    $rizky = User::query()->where('email', 'anggota@demo.test')->firstOrFail();

    expect(InboxNotification::query()->visibleTo($dimas)->count())->toBe(9)
        ->and(InboxNotification::query()->visibleTo($dimas)->needsAction()->count())->toBe(3)
        ->and(InboxNotification::query()->visibleTo($dimas)->whereNull('read_at')->count())->toBe(6)
        ->and(InboxNotification::query()->visibleTo($rizky)->count())->toBe(1)
        ->and(InboxNotification::query()->count())->toBe(15);

    $mention = InboxNotification::query()->visibleTo($dimas)->where('type', 'mention')->sole();
    expect($mention->data['actor']['name'])->toBe('Sari Wulandari')
        ->and($mention->subject_id)->toBeNull();
});

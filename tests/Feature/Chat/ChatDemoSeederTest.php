<?php

use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Queries\ChatInbox;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\ChatDemoSeeder;
use Database\Seeders\DatabaseSeeder;

it('seeds demo conversations once, with workspace channels for every shared workspace', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(ChatDemoSeeder::class);

    $kadiv = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();
    $programmer = User::query()->where('email', 'programmer@demo.test')->firstOrFail();

    expect(Channel::query()->where('type', ChannelType::Workspace)->count())
        ->toBe(Workspace::query()->where('type', '!=', 'personal')->count())
        ->and(Channel::query()->where('type', ChannelType::Public)->where('name', 'umum')->count())->toBe(1)
        ->and(Channel::query()->whereIn('type', [ChannelType::Dm, ChannelType::Group])->count())->toBe(3)
        ->and(Message::withTrashed()->count())->toBe(35)
        ->and(app(ChatInbox::class)->unreadChannels($kadiv))->toBe(3)
        ->and(Channel::query()->visibleTo($programmer)->whereHas('messages')->count())->toBeGreaterThanOrEqual(2);
});

<?php

use App\Models\Comment;
use App\Models\InboxNotification;
use App\Models\Mention;
use App\Models\SavedView;
use App\Models\Task;
use Database\Seeders\DemoUserSeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\TaskCollaborationSeeder;
use Database\Seeders\WorkspaceSeeder;

it('seeds the PLQ-21 discussion idempotently without notifications', function () {
    $this->seed([RoleSeeder::class, DemoUserSeeder::class, OrganizationSeeder::class, WorkspaceSeeder::class]);
    InboxNotification::query()->delete();

    $this->seed(TaskCollaborationSeeder::class);
    $this->seed(TaskCollaborationSeeder::class);

    $task = Task::query()->whereHas('workspace', fn ($q) => $q->where('key', 'PLQ'))->where('number', 21)->firstOrFail();

    expect(Comment::query()->count())->toBe(2)
        ->and(Mention::query()->count())->toBe(3)
        ->and(SavedView::query()->count())->toBe(2)
        ->and($task->description['content'][1]['type'])->toBe('heading')
        ->and(InboxNotification::query()->count())->toBe(0);
});

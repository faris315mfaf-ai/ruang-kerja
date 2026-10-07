<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Models\Channel;
use App\Models\Company;
use App\Models\Division;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

/*
| Private per-user channel for broadcast notifications (Laravel default name).
| IDs are ULID strings: compare as strings — an (int) cast would map many
| different ULIDs to the same number.
*/
Broadcast::channel('App.Models.User.{id}', function (User $user, string $id): bool {
    return $user->id === $id;
});

// Sprint 5/6: board & detail events (task.created/updated/moved/deleted, comment.posted/updated/deleted)
// on `private-workspace.{id}` for everyone who may see the workspace.
// The same rule authorizes `presence-workspace.{id}` (board presence per card): members whisper
// which task they have open and whether they are typing in it (client events only, nothing
// stored). `read_only` (view-only management, archived workspace) lets clients ignore typing
// hints from people who cannot edit or comment. Private channels ignore the returned array.
Broadcast::channel('workspace.{workspace}', function (User $user, Workspace $workspace): array|false {
    if (Gate::forUser($user)->denies('view', $workspace)) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
        'avatar' => $user->avatar_url,
        'read_only' => $workspace->isArchived() || app(WorkspacePolicy::class)->isViewOnly($user, $workspace),
    ];
});

// Sprint 6: presence "X sedang melihat tugas ini" — members are the people with the task open.
Broadcast::channel('task.{task}', function (User $user, Task $task): array|false {
    if (Gate::forUser($user)->denies('view', $task)) {
        return false;
    }

    return ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url];
});

// Sprint 2 — live attendance boards (authorized by AttendanceDayPolicy).
// One channel per company (review fix 3-9 B): only viewers of that company
// with attendance.view_all may listen, so several companies never share a feed.
Broadcast::channel('company.{company}.attendance', function (User $user, Company $company): bool {
    return $user->company_id === $company->id
        && $user->can('viewCompanyFeed', AttendanceDay::class);
});

Broadcast::channel('division.{division}.attendance', function (User $user, Division $division): bool {
    return $user->can('viewDivisionFeed', [AttendanceDay::class, $division]);
});

// Obrolan (F2-1): message/reaction/read events of one channel (ChannelPolicy::view);
// clients also whisper "typing" here.
Broadcast::channel('chat.{channel}', function (User $user, Channel $channel): bool {
    return Gate::forUser($user)->allows('view', $channel);
});

// Obrolan presence: who is online among the employees of the company (green dots).
Broadcast::channel('chat-online.{company}', function (User $user, Company $company): array|false {
    return $user->company_id === $company->id
        ? ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url]
        : false;
});

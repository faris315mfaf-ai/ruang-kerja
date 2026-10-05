<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Models\Division;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
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
// for everyone who may see the workspace.
Broadcast::channel('workspace.{workspace}', function (User $user, Workspace $workspace): bool {
    return Gate::forUser($user)->allows('view', $workspace);
});

// Sprint 6: presence "X sedang melihat tugas ini" — members are the people with the task open.
Broadcast::channel('task.{task}', function (User $user, Task $task): array|false {
    if (Gate::forUser($user)->denies('view', $task)) {
        return false;
    }

    return ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url];
});

// Sprint 2 — live attendance boards (authorized by AttendanceDayPolicy).
Broadcast::channel('company.attendance', function (User $user): bool {
    return $user->can('viewCompanyFeed', AttendanceDay::class);
});

Broadcast::channel('division.{division}.attendance', function (User $user, Division $division): bool {
    return $user->can('viewDivisionFeed', [AttendanceDay::class, $division]);
});

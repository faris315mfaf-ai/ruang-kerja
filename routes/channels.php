<?php

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

// Sprint 5/6: board events (TaskCreated/Updated/Moved/Deleted) for everyone who may see the workspace.
Broadcast::channel('workspace.{workspace}', function (User $user, Workspace $workspace): bool {
    return Gate::forUser($user)->allows('view', $workspace);
});

<?php

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Sprint 5/6: board events (TaskCreated/Updated/Moved/Deleted) for everyone who may see the workspace.
Broadcast::channel('workspace.{workspace}', function (User $user, Workspace $workspace): bool {
    return Gate::forUser($user)->allows('view', $workspace);
});

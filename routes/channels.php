<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
| Private per-user channel for broadcast notifications (Laravel default name).
| IDs are ULID strings: compare as strings — an (int) cast would map many
| different ULIDs to the same number.
*/
Broadcast::channel('App.Models.User.{id}', function (User $user, string $id): bool {
    return $user->id === $id;
});

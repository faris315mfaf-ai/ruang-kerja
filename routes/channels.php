<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// User IDs are ULID strings: compare as strings (an (int) cast turns most ULIDs into 1).
Broadcast::channel('App.Models.User.{id}', function (User $user, string $id): bool {
    return $user->id === $id;
});

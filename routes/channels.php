<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Models\Division;
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

// Sprint 2 — live attendance boards (authorized by AttendanceDayPolicy).
Broadcast::channel('company.attendance', function (User $user): bool {
    return $user->can('viewCompanyFeed', AttendanceDay::class);
});

Broadcast::channel('division.{division}.attendance', function (User $user, Division $division): bool {
    return $user->can('viewDivisionFeed', [AttendanceDay::class, $division]);
});

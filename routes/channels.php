<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Models\Division;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Sprint 2 — live attendance boards (authorized by AttendanceDayPolicy).
Broadcast::channel('company.attendance', function (User $user): bool {
    return $user->can('viewCompanyFeed', AttendanceDay::class);
});

Broadcast::channel('division.{division}.attendance', function (User $user, Division $division): bool {
    return $user->can('viewDivisionFeed', [AttendanceDay::class, $division]);
});

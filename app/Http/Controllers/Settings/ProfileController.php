<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Read-only profile: organization data is master data managed by HR.
 */
class ProfileController extends Controller
{
    public function edit(#[CurrentUser] User $user): Response
    {
        Gate::authorize('view', $user);

        $user->loadMissing(['division:id,name', 'team:id,name', 'position:id,name', 'manager:id,name,email']);

        return Inertia::render('settings/profile', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'division' => $user->division?->name,
                'team' => $user->team?->name,
                'position' => $user->position?->name,
                'manager' => $user->manager === null ? null : [
                    'name' => $user->manager->name,
                    'email' => $user->manager->email,
                ],
                'workMode' => $user->work_mode->label(),
                'joinedAt' => $user->joined_at?->toDateString(),
            ],
            'canManageCredentials' => Gate::forUser($user)->allows('manageCredentials', $user),
        ]);
    }
}

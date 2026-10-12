<?php

namespace App\Domain\Auth\Services;

use App\Domain\Devices\Models\Device;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Ends every existing sign-in of a user whose password was replaced by someone
 * else (HR) or through "Lupa kata sandi":
 *
 * - browser sessions store the password hash (AuthenticateSession) and
 *   remember-me cookies embed it too, so the new hash already invalidates them
 *   on their next request;
 * - the remember token is rotated as well (call before saving the user);
 * - with the database session driver the rows are deleted right away;
 * - mobile app sign-ins (Sanctum tokens, one per installation) are revoked
 *   and the installations stop receiving pushes until they sign in again.
 */
final class SessionTerminator
{
    public function rotateRememberToken(User $user): void
    {
        $user->setRememberToken(Str::random(60));
    }

    public function deleteStoredSessions(User $user): void
    {
        if (config('session.driver') !== 'database') {
            return;
        }

        $connection = config('session.connection');

        DB::connection(is_string($connection) ? $connection : null)
            ->table(config()->string('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->delete();
    }

    /**
     * Revokes every API token of the user (the app answers 401 and returns to
     * the login screen) and clears the push tokens of their installations, so
     * a signed-out phone no longer receives notifications. The device rows stay
     * ("Perangkat saya"); signing in again refreshes them.
     */
    public function revokeApiTokens(User $user): void
    {
        $user->tokens()->delete();

        Device::query()
            ->where('user_id', $user->id)
            ->whereNotNull('push_token')
            ->update(['push_token' => null]);
    }
}

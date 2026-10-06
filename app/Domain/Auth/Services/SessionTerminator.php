<?php

namespace App\Domain\Auth\Services;

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
 * - with the database session driver the rows are deleted right away.
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
}

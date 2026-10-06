<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Services\SessionTerminator;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Pengaturan › Keamanan › Ubah kata sandi (the signed-in employee; the current
 * password was validated by PasswordUpdateRequest). Clears "wajib ganti",
 * writes one `user.password_changed` audit row (never the value) and signs out
 * every other device while keeping this one signed in.
 */
final readonly class ChangeOwnPassword
{
    public function __construct(
        private AuditLogger $audit,
        private SessionTerminator $sessions,
    ) {}

    public function handle(User $user, #[\SensitiveParameter] string $password): void
    {
        DB::transaction(function () use ($user, $password): void {
            $wasRequired = $user->password_change_required;

            $user->forceFill([
                'password' => $password,
                'password_change_required' => false,
            ]);
            $this->sessions->rotateRememberToken($user);
            // One explicit audit row instead of a generic user.updated.
            $user->saveQuietly();

            $this->audit->log('user.password_changed', $user, null, [
                'required_change' => $wasRequired,
            ], $user);
        });

        // Sign out every other device (AuthenticateSession compares the session's
        // password hash) and re-issue this device's session hash / remember-me
        // cookie. The re-hash of the same password is not a master-data change.
        if (Auth::guard('web')->user()?->is($user) === true) {
            Model::withoutEvents(fn () => Auth::guard('web')->logoutOtherDevices($password));
        }
    }
}

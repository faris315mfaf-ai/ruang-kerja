<?php

namespace App\Domain\Auth\Jobs;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Sends a password reset link, but only to an active Super Admin (the only
 * accounts with password sign-in). Queued for every request so the HTTP
 * response is identical — content and timing — whether or not the address
 * belongs to anyone. The broker's per-user throttle applies silently.
 */
final class SendSuperAdminPasswordResetLink implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(#[\SensitiveParameter] public string $email) {}

    public function handle(): void
    {
        $user = User::query()
            ->whereRaw('lower(email) = ?', [Str::lower(trim($this->email))])
            ->where('status', UserStatus::Active->value)
            ->first();

        if ($user === null || ! $user->hasRole(Role::SuperAdmin)) {
            return;
        }

        Password::broker((string) config('fortify.passwords'))->sendResetLink(['email' => $user->email]);
    }
}

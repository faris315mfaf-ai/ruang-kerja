<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Notifications\PasswordResetRequestedNotification;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;

/**
 * "Lupa kata sandi" form (guest). Always returns a fresh random request token
 * that the controller keeps in the session; the response, the waiting page and
 * its timing are the same whether or not the address belongs to an active
 * employee (anti-enumeration).
 *
 * For an active employee: earlier open requests are canceled (one at a time),
 * a new `pending` row stores only the token's hash, and HR is notified (for a
 * Super Admin: the other Super Admins). Unknown/inactive addresses get no row.
 */
final readonly class RequestPasswordReset
{
    /** Minimum duration of every call, whatever the outcome. */
    public const int TIMEBOX_MICROSECONDS = 400_000;

    public function __construct(private ResolveNotificationsForSubject $resolveNotifications) {}

    public function handle(string $email, ?string $ip = null, ?string $userAgent = null): string
    {
        $token = Str::random(64);

        app(Timebox::class)->call(function () use ($email, $ip, $userAgent, $token): void {
            $this->create(Str::lower(trim($email)), $token, $ip, $userAgent);
        }, self::TIMEBOX_MICROSECONDS);

        return $token;
    }

    private function create(string $email, string $token, ?string $ip, ?string $userAgent): void
    {
        $user = $email === '' ? null : User::query()
            ->whereRaw('lower(email) = ?', [$email])
            ->where('status', UserStatus::Active->value)
            ->first();

        if ($user === null) {
            return;
        }

        $created = DB::transaction(function () use ($user, $token, $ip, $userAgent): PasswordResetRequest {
            // Serializes concurrent requests of the same employee (one open request).
            User::query()->whereKey($user->id)->lockForUpdate()->first(['id']);

            $open = PasswordResetRequest::query()
                ->where('user_id', $user->id)
                ->whereIn('status', [PasswordResetStatus::Pending->value, PasswordResetStatus::Approved->value])
                ->get();

            foreach ($open as $previous) {
                $previous->forceFill(['status' => PasswordResetStatus::Canceled, 'setup_token_hash' => null])->save();
                $this->resolveNotifications->handle($previous, NotificationType::PasswordResetRequested);
            }

            return PasswordResetRequest::query()->create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'email' => $user->email,
                'request_token_hash' => PasswordResetRequest::hashToken($token),
                'status' => PasswordResetStatus::Pending,
                'expires_at' => CarbonImmutable::now()->addHours(PasswordResetRequest::PENDING_HOURS),
                'ip' => $ip,
                'user_agent' => $userAgent === null ? null : Str::limit($userAgent, 509),
            ]);
        });

        Notification::send($this->recipients($user), new PasswordResetRequestedNotification($created, $user));
    }

    /**
     * HR of the company; a Super Admin's request goes to the other Super Admins.
     * Without an active HR, the Super Admins decide.
     *
     * @return Collection<int, User>
     */
    private function recipients(User $employee): Collection
    {
        $withRole = fn (Role $role): Collection => User::query()
            ->where('company_id', $employee->company_id)
            ->where('status', UserStatus::Active->value)
            ->whereKeyNot($employee->id)
            ->whereHas('roles', fn (Builder $roles) => $roles->where('name', $role->value))
            ->get();

        if ($employee->isSuperAdmin()) {
            return $withRole(Role::SuperAdmin);
        }

        $hr = $withRole(Role::Hr);

        return $hr->isNotEmpty() ? $hr : $withRole(Role::SuperAdmin);
    }
}

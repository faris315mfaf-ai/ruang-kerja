<?php

namespace App\Domain\Organization\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Writes append-only rows to `audit_logs`.
 *
 *   app(AuditLogger::class)->log('selfie.viewed', $attendanceLog);
 *   app(AuditLogger::class)->log('request.approved', $request, ['status' => 'waiting'], ['status' => 'approved']);
 *
 * Actor defaults to the signed-in user (null in console/queue). Secrets are never
 * stored: sensitive keys and encrypted/hashed attributes are masked.
 */
final class AuditLogger
{
    public const string MASK = '***';

    /**
     * Attribute names masked wherever they appear (also nested).
     *
     * @var list<string>
     */
    public const array SENSITIVE_KEYS = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'nik',
        'token',
        'access_token',
        'refresh_token',
        'secret',
        'api_key',
    ];

    public function __construct(private readonly Request $request) {}

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public function log(
        string $action,
        ?Model $subject = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?User $actor = null,
    ): AuditLog {
        $actor ??= $this->currentUser();
        $userAgent = $this->request->userAgent();

        return AuditLog::query()->create([
            'user_id' => $actor?->getKey(),
            'action' => $action,
            'auditable_type' => $subject?->getMorphClass(),
            'auditable_id' => $subject?->getKey(),
            'old_values' => $oldValues === null ? null : self::sanitize($oldValues),
            'new_values' => $newValues === null ? null : self::sanitize($newValues),
            'ip_address' => $this->request->ip(),
            'user_agent' => $userAgent === null ? null : Str::limit($userAgent, 509),
        ]);
    }

    /**
     * Mask sensitive keys (recursively).
     *
     * @param  array<array-key, mixed>  $values
     * @return array<array-key, mixed>
     */
    public static function sanitize(array $values): array
    {
        foreach ($values as $key => $value) {
            if (is_string($key) && self::isSensitiveKey($key)) {
                $values[$key] = $value === null ? null : self::MASK;
            } elseif (is_array($value)) {
                $values[$key] = self::sanitize($value);
            }
        }

        return $values;
    }

    public static function isSensitiveKey(string $key): bool
    {
        $key = Str::lower($key);

        return in_array($key, self::SENSITIVE_KEYS, true)
            || str_contains($key, 'password')
            || str_contains($key, 'secret')
            || str_ends_with($key, '_token');
    }

    private function currentUser(): ?User
    {
        $user = Auth::user();

        return $user instanceof User ? $user : null;
    }
}

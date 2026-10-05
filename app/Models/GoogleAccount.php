<?php

namespace App\Models;

use App\Casts\PostgresTextArray;
use Carbon\CarbonImmutable;
use Database\Factories\GoogleAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user's connected Google account (per-user OAuth, scope drive.file).
 * Tokens are encrypted at rest and hidden from serialization.
 *
 * @property string $id
 * @property string $user_id
 * @property string $google_id
 * @property string $email
 * @property string $access_token
 * @property string|null $refresh_token
 * @property CarbonImmutable|null $expires_at
 * @property list<string> $scopes
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'google_id', 'email', 'access_token', 'refresh_token', 'expires_at', 'scopes'])]
#[Hidden(['access_token', 'refresh_token'])]
class GoogleAccount extends Model
{
    /** @use HasFactory<GoogleAccountFactory> */
    use HasFactory, HasUlids;

    public const string DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'expires_at' => 'datetime',
            'scopes' => PostgresTextArray::class,
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hasScope(string $scope): bool
    {
        return in_array($scope, $this->scopes, true);
    }

    /**
     * drive.file (or the broader drive scope) is required for the Picker.
     */
    public function hasDriveAccess(): bool
    {
        return $this->hasScope(self::DRIVE_FILE_SCOPE)
            || $this->hasScope('https://www.googleapis.com/auth/drive');
    }

    /**
     * The access token is missing, expired or expires within `$leewaySeconds`.
     */
    public function tokenExpired(int $leewaySeconds = 60): bool
    {
        return $this->expires_at === null
            || $this->expires_at->lte(now()->addSeconds($leewaySeconds));
    }

    /**
     * No usable token and no way to refresh it: the user must reconnect.
     */
    public function needsReconnect(): bool
    {
        return $this->refresh_token === null && $this->tokenExpired(0);
    }
}

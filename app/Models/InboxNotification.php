<?php

namespace App\Models;

use App\Domain\Notifications\Enums\NotificationCategory;
use App\Domain\Notifications\Enums\NotificationType;
use Carbon\CarbonImmutable;
use Database\Factories\InboxNotificationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\DatabaseNotification;

/**
 * A row of the `notifications` table as seen by the Inbox.
 *
 * Extends Laravel's DatabaseNotification (same table) with Inbox columns and
 * the visibility scope; every Inbox query must go through visibleTo().
 *
 * @property string $id
 * @property string $type
 * @property string $notifiable_type
 * @property string $notifiable_id
 * @property array<string, mixed> $data
 * @property string|null $subject_type
 * @property string|null $subject_id
 * @property bool $action_required
 * @property CarbonImmutable|null $resolved_at
 * @property CarbonImmutable|null $read_at
 * @property CarbonImmutable|null $archived_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
class InboxNotification extends DatabaseNotification
{
    /** @use HasFactory<InboxNotificationFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
            'action_required' => 'boolean',
            'resolved_at' => 'datetime',
            'read_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    /**
     * Only the recipient may see a notification (no role sees others' Inbox).
     *
     * @param  Builder<self>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->getKey());
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('archived_at');
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeArchived(Builder $query): void
    {
        $query->whereNotNull('archived_at');
    }

    /**
     * Unresolved "Perlu tindakan" items that are still in the Inbox.
     *
     * @param  Builder<self>  $query
     */
    public function scopeNeedsAction(Builder $query): void
    {
        $query->where('action_required', true)->whereNull('resolved_at')->whereNull('archived_at');
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeInCategory(Builder $query, NotificationCategory $category): void
    {
        $query->whereIn('type', array_map(
            fn (NotificationType $type): string => $type->value,
            $category->types(),
        ));
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeOfType(Builder $query, NotificationType ...$types): void
    {
        $query->whereIn('type', array_map(fn (NotificationType $type): string => $type->value, $types));
    }

    public function notificationType(): ?NotificationType
    {
        return NotificationType::tryFrom($this->type);
    }

    public function isActionPending(): bool
    {
        return $this->action_required && $this->resolved_at === null;
    }

    public function dataString(string $key): ?string
    {
        $value = data_get($this->data, $key);

        return is_string($value) ? $value : null;
    }
}

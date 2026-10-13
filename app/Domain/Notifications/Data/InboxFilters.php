<?php

namespace App\Domain\Notifications\Data;

use App\Domain\Notifications\Enums\NotificationCategory;

/**
 * Inbox list filters: tab (all · unread · action), kind (a category or
 * "mention") and whether to show the archive.
 */
final readonly class InboxFilters
{
    public const array TABS = ['all', 'unread', 'action'];

    public const string MENTION = 'mention';

    public function __construct(
        public string $tab = 'all',
        public ?string $kind = null,
        public bool $archived = false,
        // Mobile app "Belum dibaca" chip: combines with any tab (not part of toArray(), the web keeps it as a tab).
        public bool $unreadOnly = false,
    ) {}

    public function category(): ?NotificationCategory
    {
        return $this->kind === null ? null : NotificationCategory::tryFrom($this->kind);
    }

    /**
     * @return list<string>
     */
    public static function kinds(): array
    {
        return [self::MENTION, ...array_map(fn (NotificationCategory $category): string => $category->value, NotificationCategory::cases())];
    }

    /**
     * @return array{tab: string, kind: string|null, archived: bool}
     */
    public function toArray(): array
    {
        return ['tab' => $this->tab, 'kind' => $this->kind, 'archived' => $this->archived];
    }
}

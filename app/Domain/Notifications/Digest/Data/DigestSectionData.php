<?php

namespace App\Domain\Notifications\Digest\Data;

/**
 * Rendered block of the digest. `count` feeds the KPI tile at the top
 * (label `tileLabel`); `tone` "danger" highlights tile and heading.
 */
final readonly class DigestSectionData
{
    /**
     * @param  list<DigestItem>  $items  at most ~5 shown; use $more for the rest
     * @param  string|null  $note  muted line under the list ("Besok: PLQ-18 …")
     * @param  string|null  $more  last row inside the list ("dan 1 pengajuan lainnya")
     */
    public function __construct(
        public string $key,
        public string $title,
        public string $tileLabel,
        public int $count,
        public array $items,
        public string $tone = 'default',
        public ?string $note = null,
        public ?string $more = null,
    ) {}

    public function isEmpty(): bool
    {
        return $this->count === 0 && $this->items === [];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'title' => $this->title,
            'tile_label' => $this->tileLabel,
            'count' => $this->count,
            'tone' => $this->tone,
            'items' => array_map(fn (DigestItem $item): array => $item->toArray(), $this->items),
            'note' => $this->note,
            'more' => $this->more,
        ];
    }
}

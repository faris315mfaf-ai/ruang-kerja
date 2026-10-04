<?php

namespace App\Domain\Search\Data;

/**
 * One search hit. Either `url` (Inertia visit; `external` opens a new tab or
 * mailto) or `action` (client-side handler such as "theme.toggle").
 */
final readonly class SearchResult
{
    /**
     * @param  string  $icon  icon key understood by features/search/search-icon.tsx
     * @param  string|null  $code  mono identifier shown before the title ("PLQ-21")
     * @param  string|null  $subtitle  muted second line
     * @param  string|null  $meta  right-aligned muted text
     * @param  string|null  $shortcut  keyboard hint ("C")
     * @param  string|null  $snippet  matched excerpt ("deskripsi: …landing page…")
     */
    public function __construct(
        public string $id,
        public string $title,
        public string $icon,
        public ?string $url = null,
        public ?string $action = null,
        public ?string $code = null,
        public ?string $subtitle = null,
        public ?string $meta = null,
        public ?string $shortcut = null,
        public ?string $snippet = null,
        public bool $external = false,
    ) {}

    /**
     * @return array<string, string|bool|null>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'icon' => $this->icon,
            'url' => $this->url,
            'action' => $this->action,
            'code' => $this->code,
            'subtitle' => $this->subtitle,
            'meta' => $this->meta,
            'shortcut' => $this->shortcut,
            'snippet' => $this->snippet,
            'external' => $this->external,
        ];
    }
}

<?php

namespace App\Domain\Documentation\Data;

/**
 * One allowlisted Markdown file (config/docs.php), resolved on disk.
 */
final readonly class DocumentEntry
{
    public function __construct(
        public string $slug,
        public string $title,
        public string $group,
        /** Path relative to the repository root, e.g. docs/PRD.md. */
        public string $path,
        /** Resolved absolute path (inside the repository). */
        public string $absolutePath,
        public int $size,
        public int $modifiedAt,
    ) {}

    /**
     * @return array{slug: string, title: string, group: string, path: string, size: int, updatedAt: string}
     */
    public function toArray(): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'group' => $this->group,
            'path' => $this->path,
            'size' => $this->size,
            'updatedAt' => gmdate('Y-m-d\TH:i:s\Z', $this->modifiedAt),
        ];
    }
}

<?php

namespace App\Domain\Tasks\Services;

/**
 * Plain text ↔ minimal Tiptap/ProseMirror document. Sprint 5 edits plain
 * text; Sprint 6 replaces it with the rich editor and keeps description_text.
 */
final class TaskDescription
{
    /**
     * @return array<string, mixed>|null
     */
    public static function documentFromText(?string $text): ?array
    {
        $text = $text === null ? '' : trim(str_replace("\r\n", "\n", $text));

        if ($text === '') {
            return null;
        }

        $paragraphs = array_map(
            fn (string $line): array => $line === ''
                ? ['type' => 'paragraph']
                : ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $line]]],
            explode("\n", $text),
        );

        return ['type' => 'doc', 'content' => $paragraphs];
    }

    public static function normalizeText(?string $text): ?string
    {
        $text = $text === null ? '' : trim(str_replace("\r\n", "\n", $text));

        return $text === '' ? null : $text;
    }
}

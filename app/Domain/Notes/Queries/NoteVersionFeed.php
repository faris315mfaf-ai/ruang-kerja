<?php

namespace App\Domain\Notes\Queries;

use App\Domain\Notes\Services\NoteHtml;
use App\Domain\Tasks\Services\RichText;
use App\Models\Note;
use App\Models\NoteVersion;
use Carbon\CarbonInterface;

/**
 * Version history for the mobile app: the list carries no document (it can
 * be large), a version's preview carries it as safe HTML (NoteHtml escapes
 * all text and keeps the editor's node whitelist only).
 */
final class NoteVersionFeed
{
    /**
     * @return list<array<string, mixed>>
     */
    public function list(Note $note): array
    {
        return array_values(NoteVersion::query()
            ->where('note_id', $note->id)
            ->with('creator:id,name,avatar_url')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(NoteLibrary::VERSION_LIMIT)
            ->get(['id', 'note_id', 'title', 'label', 'created_by', 'created_at'])
            ->map(fn (NoteVersion $version): array => self::row($version))
            ->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function preview(NoteVersion $version): array
    {
        $version->loadMissing('creator:id,name,avatar_url');

        return [
            ...self::row($version),
            'body_html' => NoteHtml::toHtml(is_array($version->content) ? $version->content : null),
            'body_text' => $version->content === null ? '' : (string) RichText::toText($version->content),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function row(NoteVersion $version): array
    {
        return [
            'id' => $version->id,
            'note_id' => $version->note_id,
            'title' => $version->title,
            'label' => $version->label,
            'created_at' => self::iso($version->created_at),
            'author' => $version->creator === null ? null : [
                'id' => $version->creator->id,
                'name' => $version->creator->name,
                'avatar' => $version->creator->avatar_url,
            ],
        ];
    }

    private static function iso(?CarbonInterface $value): ?string
    {
        return $value?->toIso8601String();
    }
}

<?php

namespace App\Http\Resources\Api;

use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Notes\Services\NoteHtml;
use App\Models\Note;
use App\Models\User;

/**
 * One note for the mobile app (API v1): the web NoteLibrary row + rights
 * (can_edit, can_share, can_delete), with the document as `body_html`
 * (NoteHtml) instead of the raw Tiptap JSON — the app renders HTML and sends
 * it back. Folders answer body_html null (they only group notes).
 */
final class NoteDetail
{
    /**
     * @return array<string, mixed>
     */
    public static function make(Note $note, User $viewer, NoteLibrary $library): array
    {
        $detail = $library->detail($note, $viewer);
        unset($detail['content']);

        return [
            ...$detail,
            'body_html' => $note->isFolder() ? null : NoteHtml::toHtml(is_array($note->content) ? $note->content : null),
            'body_text' => $note->isFolder() ? null : $note->content_text,
        ];
    }

    /**
     * Detail plus `mobile_editable` (plain paragraphs only — NoteHtml::
     * isMobileEditable; folders false): the shape of GET /catatan/{note}.
     *
     * @return array<string, mixed>
     */
    public static function forApp(Note $note, User $viewer, NoteLibrary $library): array
    {
        return [
            ...self::make($note, $viewer, $library),
            'mobile_editable' => ! $note->isFolder() && NoteHtml::isMobileEditable(is_array($note->content) ? $note->content : null),
        ];
    }
}

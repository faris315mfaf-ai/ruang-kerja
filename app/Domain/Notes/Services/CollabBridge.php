<?php

namespace App\Domain\Notes\Services;

use App\Models\Note;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Laravel → collab server. When Laravel changes a note's content outside
 * the live document (restoring a version, the save fallback without
 * collaboration), the collab server replaces the content of the loaded Yjs
 * document in one transaction, so connected editors see it at once and the
 * next store writes a fresh yjs_state. When the document is not loaded the
 * server answers `loaded: false` and the next load rebuilds it from
 * `notes.content` (the caller cleared yjs_state).
 */
final class CollabBridge
{
    /**
     * @param  array<string, mixed>|null  $content
     */
    public function replace(Note $note, ?array $content): bool
    {
        return $this->post($note, 'replace', ['content' => $content]);
    }

    /**
     * Closes every connection to the note: after access changed, editors
     * reconnect with a fresh token (and are refused when they lost access).
     */
    public function reconnect(Note $note): bool
    {
        return $this->post($note, 'reconnect');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function post(Note $note, string $action, array $data = []): bool
    {
        if (! CollabToken::enabled()) {
            return false;
        }

        try {
            $response = Http::baseUrl(rtrim((string) config('collab.url'), '/'))
                ->withToken((string) config('collab.secret'))
                ->acceptJson()
                ->connectTimeout(2)
                ->timeout(5)
                ->post('/internal/documents/'.$note->id.'/'.$action, $data);
        } catch (ConnectionException) {
            Log::warning('notes.collab_unreachable', ['note_id' => $note->id, 'action' => $action]);

            return false;
        }

        if (! $response->successful()) {
            Log::warning('notes.collab_request_failed', ['note_id' => $note->id, 'action' => $action, 'status' => $response->status()]);

            return false;
        }

        return $response->json('loaded') === true;
    }
}

<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Notes\Services\CollabToken;
use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Collaborative minutes of the video room (lead decision 7 Okt 2026,
 * docs/fitur/rapat-video-kontrak.md §1.4): when FEATURE_NOTES and the collab
 * server (COLLAB_SECRET) are available, the minutes text of an occurrence is
 * a Yjs document "meeting-minutes.{minutes id}" on the same collab server as
 * Catatan bersama, with the same token format (CollabToken). Everyone
 * invited (organizer, minute taker, participants) edits it while the
 * minutes are a draft; leadership observers and final minutes are
 * read-only. The collab server stores the state through
 * /internal/rapat/notulen/{id}/state (StoreMinutesDocument), which mirrors
 * the text into sections/decisions. Changes made outside the live document
 * (autosave fallback, notes source, AI insert) replace it (replaceLive).
 */
final class MinutesCollab
{
    public const string DOCUMENT_PREFIX = 'meeting-minutes.';

    public function __construct(private readonly MeetingPolicy $policy) {}

    public static function enabled(): bool
    {
        return (bool) config('features.notes') && CollabToken::enabled();
    }

    public static function documentName(MeetingMinutes $minutes): string
    {
        return self::DOCUMENT_PREFIX.$minutes->id;
    }

    /**
     * Collab mode: invited people edit a draft; others (and final minutes)
     * read. Someone the organizer removed from the occurrence's video room
     * only reads until re-admitted (audit rapat 2026-10, B-02).
     */
    public function canEdit(User $user, Meeting $meeting, ?MeetingMinutes $minutes, ?string $occurrenceDate = null): bool
    {
        $date = $minutes?->occurrence_date->toDateString() ?? $occurrenceDate;

        return $this->policy->canView($user, $meeting)
            && ! $meeting->isCanceled()
            && $meeting->involves($user)
            && $minutes?->isFinal() !== true
            && ($date === null || ! MeetingVideoRemoval::query()
                ->where('meeting_id', $meeting->id)
                ->where('occurrence_date', $date)
                ->where('user_id', $user->id)
                ->exists());
    }

    /**
     * Token for the collab server, same format as CollabToken (payload
     * `note` = document name).
     */
    public function issue(MeetingMinutes $minutes, User $user, bool $canEdit): string
    {
        $payload = [
            'note' => self::documentName($minutes),
            'user' => $user->id,
            'name' => $user->name,
            'edit' => $canEdit,
            'exp' => now()->addSeconds(CollabToken::ttl())->getTimestamp(),
        ];

        $body = self::base64Url((string) json_encode($payload));

        return $body.'.'.self::base64Url(hash_hmac('sha256', $body, (string) config('collab.secret'), true));
    }

    /**
     * The structured minutes changed outside the live document: drop the
     * stored Yjs state, keep a fresh snapshot, and (after commit) replace the
     * content of the loaded document so connected editors see it.
     */
    public function replaceLive(MeetingMinutes $minutes): void
    {
        if (! self::enabled()) {
            return;
        }

        $content = MinutesDocument::toDoc($minutes->sections, $minutes->decisions);
        $minutes->forceFill(['doc_state' => null, 'doc_content' => $content])->saveQuietly();

        DB::afterCommit(fn () => $this->post($minutes, 'replace', ['content' => $content]));
    }

    /** Editors reconnect with a fresh token (finalized → read-only, reopened → editable). */
    public function reconnect(MeetingMinutes $minutes): void
    {
        if (self::enabled()) {
            DB::afterCommit(fn () => $this->post($minutes, 'reconnect'));
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function post(MeetingMinutes $minutes, string $action, array $data = []): void
    {
        try {
            $response = Http::baseUrl(rtrim((string) config('collab.url'), '/'))
                ->withToken((string) config('collab.secret'))
                ->acceptJson()
                ->connectTimeout(2)
                ->timeout(5)
                ->post('/internal/documents/'.self::documentName($minutes).'/'.$action, $data);

            if (! $response->successful()) {
                Log::warning('meetings.collab_request_failed', ['minutes_id' => $minutes->id, 'action' => $action, 'status' => $response->status()]);
            }
        } catch (ConnectionException) {
            Log::warning('meetings.collab_unreachable', ['minutes_id' => $minutes->id, 'action' => $action]);
        }
    }

    private static function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}

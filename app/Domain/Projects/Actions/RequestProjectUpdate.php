<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Projects\Notifications\ProjectUpdateRequestedNotification;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\Activity;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Minta update" (Direksi → PIC; the owner when the project has no PIC).
 * At most once per 12 hours per project so the PIC is not flooded. The
 * cooldown check and the activity row are written while holding a row lock on
 * the workspace, so two concurrent requests cannot both pass the check.
 */
final class RequestProjectUpdate
{
    public const int COOLDOWN_HOURS = 12;

    public function __construct(private readonly RecordActivity $recordActivity) {}

    public function handle(Workspace $workspace, User $requester, ?string $note = null): User
    {
        $recipient = $workspace->lead ?? $workspace->owner;

        DB::transaction(function () use ($workspace, $requester, $recipient, $note): void {
            // Claim: serialize concurrent requests for this project.
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->value('id');

            $recent = Activity::query()
                ->where('workspace_id', $workspace->id)
                ->where('event', ActivityEvent::ProjectUpdateRequested->value)
                ->where('created_at', '>=', now()->subHours(self::COOLDOWN_HOURS))
                ->exists();

            if ($recent) {
                throw ValidationException::withMessages([
                    'note' => "Permintaan update untuk {$workspace->name} sudah dikirim dalam ".self::COOLDOWN_HOURS.' jam terakhir.',
                ]);
            }

            $this->recordActivity->handle($workspace, $workspace, $requester, ActivityEvent::ProjectUpdateRequested, [
                'recipient' => $recipient->name,
                'note' => $note,
            ]);
        });

        $recipient->notify(new ProjectUpdateRequestedNotification($workspace, $requester, $note));

        return $recipient;
    }
}

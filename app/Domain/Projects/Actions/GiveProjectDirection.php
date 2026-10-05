<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Projects\Notifications\ProjectDirectionNotification;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\ProjectDirection;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;

/**
 * "Beri arahan" / "Balas" / "Diskusikan": a direction from Direksi on the
 * project (optionally on one update). Notifies the PIC and the update author,
 * and appears in the project activity feed.
 */
final class GiveProjectDirection
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    public function handle(Workspace $workspace, User $author, string $body, ?ProjectUpdate $update = null): ProjectDirection
    {
        $direction = DB::transaction(function () use ($workspace, $author, $body, $update): ProjectDirection {
            $direction = ProjectDirection::query()->create([
                'workspace_id' => $workspace->id,
                'project_update_id' => $update?->id,
                'author_id' => $author->id,
                'body' => $body,
            ]);

            $this->recordActivity->handle($workspace, $direction, $author, ActivityEvent::ProjectDirectionGiven, [
                'body' => mb_strimwidth($body, 0, 160, '…'),
                'project_update_id' => $update?->id,
            ]);

            return $direction;
        });

        $recipientIds = array_values(array_unique(array_filter([
            $workspace->lead_user_id ?? $workspace->owner_id,
            $update?->author_id,
        ], fn (?string $id): bool => $id !== null && $id !== $author->id)));

        if ($recipientIds !== []) {
            $direction->setRelation('workspace', $workspace)->setRelation('author', $author);
            // Only people who can still see the project (a former PIC/author may have been removed).
            $recipients = User::query()->active()->whereKey($recipientIds)->get()
                ->filter(fn (User $user): bool => Gate::forUser($user)->allows('view', $workspace));

            Notification::send($recipients, new ProjectDirectionNotification($direction));
        }

        return $direction;
    }
}

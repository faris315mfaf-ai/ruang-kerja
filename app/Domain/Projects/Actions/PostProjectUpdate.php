<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Notifications\ProjectDecisionNeededNotification;
use App\Domain\Projects\Queries\ProjectMetrics;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * "Update proyek" by the PIC: health, summary, blockers and an optional
 * decision needed from Direksi. Stores the actual/planned progress of the
 * moment, denormalizes workspaces.health + last_update_at, clears pending
 * "Minta update" items and asks the sponsor (or all Direksi) for a decision.
 */
final class PostProjectUpdate
{
    public function __construct(
        private readonly ProjectMetrics $metrics,
        private readonly RecordActivity $recordActivity,
        private readonly ResolveNotificationsForSubject $resolveNotifications,
    ) {}

    /**
     * @param  array{health: ProjectHealth, summary: string, blockers?: string|null, decision_needed?: string|null}  $data
     */
    public function handle(Workspace $workspace, User $author, array $data): ProjectUpdate
    {
        $update = DB::transaction(function () use ($workspace, $author, $data): ProjectUpdate {
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first(['id']);

            $metrics = $this->metrics->forWorkspace($workspace);

            $update = ProjectUpdate::query()->create([
                'workspace_id' => $workspace->id,
                'author_id' => $author->id,
                'health' => $data['health'],
                'summary' => $data['summary'],
                'blockers' => $data['blockers'] ?? null,
                'decision_needed' => $data['decision_needed'] ?? null,
                'progress_snapshot' => $metrics->actual,
                'planned_snapshot' => $metrics->planned,
            ]);

            $workspace->forceFill(['health' => $data['health'], 'last_update_at' => $update->created_at])->save();

            $this->recordActivity->handle($workspace, $update, $author, ActivityEvent::ProjectUpdatePosted, [
                'health' => $data['health']->value,
                'summary' => mb_strimwidth($data['summary'], 0, 160, '…'),
                'decision_needed' => ($data['decision_needed'] ?? null) !== null,
            ]);

            $this->resolveNotifications->handle($workspace, NotificationType::ProjectUpdateRequested, NotificationType::ProjectUpdateReminder);

            return $update;
        });

        if ($update->decision_needed !== null) {
            $update->setRelation('workspace', $workspace)->setRelation('author', $author);
            Notification::send($this->decisionMakers($workspace, $author), new ProjectDecisionNeededNotification($update));
        }

        return $update;
    }

    /**
     * The sponsor, or every active Direksi member when the project has none.
     *
     * @return Collection<int, User>
     */
    private function decisionMakers(Workspace $workspace, User $author): Collection
    {
        $query = User::query()->active()->where('company_id', $workspace->company_id)->whereKeyNot($author->id);

        $sponsor = $workspace->sponsor_user_id !== null
            ? (clone $query)->whereKey($workspace->sponsor_user_id)->get()
            : new Collection;

        if ($sponsor->isNotEmpty()) {
            return $sponsor;
        }

        return $query->role(Role::Direksi->value)->get();
    }
}

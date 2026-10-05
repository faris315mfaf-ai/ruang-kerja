<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Projects\Notifications\ProjectDecisionResolvedNotification;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\ProjectUpdate;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * "Tandai keputusan selesai" (button "Setujui"): closes the decision an update
 * asked for, so it leaves "Butuh keputusan Anda". Audited.
 */
final class ResolveProjectDecision
{
    public function __construct(
        private readonly RecordActivity $recordActivity,
        private readonly ResolveNotificationsForSubject $resolveNotifications,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(ProjectUpdate $update, User $resolver): ProjectUpdate
    {
        $workspace = $update->workspace;

        DB::transaction(function () use ($update, $resolver, $workspace): void {
            $update->forceFill(['decision_resolved_at' => now(), 'decision_resolved_by' => $resolver->id])->save();

            $this->recordActivity->handle($workspace, $update, $resolver, ActivityEvent::ProjectDecisionResolved, [
                'decision' => mb_strimwidth((string) $update->decision_needed, 0, 160, '…'),
            ]);
            $this->audit->log('project.decision_resolved', $update, ['decision_resolved_at' => null], [
                'decision_resolved_at' => $update->decision_resolved_at?->toIso8601String(),
                'decision_resolved_by' => $resolver->id,
            ], $resolver);
            $this->resolveNotifications->handle($update, NotificationType::ProjectDecisionNeeded);
        });

        $recipientIds = array_values(array_unique(array_filter([
            $update->author_id,
            $workspace->lead_user_id,
        ], fn (?string $id): bool => $id !== null && $id !== $resolver->id)));

        if ($recipientIds !== []) {
            Notification::send(User::query()->active()->whereKey($recipientIds)->get(), new ProjectDecisionResolvedNotification($update, $resolver));
        }

        return $update;
    }
}

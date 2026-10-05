<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Actions\ResolveOverdueNotices;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Archives (read-only, hidden from the sidebar and "Tugas saya") or restores a
 * workspace. Audited.
 */
final class ArchiveWorkspace
{
    public function __construct(
        private readonly RecordActivity $recordActivity,
        private readonly AuditLogger $audit,
        private readonly ResolveOverdueNotices $overdueNotices,
    ) {}

    public function handle(Workspace $workspace, User $actor, bool $archive = true): Workspace
    {
        if ($workspace->isArchived() === $archive) {
            return $workspace;
        }

        return DB::transaction(function () use ($workspace, $actor, $archive): Workspace {
            $workspace->archived_at = $archive ? now() : null;
            $workspace->save();

            // Archived workspaces get no deadline reminders; settle the open ones.
            if ($archive) {
                $this->overdueNotices->handle($workspace);
            }

            $this->recordActivity->handle(
                $workspace,
                $workspace,
                $actor,
                $archive ? ActivityEvent::WorkspaceArchived : ActivityEvent::WorkspaceRestored,
            );

            $this->audit->log(
                $archive ? 'workspace.archived' : 'workspace.restored',
                $workspace,
                ['archived' => ! $archive],
                ['archived' => $archive],
                $actor,
            );

            return $workspace;
        });
    }
}

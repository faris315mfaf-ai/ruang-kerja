<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Tasks\Services\DefaultTaskStatuses;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Domain\Workspaces\Services\WorkspaceMembership;
use App\Events\Workspaces\WorkspaceCreated;
use App\Models\Company;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Creates a workspace with its owner membership and the default columns.
 * Used for manual team/project workspaces and, internally, for personal and
 * division workspaces.
 */
final class CreateWorkspace
{
    public function __construct(
        private readonly WorkspaceKeyGenerator $keys,
        private readonly WorkspaceMembership $membership,
        private readonly DefaultTaskStatuses $statuses,
        private readonly RecordActivity $recordActivity,
        private readonly SyncTeamMembers $syncTeamMembers,
    ) {}

    /**
     * @param  array{type: WorkspaceType, name: string, key?: string|null, description?: string|null, visibility?: WorkspaceVisibility|null, color?: string|null, division_id?: string|null, team_id?: string|null}  $input
     */
    public function handle(User $owner, array $input, ?User $actor = null): Workspace
    {
        $workspace = DB::transaction(function () use ($owner, $input, $actor): Workspace {
            $companyId = $owner->company_id ?? Company::query()->orderBy('id')->value('id');

            if (! is_string($companyId)) {
                throw new RuntimeException('Tidak ada perusahaan untuk workspace ini.');
            }

            $preferred = $input['key'] ?? null;
            $key = $preferred !== null && WorkspaceKeyGenerator::isValid($preferred) && ! $this->keys->taken($companyId, $preferred)
                ? $preferred
                : $this->keys->generate($companyId, $input['name'], $preferred);

            $workspace = Workspace::query()->create([
                'company_id' => $companyId,
                'type' => $input['type'],
                'name' => $input['name'],
                'key' => $key,
                'description' => $input['description'] ?? null,
                'visibility' => $input['visibility'] ?? WorkspaceVisibility::Private,
                'color' => $input['color'] ?? self::defaultColor($input['type']),
                'owner_id' => $owner->id,
                'division_id' => $input['division_id'] ?? null,
                'team_id' => $input['team_id'] ?? null,
            ]);

            $this->membership->put($workspace, $owner->id, WorkspaceRole::Owner);
            $this->statuses->ensure($workspace);

            if ($workspace->team_id !== null) {
                $team = Team::query()->find($workspace->team_id);

                if ($team !== null) {
                    $this->syncTeamMembers->handle($team);
                }
            }

            $this->recordActivity->handle($workspace, $workspace, $actor ?? $owner, ActivityEvent::WorkspaceCreated, [
                'name' => $workspace->name,
                'key' => $workspace->key,
            ]);

            return $workspace;
        });

        WorkspaceCreated::dispatch($workspace);

        return $workspace;
    }

    public static function defaultColor(WorkspaceType $type): string
    {
        return match ($type) {
            WorkspaceType::Personal => 'gray',
            WorkspaceType::Division => 'teal',
            WorkspaceType::Team => 'blue',
            WorkspaceType::Project => 'violet',
        };
    }
}

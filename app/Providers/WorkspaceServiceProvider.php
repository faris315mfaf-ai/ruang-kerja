<?php

namespace App\Providers;

use App\Domain\Workspaces\Actions\ArchiveWorkspace;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Actions\PurgePersonalWorkspace;
use App\Domain\Workspaces\Actions\SyncDivisionMembers;
use App\Domain\Workspaces\Actions\SyncTeamMembers;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

/**
 * Keeps workspaces in line with the organization (PRD M3):
 * - new employee → personal workspace + division/team sync;
 * - employee moves division/team or changes status → sync old and new;
 * - division created/changed → division workspace created/synced;
 * - division deleted/restored → its workspace archived/restored;
 * - Ketua Tim changes → team workspaces synced;
 * - employee hard-deleted → personal workspace purged.
 *
 * Model events are muted by seeders using WithoutModelEvents; WorkspaceSeeder
 * runs the same actions explicitly.
 */
class WorkspaceServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        User::created(function (User $user): void {
            app(EnsurePersonalWorkspace::class)->handle($user);
            $this->syncDivision($user->division_id);
            $this->syncTeam($user->team_id);
        });

        User::updated(function (User $user): void {
            if ($user->wasChanged('division_id')) {
                $this->syncDivision(self::originalId($user, 'division_id'));
                $this->syncDivision($user->division_id);
            }

            if ($user->wasChanged('team_id')) {
                $this->syncTeam(self::originalId($user, 'team_id'));
                $this->syncTeam($user->team_id);
            }

            if ($user->wasChanged('status')) {
                $this->syncDivision($user->division_id);
                $this->syncTeam($user->team_id);
            }
        });

        User::deleting(fn (User $user) => app(PurgePersonalWorkspace::class)->handle($user));

        Division::created(fn (Division $division) => $this->syncDivisionModel($division));

        Division::updated(function (Division $division): void {
            if ($division->wasChanged(['head_user_id', 'name', 'is_board'])) {
                $this->renameDivisionWorkspace($division);
                $this->syncDivisionModel($division);
            }
        });

        Division::deleted(fn (Division $division) => $this->archiveDivisionWorkspace($division, true));
        Division::restored(fn (Division $division) => $this->archiveDivisionWorkspace($division, false));

        Team::updated(function (Team $team): void {
            if ($team->wasChanged('lead_user_id')) {
                app(SyncTeamMembers::class)->handle($team);
            }
        });
    }

    private function syncDivision(?string $divisionId): void
    {
        $division = $divisionId !== null ? Division::query()->find($divisionId) : null;

        if ($division !== null) {
            $this->syncDivisionModel($division);
        }
    }

    private function syncDivisionModel(Division $division): void
    {
        $actor = Auth::user();

        app(SyncDivisionMembers::class)->handle($division, $actor instanceof User ? $actor : null);
    }

    private function syncTeam(?string $teamId): void
    {
        $team = $teamId !== null ? Team::query()->find($teamId) : null;

        if ($team !== null) {
            app(SyncTeamMembers::class)->handle($team);
        }
    }

    private function renameDivisionWorkspace(Division $division): void
    {
        if (! $division->wasChanged(['name', 'is_board'])) {
            return;
        }

        $workspace = $this->divisionWorkspace($division);
        $previous = clone $division;
        $previous->forceFill([
            'name' => $division->getOriginal('name'),
            'is_board' => $division->getOriginal('is_board'),
        ]);

        // Only rename when nobody customized the generated name.
        if ($workspace !== null && $workspace->name === SyncDivisionMembers::nameFor($previous)) {
            $workspace->name = SyncDivisionMembers::nameFor($division);
            $workspace->save();
        }
    }

    private function archiveDivisionWorkspace(Division $division, bool $archive): void
    {
        $workspace = $this->divisionWorkspace($division);
        $actor = Auth::user();

        if ($workspace !== null && $actor instanceof User) {
            app(ArchiveWorkspace::class)->handle($workspace, $actor, $archive);
        } elseif ($workspace !== null) {
            $workspace->archived_at = $archive ? now() : null;
            $workspace->save();
        }
    }

    private function divisionWorkspace(Division $division): ?Workspace
    {
        return Workspace::query()
            ->where('type', WorkspaceType::Division->value)
            ->where('division_id', $division->id)
            ->first();
    }

    private static function originalId(User $user, string $column): ?string
    {
        $value = $user->getOriginal($column);

        return is_string($value) ? $value : null;
    }
}

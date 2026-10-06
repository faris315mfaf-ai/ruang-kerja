<?php

namespace App\Domain\Announcements\Services;

use App\Domain\Announcements\Enums\AnnouncementAudience;
use App\Domain\Organization\Enums\Role;
use App\Models\Announcement;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Who may announce to whom (keputusan pemilik 6 Okt 2026):
 * - Direksi, HR, Super Admin: everyone, any divisions or any teams;
 * - Kepala Divisi: the divisions they lead (and their sub-divisions);
 * - Ketua Tim: the teams they lead.
 * And who receives an announcement (recipients()).
 */
final class AnnouncementTargets
{
    public static function announcesToAll(User $user): bool
    {
        return $user->hasAnyRole([Role::Direksi, Role::Hr, Role::SuperAdmin]);
    }

    /**
     * @return array{audiences: list<AnnouncementAudience>, divisions: list<array{id: string, name: string}>, teams: list<array{id: string, name: string}>}
     */
    public function optionsFor(User $user): array
    {
        if (! $user->isActive()) {
            return ['audiences' => [], 'divisions' => [], 'teams' => []];
        }

        $all = self::announcesToAll($user);
        $divisionIds = $all ? null : ($user->hasRole(Role::KepalaDivisi) ? $user->ledDivisionIds() : []);

        $divisions = array_values(Division::query()
            ->where('company_id', $user->company_id)
            ->when($divisionIds !== null, fn (Builder $query) => $query->whereIn('id', $divisionIds ?? []))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Division $division): array => ['id' => $division->id, 'name' => $division->name])
            ->all());

        $teams = array_values(Team::query()
            ->whereHas('division', fn (Builder $division) => $division->where('company_id', $user->company_id))
            ->when(! $all, fn (Builder $query) => $query->where('lead_user_id', $user->id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name])
            ->all());

        $audiences = [
            ...($all ? [AnnouncementAudience::All] : []),
            ...($divisions !== [] ? [AnnouncementAudience::Division] : []),
            ...($teams !== [] ? [AnnouncementAudience::Team] : []),
        ];

        return ['audiences' => $audiences, 'divisions' => $divisions, 'teams' => $teams];
    }

    public function canAnnounce(User $user): bool
    {
        if (! $user->isActive()) {
            return false;
        }

        return self::announcesToAll($user)
            || ($user->hasRole(Role::KepalaDivisi) && $user->ledDivisionIds() !== [])
            || $user->ledTeams()->exists();
    }

    /**
     * Whether $user may send to this audience + targets.
     *
     * @param  list<string>  $targetIds
     */
    public function allows(User $user, AnnouncementAudience $audience, array $targetIds): bool
    {
        $options = $this->optionsFor($user);

        if (! in_array($audience, $options['audiences'], true)) {
            return false;
        }

        $allowed = match ($audience) {
            AnnouncementAudience::All => null,
            AnnouncementAudience::Division => array_column($options['divisions'], 'id'),
            AnnouncementAudience::Team => array_column($options['teams'], 'id'),
        };

        if ($allowed === null) {
            return $targetIds === [];
        }

        return $targetIds !== [] && array_diff($targetIds, $allowed) === [];
    }

    /**
     * Active employees who receive it (division targets include sub-divisions).
     *
     * @return Builder<User>
     */
    public function recipients(Announcement $announcement): Builder
    {
        $query = User::query()->active()->where('company_id', $announcement->company_id);

        return match ($announcement->audience) {
            AnnouncementAudience::All => $query,
            AnnouncementAudience::Division => $query->whereIn('division_id', Division::withDescendantIds($announcement->target_ids)),
            AnnouncementAudience::Team => $query->whereIn('team_id', $announcement->target_ids),
        };
    }

    /**
     * "Semua karyawan" · "Divisi Operasional, Keuangan" · "Tim Gudang".
     *
     * @param  array<string, string>  $names  division/team id => name
     */
    public static function label(Announcement $announcement, array $names): string
    {
        if ($announcement->audience === AnnouncementAudience::All) {
            return 'Semua karyawan';
        }

        $list = array_values(array_filter(array_map(fn (string $id): ?string => $names[$id] ?? null, $announcement->target_ids)));
        $prefix = $announcement->audience === AnnouncementAudience::Division ? 'Divisi' : 'Tim';

        return $list === [] ? $prefix : $prefix.' '.implode(', ', $list);
    }
}

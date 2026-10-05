<?php

namespace App\Domain\Analytics\Services;

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Who may open which dashboard and over which people (PRD M7, §3.2):
 *
 * - Saya: everyone, about themselves.
 * - Kepala Divisi: Kepala Divisi / division heads over the divisions they lead
 *   (incl. sub-divisions); `dashboard.view_company` (Direksi, HR, Super Admin)
 *   over every division.
 * - HR: `attendance.view_all` + `dashboard.view_company` over the company.
 *
 * People are always taken from `User::visibleTo($viewer)` and active
 * employees only.
 */
final class DashboardAccess
{
    public function can(User $user, DashboardView $view): bool
    {
        if (! $user->isActive()) {
            return false;
        }

        return match ($view) {
            DashboardView::Personal => true,
            DashboardView::Division => $user->hasPermission(Permission::DashboardViewCompany) || $user->ledDivisionIds() !== [],
            DashboardView::Hr => $user->hasPermission(Permission::DashboardViewCompany) && $user->hasPermission(Permission::AttendanceViewAll),
        };
    }

    /**
     * @return list<DashboardView>
     */
    public function views(User $user): array
    {
        return array_values(array_filter(DashboardView::cases(), fn (DashboardView $view): bool => $this->can($user, $view)));
    }

    /**
     * Landing view of `/dashboard`: HR first (Kepala Divisi SDM is HR at
     * heart), then the division dashboard for division leads, else "Saya".
     * Direksi land on "Saya"; their portfolio lives at /portofolio.
     */
    public function defaultView(User $user): DashboardView
    {
        if ($user->hasRole(Role::Hr) && $this->can($user, DashboardView::Hr)) {
            return DashboardView::Hr;
        }

        if (($user->hasRole(Role::KepalaDivisi) || $user->ledDivisionIds() !== []) && $this->can($user, DashboardView::Division)) {
            return DashboardView::Division;
        }

        return DashboardView::Personal;
    }

    public function canSeePortfolio(User $user): bool
    {
        return $user->isActive() && $user->hasPermission(Permission::PortfolioView);
    }

    /**
     * Divisions selectable in the filter of a view (empty for "Saya").
     *
     * @return Collection<int, Division>
     */
    public function divisions(User $user, DashboardView $view): Collection
    {
        $query = Division::query()->visibleTo($user)->orderBy('name');

        return match ($view) {
            DashboardView::Personal => new Collection,
            DashboardView::Hr => $query->get(),
            DashboardView::Division => $user->hasPermission(Permission::DashboardViewCompany)
                ? $query->where('is_board', false)->get()
                : $query->whereIn('id', $user->ledDivisionIds())->get(),
        };
    }

    /**
     * Teams of the selectable divisions (narrowed to one division when chosen).
     *
     * @param  Collection<int, Division>  $divisions
     * @return Collection<int, Team>
     */
    public function teams(Collection $divisions, ?Division $division): Collection
    {
        $ids = $division !== null ? Division::withDescendantIds([$division->id]) : $divisions->modelKeys();

        return Team::query()->whereIn('division_id', $ids)->orderBy('name')->get();
    }

    /**
     * Active people measured by a view for the chosen division/team.
     *
     * @param  Collection<int, Division>  $allowed  result of divisions()
     * @return Builder<User>
     */
    public function people(User $viewer, DashboardView $view, Collection $allowed, ?Division $division, ?Team $team): Builder
    {
        $query = User::query()->visibleTo($viewer)->active();

        if ($view === DashboardView::Personal) {
            return $query->whereKey($viewer->id);
        }

        if ($division !== null) {
            $query->whereIn('users.division_id', Division::withDescendantIds([$division->id]));
        } elseif ($view === DashboardView::Division && ! $viewer->hasPermission(Permission::DashboardViewCompany)) {
            $query->whereIn('users.division_id', $allowed->modelKeys());
        }

        if ($team !== null) {
            $query->where('users.team_id', $team->id);
        }

        return $query;
    }
}

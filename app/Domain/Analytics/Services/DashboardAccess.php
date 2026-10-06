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
 *   (incl. sub-divisions); HR and Super Admin over every division.
 * - HR: `attendance.view_all` + `dashboard.view_company` over the company,
 *   for HR and Super Admin.
 * - Direksi: `portfolio.view` (Direksi, Super Admin) over the company.
 *
 * Keputusan pemilik 6 Okt 2026: Direksi no longer get the Kepala Divisi and
 * HR tabs (unless they also hold HR / Super Admin or lead a division); they
 * land on their own monitoring dashboard. Super Admin may pick any view.
 *
 * People are always taken from `User::visibleTo($viewer)` and active
 * employees only.
 */
final class DashboardAccess
{
    /** @var array<string, list<string>> board division ids per company (one query per request) */
    private array $boardIds = [];

    public function can(User $user, DashboardView $view): bool
    {
        if (! $user->isActive()) {
            return false;
        }

        return match ($view) {
            DashboardView::Personal => true,
            DashboardView::Division => $this->companyWide($user) || $this->ledOperationalDivisionIds($user) !== [],
            DashboardView::Hr => $this->companyWide($user) && $user->hasPermission(Permission::AttendanceViewAll),
            DashboardView::Direksi => $user->hasPermission(Permission::PortfolioView),
        };
    }

    /**
     * Divisions the user leads, without the Direksi board unit: the Direktur
     * Utama heading "Direksi" does not get a Kepala Divisi dashboard of it
     * (keputusan pemilik 6 Okt 2026).
     *
     * @return list<string>
     */
    private function ledOperationalDivisionIds(User $user): array
    {
        $led = $user->ledDivisionIds();

        if ($led === []) {
            return [];
        }

        $this->boardIds[$user->company_id] ??= array_values(array_map('strval', Division::query()->where('company_id', $user->company_id)->where('is_board', true)->pluck('id')->all()));

        return array_values(array_diff($led, $this->boardIds[$user->company_id]));
    }

    /**
     * Company-wide Kepala Divisi / HR dashboards: `dashboard.view_company`
     * except for Direksi who hold nothing else (keputusan pemilik 6 Okt 2026).
     */
    private function companyWide(User $user): bool
    {
        if (! $user->hasPermission(Permission::DashboardViewCompany)) {
            return false;
        }

        return ! $user->hasRole(Role::Direksi) || $user->hasRole(Role::Hr) || $user->hasRole(Role::SuperAdmin);
    }

    /**
     * @return list<DashboardView>
     */
    public function views(User $user): array
    {
        return array_values(array_filter(DashboardView::cases(), fn (DashboardView $view): bool => $this->can($user, $view)));
    }

    /**
     * Landing view of `/dashboard`: Direksi on their monitoring dashboard
     * (keputusan pemilik 6 Okt 2026), then HR (Kepala Divisi SDM is HR at
     * heart), then the division dashboard for division leads, else "Saya".
     * Super Admin keeps "Saya" and picks the others.
     */
    public function defaultView(User $user): DashboardView
    {
        if ($user->hasRole(Role::Direksi) && $this->can($user, DashboardView::Direksi)) {
            return DashboardView::Direksi;
        }

        if ($user->hasRole(Role::Hr) && $this->can($user, DashboardView::Hr)) {
            return DashboardView::Hr;
        }

        if (($user->hasRole(Role::KepalaDivisi) || $this->ledOperationalDivisionIds($user) !== []) && $this->can($user, DashboardView::Division)) {
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
            DashboardView::Hr, DashboardView::Direksi => $query->get(),
            DashboardView::Division => $this->companyWide($user)
                ? $query->where('is_board', false)->get()
                : $query->whereIn('id', $this->ledOperationalDivisionIds($user))->get(),
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
        } elseif ($view === DashboardView::Division && ! $this->companyWide($viewer)) {
            $query->whereIn('users.division_id', $allowed->modelKeys());
        }

        if ($team !== null) {
            $query->where('users.team_id', $team->id);
        }

        return $query;
    }
}

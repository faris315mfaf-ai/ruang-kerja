<?php

namespace App\Domain\Analytics\Services;

use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;

/**
 * Turns the URL query (`periode`, `dari`, `sampai`, `divisi`, `tim`) into a
 * DashboardContext. Malformed period values fall back to the view's default
 * (a bookmarked URL never errors); a division or team outside the viewer's
 * scope is refused (403) — a Kepala Divisi can never open another division.
 */
final class DashboardContextResolver
{
    public function __construct(private readonly DashboardAccess $access) {}

    /**
     * @param  array<string, mixed>  $query
     *
     * @throws AuthorizationException
     */
    public function resolve(User $viewer, DashboardView $view, array $query, CarbonImmutable $now): DashboardContext
    {
        $preset = PeriodPreset::tryFrom(self::string($query, 'periode') ?? '') ?? self::defaultPreset($view);
        $from = self::string($query, 'dari');
        $to = self::string($query, 'sampai');
        $period = Period::resolve($preset, $from, $to, $now);

        if ($period->preset === PeriodPreset::Custom && $period->days() > config()->integer('analytics.max_custom_days')) {
            $period = Period::resolve(self::defaultPreset($view), null, null, $now);
        }

        $divisions = $this->access->divisions($viewer, $view);
        $division = null;
        $team = null;
        $divisionId = self::string($query, 'divisi');
        $teamId = self::string($query, 'tim');

        if ($view !== DashboardView::Personal && $divisionId !== null) {
            $division = $divisions->firstWhere('id', $divisionId) ?? throw new AuthorizationException('Divisi di luar cakupan Anda.');
        }

        $teams = $view === DashboardView::Personal ? new Collection : $this->access->teams($divisions, $division);

        if ($view !== DashboardView::Personal && $teamId !== null) {
            $team = $teams->firstWhere('id', $teamId) ?? throw new AuthorizationException('Tim di luar cakupan Anda.');
        }

        $filters = new DashboardFilters($period, $division instanceof Division ? $division : null, $team instanceof Team ? $team : null);
        $people = $this->access->people($viewer, $view, $divisions, $filters->division, $filters->team)
            ->with('division:id,name')
            ->orderBy('users.name')
            ->get(['users.id', 'users.name', 'users.avatar_url', 'users.division_id', 'users.team_id', 'users.company_id']);

        return new DashboardContext($viewer, $view, $filters, $divisions, $teams, $people);
    }

    public static function defaultPreset(DashboardView $view): PeriodPreset
    {
        return $view === DashboardView::Division ? PeriodPreset::Week : PeriodPreset::Month;
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private static function string(array $query, string $key): ?string
    {
        $value = $query[$key] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }
}

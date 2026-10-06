<?php

namespace App\Domain\Analytics\Services;

use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Enums\Permission;
use App\Models\Division;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;

/**
 * Filter + people of the Absensi › Kedisiplinan tab (keputusan pemilik
 * 6 Okt 2026): the same attendance scope as the board and the monthly recap
 * (AttendanceDay::visibleUserIds — HR, Direksi and Super Admin see the
 * company, a Kepala Divisi their divisions, a manager their direct reports),
 * active employees only, narrowed by `?divisi=`. The period query is the
 * dashboard one (`periode`, `dari`, `sampai`), default the current month.
 */
final class AttendanceScopeResolver
{
    /**
     * @param  array<string, mixed>  $query
     *
     * @throws AuthorizationException
     */
    public function resolve(User $viewer, array $query, CarbonImmutable $now): DashboardContext
    {
        $preset = PeriodPreset::tryFrom(self::string($query, 'periode') ?? '') ?? PeriodPreset::Month;
        $period = Period::resolve($preset, self::string($query, 'dari'), self::string($query, 'sampai'), $now);

        if ($period->preset === PeriodPreset::Custom && $period->days() > config()->integer('analytics.max_custom_days')) {
            $period = Period::resolve(PeriodPreset::Month, null, null, $now);
        }

        $visible = AttendanceDay::visibleUserIds($viewer);
        $divisions = Division::query()->visibleTo($viewer)->orderBy('name');

        if (! $viewer->hasPermission(Permission::AttendanceViewAll)) {
            // Only divisions that hold people the viewer may see.
            $divisions->whereIn('id', User::query()->whereIn('users.id', $visible)->whereNotNull('division_id')->select('division_id'));
        }

        $divisions = $divisions->get(['id', 'name', 'company_id']);
        $divisionId = self::string($query, 'divisi');
        $division = null;

        if ($divisionId !== null) {
            $division = $divisions->firstWhere('id', $divisionId) ?? throw new AuthorizationException('Divisi di luar cakupan Anda.');
        }

        $people = User::query()
            ->whereIn('users.id', $visible)
            ->active()
            ->when($division instanceof Division, fn ($users) => $users->whereIn('users.division_id', Division::withDescendantIds([(string) $divisionId])))
            ->with('division:id,name')
            ->orderBy('users.name')
            ->get(['users.id', 'users.name', 'users.avatar_url', 'users.division_id', 'users.team_id', 'users.company_id', 'users.work_mode']);

        return new DashboardContext(
            $viewer,
            DashboardView::Hr,
            new DashboardFilters($period, $division instanceof Division ? $division : null),
            $divisions,
            new Collection,
            $people,
        );
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

<?php

namespace App\Domain\Reports\Services;

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Who reads whose daily reports (Laporan progres harian, keputusan pemilik
 * 6 Okt 2026): the employee writes their own; the direct manager, the
 * Kepala Divisi of the employee's division (and its sub-divisions), Direksi,
 * HR and Super Admin read — always inside one company. Everyone else: 404.
 */
final class ReportReaders
{
    /** Roles that read every employee's reports (monitoring). */
    public static function readsEveryone(User $viewer): bool
    {
        return $viewer->hasAnyRole([Role::Direksi, Role::Hr, Role::SuperAdmin]);
    }

    public function canRead(User $viewer, User $owner): bool
    {
        if (! $viewer->isActive() || $viewer->company_id !== $owner->company_id) {
            return false;
        }

        if ($viewer->is($owner) || $owner->manager_id === $viewer->id || self::readsEveryone($viewer)) {
            return true;
        }

        return $owner->division_id !== null
            && $viewer->hasRole(Role::KepalaDivisi)
            && in_array($owner->division_id, $viewer->ledDivisionIds(), true);
    }

    /**
     * Active colleagues whose reports $viewer reads (never $viewer), as a query.
     *
     * @return Builder<User>
     */
    public function readableUsers(User $viewer): Builder
    {
        $query = User::query()
            ->active()
            ->where('company_id', $viewer->company_id)
            ->whereKeyNot($viewer->id);

        if (! $viewer->isActive()) {
            return $query->whereRaw('false');
        }

        if (self::readsEveryone($viewer)) {
            return $query;
        }

        $divisionIds = $viewer->hasRole(Role::KepalaDivisi) ? $viewer->ledDivisionIds() : [];

        return $query->where(fn (Builder $scope) => $scope
            ->where('manager_id', $viewer->id)
            ->when($divisionIds !== [], fn (Builder $led) => $led->orWhereIn('division_id', $divisionIds)));
    }
}

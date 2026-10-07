<?php

namespace App\Policies;

use App\Domain\Reports\Services\ReportReaders;
use App\Domain\Reports\Support\ReportDay;
use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Laporan progres harian (keputusan pemilik 6 Okt 2026): the owner writes
 * their own report on the day itself (until 23.59 office time); the direct
 * manager, Kepala Divisi of the division, Direksi, HR and Super Admin read
 * sent reports. Drafts are the owner's only. Anything else is a 404.
 */
class DailyReportPolicy
{
    public function __construct(private readonly ReportReaders $readers) {}

    /**
     * Write (and see) one's own report of today.
     */
    public function create(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, DailyReport $report): Response
    {
        $owner = $report->relationLoaded('user') ? $report->user : $report->user()->firstOrFail();

        if ($user->id === $report->user_id && $user->isActive()) {
            return Response::allow();
        }

        return $report->isSubmitted() && $this->readers->canRead($user, $owner)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    /**
     * Only the owner, only on the report's own office date.
     */
    public function update(User $user, DailyReport $report): Response
    {
        if ($user->id !== $report->user_id || ! $user->isActive()) {
            return Response::denyAsNotFound();
        }

        return $report->report_date->toDateString() === ReportDay::today()
            ? Response::allow()
            : Response::deny('Laporan hari itu sudah terkunci (batas pukul 23.59).');
    }

    /**
     * Reports list of $owner (/laporan/{user}).
     */
    public function viewReportsOf(User $user, User $owner): Response
    {
        return $this->readers->canRead($user, $owner) ? Response::allow() : Response::denyAsNotFound();
    }

    public function delete(User $user, DailyReport $report): bool
    {
        return false;
    }
}

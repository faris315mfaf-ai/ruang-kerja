<?php

namespace App\Domain\Hiring\Jobs;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Candidate;
use App\Models\HiringPosition;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

/**
 * Daily: permanently deletes applicant data older than the retention window
 * (config/hiring.php, 30 days by default; keputusan pemilik 6 Okt 2026):
 * candidates decided (Diterima / Ditolak), deleted by HR, or left undecided
 * on a position that has been closed, each counted from that moment. Child
 * rows go with the candidate (FK cascade); Inbox notifications about the
 * candidate are removed too. Only the number of purged candidates is audited.
 */
final class PurgeExpiredApplicantData implements ShouldQueue
{
    use Queueable;

    public function handle(AuditLogger $audit): void
    {
        $cutoff = CarbonImmutable::now()->subDays(max(1, config()->integer('hiring.retention_days')));
        $purged = 0;

        Candidate::query()
            ->withTrashed()
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $decided) => $decided
                    ->whereIn('stage', [CandidateStage::Hired->value, CandidateStage::Rejected->value])
                    ->where('decided_at', '<', $cutoff))
                ->orWhere('deleted_at', '<', $cutoff)
                ->orWhereIn('position_id', HiringPosition::query()->withTrashed()->where('closed_at', '<', $cutoff)->select('id')))
            ->orderBy('id')
            ->chunkById(200, function ($candidates) use (&$purged): void {
                $ids = $candidates->modelKeys();

                DB::transaction(function () use ($ids): void {
                    DB::table('notifications')->where('subject_type', Candidate::class)->whereIn('subject_id', $ids)->delete();
                    Candidate::query()->withTrashed()->whereKey($ids)->forceDelete();
                });

                $purged += count($ids);
            });

        if ($purged > 0) {
            $audit->log('hiring.applicants_purged', null, null, ['count' => $purged, 'retention_days' => config()->integer('hiring.retention_days')]);
        }
    }
}

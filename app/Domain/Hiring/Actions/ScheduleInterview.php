<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Notifications\InterviewScheduledNotification;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Candidate;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Jadwal wawancara (Ruang HR › Jadwal, keputusan pemilik 20 Okt 2026): HR
 * sets, moves or clears the planned interview of a candidate who is still
 * before "Keputusan akhir". The time is typed in office time (`Y-m-d H:i`)
 * and stored in UTC. The interviewers of the position are told when a date
 * is set or changed (`hiring.interview_scheduled`, preference
 * `hiring.activity`). The audit row carries ids only (applicant data stays
 * out of the log).
 */
final class ScheduleInterview
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Stages where an interview can still be planned.
     *
     * @return list<CandidateStage>
     */
    public static function stages(): array
    {
        return [CandidateStage::Applied, CandidateStage::Screening, CandidateStage::Interview, CandidateStage::Assessment];
    }

    /**
     * @param  string|null  $at  office time `Y-m-d H:i`; null clears the schedule
     */
    public function handle(User $actor, Candidate $candidate, ?string $at, ?string $location = null): Candidate
    {
        if (! in_array($candidate->stage, self::stages(), true)) {
            throw ValidationException::withMessages(['interview_at' => 'Wawancara hanya bisa dijadwalkan sebelum tahap Keputusan akhir.']);
        }

        $when = $at === null ? null : self::parse($at);
        $location = $when === null ? null : (trim((string) $location) === '' ? null : mb_substr(trim((string) $location), 0, 200));

        $changed = DB::transaction(function () use ($candidate, $when, $location): bool {
            $locked = Candidate::query()->whereKey($candidate->id)->lockForUpdate()->firstOrFail();
            $before = $locked->interview_at?->toIso8601String();

            $locked->forceFill(['interview_at' => $when, 'interview_location' => $location])->save();
            $candidate->setRawAttributes($locked->getAttributes(), true);

            return $before !== $when?->toIso8601String();
        });

        $this->audit->log('hiring.interview_scheduled', $candidate, null, [
            'candidate_id' => $candidate->id,
            'scheduled' => $when !== null,
        ], $actor);

        if ($when !== null && $changed) {
            $interviewers = User::query()
                ->whereIn('id', $candidate->loadMissing('hiringPosition')->hiringPosition->interviewer_ids)
                ->where('company_id', $candidate->company_id)
                ->where('status', UserStatus::Active)
                ->whereKeyNot($actor->id)
                ->get();

            Notification::send($interviewers, new InterviewScheduledNotification($candidate, $actor));
        }

        return $candidate;
    }

    private static function parse(string $value): CarbonImmutable
    {
        $value = str_replace('T', ' ', $value);
        $date = preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $value) === 1
            ? CarbonImmutable::createFromFormat('!Y-m-d H:i', $value, CurrentCompany::timezone())
            : null;

        // Rejects overflowing values such as 2026-02-30 or 25:00.
        if (! $date instanceof CarbonImmutable || $date->format('Y-m-d H:i') !== $value) {
            throw ValidationException::withMessages(['interview_at' => 'Tanggal & jam wawancara tidak valid (format YYYY-MM-DD HH:MM).']);
        }

        return $date->utc();
    }
}

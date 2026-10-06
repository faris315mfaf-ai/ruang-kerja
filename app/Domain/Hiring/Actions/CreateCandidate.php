<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Services\CandidateChecklist;
use App\Domain\Hiring\Services\FormSubmissionMapper;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Candidate;
use App\Models\HiringPosition;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * "Tambah kandidat manual": HR adds an applicant who did not come through the
 * Google Form (referral, email). Starts in "Masuk" with the usual checklist.
 */
final class CreateCandidate
{
    public function __construct(
        private readonly CandidateChecklist $checklist,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{full_name: string, email?: string|null, phone?: string|null, cv_url?: string|null}  $data
     */
    public function handle(User $actor, HiringPosition $position, array $data): Candidate
    {
        $candidate = DB::transaction(function () use ($actor, $position, $data): Candidate {
            $candidate = Candidate::query()->create([
                'company_id' => $position->company_id,
                'position_id' => $position->id,
                'full_name' => trim($data['full_name']),
                'email' => self::email($data['email'] ?? null),
                'phone' => CreateHiringPosition::text($data['phone'] ?? null),
                'cv_url' => FormSubmissionMapper::safeUrl($data['cv_url'] ?? null),
                'attachments' => [],
                'form_answers' => [],
                'stage' => CandidateStage::Applied,
                'source' => CandidateSource::Manual,
                'applied_at' => CarbonImmutable::now(),
                'created_by' => $actor->id,
            ]);

            $this->checklist->seed($candidate, $position);

            return $candidate;
        });

        $this->audit->log('hiring.candidate_created', $candidate, null, [
            'position_id' => $position->id,
            'source' => CandidateSource::Manual->value,
            'stage' => CandidateStage::Applied->value,
        ], $actor);

        return $candidate;
    }

    public static function email(?string $value): ?string
    {
        $value = CreateHiringPosition::text($value);

        return $value === null ? null : mb_strtolower($value);
    }
}

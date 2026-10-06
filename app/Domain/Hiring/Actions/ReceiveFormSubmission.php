<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Notifications\CandidateReceivedNotification;
use App\Domain\Hiring\Services\CandidateChecklist;
use App\Domain\Hiring\Services\FormSubmissionMapper;
use App\Domain\Hiring\Services\HiringAccess;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Candidate;
use App\Models\HiringPosition;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Stores one Google Form response as a candidate (POST /api/hiring/form/{token},
 * signature already verified). Idempotent per `response_id`: a retried
 * delivery returns the existing candidate without notifying again.
 */
final class ReceiveFormSubmission
{
    public function __construct(
        private readonly FormSubmissionMapper $mapper,
        private readonly CandidateChecklist $checklist,
        private readonly HiringAccess $access,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{response_id: string, submitted_at?: string|null, answers?: array<array-key, mixed>, files?: array<array-key, mixed>}  $payload
     * @return array{candidate: Candidate, created: bool}
     */
    public function handle(HiringPosition $position, array $payload): array
    {
        $responseId = mb_substr(trim($payload['response_id']), 0, 191);

        $existing = $this->existing($position, $responseId);

        if ($existing !== null) {
            return ['candidate' => $existing, 'created' => false];
        }

        $answers = FormSubmissionMapper::answers($payload['answers'] ?? []);
        $files = FormSubmissionMapper::files($payload['files'] ?? []);
        $fields = $this->mapper->map($position, $answers, $files);

        try {
            $candidate = DB::transaction(function () use ($position, $responseId, $answers, $files, $fields, $payload): Candidate {
                $candidate = Candidate::query()->create([
                    'company_id' => $position->company_id,
                    'position_id' => $position->id,
                    'full_name' => $fields['full_name'] ?? 'Pelamar tanpa nama',
                    'email' => $fields['email'],
                    'phone' => $fields['phone'],
                    'cv_url' => $fields['cv_url'],
                    'attachments' => $files,
                    'form_answers' => $answers,
                    'external_response_id' => $responseId,
                    'stage' => CandidateStage::Applied,
                    'source' => CandidateSource::GoogleForm,
                    'applied_at' => self::submittedAt($payload['submitted_at'] ?? null),
                ]);

                $this->checklist->seed($candidate, $position);

                return $candidate;
            });
        } catch (UniqueConstraintViolationException) {
            // A parallel retry of the same response won the race.
            $winner = $this->existing($position, $responseId);

            if ($winner === null) {
                throw new \RuntimeException('Candidate for the response could not be stored.');
            }

            return ['candidate' => $winner, 'created' => false];
        }

        // Ids and the source only: applicant data never goes to audit values.
        $this->audit->log('hiring.candidate_received', $candidate, null, [
            'position_id' => $position->id,
            'source' => CandidateSource::GoogleForm->value,
            'stage' => CandidateStage::Applied->value,
        ]);

        $candidate->setRelation('hiringPosition', $position);
        Notification::send($this->access->hrStaff($position->company_id), new CandidateReceivedNotification($candidate));

        return ['candidate' => $candidate, 'created' => true];
    }

    private function existing(HiringPosition $position, string $responseId): ?Candidate
    {
        return Candidate::withTrashed()
            ->where('position_id', $position->id)
            ->where('external_response_id', $responseId)
            ->first();
    }

    private static function submittedAt(?string $value): CarbonImmutable
    {
        $now = CarbonImmutable::now();

        if ($value === null || trim($value) === '') {
            return $now;
        }

        try {
            $at = CarbonImmutable::parse($value)->utc();
        } catch (Throwable) {
            return $now;
        }

        // A clock far in the future (or nonsense) falls back to "now".
        return $at->greaterThan($now->addHour()) ? $now : $at;
    }
}

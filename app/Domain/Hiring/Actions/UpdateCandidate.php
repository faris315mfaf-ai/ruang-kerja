<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Services\FormSubmissionMapper;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Candidate;
use App\Models\User;

/**
 * HR corrects a candidate's contact data or CV link (e.g. a typo in the
 * Form). The audit row names the changed fields, never their values.
 */
final class UpdateCandidate
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{full_name: string, email?: string|null, phone?: string|null, cv_url?: string|null}  $data
     */
    public function handle(User $actor, Candidate $candidate, array $data): Candidate
    {
        $candidate->fill([
            'full_name' => trim($data['full_name']),
            'email' => CreateCandidate::email($data['email'] ?? null),
            'phone' => CreateHiringPosition::text($data['phone'] ?? null),
            'cv_url' => FormSubmissionMapper::safeUrl($data['cv_url'] ?? null),
        ]);

        $changed = array_keys($candidate->getDirty());

        if ($changed !== []) {
            $candidate->save();
            $this->audit->log('hiring.candidate_updated', $candidate, null, ['fields' => $changed], $actor);
        }

        return $candidate;
    }
}

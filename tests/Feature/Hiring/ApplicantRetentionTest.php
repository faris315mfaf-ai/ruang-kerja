<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Jobs\PurgeExpiredApplicantData;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Models\CandidateNote;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/*
 * Keputusan pemilik 6 Okt 2026: applicant data is kept 30 days after the
 * final decision, after HR deletes the candidate, or after the position is
 * closed (undecided candidates), then deleted for good (UU PDP).
 */

beforeEach(function () {
    $this->travelTo('2026-10-06 09:00:00');
    $this->position = HiringPosition::factory()->create();
});

function retentionCandidate(HiringPosition $position, array $attributes = []): Candidate
{
    return Candidate::factory()->forPosition($position)->create($attributes);
}

it('deletes decided applicants 30 days after the decision, with their data and notifications', function () {
    $old = retentionCandidate($this->position, ['stage' => CandidateStage::Rejected, 'decided_at' => now()->subDays(31)]);
    $hired = retentionCandidate($this->position, ['stage' => CandidateStage::Hired, 'decided_at' => now()->subDays(40)]);
    $recent = retentionCandidate($this->position, ['stage' => CandidateStage::Rejected, 'decided_at' => now()->subDays(29)]);
    $open = retentionCandidate($this->position, ['stage' => CandidateStage::Interview]);
    $author = User::factory()->create(['company_id' => $this->position->company_id]);
    CandidateNote::query()->create(['candidate_id' => $old->id, 'author_id' => $author->id, 'body' => 'Notulensi wawancara']);
    DB::table('notifications')->insert([
        'id' => (string) Str::uuid(), 'type' => 'hiring.candidate_decided',
        'notifiable_type' => User::class, 'notifiable_id' => $author->id,
        'subject_type' => Candidate::class, 'subject_id' => $old->id,
        'data' => json_encode(['title' => 'x']), 'action_required' => false,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    (new PurgeExpiredApplicantData)->handle(app(AuditLogger::class));

    expect(Candidate::withTrashed()->whereKey($old->id)->exists())->toBeFalse()
        ->and(Candidate::withTrashed()->whereKey($hired->id)->exists())->toBeFalse()
        ->and(Candidate::query()->whereKey($recent->id)->exists())->toBeTrue()
        ->and(Candidate::query()->whereKey($open->id)->exists())->toBeTrue()
        ->and(CandidateNote::query()->where('candidate_id', $old->id)->exists())->toBeFalse()
        ->and(DB::table('notifications')->where('subject_id', $old->id)->exists())->toBeFalse();

    $log = AuditLog::query()->where('action', 'hiring.applicants_purged')->sole();
    expect($log->new_values)->toBe(['count' => 2, 'retention_days' => 30]);
});

it('deletes candidates HR removed and undecided candidates of a position closed 30 days ago', function () {
    $deleted = retentionCandidate($this->position);
    $deleted->delete();
    $this->travel(31)->days();
    $closed = HiringPosition::factory()->create(['closed_at' => now()->subDays(31)]);
    $undecided = retentionCandidate($closed, ['stage' => CandidateStage::Screening]);
    $stillOpen = retentionCandidate($this->position, ['stage' => CandidateStage::Applied]);

    (new PurgeExpiredApplicantData)->handle(app(AuditLogger::class));

    expect(Candidate::withTrashed()->whereKey($deleted->id)->exists())->toBeFalse()
        ->and(Candidate::withTrashed()->whereKey($undecided->id)->exists())->toBeFalse()
        ->and(Candidate::query()->whereKey($stillOpen->id)->exists())->toBeTrue();
});

it('follows HIRING_RETENTION_DAYS and audits nothing when nothing expired', function () {
    config(['hiring.retention_days' => 60]);
    $candidate = retentionCandidate($this->position, ['stage' => CandidateStage::Rejected, 'decided_at' => now()->subDays(45)]);

    (new PurgeExpiredApplicantData)->handle(app(AuditLogger::class));

    expect(Candidate::query()->whereKey($candidate->id)->exists())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'hiring.applicants_purged')->exists())->toBeFalse();
});

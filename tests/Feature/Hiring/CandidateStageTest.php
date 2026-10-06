<?php

use App\Domain\Hiring\Actions\MoveCandidateStage;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\DecisionValue;
use App\Domain\Hiring\Notifications\DecisionNeededNotification;
use App\Models\AuditLog;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateDecision;
use App\Models\InboxNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
 * Masuk → Seleksi berkas → Wawancara → Penilaian → Keputusan akhir →
 * Diterima / Ditolak (HR moves; Diterima only through the approvers).
 */
beforeEach(function () {
    $this->world = hiringWorld();
    $this->candidate = $this->world->candidate;
});

function hiringMove(string $stage, ?string $reason = null, ?string $as = 'hr'): TestResponse
{
    return test()->actingAs(test()->world->{$as})
        ->from('/hiring/kandidat/'.test()->candidate->id)
        ->put('/hiring/kandidat/'.test()->candidate->id.'/tahap', ['stage' => $stage, 'reason' => $reason]);
}

it('lets HR move a candidate through the open stages and audits each move', function () {
    foreach (['screening', 'interview', 'assessment'] as $stage) {
        hiringMove($stage)->assertRedirect()->assertSessionHasNoErrors();
        expect($this->candidate->fresh()?->stage->value)->toBe($stage);
    }

    expect(AuditLog::query()->where('action', 'hiring.stage_changed')->count())->toBe(3);

    $last = AuditLog::query()->where('action', 'hiring.stage_changed')->latest('created_at')->latest('id')->first();
    expect($last?->old_values)->toBe(['stage' => 'interview'])
        ->and($last?->new_values)->toEqual(['stage' => 'assessment', 'reason_given' => false]);
});

it('refuses Keputusan akhir while required checklist items are open', function () {
    hiringMove('final_review')->assertSessionHasErrors('stage');

    expect($this->candidate->fresh()?->stage)->toBe(CandidateStage::Applied);
});

it('ignores open items of deactivated interviewers', function () {
    hiringCompleteChecklist($this->candidate);
    // The fixture's inactive interviewer has unticked items: they must not block.
    CandidateChecklistItem::query()->where('reviewer_id', $this->world->inactive->id)->update(['checked_at' => null]);

    hiringMove('final_review')->assertSessionHasNoErrors();
    expect($this->candidate->fresh()?->stage)->toBe(CandidateStage::FinalReview);
});

it('notifies every active final approver when the candidate reaches Keputusan akhir', function () {
    Notification::fake();
    hiringToFinal($this->world);

    hiringMove('final_review')->assertSessionHasNoErrors();

    Notification::assertSentTo([$this->world->approver, $this->world->approver2], DecisionNeededNotification::class);
    Notification::assertNotSentTo([$this->world->hr, $this->world->interviewer], DecisionNeededNotification::class);
});

it('stores the decision-needed notification as Perlu tindakan and resolves it when moved back', function () {
    hiringToFinal($this->world);
    hiringMove('final_review')->assertSessionHasNoErrors();

    $open = fn () => InboxNotification::query()->where('type', 'hiring.decision_needed')->whereNull('resolved_at')->where('action_required', true)->count();
    expect($open())->toBe(2);

    CandidateDecision::query()->create([
        'candidate_id' => $this->candidate->id,
        'approver_id' => $this->world->approver->id,
        'decision' => DecisionValue::Approve,
        'decided_at' => now(),
    ]);

    hiringMove('assessment')->assertSessionHasNoErrors();

    expect($open())->toBe(0)
        ->and(CandidateDecision::query()->count())->toBe(0);
});

it('refuses Keputusan akhir when the position has no active final approver', function () {
    hiringToFinal($this->world);
    $this->world->position->forceFill(['final_approver_ids' => [$this->world->inactive->id]])->save();

    hiringMove('final_review')->assertSessionHasErrors('stage');
});

it('requires a reason to reject and never sets Diterima by hand', function () {
    hiringMove('rejected')->assertSessionHasErrors('reason');
    hiringMove('hired')->assertSessionHasErrors('stage');

    hiringMove('rejected', 'Pengalaman belum sesuai.')->assertSessionHasNoErrors();

    $candidate = $this->candidate->fresh();
    expect($candidate?->stage)->toBe(CandidateStage::Rejected)
        ->and($candidate?->rejected_reason)->toBe('Pengalaman belum sesuai.')
        ->and($candidate?->decided_at)->not->toBeNull();

    // Reopening clears the reason.
    hiringMove('screening')->assertSessionHasNoErrors();
    expect($this->candidate->fresh()?->rejected_reason)->toBeNull();
});

it('lets only HR move stages', function () {
    hiringMove('screening', null, 'interviewer')->assertForbidden();
    hiringMove('screening', null, 'approver')->assertForbidden();
    hiringMove('screening', null, 'kadiv')->assertNotFound();
    hiringMove('screening', null, 'anggota')->assertNotFound();
    hiringMove('screening', null, 'admin')->assertSessionHasNoErrors();
});

it('does nothing when the stage does not change', function () {
    $actor = $this->world->hr;

    app(MoveCandidateStage::class)->handle($actor, $this->candidate, CandidateStage::Applied);

    expect(AuditLog::query()->where('action', 'hiring.stage_changed')->count())->toBe(0);
});

it('rejects Diterima through the action as well', function () {
    app(MoveCandidateStage::class)->handle($this->world->hr, $this->candidate, CandidateStage::Hired);
})->throws(ValidationException::class);

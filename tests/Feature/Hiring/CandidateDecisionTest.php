<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Notifications\CandidateDecidedNotification;
use App\Models\AuditLog;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateDecision;
use App\Models\InboxNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
 * Final decision: every final approver approves → Diterima; one rejects →
 * Ditolak (with the reason). HR is notified; approvers' items resolved.
 */
beforeEach(function () {
    $this->world = hiringWorld();
    $this->candidate = hiringToFinal($this->world);
    $this->actingAs($this->world->hr)
        ->put('/hiring/kandidat/'.$this->candidate->id.'/tahap', ['stage' => 'final_review'])
        ->assertSessionHasNoErrors();
});

function hiringTickApprover(string $who): void
{
    CandidateChecklistItem::query()
        ->where('candidate_id', test()->candidate->id)
        ->where('reviewer_id', test()->world->{$who}->id)
        ->update(['checked_at' => now(), 'checked_by' => test()->world->{$who}->id]);
}

function hiringDecide(string $who, string $decision, ?string $note = null): TestResponse
{
    return test()->actingAs(test()->world->{$who})
        ->from('/hiring/kandidat/'.test()->candidate->id)
        ->post('/hiring/kandidat/'.test()->candidate->id.'/keputusan', ['decision' => $decision, 'note' => $note]);
}

it('hires the candidate once every final approver approved', function () {
    Notification::fake();
    hiringTickApprover('approver');
    hiringTickApprover('approver2');

    hiringDecide('approver', 'approve')->assertSessionHasNoErrors();
    expect($this->candidate->fresh()?->stage)->toBe(CandidateStage::FinalReview);
    Notification::assertNothingSentTo($this->world->hr);

    hiringDecide('approver2', 'approve', 'Setuju.')->assertSessionHasNoErrors();

    $candidate = $this->candidate->fresh();
    expect($candidate?->stage)->toBe(CandidateStage::Hired)
        ->and($candidate?->decided_at)->not->toBeNull()
        ->and(CandidateDecision::query()->count())->toBe(2);

    Notification::assertSentTo($this->world->hr, CandidateDecidedNotification::class);
    expect(AuditLog::query()->where('action', 'hiring.decision_recorded')->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'hiring.candidate_decided')->sole()->new_values)->toBe(['stage' => 'hired']);
});

it('rejects the candidate as soon as one approver rejects, with the reason', function () {
    hiringTickApprover('approver');
    hiringDecide('approver', 'approve')->assertSessionHasNoErrors();

    hiringDecide('approver2', 'reject')->assertSessionHasErrors('note');
    hiringDecide('approver2', 'reject', 'Belum cocok dengan kebutuhan tim.')->assertSessionHasNoErrors();

    $candidate = $this->candidate->fresh();
    expect($candidate?->stage)->toBe(CandidateStage::Rejected)
        ->and($candidate?->rejected_reason)->toBe('Belum cocok dengan kebutuhan tim.');

    // HR gets the outcome; nobody still has an open decision item.
    $hrNotice = InboxNotification::query()->where('notifiable_id', $this->world->hr->id)->where('type', 'hiring.candidate_decided')->sole();
    expect($hrNotice->data['title'])->toBe('Nadia Putri ditolak untuk Staf Programmer')
        ->and(InboxNotification::query()->where('type', 'hiring.decision_needed')->whereNull('resolved_at')->count())->toBe(0);
});

it('resolves only the deciding approver item while others still have to decide', function () {
    hiringTickApprover('approver');
    hiringDecide('approver', 'approve')->assertSessionHasNoErrors();

    $open = InboxNotification::query()->where('type', 'hiring.decision_needed')->whereNull('resolved_at')->pluck('notifiable_id')->all();

    expect($open)->toBe([$this->world->approver2->id]);
});

it('requires the approver own checklist before approving', function () {
    hiringDecide('approver', 'approve')->assertSessionHasErrors('decision');

    expect(CandidateDecision::query()->count())->toBe(0);
});

it('lets approvers change their mind until the outcome is final', function () {
    hiringTickApprover('approver');
    hiringDecide('approver', 'approve')->assertSessionHasNoErrors();
    hiringDecide('approver', 'reject', 'Setelah ditinjau ulang, belum cocok.')->assertSessionHasNoErrors();

    expect(CandidateDecision::query()->count())->toBe(1)
        ->and($this->candidate->fresh()?->stage)->toBe(CandidateStage::Rejected);

    // Decided: no more decisions.
    hiringDecide('approver2', 'approve')->assertForbidden();
});

it('refuses decisions from others', function () {
    hiringDecide('interviewer', 'approve')->assertForbidden();
    hiringDecide('hr', 'approve')->assertForbidden();
    hiringDecide('kadiv', 'approve')->assertNotFound();
    hiringDecide('anggota', 'approve')->assertNotFound();
});

it('does not wait for a deactivated approver', function () {
    $this->world->approver2->forceFill(['status' => 'inactive'])->save();
    hiringTickApprover('approver');

    hiringDecide('approver', 'approve')->assertSessionHasNoErrors();

    expect($this->candidate->fresh()?->stage)->toBe(CandidateStage::Hired);
});

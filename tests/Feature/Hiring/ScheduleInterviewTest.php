<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Notifications\InterviewScheduledNotification;
use App\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
 * Jadwal wawancara (Ruang HR › Jadwal, keputusan pemilik 20 Okt 2026):
 * HR sets / moves / clears the interview of a candidate; interviewers are told.
 */
beforeEach(function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-20 09:00', 'Asia/Jakarta'));
    $this->world = hiringWorld();
    $this->url = '/hiring/kandidat/'.$this->world->candidate->id.'/wawancara';
});

it('stores the office time in UTC, tells the active interviewers and shows it on the profile', function () {
    $this->actingAs($this->world->hr)->from('/hiring')
        ->put($this->url, ['interview_at' => '2026-10-22 10:30', 'interview_location' => 'Ruang Rapat 2'])
        ->assertRedirect('/hiring')
        ->assertSessionHasNoErrors();

    $candidate = $this->world->candidate->refresh();
    expect($candidate->interview_at?->toIso8601String())->toBe('2026-10-22T03:30:00+00:00')
        ->and($candidate->interview_location)->toBe('Ruang Rapat 2');

    Notification::assertSentTo([$this->world->interviewer, $this->world->interviewer2], InterviewScheduledNotification::class);
    Notification::assertSentTo($this->world->interviewer, InterviewScheduledNotification::class, fn (InterviewScheduledNotification $notification): bool => $notification->payload($this->world->interviewer)->title === 'Wawancara Nadia Putri: Kam, 22 Okt 2026 10.30'
        && $notification->payload($this->world->interviewer)->body === 'Staf Programmer · Ruang Rapat 2'
        && ! str_contains((string) $notification->externalPayload($this->world->interviewer)->title, 'Nadia'));
    Notification::assertNotSentTo([$this->world->inactive, $this->world->approver, $this->world->hr], InterviewScheduledNotification::class);

    $audit = AuditLog::query()->where('action', 'hiring.interview_scheduled')->sole();
    expect($audit->new_values)->toEqualCanonicalizing(['candidate_id' => $candidate->id, 'scheduled' => true])
        ->and(json_encode($audit->new_values))->not->toContain('Nadia');

    $this->actingAs($this->world->hr)->get('/hiring/kandidat/'.$candidate->id)
        ->assertInertia(fn (Assert $page) => $page
            ->where('candidate.interview.local', '2026-10-22 10:30')
            ->where('candidate.interview.location', 'Ruang Rapat 2')
            ->where('candidate.interview.can_schedule', true));

    $this->actingAs($this->world->interviewer)->get('/hiring/kandidat/'.$candidate->id)
        ->assertInertia(fn (Assert $page) => $page->where('candidate.interview.can_schedule', false));
});

it('accepts the datetime-local form, clears the schedule without notifying, and rejects bad dates', function () {
    $this->actingAs($this->world->hr)->put($this->url, ['interview_at' => '2026-10-22T08:00'])->assertSessionHasNoErrors();
    expect($this->world->candidate->refresh()->interview_at?->toIso8601String())->toBe('2026-10-22T01:00:00+00:00');

    Notification::fake();
    $this->actingAs($this->world->hr)->put($this->url, ['interview_at' => null, 'interview_location' => 'abaikan'])->assertSessionHasNoErrors();
    expect($this->world->candidate->refresh()->interview_at)->toBeNull()
        ->and($this->world->candidate->interview_location)->toBeNull();
    Notification::assertNothingSent();

    $this->actingAs($this->world->hr)->put($this->url, ['interview_at' => '2026-02-30 10:00'])->assertSessionHasErrors('interview_at');
    $this->actingAs($this->world->hr)->put($this->url, ['interview_at' => 'besok'])->assertSessionHasErrors('interview_at');
});

it('refuses decided or final-review candidates and everyone but HR', function () {
    $this->actingAs($this->world->interviewer)->put($this->url, ['interview_at' => '2026-10-22 10:30'])->assertForbidden();
    $this->actingAs($this->world->kadiv)->put($this->url, ['interview_at' => '2026-10-22 10:30'])->assertNotFound();
    $this->actingAs($this->world->foreign)->put($this->url, ['interview_at' => '2026-10-22 10:30'])->assertNotFound();

    $this->world->candidate->forceFill(['stage' => CandidateStage::FinalReview])->save();
    $this->actingAs($this->world->hr)->put($this->url, ['interview_at' => '2026-10-22 10:30'])->assertSessionHasErrors('interview_at');
});

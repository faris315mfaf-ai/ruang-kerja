<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Models\AuditLog;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateNote;
use App\Models\HiringQuestion;
use App\Models\InterviewAnswer;
use App\Models\InterviewScore;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
 * Wawancara tab (answers by HR, own points per interviewer), checklist per
 * reviewer and interview minutes.
 */
beforeEach(function () {
    $this->world = hiringWorld();
    $this->candidate = $this->world->candidate;
    $this->question = $this->world->questions[0];
});

function hiringUrl(string $suffix = ''): string
{
    return '/hiring/kandidat/'.test()->candidate->id.$suffix;
}

it('lets HR record the candidate answer and clear it again', function () {
    $this->actingAs($this->world->hr)
        ->putJson(hiringUrl('/jawaban/'.$this->question->id), ['answer' => '  Membangun sistem absensi.  '])
        ->assertOk()
        ->assertJsonPath('answer', 'Membangun sistem absensi.');

    expect(InterviewAnswer::query()->sole()->recorded_by)->toBe($this->world->hr->id);

    $this->putJson(hiringUrl('/jawaban/'.$this->question->id), ['answer' => ''])->assertOk()->assertJsonPath('answer', null);
    expect(InterviewAnswer::query()->count())->toBe(0);

    $this->actingAs($this->world->interviewer)
        ->putJson(hiringUrl('/jawaban/'.$this->question->id), ['answer' => 'x'])
        ->assertForbidden();
});

it('stores points only for the signed-in interviewer, within the question maximum', function () {
    $this->actingAs($this->world->interviewer)
        ->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => 4, 'note' => 'Jelas.'])
        ->assertOk()
        ->assertJsonPath('my_score.score', 4);

    $this->actingAs($this->world->interviewer2)
        ->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => 2])
        ->assertOk();

    expect(InterviewScore::query()->where('interviewer_id', $this->world->interviewer->id)->sole()->score)->toBe(4)
        ->and(InterviewScore::query()->where('interviewer_id', $this->world->interviewer2->id)->sole()->score)->toBe(2);

    // Above the maximum (5) or a note without points.
    $this->actingAs($this->world->interviewer)->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => 6])->assertUnprocessable();
    $this->actingAs($this->world->interviewer)->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => null, 'note' => 'x'])->assertUnprocessable();

    // HR and approvers do not score; others see nothing.
    $this->actingAs($this->world->hr)->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => 3])->assertForbidden();
    $this->actingAs($this->world->approver)->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => 3])->assertForbidden();
    $this->actingAs($this->world->kadiv)->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => 3])->assertNotFound();

    // Clearing removes only the own row.
    $this->actingAs($this->world->interviewer)->putJson(hiringUrl('/poin/'.$this->question->id), ['score' => null])->assertOk();
    expect(InterviewScore::query()->pluck('interviewer_id')->all())->toBe([$this->world->interviewer2->id]);
});

it('refuses a question of another position', function () {
    $other = HiringQuestion::factory()->create();

    $this->actingAs($this->world->interviewer)
        ->putJson(hiringUrl('/poin/'.$other->id), ['score' => 3])
        ->assertNotFound();
});

it('shows every interviewer points to HR and approvers, only own points to an interviewer', function () {
    foreach ([[$this->world->interviewer, 4], [$this->world->interviewer2, 2]] as [$user, $score]) {
        InterviewScore::query()->create([
            'candidate_id' => $this->candidate->id,
            'question_id' => $this->question->id,
            'interviewer_id' => $user->id,
            'score' => $score,
        ]);
    }

    $this->actingAs($this->world->approver)->get(hiringUrl())
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('hiring/candidate')
            ->has('questions.0.scores', 2)
            ->where('questions.0.average', 3)
            ->where('can.see_all_scores', true));

    $this->actingAs($this->world->interviewer)->get(hiringUrl())
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('questions.0.scores', null)
            ->where('questions.0.average', null)
            ->where('questions.0.my_score.score', 4)
            ->where('can.score', true)
            ->where('can.manage', false));
});

it('lets each reviewer tick their own items and HR add or remove items', function () {
    $own = CandidateChecklistItem::query()->where('reviewer_id', $this->world->interviewer->id)->orderBy('position')->firstOrFail();
    $hrItem = CandidateChecklistItem::query()->whereNull('reviewer_id')->orderBy('position')->firstOrFail();

    $this->actingAs($this->world->interviewer)
        ->patchJson('/hiring/checklist/'.$own->id, ['checked' => true, 'note' => 'Selesai 45 menit.'])
        ->assertOk();

    expect($own->fresh()?->checked_at)->not->toBeNull()
        ->and($own->fresh()?->checked_by)->toBe($this->world->interviewer->id)
        ->and($own->fresh()?->note)->toBe('Selesai 45 menit.');

    $this->patchJson('/hiring/checklist/'.$hrItem->id, ['checked' => true])->assertForbidden();
    $this->actingAs($this->world->hr)->patchJson('/hiring/checklist/'.$hrItem->id, ['checked' => true])->assertOk();
    $this->actingAs($this->world->hr)->patchJson('/hiring/checklist/'.$own->id, ['checked' => false])->assertForbidden();

    // Unticking clears the tick.
    $this->actingAs($this->world->interviewer)->patchJson('/hiring/checklist/'.$own->id, ['checked' => false])->assertOk();
    expect($own->fresh()?->checked_at)->toBeNull();

    // HR adds an item for an approver, then removes it.
    $this->actingAs($this->world->hr)
        ->post(hiringUrl('/checklist'), ['label' => 'Cek referensi', 'reviewer_id' => $this->world->approver->id, 'required' => true])
        ->assertSessionHasNoErrors();

    $added = CandidateChecklistItem::query()->where('label', 'Cek referensi')->sole();
    expect($added->role->value)->toBe('approver')
        ->and($added->reviewer_id)->toBe($this->world->approver->id);

    $this->actingAs($this->world->hr)
        ->post(hiringUrl('/checklist'), ['label' => 'Orang luar', 'reviewer_id' => $this->world->kadiv->id])
        ->assertSessionHasErrors('reviewer_id');

    $this->actingAs($this->world->interviewer)->post(hiringUrl('/checklist'), ['label' => 'Butir baru'])->assertForbidden();
    $this->actingAs($this->world->hr)->delete('/hiring/checklist/'.$added->id)->assertRedirect();
    expect(CandidateChecklistItem::query()->whereKey($added->id)->exists())->toBeFalse();
});

it('locks the checklist once the candidate is decided', function () {
    $own = CandidateChecklistItem::query()->where('reviewer_id', $this->world->interviewer->id)->firstOrFail();
    $this->candidate->forceFill(['stage' => CandidateStage::Rejected, 'rejected_reason' => 'x'])->save();

    $this->actingAs($this->world->interviewer)
        ->patchJson('/hiring/checklist/'.$own->id, ['checked' => true])
        ->assertForbidden();
});

it('keeps interview minutes editable by their author only', function () {
    $this->actingAs($this->world->approver)
        ->post(hiringUrl('/notulensi'), ['body' => 'Kandidat komunikatif.'])
        ->assertSessionHasNoErrors();

    $note = CandidateNote::query()->sole();
    expect($note->author_id)->toBe($this->world->approver->id);

    $this->actingAs($this->world->hr)->patch('/hiring/notulensi/'.$note->id, ['body' => 'Diubah HR'])->assertForbidden();
    $this->actingAs($this->world->approver)->patch('/hiring/notulensi/'.$note->id, ['body' => 'Kandidat sangat komunikatif.'])->assertSessionHasNoErrors();

    expect($note->fresh()?->body)->toBe('Kandidat sangat komunikatif.')
        ->and($note->fresh()?->edited_at)->not->toBeNull();

    $this->actingAs($this->world->anggota)->post(hiringUrl('/notulensi'), ['body' => 'x'])->assertNotFound();
    $this->actingAs($this->world->interviewer)->delete('/hiring/notulensi/'.$note->id)->assertForbidden();
    $this->actingAs($this->world->approver)->delete('/hiring/notulensi/'.$note->id)->assertRedirect();

    expect(CandidateNote::query()->count())->toBe(0);
});

it('lets HR correct contact data without logging it', function () {
    $this->actingAs($this->world->hr)
        ->patch(hiringUrl(), ['full_name' => 'Nadia Putri Lestari', 'email' => 'NADIA@contoh.id', 'phone' => '0811', 'cv_url' => 'https://contoh.id/cv.pdf'])
        ->assertSessionHasNoErrors();

    expect($this->candidate->fresh()?->email)->toBe('nadia@contoh.id');

    $audit = AuditLog::query()->where('action', 'hiring.candidate_updated')->sole();
    expect(json_encode($audit->new_values))->not->toContain('Lestari');

    $this->actingAs($this->world->hr)->patch(hiringUrl(), ['full_name' => 'X Y', 'cv_url' => 'javascript:alert(1)'])->assertSessionHasErrors('cv_url');
    $this->actingAs($this->world->interviewer)->patch(hiringUrl(), ['full_name' => 'Nama Baru'])->assertForbidden();
});

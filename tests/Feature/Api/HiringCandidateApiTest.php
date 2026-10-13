<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Notifications\CandidateDecidedNotification;
use App\Domain\Hiring\Notifications\DecisionNeededNotification;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateDecision;
use App\Models\CandidateNote;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\InterviewAnswer;
use App\Models\InterviewScore;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
| API v1 — B5-H Hiring (Bagian 5): akses menu, kandidat (chip tahap, tambah
| manual, ubah data, pindah/tolak/buka kembali), profil kandidat (Wawancara,
| Checklist, Notulensi, Keputusan) — Action/Policy/Query web; pewawancara
| hanya poinnya sendiri, orang lain 404, semua respons `no-store`.
*/

beforeEach(function () {
    $this->world = hiringWorld();
    $this->candidate = $this->world->candidate;
    $this->question = $this->world->questions[0];
});

function hiringApi(User $user): void
{
    Sanctum::actingAs($user);
}

function kandidatApi(string $suffix = ''): string
{
    return '/api/v1/hiring/kandidat/'.test()->candidate->id.$suffix;
}

function assertNoStore(TestResponse $response): TestResponse
{
    expect((string) $response->headers->get('Cache-Control'))->toContain('no-store');

    return $response;
}

test('the Lainnya access summary tells who may enter Hiring and the badge', function () {
    $this->world->candidate->forceFill(['stage' => CandidateStage::Applied])->save();

    hiringApi($this->world->hr);
    assertNoStore($this->getJson('/api/v1/hiring/akses'))
        ->assertOk()
        ->assertJsonPath('has_access', true)
        ->assertJsonPath('can_manage', true)
        ->assertJsonPath('counts.open_positions', 1)
        ->assertJsonPath('counts.new_candidates', 1)
        ->assertJsonPath('badge', 1);

    hiringApi($this->world->interviewer);
    $this->getJson('/api/v1/hiring/akses')->assertOk()
        ->assertJsonPath('has_access', true)
        ->assertJsonPath('can_manage', false)
        ->assertJsonPath('badge', 0);

    foreach (['anggota', 'kadiv', 'direksi'] as $who) {
        hiringApi($this->world->{$who});
        $this->getJson('/api/v1/hiring/akses')->assertOk()
            ->assertExactJson(['has_access' => false, 'can_manage' => false, 'counts' => null, 'badge' => 0]);
    }

    // HR of another company only counts their own company.
    hiringApi($this->world->foreign);
    $this->getJson('/api/v1/hiring/akses')->assertOk()->assertJsonPath('counts.new_candidates', 0)->assertJsonPath('counts.open_positions', 0);
});

test('the Kandidat tab lists cards with stage counts, filters and manager flags', function () {
    $other = Candidate::factory()->forPosition($this->world->position)->withChecklist()
        ->stage(CandidateStage::Interview)->create(['full_name' => 'Yoga Pratama', 'email' => 'yoga@contoh.id']);

    hiringApi($this->world->hr);
    assertNoStore($this->getJson('/api/v1/hiring/kandidat'))
        ->assertOk()
        ->assertJsonPath('hiring.can_manage', true)
        ->assertJsonCount(2, 'candidates')
        ->assertJsonCount(7, 'stages')
        ->assertJsonPath('stages.0.value', 'applied')
        ->assertJsonPath('stages.0.label', 'Masuk')
        ->assertJsonPath('stages.0.count', 1)
        ->assertJsonPath('stages.2.count', 1)
        ->assertJsonPath('positions.0.id', $this->world->position->id)
        ->assertJsonPath('can.create_candidate', true)
        ->assertJsonPath('can.move', true);

    $this->getJson('/api/v1/hiring/kandidat?tahap=interview')->assertOk()
        ->assertJsonCount(1, 'candidates')
        ->assertJsonPath('candidates.0.id', $other->id)
        ->assertJsonPath('candidates.0.stage_label', 'Wawancara')
        ->assertJsonPath('stages.0.count', 1)
        ->assertJsonPath('filters.stage', 'interview');

    $this->getJson('/api/v1/hiring/kandidat?q=yoga&lowongan='.$this->world->position->id)->assertOk()
        ->assertJsonCount(1, 'candidates')
        ->assertJsonPath('filters.q', 'yoga')
        ->assertJsonPath('filters.position', $this->world->position->id);

    assertNoStore($this->getJson('/api/v1/hiring/kandidat?tahap=bukan'))->assertUnprocessable()->assertJsonValidationErrors('tahap');

    hiringApi($this->world->interviewer);
    $this->getJson('/api/v1/hiring/kandidat')->assertOk()
        ->assertJsonCount(2, 'candidates')
        ->assertJsonPath('can.manage', false)
        ->assertJsonPath('can.create_candidate', false);

    // A position the interviewer is not on stays invisible.
    $hidden = HiringPosition::factory()->create(['company_id' => $this->world->hr->company_id]);
    Candidate::factory()->forPosition($hidden)->create();
    $this->getJson('/api/v1/hiring/kandidat')->assertOk()->assertJsonCount(2, 'candidates')->assertJsonCount(1, 'positions');

    foreach (['anggota', 'kadiv', 'direksi'] as $who) {
        hiringApi($this->world->{$who});
        $this->getJson('/api/v1/hiring/kandidat')->assertNotFound();
    }

    hiringApi($this->world->foreign);
    $this->getJson('/api/v1/hiring/kandidat')->assertOk()->assertJsonCount(0, 'candidates')->assertJsonCount(0, 'positions');
});

test('the profile per role: HR manages, interviewers see only own points, others 404', function () {
    foreach ([[$this->world->interviewer, 4], [$this->world->interviewer2, 2]] as [$user, $score]) {
        InterviewScore::query()->create([
            'candidate_id' => $this->candidate->id,
            'question_id' => $this->question->id,
            'interviewer_id' => $user->id,
            'score' => $score,
        ]);
    }

    hiringApi($this->world->hr);
    assertNoStore($this->getJson(kandidatApi()))
        ->assertOk()
        ->assertJsonPath('candidate.candidate.full_name', 'Nadia Putri')
        ->assertJsonPath('candidate.candidate.stage_label', 'Masuk')
        ->assertJsonPath('candidate.candidate.position.status_label', 'Dibuka')
        ->assertJsonCount(3, 'candidate.questions')
        ->assertJsonCount(2, 'candidate.questions.0.scores')
        ->assertJsonPath('candidate.questions.0.average', 3)
        ->assertJsonPath('candidate.can.manage', true)
        ->assertJsonPath('candidate.can.move', true)
        ->assertJsonPath('candidate.can.answer', true)
        ->assertJsonPath('candidate.can.score', false)
        ->assertJsonPath('candidate.can.decide', false)
        ->assertJsonPath('candidate.summary.score.total', 3)
        ->assertJsonPath('candidate.summary.score.max', 5)
        ->assertJsonCount(2, 'candidate.summary.score.by_interviewer')
        ->assertJsonPath('candidate.move_targets.0.stage', 'screening')
        ->assertJsonPath('candidate.move_targets.3.stage', 'final_review')
        ->assertJsonPath('candidate.move_targets.4.stage', 'rejected')
        ->assertJsonPath('candidate.move_targets.4.requires_reason', true);

    expect($this->getJson(kandidatApi())->json('candidate.move_targets.3.blocked'))->toContain('butir checklist wajib')
        ->and(collect($this->getJson(kandidatApi())->json('candidate.move_targets'))->pluck('stage'))->not->toContain('hired');

    hiringApi($this->world->interviewer);
    $this->getJson(kandidatApi())->assertOk()
        ->assertJsonPath('candidate.questions.0.scores', null)
        ->assertJsonPath('candidate.questions.0.average', null)
        ->assertJsonPath('candidate.questions.0.my_score.score', 4)
        ->assertJsonPath('candidate.summary.score', null)
        ->assertJsonPath('candidate.summary.my_score.total', 4)
        ->assertJsonPath('candidate.can.score', true)
        ->assertJsonPath('candidate.can.manage', false)
        ->assertJsonPath('candidate.can.is_interviewer', true)
        ->assertJsonPath('candidate.move_targets', []);

    hiringApi($this->world->approver);
    $this->getJson(kandidatApi())->assertOk()
        ->assertJsonCount(2, 'candidate.questions.0.scores')
        ->assertJsonPath('candidate.can.see_all_scores', true)
        ->assertJsonPath('candidate.can.is_approver', true)
        ->assertJsonPath('candidate.can.decide', false);

    foreach (['anggota', 'kadiv', 'direksi', 'foreign'] as $who) {
        hiringApi($this->world->{$who});
        $this->getJson(kandidatApi())->assertNotFound();
    }
});

test('HR adds a candidate by hand and corrects contact data; reviewers cannot', function () {
    hiringApi($this->world->hr);

    $created = $this->postJson('/api/v1/hiring/kandidat', [
        'position_id' => $this->world->position->id,
        'full_name' => 'Rani Wijaya',
        'email' => 'RANI@contoh.id',
        'phone' => '0812',
        'cv_url' => 'https://contoh.id/rani.pdf',
    ]);
    assertNoStore($created)->assertCreated()
        ->assertJsonPath('message', 'Rani Wijaya ditambahkan ke tahap Masuk.')
        ->assertJsonPath('candidate.candidate.stage', 'applied')
        ->assertJsonPath('candidate.candidate.source', 'manual')
        ->assertJsonPath('candidate.candidate.is_manual', true)
        ->assertJsonPath('candidate.candidate.email', 'rani@contoh.id');

    $id = $created->json('candidate.candidate.id');
    expect(CandidateChecklistItem::query()->where('candidate_id', $id)->count())->toBeGreaterThan(0);

    $audit = AuditLog::query()->where('action', 'hiring.candidate_created')->sole();
    expect(json_encode([$audit->old_values, $audit->new_values]))->not->toContain('Rani')->not->toContain('rani@');

    $this->postJson('/api/v1/hiring/kandidat', ['position_id' => $this->world->position->id, 'full_name' => 'X', 'cv_url' => 'javascript:alert(1)'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['full_name', 'cv_url']);

    $this->patchJson('/api/v1/hiring/kandidat/'.$id, ['full_name' => 'Rani Wijaya Putri', 'email' => null])
        ->assertOk()
        ->assertJsonPath('message', 'Data kandidat disimpan.')
        ->assertJsonPath('candidate.candidate.full_name', 'Rani Wijaya Putri')
        ->assertJsonPath('candidate.candidate.email', null);

    hiringApi($this->world->interviewer);
    $this->postJson('/api/v1/hiring/kandidat', ['position_id' => $this->world->position->id, 'full_name' => 'Orang Lain'])->assertForbidden();
    $this->patchJson('/api/v1/hiring/kandidat/'.$id, ['full_name' => 'Nama Baru'])->assertForbidden();

    hiringApi($this->world->anggota);
    $this->postJson('/api/v1/hiring/kandidat', ['position_id' => $this->world->position->id, 'full_name' => 'Orang Lain'])->assertNotFound();
    $this->patchJson('/api/v1/hiring/kandidat/'.$id, ['full_name' => 'Nama Baru'])->assertNotFound();
});

test('stage moves: checklist gate for Keputusan akhir, reason for Ditolak, reopen clears decisions', function () {
    Notification::fake();
    hiringApi($this->world->hr);

    $this->putJson(kandidatApi('/tahap'), ['stage' => 'screening'])->assertOk()
        ->assertJsonPath('previous_stage', 'applied')
        ->assertJsonPath('candidate.candidate.stage', 'screening')
        ->assertJsonPath('message', 'Nadia Putri dipindah ke Seleksi berkas.');

    $this->putJson(kandidatApi('/tahap'), ['stage' => 'final_review'])->assertUnprocessable()
        ->assertJsonValidationErrors('stage');
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'hired'])->assertUnprocessable()->assertJsonValidationErrors('stage');
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'rejected'])->assertUnprocessable()->assertJsonValidationErrors('reason');

    hiringCompleteChecklist($this->candidate);
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'final_review'])->assertOk()
        ->assertJsonPath('candidate.candidate.stage', 'final_review');
    Notification::assertSentTo([$this->world->approver, $this->world->approver2], DecisionNeededNotification::class);

    CandidateDecision::query()->create([
        'candidate_id' => $this->candidate->id,
        'approver_id' => $this->world->approver->id,
        'decision' => 'approve',
        'decided_at' => now(),
    ]);

    $this->putJson(kandidatApi('/tahap'), ['stage' => 'rejected', 'reason' => 'Posisi sudah terisi.'])->assertOk()
        ->assertJsonPath('candidate.candidate.stage', 'rejected')
        ->assertJsonPath('candidate.candidate.rejected_reason', 'Posisi sudah terisi.');
    expect(CandidateDecision::query()->count())->toBe(0);

    // Reopen a decided candidate.
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'interview'])->assertOk()
        ->assertJsonPath('candidate.candidate.stage', 'interview')
        ->assertJsonPath('candidate.candidate.rejected_reason', null);

    $audits = AuditLog::query()->where('action', 'hiring.stage_changed')->get();
    expect($audits)->toHaveCount(4)
        ->and(json_encode($audits->pluck('new_values')))->not->toContain('terisi');

    hiringApi($this->world->approver);
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'assessment'])->assertForbidden();
    hiringApi($this->world->kadiv);
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'assessment'])->assertNotFound();
});

test('Wawancara: HR autosaves answers, interviewers their own points within the maximum', function () {
    hiringApi($this->world->hr);
    assertNoStore($this->putJson(kandidatApi('/jawaban/'.$this->question->id), ['answer' => '  Sistem absensi.  ']))
        ->assertOk()
        ->assertJsonPath('question_id', $this->question->id)
        ->assertJsonPath('answer', 'Sistem absensi.');
    expect(InterviewAnswer::query()->sole()->recorded_by)->toBe($this->world->hr->id);

    $this->putJson(kandidatApi('/jawaban/'.$this->question->id), ['answer' => ''])->assertOk()->assertJsonPath('answer', null);
    expect(InterviewAnswer::query()->count())->toBe(0);
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => 3])->assertForbidden();

    hiringApi($this->world->interviewer);
    $this->putJson(kandidatApi('/jawaban/'.$this->question->id), ['answer' => 'x'])->assertForbidden();
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => 4, 'note' => 'Jelas.'])->assertOk()
        ->assertJsonPath('my_score.score', 4)
        ->assertJsonPath('my_score.note', 'Jelas.')
        ->assertJsonPath('max_score', 5);
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => 6])->assertUnprocessable()
        ->assertJsonPath('errors.score.0', 'Poin harus antara 1 dan 5.');
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => null, 'note' => 'x'])->assertUnprocessable()
        ->assertJsonValidationErrors('score');

    $other = HiringQuestion::factory()->create();
    $this->putJson(kandidatApi('/poin/'.$other->id), ['score' => 3])->assertNotFound();

    hiringApi($this->world->interviewer2);
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => 2])->assertOk();
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => null])->assertOk()->assertJsonPath('my_score', null);
    expect(InterviewScore::query()->pluck('interviewer_id')->all())->toBe([$this->world->interviewer->id]);

    hiringApi($this->world->approver);
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => 3])->assertForbidden();
    hiringApi($this->world->anggota);
    $this->putJson(kandidatApi('/poin/'.$this->question->id), ['score' => 3])->assertNotFound();
});

test('Checklist: own items ticked by their reviewer, HR adds and removes items', function () {
    $own = CandidateChecklistItem::query()->where('reviewer_id', $this->world->interviewer->id)->orderBy('position')->firstOrFail();
    $hrItem = CandidateChecklistItem::query()->whereNull('reviewer_id')->orderBy('position')->firstOrFail();

    hiringApi($this->world->interviewer);
    assertNoStore($this->patchJson('/api/v1/hiring/checklist/'.$own->id, ['checked' => true, 'note' => 'Selesai 45 menit.']))
        ->assertOk()
        ->assertJsonPath('item.id', $own->id)
        ->assertJsonPath('item.note', 'Selesai 45 menit.')
        ->assertJsonPath('item.checked_by.id', $this->world->interviewer->id)
        ->assertJsonPath('item.mine', true)
        ->assertJsonPath('item.can_delete', false);
    $this->patchJson('/api/v1/hiring/checklist/'.$hrItem->id, ['checked' => true])->assertForbidden();
    $this->postJson(kandidatApi('/checklist'), ['label' => 'Butir baru'])->assertForbidden();

    hiringApi($this->world->hr);
    $this->patchJson('/api/v1/hiring/checklist/'.$hrItem->id, ['checked' => true])->assertOk()->assertJsonPath('item.role_label', 'HR');
    $this->patchJson('/api/v1/hiring/checklist/'.$own->id, ['checked' => false])->assertForbidden();
    $this->patchJson('/api/v1/hiring/checklist/'.$hrItem->id, [])->assertUnprocessable()->assertJsonValidationErrors('checked');

    $added = $this->postJson(kandidatApi('/checklist'), ['label' => 'Cek referensi', 'reviewer_id' => $this->world->approver->id, 'required' => true])
        ->assertCreated()
        ->assertJsonPath('item.role', 'approver')
        ->assertJsonPath('item.reviewer.id', $this->world->approver->id)
        ->assertJsonPath('item.can_delete', true)
        ->json('item.id');

    $this->postJson(kandidatApi('/checklist'), ['label' => 'Orang luar', 'reviewer_id' => $this->world->kadiv->id])
        ->assertUnprocessable()->assertJsonValidationErrors('reviewer_id');

    $this->deleteJson('/api/v1/hiring/checklist/'.$hrItem->id)->assertForbidden();
    $this->deleteJson('/api/v1/hiring/checklist/'.$added)->assertNoContent();
    expect(CandidateChecklistItem::query()->whereKey($added)->exists())->toBeFalse();

    // Decided candidates are locked.
    $this->candidate->forceFill(['stage' => CandidateStage::Rejected, 'rejected_reason' => 'x'])->save();
    hiringApi($this->world->interviewer);
    $this->patchJson('/api/v1/hiring/checklist/'.$own->id, ['checked' => false])->assertForbidden();

    hiringApi($this->world->anggota);
    $this->patchJson('/api/v1/hiring/checklist/'.$own->id, ['checked' => true])->assertNotFound();
});

test('Notulensi: every reviewer adds, only the author edits or deletes', function () {
    hiringApi($this->world->approver);
    $id = assertNoStore($this->postJson(kandidatApi('/notulensi'), ['body' => 'Kandidat komunikatif.']))
        ->assertCreated()
        ->assertJsonPath('note.body', 'Kandidat komunikatif.')
        ->assertJsonPath('note.author.id', $this->world->approver->id)
        ->assertJsonPath('note.can_edit', true)
        ->json('note.id');

    $this->postJson(kandidatApi('/notulensi'), ['body' => ''])->assertUnprocessable()->assertJsonValidationErrors('body');

    $this->patchJson('/api/v1/hiring/notulensi/'.$id, ['body' => 'Kandidat sangat komunikatif.'])->assertOk()
        ->assertJsonPath('note.body', 'Kandidat sangat komunikatif.');
    expect(CandidateNote::query()->sole()->edited_at)->not->toBeNull();

    hiringApi($this->world->hr);
    $this->patchJson('/api/v1/hiring/notulensi/'.$id, ['body' => 'Diubah HR'])->assertForbidden();
    $this->deleteJson('/api/v1/hiring/notulensi/'.$id)->assertForbidden();

    hiringApi($this->world->interviewer);
    $this->getJson(kandidatApi())->assertOk()->assertJsonPath('candidate.notes.0.can_edit', false);

    hiringApi($this->world->anggota);
    $this->postJson(kandidatApi('/notulensi'), ['body' => 'Saya ikut.'])->assertNotFound();
    $this->deleteJson('/api/v1/hiring/notulensi/'.$id)->assertNotFound();

    hiringApi($this->world->approver);
    $this->deleteJson('/api/v1/hiring/notulensi/'.$id)->assertNoContent();
    expect(CandidateNote::query()->count())->toBe(0);
});

test('Keputusan: all approvers approve → Diterima; own checklist first; note required to reject', function () {
    Notification::fake();
    hiringToFinal($this->world);
    hiringApi($this->world->hr);
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'final_review'])->assertOk();

    hiringApi($this->world->approver);
    $this->getJson(kandidatApi())->assertOk()
        ->assertJsonPath('candidate.can.decide', true)
        ->assertJsonPath('candidate.blockers.my_approval', 1)
        ->assertJsonPath('candidate.my_decision', null);

    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'approve'])->assertUnprocessable()
        ->assertJsonValidationErrors('decision');
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'reject'])->assertUnprocessable()
        ->assertJsonPath('errors.note.0', 'Tulis alasan penolakan.');
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'maybe'])->assertUnprocessable()->assertJsonValidationErrors('decision');

    foreach (['approver', 'approver2'] as $who) {
        CandidateChecklistItem::query()->where('candidate_id', $this->candidate->id)->where('reviewer_id', $this->world->{$who}->id)
            ->update(['checked_at' => now(), 'checked_by' => $this->world->{$who}->id]);
    }

    assertNoStore($this->postJson(kandidatApi('/keputusan'), ['decision' => 'approve']))->assertOk()
        ->assertJsonPath('outcome', null)
        ->assertJsonPath('message', 'Keputusan Anda dicatat. Menunggu penyetuju lain.')
        ->assertJsonPath('candidate.my_decision.decision', 'approve')
        ->assertJsonPath('candidate.summary.decisions.approved', 1)
        ->assertJsonPath('candidate.summary.decisions.pending', 1);

    hiringApi($this->world->interviewer);
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'approve'])->assertForbidden();
    hiringApi($this->world->anggota);
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'approve'])->assertNotFound();

    hiringApi($this->world->approver2);
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'approve', 'note' => 'Setuju.'])->assertOk()
        ->assertJsonPath('outcome', 'hired')
        ->assertJsonPath('message', 'Semua penyetuju setuju: Nadia Putri diterima.')
        ->assertJsonPath('candidate.candidate.stage', 'hired')
        ->assertJsonPath('candidate.can.decide', false);

    Notification::assertSentTo($this->world->hr, CandidateDecidedNotification::class);
    expect(AuditLog::query()->where('action', 'hiring.decision_recorded')->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'hiring.candidate_decided')->sole()->new_values)->toBe(['stage' => 'hired']);

    // A late decision on a decided candidate is a conflict, not a silent change.
    hiringApi($this->world->approver);
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'reject', 'note' => 'Berubah pikiran.'])->assertStatus(409)
        ->assertJsonPath('code', 'bukan_tahap_keputusan')
        ->assertJsonPath('candidate.candidate.stage', 'hired');
});

test('Keputusan: one rejection → Ditolak with the reason, never in the audit', function () {
    Notification::fake();
    hiringToFinal($this->world);
    hiringApi($this->world->hr);
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'final_review'])->assertOk();

    hiringApi($this->world->approver2);
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'reject', 'note' => 'Belum cocok dengan kebutuhan tim.'])->assertOk()
        ->assertJsonPath('outcome', 'rejected')
        ->assertJsonPath('message', 'Nadia Putri ditolak.')
        ->assertJsonPath('candidate.candidate.rejected_reason', 'Belum cocok dengan kebutuhan tim.')
        ->assertJsonPath('candidate.decisions.1.decision_label', 'Ditolak');

    expect($this->candidate->fresh()?->stage)->toBe(CandidateStage::Rejected)
        ->and(json_encode(AuditLog::query()->where('action', 'like', 'hiring.%')->get(['old_values', 'new_values'])))
        ->not->toContain('Belum cocok')->not->toContain('Nadia');
});

test('Keputusan before the candidate reaches Keputusan akhir answers 409 for an approver', function () {
    hiringApi($this->world->approver);
    $this->postJson(kandidatApi('/keputusan'), ['decision' => 'approve'])->assertStatus(409)
        ->assertJsonPath('code', 'bukan_tahap_keputusan')
        ->assertJsonPath('candidate.candidate.stage', 'applied');

    expect(CandidateDecision::query()->count())->toBe(0);
});

test('Super Admin (with 2FA) has the same full access as HR', function () {
    $admin = $this->world->admin;
    $admin->forceFill([
        'two_factor_secret' => encrypt('secret'),
        'two_factor_recovery_codes' => encrypt(json_encode(['recovery-code-1'])),
        'two_factor_confirmed_at' => now(),
    ])->save();

    hiringApi($admin);
    $this->getJson('/api/v1/hiring/akses')->assertOk()->assertJsonPath('can_manage', true);
    $this->getJson(kandidatApi())->assertOk()->assertJsonPath('candidate.can.manage', true);
    $this->putJson(kandidatApi('/tahap'), ['stage' => 'screening'])->assertOk();
    $this->getJson('/api/v1/hiring/pengaturan')->assertOk();
});

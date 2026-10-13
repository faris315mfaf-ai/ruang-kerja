<?php

use App\Domain\Hiring\Enums\PositionStatus;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\Division;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\HiringSetting;
use App\Models\InterviewScore;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
| API v1 — B5-H Hiring: Lowongan (daftar, buat, pengaturan, hapus),
| pertanyaan (tambah, ubah dengan batas poin, urutkan, hapus bila belum
| dipakai) dan Pengaturan hiring. Secret webhook tidak pernah dikirim.
*/

beforeEach(function () {
    $this->world = hiringWorld();
    $this->position = $this->world->position;
});

function lowonganApi(string $suffix = ''): string
{
    return '/api/v1/hiring/lowongan/'.test()->position->id.$suffix;
}

/**
 * @return array<string, mixed>
 */
function lowonganForm(HiringPosition $position, array $overrides = []): array
{
    return [
        'title' => $position->title,
        'division_id' => $position->division_id,
        'description' => $position->description,
        'status' => $position->status->value,
        'interviewer_ids' => $position->interviewer_ids,
        'final_approver_ids' => $position->final_approver_ids,
        'field_map' => ['full_name' => 'Nama pelamar', 'email' => null, 'phone' => null, 'cv_url' => null],
        ...$overrides,
    ];
}

test('the Lowongan tab lists positions with counts and the viewer roles', function () {
    Sanctum::actingAs($this->world->hr);
    $response = $this->getJson('/api/v1/hiring/lowongan')->assertOk()
        ->assertJsonCount(1, 'positions')
        ->assertJsonPath('positions.0.id', $this->position->id)
        ->assertJsonPath('positions.0.status_label', 'Dibuka')
        ->assertJsonPath('positions.0.candidates_count', 1)
        ->assertJsonPath('positions.0.open_candidates_count', 1)
        ->assertJsonPath('positions.0.my_roles', [])
        ->assertJsonPath('can.create', true);
    expect((string) $response->headers->get('Cache-Control'))->toContain('no-store');

    Sanctum::actingAs($this->world->interviewer);
    $this->getJson('/api/v1/hiring/lowongan')->assertOk()
        ->assertJsonPath('positions.0.my_roles', ['interviewer'])
        ->assertJsonPath('divisions', [])
        ->assertJsonPath('can.create', false);

    Sanctum::actingAs($this->world->approver);
    $this->getJson('/api/v1/hiring/lowongan')->assertOk()->assertJsonPath('positions.0.my_roles', ['approver']);

    foreach (['anggota', 'kadiv', 'direksi'] as $who) {
        Sanctum::actingAs($this->world->{$who});
        $this->getJson('/api/v1/hiring/lowongan')->assertNotFound();
    }

    Sanctum::actingAs($this->world->foreign);
    $this->getJson('/api/v1/hiring/lowongan')->assertOk()->assertJsonCount(0, 'positions');
});

test('HR creates a draft position with the default final approvers', function () {
    HiringSetting::query()->create([
        'company_id' => $this->world->hr->company_id,
        'default_final_approver_ids' => [$this->world->approver->id],
        'checklist_template' => [],
    ]);

    Sanctum::actingAs($this->world->hr);
    $this->postJson('/api/v1/hiring/lowongan', ['title' => 'Staf Desain', 'description' => 'Desain UI.'])
        ->assertCreated()
        ->assertJsonPath('message', 'Lowongan dibuat sebagai draf. Lengkapi pengaturannya.')
        ->assertJsonPath('position.status', 'draft')
        ->assertJsonPath('position.final_approver_ids', [$this->world->approver->id])
        ->assertJsonPath('position.approvers.0.name', 'Faris')
        ->assertJsonMissingPath('position.webhook_secret');

    $this->postJson('/api/v1/hiring/lowongan', ['title' => 'AB'])->assertUnprocessable()->assertJsonValidationErrors('title');

    Sanctum::actingAs($this->world->interviewer);
    $this->postJson('/api/v1/hiring/lowongan', ['title' => 'Staf Lain'])->assertForbidden();
    Sanctum::actingAs($this->world->anggota);
    $this->postJson('/api/v1/hiring/lowongan', ['title' => 'Staf Lain'])->assertNotFound();
});

test('position settings: HR only, never the webhook secret, Google Form section desktop only', function () {
    InterviewScore::query()->create([
        'candidate_id' => $this->world->candidate->id,
        'question_id' => $this->world->questions[0]->id,
        'interviewer_id' => $this->world->interviewer->id,
        'score' => 4,
    ]);

    Sanctum::actingAs($this->world->hr);
    $response = $this->getJson(lowonganApi())->assertOk()
        ->assertJsonPath('position.title', 'Staf Programmer')
        ->assertJsonCount(3, 'position.interviewers')
        ->assertJsonPath('position.interviewers.2.active', false)
        ->assertJsonCount(3, 'questions')
        ->assertJsonPath('questions.0.locked', true)
        ->assertJsonPath('questions.0.can_delete', false)
        ->assertJsonPath('questions.1.locked', false)
        ->assertJsonCount(4, 'field_defaults')
        ->assertJsonCount(3, 'statuses')
        ->assertJsonPath('google_form.desktop_only', true)
        ->assertJsonPath('google_form.webhook_url', url('/api/hiring/form/'.$this->position->webhook_token))
        ->assertJsonPath('google_form.desktop_path', '/hiring/lowongan/'.$this->position->id)
        ->assertJsonPath('can.delete', false)
        ->assertJsonPath('can.regenerate_webhook', false);

    expect($response->getContent())->not->toContain((string) $this->position->webhook_secret)
        ->and((string) $response->headers->get('Cache-Control'))->toContain('no-store');

    Sanctum::actingAs($this->world->interviewer);
    $this->getJson(lowonganApi())->assertForbidden();
    Sanctum::actingAs($this->world->approver);
    $this->getJson(lowonganApi())->assertForbidden();
    Sanctum::actingAs($this->world->kadiv);
    $this->getJson(lowonganApi())->assertNotFound();
    Sanctum::actingAs($this->world->foreign);
    $this->getJson(lowonganApi())->assertNotFound();

    // No API route can regenerate (reveal) the webhook secret.
    Sanctum::actingAs($this->world->hr);
    $this->postJson(lowonganApi('/webhook'))->assertNotFound();
});

test('HR updates details, status, reviewers and field mapping; checklists follow', function () {
    $division = Division::factory()->create(['company_id' => $this->world->hr->company_id]);
    $newInterviewer = User::factory()->create(['company_id' => $this->world->hr->company_id]);

    Sanctum::actingAs($this->world->hr);
    $this->putJson(lowonganApi(), lowonganForm($this->position, [
        'title' => 'Staf Programmer Backend',
        'division_id' => $division->id,
        'status' => 'closed',
        'interviewer_ids' => [$this->world->interviewer->id, $newInterviewer->id, $this->world->inactive->id],
    ]))->assertOk()
        ->assertJsonPath('message', 'Pengaturan lowongan disimpan.')
        ->assertJsonPath('position.title', 'Staf Programmer Backend')
        ->assertJsonPath('position.division', $division->name)
        ->assertJsonPath('position.status', 'closed')
        ->assertJsonPath('position.interviewer_ids', [$this->world->interviewer->id, $newInterviewer->id])
        ->assertJsonPath('position.field_map.full_name', 'Nama pelamar');

    $position = $this->position->fresh();
    expect($position?->status)->toBe(PositionStatus::Closed)
        ->and($position?->closed_at)->not->toBeNull()
        ->and(CandidateChecklistItem::query()->where('reviewer_id', $newInterviewer->id)->exists())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'hiring.position_updated')->exists())->toBeTrue();

    $this->putJson(lowonganApi(), lowonganForm($this->position, ['status' => 'aktif']))
        ->assertUnprocessable()->assertJsonValidationErrors('status');
    $this->putJson(lowonganApi(), ['title' => 'Staf'])
        ->assertUnprocessable()->assertJsonValidationErrors(['status', 'interviewer_ids', 'final_approver_ids']);

    Sanctum::actingAs($this->world->interviewer);
    $this->putJson(lowonganApi(), lowonganForm($this->position))->assertForbidden();
    Sanctum::actingAs($this->world->anggota);
    $this->putJson(lowonganApi(), lowonganForm($this->position))->assertNotFound();
});

test('a position is deleted only while it never had a candidate', function () {
    Sanctum::actingAs($this->world->hr);
    $this->deleteJson(lowonganApi())->assertUnprocessable()->assertJsonPath('code', 'punya_kandidat');

    $empty = HiringPosition::factory()->create(['company_id' => $this->world->hr->company_id]);
    $this->getJson('/api/v1/hiring/lowongan/'.$empty->id)->assertOk()->assertJsonPath('can.delete', true);

    Sanctum::actingAs($this->world->interviewer);
    $this->deleteJson('/api/v1/hiring/lowongan/'.$empty->id)->assertNotFound();

    Sanctum::actingAs($this->world->hr);
    $this->deleteJson('/api/v1/hiring/lowongan/'.$empty->id)->assertNoContent();
    expect(HiringPosition::query()->whereKey($empty->id)->exists())->toBeFalse();

    // Soft-deleted candidates still block the delete.
    $withTrashed = HiringPosition::factory()->create(['company_id' => $this->world->hr->company_id]);
    Candidate::factory()->forPosition($withTrashed)->create()->delete();
    $this->deleteJson('/api/v1/hiring/lowongan/'.$withTrashed->id)->assertUnprocessable();
});

test('questions: add, edit with the max points rule, reorder and delete only while unused', function () {
    [$q1, $q2, $q3] = $this->world->questions;
    InterviewScore::query()->create([
        'candidate_id' => $this->world->candidate->id,
        'question_id' => $q1->id,
        'interviewer_id' => $this->world->interviewer->id,
        'score' => 4,
    ]);

    Sanctum::actingAs($this->world->hr);
    $new = $this->postJson(lowonganApi('/pertanyaan'), ['prompt' => 'Apa kelemahan Anda?', 'guidance' => 'Dengarkan jujur.', 'max_score' => 10])
        ->assertCreated()
        ->assertJsonCount(4, 'questions')
        ->assertJsonPath('questions.3.prompt', 'Apa kelemahan Anda?')
        ->assertJsonPath('questions.3.max_score', 10)
        ->json('question_id');

    $this->postJson(lowonganApi('/pertanyaan'), ['prompt' => 'X', 'max_score' => 11])
        ->assertUnprocessable()->assertJsonValidationErrors(['prompt', 'max_score']);

    $this->putJson('/api/v1/hiring/pertanyaan/'.$q1->id, ['prompt' => $q1->prompt, 'max_score' => 3])
        ->assertUnprocessable()
        ->assertJsonPath('errors.max_score.0', 'Sudah ada poin 4 untuk pertanyaan ini; poin maksimal tidak boleh lebih kecil.');
    $this->putJson('/api/v1/hiring/pertanyaan/'.$q1->id, ['prompt' => 'Ceritakan proyek terbesar Anda.', 'max_score' => 4])
        ->assertOk()->assertJsonPath('questions.0.prompt', 'Ceritakan proyek terbesar Anda.');

    $this->putJson(lowonganApi('/urutan-pertanyaan'), ['ids' => [$new, $q3->id, $q2->id, $q1->id]])->assertOk()
        ->assertJsonPath('questions.0.id', $new)
        ->assertJsonPath('questions.3.id', $q1->id);
    $this->putJson(lowonganApi('/urutan-pertanyaan'), ['ids' => [$q1->id]])
        ->assertUnprocessable()->assertJsonValidationErrors('ids');

    $this->deleteJson('/api/v1/hiring/pertanyaan/'.$q1->id)->assertForbidden()
        ->assertJsonPath('message', 'Pertanyaan yang sudah punya jawaban atau poin tidak bisa dihapus.');
    $this->deleteJson('/api/v1/hiring/pertanyaan/'.$q2->id)->assertOk()->assertJsonCount(3, 'questions');
    expect(HiringQuestion::query()->whereKey($q2->id)->exists())->toBeFalse();

    Sanctum::actingAs($this->world->interviewer);
    $this->postJson(lowonganApi('/pertanyaan'), ['prompt' => 'Pertanyaan saya', 'max_score' => 5])->assertForbidden();
    $this->deleteJson('/api/v1/hiring/pertanyaan/'.$q3->id)->assertForbidden();
    Sanctum::actingAs($this->world->anggota);
    $this->putJson('/api/v1/hiring/pertanyaan/'.$q3->id, ['prompt' => 'Ubah', 'max_score' => 5])->assertNotFound();
});

test('Pengaturan hiring: HR edits defaults and the checklist template; reviewers 403, others 404', function () {
    Sanctum::actingAs($this->world->hr);
    $this->getJson('/api/v1/hiring/pengaturan')->assertOk()
        ->assertJsonPath('settings.default_final_approver_ids', [])
        ->assertJsonCount(3, 'settings.checklist_template.hr')
        ->assertJsonCount(3, 'roles')
        ->assertJsonPath('roles.1.label', 'Pewawancara');

    $this->putJson('/api/v1/hiring/pengaturan', [
        'default_final_approver_ids' => [$this->world->approver->id, $this->world->inactive->id, $this->world->approver2->id],
        'checklist_template' => [
            'hr' => [['label' => 'Cek CV', 'required' => true]],
            'interviewer' => [],
            'approver' => [['label' => 'Tinjau profil', 'required' => false]],
        ],
    ])->assertOk()
        ->assertJsonPath('message', 'Pengaturan hiring disimpan.')
        ->assertJsonPath('settings.default_final_approver_ids', [$this->world->approver->id, $this->world->approver2->id])
        ->assertJsonPath('settings.default_final_approvers.1.name', 'Dio')
        ->assertJsonPath('settings.checklist_template.hr.0.label', 'Cek CV')
        ->assertJsonPath('settings.checklist_template.approver.0.required', false);

    $this->putJson('/api/v1/hiring/pengaturan', ['default_final_approver_ids' => []])
        ->assertUnprocessable()->assertJsonValidationErrors('checklist_template');

    Sanctum::actingAs($this->world->approver);
    $this->getJson('/api/v1/hiring/pengaturan')->assertForbidden();
    Sanctum::actingAs($this->world->anggota);
    $this->getJson('/api/v1/hiring/pengaturan')->assertNotFound();
});

<?php

use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Services\WebhookSignature;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\HiringSetting;
use App\Models\InterviewAnswer;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
 * The Hiring pages per role, the nav flag, the /workspace card, positions,
 * questions, webhook credentials and the company settings.
 */
beforeEach(function () {
    $this->world = hiringWorld();
});

it('renders the Hiring pages for HR and Super Admin', function (string $who) {
    $user = $this->world->{$who};
    $position = $this->world->position;

    $this->actingAs($user)->get('/hiring')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('hiring/candidates')
        ->where('hiring.can_manage', true)
        ->has('candidates', 1)
        ->where('candidates.0.full_name', 'Nadia Putri')
        ->where('features.hiring', true));

    $this->get('/hiring/lowongan')->assertOk()->assertInertia(fn (Assert $page) => $page->component('hiring/positions')->has('positions', 1));
    $this->get('/hiring/lowongan/'.$position->id)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('hiring/position-settings')
        ->has('questions', 3)
        ->where('position.webhook_url', url('/api/hiring/form/'.$position->webhook_token))
        ->missing('position.webhook_secret'));
    $this->get('/hiring/pengaturan')->assertOk()->assertInertia(fn (Assert $page) => $page->component('hiring/settings'));
    $this->get('/hiring/kandidat/'.$this->world->candidate->id)->assertOk();
})->with(['hr', 'admin']);

it('gives reviewers read access to their positions only', function (string $who) {
    $this->actingAs($this->world->{$who})->get('/hiring')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('hiring.can_manage', false)
        ->has('candidates', 1)
        ->where('features.hiring', true));

    $this->get('/hiring/lowongan')->assertOk()->assertInertia(fn (Assert $page) => $page->has('positions', 1)->where('divisions', []));
    $this->get('/hiring/kandidat/'.$this->world->candidate->id)->assertOk();
    $this->get('/hiring/lowongan/'.$this->world->position->id)->assertForbidden();
    $this->get('/hiring/pengaturan')->assertForbidden();
})->with(['interviewer', 'approver']);

it('hides Hiring from everyone else', function (string $who) {
    $user = $this->world->{$who};

    $this->actingAs($user)->get('/hiring')->assertNotFound();
    $this->get('/hiring/lowongan')->assertNotFound();
    $this->get('/hiring/pengaturan')->assertNotFound();
    $this->get('/hiring/kandidat/'.$this->world->candidate->id)->assertNotFound();
    $this->get('/hiring/lowongan/'.$this->world->position->id)->assertNotFound();

    $this->get('/workspace')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('hiring', null)
        ->where('features.hiring', false));
})->with(['kadiv', 'direksi', 'anggota']);

it('shows the Hiring card on /workspace with the counts', function () {
    $this->actingAs($this->world->approver)->get('/workspace')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('hiring.can_manage', false)
        ->where('hiring.counts.open_positions', 1)
        ->where('hiring.counts.new_candidates', 1)
        ->where('hiring.counts.awaiting_decision', 0));
});

it('filters candidates by position and search', function () {
    $other = HiringPosition::factory()->create(['title' => 'Staf Konten']);
    Candidate::factory()->forPosition($other)->create(['full_name' => 'Bagus Konten']);

    $this->actingAs($this->world->hr)->get('/hiring?lowongan='.$other->id)->assertInertia(fn (Assert $page) => $page
        ->has('candidates', 1)
        ->where('candidates.0.full_name', 'Bagus Konten')
        ->where('filters.position', $other->id));

    $this->get('/hiring?q=nadia')->assertInertia(fn (Assert $page) => $page->has('candidates', 1)->where('filters.q', 'nadia'));
    $this->get('/hiring?lowongan=bukan-id')->assertInertia(fn (Assert $page) => $page->has('candidates', 2)->where('filters.position', null));
});

it('creates a position with the default final approvers and audits it', function () {
    HiringSetting::query()->create([
        'company_id' => $this->world->hr->company_id,
        'default_final_approver_ids' => [$this->world->approver->id, $this->world->approver2->id],
        'checklist_template' => [],
    ]);

    $this->actingAs($this->world->hr)
        ->post('/hiring/lowongan', ['title' => 'Staf Desain Grafis', 'description' => 'Desain konten.'])
        ->assertRedirect();

    $position = HiringPosition::query()->where('title', 'Staf Desain Grafis')->sole();

    expect($position->status)->toBe(PositionStatus::Draft)
        ->and($position->final_approver_ids)->toBe([$this->world->approver->id, $this->world->approver2->id])
        ->and(strlen($position->webhook_token))->toBe(40)
        ->and(AuditLog::query()->where('action', 'hiring.position_created')->exists())->toBeTrue();

    $this->actingAs($this->world->interviewer)->post('/hiring/lowongan', ['title' => 'Lain'])->assertForbidden();
    $this->actingAs($this->world->anggota)->post('/hiring/lowongan', ['title' => 'Lain lagi'])->assertNotFound();
});

it('updates a position, filters reviewers to active employees and syncs open checklists', function () {
    $position = $this->world->position;
    $newInterviewer = User::factory()->create();

    $this->actingAs($this->world->hr)->put('/hiring/lowongan/'.$position->id, [
        'title' => 'Staf Programmer Senior',
        'status' => 'open',
        'interviewer_ids' => [$this->world->interviewer->id, $newInterviewer->id, $this->world->inactive->id, $this->world->foreign->id],
        'final_approver_ids' => [$this->world->approver->id],
        'field_map' => ['full_name' => 'Siapa nama Anda?', 'email' => ''],
    ])->assertSessionHasNoErrors();

    $position->refresh();

    expect($position->title)->toBe('Staf Programmer Senior')
        ->and($position->interviewer_ids)->toBe([$this->world->interviewer->id, $newInterviewer->id])
        ->and($position->final_approver_ids)->toBe([$this->world->approver->id])
        ->and($position->field_map)->toBe(['full_name' => 'Siapa nama Anda?']);

    $items = CandidateChecklistItem::query()->where('candidate_id', $this->world->candidate->id);
    expect((clone $items)->where('reviewer_id', $newInterviewer->id)->count())->toBe(2)
        ->and((clone $items)->where('reviewer_id', $this->world->interviewer2->id)->count())->toBe(0)
        ->and((clone $items)->where('reviewer_id', $this->world->approver2->id)->count())->toBe(0);

    $this->put('/hiring/lowongan/'.$position->id, [
        'title' => 'Staf Programmer Senior',
        'status' => 'closed',
        'interviewer_ids' => [],
        'final_approver_ids' => [],
    ])->assertSessionHasNoErrors();

    expect($position->fresh()?->closed_at)->not->toBeNull();
});

it('regenerates the webhook credentials and returns the secret once', function () {
    $position = $this->world->position;
    $oldToken = $position->webhook_token;

    $response = $this->actingAs($this->world->hr)->postJson('/hiring/lowongan/'.$position->id.'/webhook')->assertOk();
    $secret = $response->json('secret');

    expect($response->json('url'))->not->toContain($oldToken)
        ->and($position->fresh()?->webhook_secret)->toBe($secret);

    $audit = AuditLog::query()->where('action', 'hiring.webhook_regenerated')->sole();
    expect(json_encode($audit->getAttributes()))->not->toContain((string) $secret);

    // The new secret signs; the old URL is gone.
    $body = (string) json_encode(['response_id' => 'r-1', 'answers' => [['question' => 'Nama lengkap', 'answer' => 'Uji Coba']]]);
    $this->call('POST', '/api/hiring/form/'.$oldToken, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_RUANGKERJA_SIGNATURE' => WebhookSignature::sign($body, (string) $secret)], $body)->assertNotFound();
    $this->call('POST', (string) parse_url((string) $response->json('url'), PHP_URL_PATH), [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_RUANGKERJA_SIGNATURE' => WebhookSignature::sign($body, (string) $secret)], $body)->assertCreated();

    $this->actingAs($this->world->approver)->postJson('/hiring/lowongan/'.$position->id.'/webhook')->assertForbidden();
});

it('manages interview questions until they are answered', function () {
    $position = $this->world->position;
    [$first, $second, $third] = $this->world->questions;

    $this->actingAs($this->world->hr)
        ->post('/hiring/lowongan/'.$position->id.'/pertanyaan', ['prompt' => 'Apa target Anda tahun depan?', 'max_score' => 4])
        ->assertSessionHasNoErrors();

    $added = HiringQuestion::query()->where('prompt', 'Apa target Anda tahun depan?')->sole();
    expect($added->position)->toBe(4)->and($added->max_score)->toBe(4);

    $this->put('/hiring/lowongan/'.$position->id.'/urutan-pertanyaan', ['ids' => [$added->id, $first->id, $second->id, $third->id]])->assertSessionHasNoErrors();
    expect($position->questions()->pluck('id')->all())->toBe([$added->id, $first->id, $second->id, $third->id]);

    $this->put('/hiring/lowongan/'.$position->id.'/urutan-pertanyaan', ['ids' => [$added->id]])->assertSessionHasErrors('ids');

    InterviewAnswer::query()->create(['candidate_id' => $this->world->candidate->id, 'question_id' => $first->id, 'answer' => 'Jawaban']);

    $this->delete('/hiring/pertanyaan/'.$first->id)->assertForbidden();
    $this->delete('/hiring/pertanyaan/'.$second->id)->assertRedirect();
    expect(HiringQuestion::query()->whereKey($second->id)->exists())->toBeFalse();

    $this->put('/hiring/pertanyaan/'.$first->id, ['prompt' => 'Ceritakan proyek terbaik Anda.', 'max_score' => 5])->assertSessionHasNoErrors();
    expect($first->fresh()?->prompt)->toBe('Ceritakan proyek terbaik Anda.');

    $this->actingAs($this->world->interviewer)->put('/hiring/pertanyaan/'.$first->id, ['prompt' => 'Ubah', 'max_score' => 5])->assertForbidden();
});

it('refuses deleting a position that has candidates', function () {
    $this->actingAs($this->world->hr)->delete('/hiring/lowongan/'.$this->world->position->id)->assertRedirect();
    expect($this->world->position->fresh()?->trashed())->toBeFalse();

    $empty = HiringPosition::factory()->create();
    $this->delete('/hiring/lowongan/'.$empty->id)->assertRedirect('/hiring/lowongan');
    expect(HiringPosition::query()->whereKey($empty->id)->exists())->toBeFalse();
});

it('saves the company hiring settings', function () {
    $this->actingAs($this->world->hr)->put('/hiring/pengaturan', [
        'default_final_approver_ids' => [$this->world->approver->id, $this->world->inactive->id],
        'checklist_template' => [
            'hr' => [['label' => 'Berkas lengkap', 'required' => true]],
            'interviewer' => [],
            'approver' => [['label' => 'Tinjau profil', 'required' => false]],
        ],
    ])->assertSessionHasNoErrors();

    $setting = HiringSetting::query()->where('company_id', $this->world->hr->company_id)->sole();

    expect($setting->default_final_approver_ids)->toBe([$this->world->approver->id])
        ->and($setting->template()['hr'])->toBe([['label' => 'Berkas lengkap', 'required' => true]])
        ->and($setting->template()['interviewer'])->toBe([]);

    $this->actingAs($this->world->interviewer)->put('/hiring/pengaturan', [
        'default_final_approver_ids' => [],
        'checklist_template' => ['hr' => [], 'interviewer' => [], 'approver' => []],
    ])->assertForbidden();
});

it('adds a manual candidate with its checklist', function () {
    $this->actingAs($this->world->hr)->post('/hiring/kandidat', [
        'position_id' => $this->world->position->id,
        'full_name' => 'Intan Permata',
        'email' => 'intan@contoh.id',
        'cv_url' => 'https://contoh.id/cv.pdf',
    ])->assertRedirect();

    $candidate = Candidate::query()->where('full_name', 'Intan Permata')->sole();

    expect($candidate->source->value)->toBe('manual')
        ->and($candidate->created_by)->toBe($this->world->hr->id)
        ->and(CandidateChecklistItem::query()->where('candidate_id', $candidate->id)->count())->toBeGreaterThan(3);

    $this->actingAs($this->world->interviewer)->post('/hiring/kandidat', [
        'position_id' => $this->world->position->id,
        'full_name' => 'Orang Lain',
    ])->assertForbidden();
});

<?php

use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Models\KeyResult;
use App\Models\Objective;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/okr-helpers.php';

/*
| API v1 — OKR divisi (Bagian 5 / B5-A): daftar per kuartal + divisi dengan
| progres terhitung, detail objective & key result, check-in, tautkan tugas,
| form objective / KR, tutup & buka kembali — OkrIndex / ObjectiveDetail /
| Action / Policy web yang sama, di balik FEATURE_OKR. Selasa 13 Okt 2026
| (hari ke-13 dari 92 di Q4). Dunia uji okrWorld(): objective Operasional
| milik Dimas (Kadiv) dengan KR milik Rizky (140 → 190, kini 148, bobot 40).
*/

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-13 10:00', 'Asia/Jakarta'));
    Notification::fake();
    config(['features.okr' => true]);
    $this->w = okrWorld();
    $this->opsSpace = okrDivisionWorkspace($this->w->ops);
    $this->task = Task::factory()->create(['workspace_id' => $this->opsSpace->id, 'title' => 'Jalankan UAT sesi 3']);
});

function okrAs(User $user): User
{
    Sanctum::actingAs($user);

    return $user;
}

describe('daftar & detail', function () {
    it('lists the quarter with computed progress, KPIs and the create options', function () {
        okrAs($this->w->kadiv);

        $this->getJson('/api/v1/okr')
            ->assertOk()
            ->assertJsonPath('filters.quarter', '2026-Q4')
            ->assertJsonPath('quarter.key', '2026-Q4')
            ->assertJsonPath('quarter.label', 'Q4 2026')
            ->assertJsonPath('quarter.day', 13)
            ->assertJsonPath('quarter.days', 92)
            ->assertJsonPath('quarter.elapsed', 0.1413)
            ->assertJsonPath('objectives.0.id', $this->w->objective->id)
            ->assertJsonPath('objectives.0.progress.value', 0.16)
            ->assertJsonPath('objectives.0.progress.status', 'on_track')
            ->assertJsonPath('objectives.0.progress.status_label', 'Sesuai jalur')
            ->assertJsonPath('objectives.0.key_results.0.progress.value', 0.16)
            ->assertJsonPath('objectives.0.key_results.0.progress.status', 'on_track')
            ->assertJsonPath('kpis', ['count' => 1, 'average' => 0.16, 'expected' => 0.1413, 'on_track' => 1, 'at_risk' => 0, 'behind' => 0])
            ->assertJsonPath('can.create', true)
            ->assertJsonPath('create.divisions.0.id', $this->w->ops->id);
    });

    it('shows a member their division without the create form and hides other divisions', function () {
        okrAs($this->w->member);
        $this->getJson('/api/v1/okr')->assertOk()->assertJsonCount(1, 'objectives')->assertJsonPath('can.create', false)->assertJsonPath('create', null);

        okrAs($this->w->prgMember);
        $this->getJson('/api/v1/okr')->assertOk()->assertJsonCount(0, 'objectives')->assertJsonPath('kpis.average', null);
        $this->getJson('/api/v1/okr/'.$this->w->objective->id)->assertNotFound();
        $this->getJson('/api/v1/okr/kr/'.$this->w->keyResult->id)->assertNotFound();

        okrAs($this->w->foreign);
        $this->getJson('/api/v1/okr/'.$this->w->objective->id)->assertNotFound();
    });

    it('filters on quarter and division', function () {
        Objective::factory()->forDivision($this->w->prg)->ownedBy($this->w->prgKadiv)->create(['title' => 'Kualitas rilis naik', 'quarter' => '2026-Q3']);
        okrAs($this->w->direksi);

        $this->getJson('/api/v1/okr?kuartal=2026-Q3')->assertOk()
            ->assertJsonPath('filters.quarter', '2026-Q3')
            ->assertJsonPath('quarter.day', 92)
            ->assertJsonPath('quarter.elapsed', 1)
            ->assertJsonCount(1, 'objectives')
            ->assertJsonPath('objectives.0.title', 'Kualitas rilis naik');

        $this->getJson('/api/v1/okr?divisi='.$this->w->prg->id)->assertOk()->assertJsonCount(0, 'objectives');
    });

    it('gives the objective detail with abilities per role', function () {
        okrAs($this->w->kadiv);
        $this->getJson('/api/v1/okr/'.$this->w->objective->id)
            ->assertOk()
            ->assertJsonPath('objective.title', 'Migrasi sistem gudang tanpa insiden')
            ->assertJsonPath('objective.can', ['update' => true, 'close' => true, 'add_key_result' => true])
            ->assertJsonPath('objective.key_results.0.can.checkin', true)
            ->assertJsonPath('objective.progress.expected', 0.1413)
            ->assertJsonPath('quarter.day', 13)
            ->assertJsonStructure(['people', 'quarters', 'today']);

        okrAs($this->w->member);
        $this->getJson('/api/v1/okr/'.$this->w->objective->id)->assertOk()
            ->assertJsonPath('objective.can', ['update' => false, 'close' => false, 'add_key_result' => false])
            ->assertJsonPath('objective.key_results.0.can', ['update' => true, 'checkin' => true, 'link_task' => true, 'delete' => false]);

        foreach ([$this->w->hr, $this->w->direksi] as $reader) {
            okrAs($reader);
            $this->getJson('/api/v1/okr/'.$this->w->objective->id)->assertOk()
                ->assertJsonPath('objective.key_results.0.can.checkin', false);
        }
    });

    it('opens one key result for the check-in deep link', function () {
        okrAs($this->w->member);

        $this->getJson('/api/v1/okr/kr/'.$this->w->keyResult->id)
            ->assertOk()
            ->assertJsonPath('key_result.id', $this->w->keyResult->id)
            ->assertJsonPath('key_result.title', 'Skenario UAT lulus')
            ->assertJsonPath('key_result.progress.value', 0.16)
            ->assertJsonPath('objective.id', $this->w->objective->id)
            ->assertJsonPath('objective.progress.status', 'on_track')
            ->assertJsonMissingPath('objective.key_results');
    });

    it('answers 404 while the feature is off', function () {
        config(['features.okr' => false]);
        okrAs($this->w->kadiv);

        $this->getJson('/api/v1/okr')->assertNotFound();
        $this->getJson('/api/v1/okr/'.$this->w->objective->id)->assertNotFound();
        $this->postJson('/api/v1/okr/kr/'.$this->w->keyResult->id.'/check-in', ['value' => 150])->assertNotFound();
    });
});

describe('check-in', function () {
    it('records the key result owner\'s check-in', function () {
        okrAs($this->w->member);

        $this->postJson('/api/v1/okr/kr/'.$this->w->keyResult->id.'/check-in', ['value' => 165, 'confidence' => 7, 'note' => 'Sesi 3 lulus.'])
            ->assertCreated()
            ->assertJsonPath('message', 'Check-in tersimpan.')
            ->assertJsonPath('key_result.current_value', 165)
            ->assertJsonPath('key_result.progress.value', 0.5)
            ->assertJsonPath('key_result.checkins.0.value', 165)
            ->assertJsonPath('key_result.checkins.0.confidence', 7)
            ->assertJsonPath('key_result.checkins.0.date', '2026-10-13');

        expect($this->w->keyResult->fresh()?->current_value)->toEqual(165.0);
    });

    it('validates and authorizes the check-in', function () {
        okrAs($this->w->member);
        $this->postJson('/api/v1/okr/kr/'.$this->w->keyResult->id.'/check-in', ['confidence' => 11])
            ->assertUnprocessable()->assertJsonValidationErrors(['value', 'confidence']);

        foreach ([$this->w->colleague, $this->w->direksi, $this->w->hr] as $other) {
            okrAs($other);
            $this->postJson('/api/v1/okr/kr/'.$this->w->keyResult->id.'/check-in', ['value' => 150])->assertForbidden();
        }

        okrAs($this->w->prgMember);
        $this->postJson('/api/v1/okr/kr/'.$this->w->keyResult->id.'/check-in', ['value' => 150])->assertNotFound();
    });
});

describe('form objective & key result', function () {
    it('creates an objective in the Kepala Divisi\'s own division only', function () {
        okrAs($this->w->kadiv);

        $this->postJson('/api/v1/okr', [
            'division_id' => $this->w->ops->id,
            'quarter' => '2026-Q4',
            'title' => 'Waktu muat gudang turun',
            'owner_id' => $this->w->member->id,
        ])->assertCreated()
            ->assertJsonPath('message', 'Objective dibuat. Tambahkan key result-nya.')
            ->assertJsonPath('objective.title', 'Waktu muat gudang turun')
            ->assertJsonPath('objective.status', 'active')
            ->assertJsonPath('objective.key_results', [])
            ->assertJsonPath('objective.progress.value', 0);

        $this->postJson('/api/v1/okr', [
            'division_id' => $this->w->prg->id,
            'quarter' => '2026-Q4',
            'title' => 'Bukan divisi saya',
            'owner_id' => $this->w->prgMember->id,
        ])->assertForbidden();

        $this->postJson('/api/v1/okr', ['division_id' => $this->w->ops->id, 'quarter' => 'Q4', 'title' => 'abc', 'owner_id' => $this->w->prgMember->id])
            ->assertUnprocessable()->assertJsonValidationErrors(['quarter', 'title', 'owner_id']);

        okrAs($this->w->member);
        $this->postJson('/api/v1/okr', ['division_id' => $this->w->ops->id, 'quarter' => '2026-Q4', 'title' => 'Staf mencoba', 'owner_id' => $this->w->member->id])
            ->assertForbidden();
    });

    it('edits, closes and reopens an objective', function () {
        okrAs($this->w->kadiv);
        $id = $this->w->objective->id;

        $this->patchJson("/api/v1/okr/{$id}", ['quarter' => '2026-Q4', 'title' => 'Migrasi gudang mulus', 'owner_id' => $this->w->kadiv->id])
            ->assertOk()->assertJsonPath('message', 'Objective disimpan.')->assertJsonPath('objective.title', 'Migrasi gudang mulus');

        $this->postJson("/api/v1/okr/{$id}/tutup")->assertOk()
            ->assertJsonPath('message', 'Objective ditutup.')
            ->assertJsonPath('objective.status', 'closed')
            ->assertJsonPath('objective.can.close', false)
            ->assertJsonPath('objective.key_results.0.can.checkin', false);

        $this->postJson("/api/v1/okr/{$id}/tutup")->assertForbidden()->assertJsonPath('message', 'Objective ini sudah ditutup.');

        okrAs($this->w->member);
        $this->postJson('/api/v1/okr/kr/'.$this->w->keyResult->id.'/check-in', ['value' => 150])
            ->assertForbidden()->assertJsonPath('message', 'Objective sudah ditutup dan hanya bisa dibaca.');

        okrAs($this->w->kadiv);
        $this->patchJson("/api/v1/okr/{$id}", ['quarter' => '2026-Q4', 'title' => 'Migrasi gudang mulus', 'owner_id' => $this->w->kadiv->id, 'status' => 'active'])
            ->assertOk()->assertJsonPath('message', 'Objective dibuka kembali.')->assertJsonPath('objective.status', 'active');

        expect($this->w->objective->fresh()?->status)->toBe(ObjectiveStatus::Active);
    });

    it('adds, edits and removes a key result', function () {
        okrAs($this->w->kadiv);

        $created = $this->postJson('/api/v1/okr/'.$this->w->objective->id.'/kr', [
            'title' => 'Bug kritis tersisa',
            'unit' => 'number',
            'unit_label' => 'bug',
            'start_value' => 14,
            'target_value' => 4,
            'current_value' => 9,
            'weight' => 30,
            'owner_id' => $this->w->colleague->id,
        ])->assertCreated()
            ->assertJsonPath('message', 'Key result ditambahkan.')
            ->assertJsonPath('key_result.title', 'Bug kritis tersisa')
            ->assertJsonPath('key_result.progress.value', 0.5)
            ->assertJsonPath('key_result.owner.name', 'Sari Wulandari');

        $kr = $created->json('key_result.id');

        $this->patchJson("/api/v1/okr/kr/{$kr}", [
            'title' => 'Bug kritis tersisa',
            'unit' => 'number',
            'start_value' => 14,
            'target_value' => 14,
            'current_value' => 9,
            'weight' => 30,
            'owner_id' => $this->w->colleague->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('target_value');

        $this->deleteJson("/api/v1/okr/kr/{$kr}")->assertNoContent();
        expect(KeyResult::query()->find($kr))->toBeNull();

        okrAs($this->w->member);
        $this->deleteJson('/api/v1/okr/kr/'.$this->w->keyResult->id)->assertForbidden();
    });
});

describe('tautkan tugas', function () {
    it('searches, links and unlinks a division task', function () {
        okrAs($this->w->member);
        $kr = $this->w->keyResult->id;

        $this->getJson("/api/v1/okr/kr/{$kr}/tugas?q=UAT")->assertOk()
            ->assertJsonPath('tasks.0.id', $this->task->id);

        $this->postJson("/api/v1/okr/kr/{$kr}/tugas", ['task_id' => $this->task->id])
            ->assertCreated()
            ->assertJsonPath('message', 'Jalankan UAT sesi 3 ditautkan.')
            ->assertJsonPath('task.id', $this->task->id);

        // Linked tasks leave the picker (LinkableTasks::search).
        $this->getJson("/api/v1/okr/kr/{$kr}/tugas?q=UAT")->assertOk()->assertJsonCount(0, 'tasks');
        $this->getJson('/api/v1/okr/kr/'.$kr)->assertOk()->assertJsonPath('key_result.tasks.0.id', $this->task->id);

        $this->deleteJson("/api/v1/okr/kr/{$kr}/tugas/{$this->task->id}")->assertNoContent();
        expect($this->w->keyResult->tasks()->count())->toBe(0);
    });

    it('refuses tasks outside the division and people who may not link', function () {
        $elsewhere = Task::factory()->create(['workspace_id' => Workspace::factory()->internal()->create()->id]);
        okrAs($this->w->member);
        $kr = $this->w->keyResult->id;

        $this->postJson("/api/v1/okr/kr/{$kr}/tugas", ['task_id' => $elsewhere->id])->assertUnprocessable()->assertJsonValidationErrors('task_id');
        $this->postJson("/api/v1/okr/kr/{$kr}/tugas", ['task_id' => '01HZZZZZZZZZZZZZZZZZZZZZZZ'])
            ->assertUnprocessable()->assertJsonPath('errors.task_id.0', 'Tugas tidak ditemukan.');
        $this->postJson("/api/v1/okr/kr/{$kr}/tugas", [])->assertUnprocessable()->assertJsonPath('errors.task_id.0', 'Pilih tugas.');

        okrAs($this->w->colleague);
        $this->getJson("/api/v1/okr/kr/{$kr}/tugas")->assertForbidden();
        $this->postJson("/api/v1/okr/kr/{$kr}/tugas", ['task_id' => $this->task->id])->assertForbidden();
    });
});

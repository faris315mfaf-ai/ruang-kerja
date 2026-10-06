<?php

use App\Domain\Monitoring\Actions\CreateManagementNote;
use App\Domain\Monitoring\Actions\ReorderManagementNotes;
use App\Domain\Monitoring\Actions\UpdateManagementNote;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\Company;
use App\Models\ManagementNote;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * "Catatan tindakan" of Direksi / management (keputusan pemilik 6 Okt 2026):
 * a private list per person, created by Direksi, HR and Super Admin
 * (dashboard.view_company), only ever visible to its owner.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->direksi = User::factory()->withRole(Role::Direksi)->create();
    $this->note = ManagementNote::factory()->ownedBy($this->direksi)->create(['body' => 'Telepon vendor', 'position' => 'V']);
});

function noteActor(string $who): User
{
    $company = test()->direksi->company_id;

    return match ($who) {
        'owner' => test()->direksi,
        'direksi' => User::factory()->withRole(Role::Direksi)->create(['company_id' => $company]),
        'hr' => User::factory()->withRole(Role::Hr)->create(['company_id' => $company]),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(['company_id' => $company]),
        'kepala_divisi' => User::factory()->withRole(Role::KepalaDivisi)->create(['company_id' => $company]),
        'anggota' => User::factory()->withRole(Role::Anggota)->create(['company_id' => $company]),
        'inactive' => User::factory()->withRole(Role::Direksi)->create(['company_id' => $company, 'status' => 'inactive']),
        'other_company' => User::factory()->withRole(Role::Direksi)->create(['company_id' => Company::factory()->create()->id]),
    };
}

function noteVerdict(User $user, string $ability, mixed $arguments): string
{
    $response = Gate::forUser($user)->inspect($ability, $arguments);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

it('applies the policy matrix', function (string $who, string $create, string $view, string $update, string $delete) {
    $user = noteActor($who);

    expect([
        noteVerdict($user, 'create', ManagementNote::class),
        noteVerdict($user, 'view', $this->note),
        noteVerdict($user, 'update', $this->note),
        noteVerdict($user, 'delete', $this->note),
    ])->toBe([$create, $view, $update, $delete]);
})->with([
    //                   create   view      update    delete
    'owner' => ['owner', 'allow', 'allow', 'allow', 'allow'],
    'direksi lain' => ['direksi', 'allow', 'hidden', 'hidden', 'hidden'],
    'hr' => ['hr', 'allow', 'hidden', 'hidden', 'hidden'],
    'super admin' => ['super_admin', 'allow', 'hidden', 'hidden', 'hidden'],
    'kepala divisi' => ['kepala_divisi', 'deny', 'hidden', 'hidden', 'hidden'],
    'anggota' => ['anggota', 'deny', 'hidden', 'hidden', 'hidden'],
    'nonaktif' => ['inactive', 'deny', 'hidden', 'hidden', 'hidden'],
    'perusahaan lain' => ['other_company', 'allow', 'hidden', 'hidden', 'hidden'],
]);

it('creates, edits, ticks and deletes a note over HTTP', function () {
    $created = $this->actingAs($this->direksi)
        ->postJson('/catatan-tindakan', ['body' => '  Putuskan vendor katering  ', 'due_on' => '2026-10-09'])
        ->assertCreated()
        ->assertJsonPath('note.body', 'Putuskan vendor katering')
        ->assertJsonPath('note.due_on', '2026-10-09')
        ->assertJsonPath('note.done', false)
        ->json('note.id');

    // New notes go on top of the open list.
    expect(ManagementNote::query()->ownedBy($this->direksi)->whereNull('done_at')->orderBy('position')->pluck('id')->first())->toBe($created);

    $this->actingAs($this->direksi)->patchJson("/catatan-tindakan/{$created}", ['body' => 'Putuskan vendor', 'due_on' => '2026-10-05'])
        ->assertOk()
        ->assertJsonPath('note.body', 'Putuskan vendor')
        ->assertJsonPath('note.overdue', true);

    $this->actingAs($this->direksi)->patchJson("/catatan-tindakan/{$created}", ['done' => true])
        ->assertOk()
        ->assertJsonPath('note.done', true)
        ->assertJsonPath('note.overdue', false);
    expect(ManagementNote::query()->find($created)->done_at)->not->toBeNull();

    $this->actingAs($this->direksi)->patchJson("/catatan-tindakan/{$created}", ['done' => false, 'due_on' => null])
        ->assertOk()
        ->assertJsonPath('note.done', false)
        ->assertJsonPath('note.due_on', null);

    $this->actingAs($this->direksi)->deleteJson("/catatan-tindakan/{$created}")->assertNoContent();
    expect(ManagementNote::query()->find($created))->toBeNull();
});

it('hides other people\'s notes behind 404 before validating', function (string $who) {
    $user = noteActor($who);

    $this->actingAs($user)->patchJson("/catatan-tindakan/{$this->note->id}", ['body' => ''])->assertNotFound();
    $this->actingAs($user)->patchJson("/catatan-tindakan/{$this->note->id}", ['done' => true])->assertNotFound();
    $this->actingAs($user)->deleteJson("/catatan-tindakan/{$this->note->id}")->assertNotFound();

    expect($this->note->fresh()->done_at)->toBeNull();
})->with(['direksi', 'hr', 'super_admin', 'anggota', 'other_company']);

it('refuses notes to people outside management', function (string $who) {
    $this->actingAs(noteActor($who))->postJson('/catatan-tindakan', ['body' => 'Coba'])->assertForbidden();
})->with(['kepala_divisi', 'anggota']);

it('validates the text and the due date', function () {
    $this->actingAs($this->direksi)->postJson('/catatan-tindakan', ['body' => '   '])->assertUnprocessable()->assertJsonValidationErrors('body');
    $this->actingAs($this->direksi)->postJson('/catatan-tindakan', ['body' => str_repeat('a', 501)])->assertUnprocessable()->assertJsonValidationErrors('body');
    $this->actingAs($this->direksi)->postJson('/catatan-tindakan', ['body' => 'Ok', 'due_on' => '07-10-2026'])->assertUnprocessable()->assertJsonValidationErrors('due_on');
    $this->actingAs($this->direksi)->patchJson("/catatan-tindakan/{$this->note->id}", ['body' => ''])->assertUnprocessable();
});

it('reorders only the owner\'s full list of open notes', function () {
    $b = app(CreateManagementNote::class)->handle($this->direksi, 'B');
    $c = app(CreateManagementNote::class)->handle($this->direksi, 'C');
    $done = ManagementNote::factory()->ownedBy($this->direksi)->done()->create();
    $order = fn (): array => ManagementNote::query()->ownedBy($this->direksi)->whereNull('done_at')->orderBy('position')->pluck('body')->all();

    expect($order())->toBe(['C', 'B', 'Telepon vendor']);

    $this->actingAs($this->direksi)->putJson('/catatan-tindakan/urutan', ['ids' => [$this->note->id, $c->id, $b->id]])->assertNoContent();
    expect($order())->toBe(['Telepon vendor', 'C', 'B']);

    // Stale or foreign lists are refused.
    $this->actingAs($this->direksi)->putJson('/catatan-tindakan/urutan', ['ids' => [$c->id, $b->id]])->assertUnprocessable();
    $this->actingAs($this->direksi)->putJson('/catatan-tindakan/urutan', ['ids' => [$this->note->id, $c->id, $b->id, $done->id]])->assertUnprocessable();
    $other = User::factory()->withRole(Role::Direksi)->create(['company_id' => $this->direksi->company_id]);
    $this->actingAs($other)->putJson('/catatan-tindakan/urutan', ['ids' => [$this->note->id, $c->id, $b->id]])->assertUnprocessable();
    expect($order())->toBe(['Telepon vendor', 'C', 'B']);
});

it('puts a reopened note at the bottom and keeps keys short when notes keep coming on top', function () {
    $b = app(CreateManagementNote::class)->handle($this->direksi, 'B');
    app(UpdateManagementNote::class)->handle($b, ['done' => true]);
    app(UpdateManagementNote::class)->handle($b->fresh(), ['done' => false]);

    expect(ManagementNote::query()->ownedBy($this->direksi)->whereNull('done_at')->orderBy('position')->pluck('body')->all())->toBe(['Telepon vendor', 'B']);

    for ($i = 0; $i < 60; $i++) {
        app(CreateManagementNote::class)->handle($this->direksi, "N{$i}");
    }

    $positions = ManagementNote::query()->ownedBy($this->direksi)->pluck('position');
    expect($positions->max(fn (string $p): int => strlen($p)))->toBeLessThan(Lexorank::MAX_LENGTH)
        ->and(ManagementNote::query()->ownedBy($this->direksi)->whereNull('done_at')->orderBy('position')->value('body'))->toBe('N59');

    app(ReorderManagementNotes::class)->handle($this->direksi, ManagementNote::query()->ownedBy($this->direksi)->whereNull('done_at')->orderBy('position')->pluck('id')->all());
});

it('stops at the limit', function () {
    ManagementNote::factory()->count(ManagementNote::LIMIT - 1)->ownedBy($this->direksi)->done()->create();

    expect(fn () => app(CreateManagementNote::class)->handle($this->direksi, 'Satu lagi'))->toThrow(ValidationException::class);
});

it('shows the notes on the Direksi dashboard, open first, done ones after', function () {
    ManagementNote::factory()->ownedBy($this->direksi)->done()->create(['body' => 'Sudah beres']);
    ManagementNote::factory()->ownedBy($this->direksi)->create(['body' => 'Cek laporan keuangan', 'position' => 'W', 'due_on' => '2026-10-06']);
    ManagementNote::factory()->ownedBy(User::factory()->withRole(Role::Direksi)->create(['company_id' => $this->direksi->company_id]))->create(['body' => 'Milik orang lain']);

    $this->actingAs($this->direksi)->get('/dashboard/direksi')
        ->assertInertia(fn (Assert $page) => $page
            ->has('notes', 3)
            ->where('notes.0.body', 'Telepon vendor')
            ->where('notes.1.body', 'Cek laporan keuangan')
            ->where('notes.1.overdue', true)
            ->where('notes.2.body', 'Sudah beres')
            ->where('notes.2.done', true));
});

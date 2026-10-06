<?php

use App\Domain\Notes\Actions\StartQuickMinutes;
use App\Domain\Notes\Actions\StoreNoteState;
use App\Domain\Notes\Enums\NotePreset;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Notulensi cepat (keputusan pemilik 6 Okt 2026, docs/fitur/catatan.md).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.notes' => true, 'collab.secret' => '', 'collab.url' => '']);
    $this->travelTo(CarbonImmutable::parse('2026-10-06 14:05', 'Asia/Jakarta'));
    $this->user = User::factory()->withRole(Role::Anggota)->create();
});

/**
 * @param  array<string, mixed>  $node
 * @return list<string>
 */
function minutesHeadings(array $node): array
{
    return collect($node['content'] ?? [])
        ->filter(fn (array $child): bool => $child['type'] === 'heading')
        ->map(fn (array $child): string => $child['content'][0]['text'])
        ->values()
        ->all();
}

it('starts minutes in the personal workspace and opens them in note-taking mode', function () {
    $response = $this->actingAs($this->user)->post('/catatan/notulensi');

    $note = Note::query()->sole();
    $response->assertRedirect("/catatan/{$note->id}?mode=catat");

    $workspace = $note->workspace;
    expect($workspace->type)->toBe(WorkspaceType::Personal)
        ->and($workspace->owner_id)->toBe($this->user->id)
        ->and($note->preset)->toBe(NotePreset::Minutes)
        ->and($note->title)->toBe('Notulensi · Selasa, 06/10/2026 14.05')
        ->and($note->created_by)->toBe($this->user->id)
        ->and($note->yjs_state)->toBeNull()
        ->and(minutesHeadings($note->content))->toBe(['Peserta', 'Agenda', 'Pembahasan', 'Keputusan', 'Tindak lanjut'])
        ->and($note->content_text)->toContain('Tanggal & jam: Selasa, 06/10/2026 14.05')
        ->and(collect($note->content['content'])->last()['type'])->toBe('taskList');
});

it('reuses the existing personal workspace', function () {
    $this->actingAs($this->user)->post('/catatan/notulensi');
    $this->travel(2)->minutes();
    $this->actingAs($this->user)->post('/catatan/notulensi');

    expect(Workspace::query()->where('owner_id', $this->user->id)->where('type', WorkspaceType::Personal->value)->count())->toBe(1)
        ->and(Note::query()->where('preset', 'minutes')->count())->toBe(2)
        ->and(Note::query()->latest('created_at')->value('title'))->toBe('Notulensi · Selasa, 06/10/2026 14.07');
});

it('answers 404 while notes are off', function () {
    config(['features.notes' => false]);

    $this->actingAs($this->user)->post('/catatan/notulensi')->assertNotFound();
    $this->actingAs($this->user)->getJson('/catatan/notulensi')->assertNotFound();

    expect(Note::query()->count())->toBe(0);
});

it('never starts minutes for an inactive employee', function () {
    $inactive = User::factory()->inactive()->withRole(Role::Anggota)->create();

    $this->actingAs($inactive)->post('/catatan/notulensi');

    expect(Note::query()->count())->toBe(0);
    expect(fn () => app(StartQuickMinutes::class)->handle($inactive))->toThrow(Exception::class);
    expect(Note::query()->count())->toBe(0);
});

it('lists the latest minutes the viewer can open, newest first', function () {
    $start = app(StartQuickMinutes::class);
    $first = $start->handle($this->user);
    $this->travel(1)->hours();
    $second = $start->handle($this->user);
    $this->travel(1)->hours();
    $third = $start->handle($this->user);
    $this->travel(1)->hours();
    $fourth = $start->handle($this->user);
    // Someone else's personal minutes stay private; plain notes are not minutes.
    $start->handle(User::factory()->withRole(Role::Anggota)->create());
    Note::factory()->in($first->workspace)->by($this->user)->create();

    $this->actingAs($this->user)->getJson('/catatan/notulensi')
        ->assertOk()
        ->assertJsonCount(3, 'minutes')
        ->assertJsonPath('minutes.0.id', $fourth->id)
        ->assertJsonPath('minutes.0.workspace_name', 'Pribadi')
        ->assertJsonPath('minutes.1.id', $third->id)
        ->assertJsonPath('minutes.2.id', $second->id);
});

it('keeps the preset in the note props', function () {
    $note = app(StartQuickMinutes::class)->handle($this->user);

    $this->actingAs($this->user)->get("/catatan/{$note->id}?mode=catat")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('notes/show')
            ->where('note.current.preset', 'minutes')
            ->where('note.notes.0.preset', 'minutes'));
});

it('keeps palette colours and highlights in note content', function () {
    $note = app(StartQuickMinutes::class)->handle($this->user);
    $document = ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [
        ['type' => 'text', 'text' => 'Penting', 'marks' => [['type' => 'textColor', 'attrs' => ['color' => 'red']], ['type' => 'highlight', 'attrs' => ['color' => 'amber']]]],
        ['type' => 'text', 'text' => ' jahat', 'marks' => [['type' => 'textColor', 'attrs' => ['color' => 'expression(alert(1))']]]],
    ]]]];

    app(StoreNoteState::class)->handle($note, null, $document, $this->user);

    expect($note->refresh()->content['content'][0]['content'])->toEqual([
        ['type' => 'text', 'text' => 'Penting', 'marks' => [['type' => 'textColor', 'attrs' => ['color' => 'red']], ['type' => 'highlight', 'attrs' => ['color' => 'amber']]]],
        ['type' => 'text', 'text' => ' jahat'],
    ]);
});

it('goes back to the parent document after deleting a tab', function () {
    $root = app(StartQuickMinutes::class)->handle($this->user);
    $tab = Note::factory()->childOf($root)->by($this->user)->create(['title' => 'Tab 2']);

    $this->actingAs($this->user)->delete("/catatan/{$tab->id}?kembali=induk")
        ->assertRedirect("/catatan/{$root->id}");

    expect($tab->fresh()?->trashed())->toBeTrue();
});

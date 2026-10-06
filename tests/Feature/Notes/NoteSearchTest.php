<?php

use App\Domain\Search\Providers\NoteSearchProvider;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.notes' => true]);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'visibility' => WorkspaceVisibility::Private]);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->visible = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'SOP penerimaan', 'content_text' => 'Cocokkan surat jalan dengan PO sebelum bongkar muat.']);
    $this->restricted = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create(['title' => 'Surat rahasia', 'content_text' => 'surat jalan khusus']);
});

it('finds visible notes by title or text with the workspace and a snippet', function () {
    $results = app(NoteSearchProvider::class)->search($this->member, 'surat jal', 5);

    expect($results)->toHaveCount(1)
        ->and($results[0]->id)->toBe('note:'.$this->visible->id)
        ->and($results[0]->url)->toBe('/catatan/'.$this->visible->id)
        ->and($results[0]->code)->toBe('OPS')
        ->and($results[0]->subtitle)->toContain('Catatan')
        ->and($results[0]->snippet)->toContain('surat jalan');

    expect(app(NoteSearchProvider::class)->search($this->member, 'penerimaan', 5))->toHaveCount(1);
});

it('never returns notes the viewer may not open', function () {
    $outsider = User::factory()->create();

    expect(app(NoteSearchProvider::class)->search($outsider, 'surat', 5))->toBe([])
        ->and(collect(app(NoteSearchProvider::class)->search($this->owner, 'rahasia', 5))->pluck('title')->all())->toBe(['Surat rahasia']);
});

it('answers through the search endpoint and is silent while the flag is off', function () {
    $groups = $this->actingAs($this->member)->getJson('/cari/hasil?q=penerimaan')
        ->assertOk()
        ->json('groups');
    $notes = collect($groups)->firstWhere('key', 'notes');

    expect($notes['label'])->toBe('Catatan')
        ->and(collect($notes['items'])->pluck('title')->all())->toBe(['SOP penerimaan']);

    config(['features.notes' => false]);
    expect(app(NoteSearchProvider::class)->search($this->member, 'surat', 5))->toBe([]);
});

<?php

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteShareRole;
use App\Domain\Notes\Services\CollabToken;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\AuditLog;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

const NOTES_HTTP_SECRET = 'notes-http-secret-notes-http-secret-12345';

function httpDoc(string $text): array
{
    return ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]];
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.notes' => true, 'collab.secret' => NOTES_HTTP_SECRET, 'collab.url' => 'http://collab.test', 'collab.public_url' => 'wss://kantor.test/collab']);
    Http::fake(['collab.test/*' => Http::response(['loaded' => false])]);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'visibility' => WorkspaceVisibility::Private]);
    addMember($this->workspace, $this->owner, WorkspaceRole::Owner);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->note = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'SOP penerimaan', 'content' => httpDoc('Cocokkan surat jalan'), 'content_text' => 'Cocokkan surat jalan']);
});

it('lists visible notes with workspaces and people', function () {
    $hidden = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create();

    $this->actingAs($this->member)->get('/catatan')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('notes/index')
            ->where('notes.viewer_id', $this->member->id)
            ->has('notes.notes', 1)
            ->where('notes.notes.0.id', $this->note->id)
            ->where('notes.notes.0.kind', 'note')
            ->missing('notes.notes.0.content')
            ->where('notes.matches', null)
            ->where('notes.workspaces', fn ($workspaces) => collect($workspaces)->contains(fn ($w) => $w['key'] === 'OPS' && $w['can_create'] === true)));

    expect($hidden->exists)->toBeTrue();
});

it('searches title and text on the server', function () {
    Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'Lain', 'content_text' => 'tidak relevan']);

    $this->actingAs($this->member)->get('/catatan?q=surat')
        ->assertInertia(fn (Assert $page) => $page->where('notes.query', 'surat')->where('notes.matches', [$this->note->id]));
});

it('opens a note with content and rights, never the Yjs state', function () {
    $this->note->forceFill(['yjs_state' => 'rahasia-biner'])->save();

    $this->actingAs($this->viewer)->get("/catatan/{$this->note->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('notes/show')
            ->where('note.current.id', $this->note->id)
            ->where('note.current.content.content.0.content.0.text', 'Cocokkan surat jalan')
            ->where('note.current.can_edit', false)
            ->where('note.current.can_share', false)
            ->where('note.current.workspace_key', 'OPS')
            ->where('note.share', null)
            ->where('note.collab', true)
            ->missing('note.current.yjs_state')
            ->missing('versions'));

    $this->actingAs($this->member)->get("/catatan/{$this->note->id}")
        ->assertInertia(fn (Assert $page) => $page->where('note.current.can_edit', true)->where('note.share.access', 'workspace'));
});

it('loads the version history on request', function () {
    NoteVersion::factory()->of($this->note)->count(2)->create();

    $this->actingAs($this->member)
        ->get("/catatan/{$this->note->id}", ['X-Inertia' => 'true', 'X-Inertia-Partial-Component' => 'notes/show', 'X-Inertia-Partial-Data' => 'versions', 'X-Inertia-Version' => app(HandleInertiaRequests::class)->version(request()) ?? ''])
        ->assertOk()
        ->assertJsonCount(2, 'props.versions');
});

it('answers 404 for notes the user may not see, also on every endpoint', function () {
    $restricted = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create();
    $direksi = User::factory()->withRole(Role::Direksi)->create();

    $this->actingAs($this->outsider)->get("/catatan/{$this->note->id}")->assertNotFound();
    $this->actingAs($this->outsider)->getJson("/catatan/{$this->note->id}/token")->assertNotFound();
    $this->actingAs($this->outsider)->patchJson("/catatan/{$this->note->id}", ['title' => 'x'])->assertNotFound();
    $this->actingAs($this->outsider)->putJson("/catatan/{$this->note->id}/akses", ['access' => 'workspace', 'people' => []])->assertNotFound();
    $this->actingAs($direksi)->get("/catatan/{$restricted->id}")->assertNotFound();
    $this->actingAs($direksi)->get("/catatan/{$this->note->id}")->assertOk();
});

it('issues a short collab token with the edit right', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-12 09:00'));

    $member = $this->actingAs($this->member)->getJson("/catatan/{$this->note->id}/token")
        ->assertOk()
        ->assertJsonPath('url', 'wss://kantor.test/collab')
        ->assertJsonPath('can_edit', true)
        ->assertJsonPath('expires_in', 120)
        ->json('token');
    $viewer = $this->actingAs($this->viewer)->getJson("/catatan/{$this->note->id}/token")->assertJsonPath('can_edit', false)->json('token');

    $payload = app(CollabToken::class)->verify($member);
    expect($payload)->toMatchArray(['note' => $this->note->id, 'user' => $this->member->id, 'edit' => true])
        ->and($payload['exp'])->toBe(now()->addSeconds(120)->getTimestamp())
        ->and(app(CollabToken::class)->verify($viewer)['edit'])->toBeFalse();

    $this->travel(3)->minutes();
    expect(app(CollabToken::class)->verify($member))->toBeNull();
});

it('signs tokens exactly like the collab server expects (fixture in collab/test/token.test.js)', function () {
    config(['collab.secret' => 'cross-check-secret-cross-check-secret-1']);
    $this->travelTo(CarbonImmutable::createFromTimestamp(1_800_000_000));
    $note = new Note;
    $note->id = '01jaaaaaaaaaaaaaaaaaaaaaaa';
    $user = new User;
    $user->id = '01jbbbbbbbbbbbbbbbbbbbbbbb';
    $user->name = 'Hana Pratiwi';

    expect(app(CollabToken::class)->issue($note, $user, false))->toBe(
        'eyJub3RlIjoiMDFqYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEiLCJ1c2VyIjoiMDFqYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmIiLCJuYW1lIjoiSGFuYSBQcmF0aXdpIiwiZWRpdCI6ZmFsc2UsImV4cCI6MTgwMDAwMDEyMH0._O1G-7tr6uG0GcZK1K2DiyZEKpyHomM3IqsEFkc4-gg'
    );
});

it('has no token without a collab server or for a folder', function () {
    $folder = Note::factory()->folder()->in($this->workspace)->create();
    $this->actingAs($this->member)->getJson("/catatan/{$folder->id}/token")->assertNotFound();

    config(['collab.secret' => '']);
    $this->actingAs($this->member)->getJson("/catatan/{$this->note->id}/token")->assertStatus(503);
    $this->actingAs($this->member)->get("/catatan/{$this->note->id}")->assertInertia(fn (Assert $page) => $page->where('note.collab', false));
});

it('creates notes and folders from the dialogs', function () {
    $this->actingAs($this->member)->post('/catatan', ['title' => 'Arsip', 'workspace_id' => $this->workspace->id, 'kind' => 'folder'])
        ->assertRedirect();
    $folder = Note::query()->where('title', 'Arsip')->sole();

    $this->actingAs($this->member)->post('/catatan', ['title' => 'Notulen', 'workspace_id' => $this->workspace->id, 'parent_id' => $folder->id])
        ->assertRedirect('/catatan/'.Note::query()->where('title', 'Notulen')->value('id'));

    $this->actingAs($this->viewer)->post('/catatan', ['title' => 'X', 'workspace_id' => $this->workspace->id])->assertForbidden();
    $this->actingAs($this->outsider)->post('/catatan', ['title' => 'X', 'workspace_id' => $this->workspace->id])->assertNotFound();
    $this->actingAs($this->member)->post('/catatan', ['title' => '', 'workspace_id' => $this->workspace->id])->assertSessionHasErrors('title');

    $this->actingAs($this->member)->get("/catatan/{$folder->id}")->assertRedirect('/w/OPS/catatan');
});

it('renames and moves through PATCH and refuses readers', function () {
    $folder = Note::factory()->folder()->in($this->workspace)->create();

    $this->actingAs($this->member)->patchJson("/catatan/{$this->note->id}", ['title' => 'SOP baru', 'parent_id' => $folder->id])
        ->assertOk()
        ->assertJsonPath('note.title', 'SOP baru')
        ->assertJsonPath('note.parent_id', $folder->id);

    $this->actingAs($this->viewer)->patchJson("/catatan/{$this->note->id}", ['title' => 'x'])->assertForbidden();
    $this->actingAs($this->member)->patchJson("/catatan/{$folder->id}", ['parent_id' => $this->note->id])->assertUnprocessable();
});

it('saves without collaboration with a conflict check', function () {
    $base = $this->note->updated_at->toIso8601String();
    $this->travel(1)->minutes();

    $this->actingAs($this->member)->patchJson("/catatan/{$this->note->id}/isi", ['body' => httpDoc('  spasi tetap  '), 'updated_at' => $base])
        ->assertOk()
        ->assertJsonPath('note.content.content.0.content.0.text', '  spasi tetap  ');

    $this->actingAs($this->member)->patchJson("/catatan/{$this->note->id}/isi", ['body' => httpDoc('basi'), 'updated_at' => $base])
        ->assertStatus(409);
    $this->actingAs($this->viewer)->patchJson("/catatan/{$this->note->id}/isi", ['body' => httpDoc('x'), 'updated_at' => $base])
        ->assertForbidden();
});

it('updates sharing for the author only and audits it', function () {
    $guest = User::factory()->create();

    $this->actingAs($this->viewer)->putJson("/catatan/{$this->note->id}/akses", ['access' => 'restricted', 'people' => []])->assertForbidden();
    $this->actingAs($this->member)->putJson("/catatan/{$this->note->id}/akses", [
        'access' => 'restricted',
        'people' => [['user_id' => $guest->id, 'role' => 'edit']],
    ])->assertOk()->assertJsonPath('share.access', 'restricted')->assertJsonPath('share.people.0.role', 'edit');

    expect(AuditLog::query()->where('action', 'note.share_updated')->count())->toBe(1);
    $this->actingAs($this->viewer)->get("/catatan/{$this->note->id}")->assertNotFound();
    $this->actingAs($guest)->get("/catatan/{$this->note->id}")->assertOk();

    $this->actingAs($this->member)->putJson("/catatan/{$this->note->id}/akses", ['access' => 'nope', 'people' => [['user_id' => 'x', 'role' => 'owner']]])
        ->assertUnprocessable()->assertJsonValidationErrors(['access', 'people.0.user_id', 'people.0.role']);
});

it('restores a version and returns the new history', function () {
    $version = NoteVersion::factory()->of($this->note)->create(['content' => httpDoc('Versi lama'), 'created_at' => now()->subDay()]);
    $other = NoteVersion::factory()->create();

    $this->actingAs($this->viewer)->postJson("/catatan/{$this->note->id}/versi/{$version->id}/pulihkan")->assertForbidden();
    $this->actingAs($this->member)->postJson("/catatan/{$this->note->id}/versi/{$other->id}/pulihkan")->assertNotFound();
    $this->actingAs($this->member)->postJson("/catatan/{$this->note->id}/versi/{$version->id}/pulihkan")
        ->assertOk()
        ->assertJsonPath('note.content.content.0.content.0.text', 'Versi lama')
        ->assertJsonCount(3, 'versions');
});

it('deletes for the author or a workspace admin', function () {
    $this->actingAs($this->viewer)->delete("/catatan/{$this->note->id}")->assertForbidden();
    $this->actingAs($this->member)->delete("/catatan/{$this->note->id}?kembali=workspace")->assertRedirect('/w/OPS/catatan');

    expect(Note::query()->find($this->note->id))->toBeNull();
});

it('shows the notes tab of a workspace, also the personal one', function () {
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->member->id)->first()
        ?? Workspace::factory()->personal($this->member)->create();
    Note::factory()->folder()->in($personal)->by($this->member)->create(['title' => 'Ide']);

    $this->actingAs($this->member)->get("/w/{$personal->key}/catatan")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/notes')
            ->where('workspace.key', $personal->key)
            ->where('notes.can_create', true)
            ->has('notes.notes', 1)
            ->where('notes.notes.0.kind', 'folder'));

    $this->actingAs($this->owner)->get("/w/{$personal->key}/catatan")->assertNotFound();
    $this->actingAs($this->viewer)->get('/w/OPS/catatan')->assertInertia(fn (Assert $page) => $page->where('notes.can_create', false));
});

it('answers 404 everywhere while the flag is off', function () {
    config(['features.notes' => false]);

    $this->actingAs($this->member)->get('/catatan')->assertNotFound();
    $this->actingAs($this->member)->get("/catatan/{$this->note->id}")->assertNotFound();
    $this->actingAs($this->member)->get('/w/OPS/catatan')->assertNotFound();
    $this->withToken(NOTES_HTTP_SECRET)->getJson("/internal/catatan/{$this->note->id}/state")->assertNotFound();
    $this->actingAs($this->member)->get('/menu')->assertInertia(fn (Assert $page) => $page->where('features.notes', false));
});

it('sends guests to the login page', function () {
    $this->get('/catatan')->assertRedirect(route('login'));
});

it('serves the internal state only with the shared secret', function () {
    $this->note->forceFill(['yjs_state' => "\x00\x01\x02"])->save();

    $this->getJson("/internal/catatan/{$this->note->id}/state")->assertUnauthorized();
    $this->withToken('salah')->getJson("/internal/catatan/{$this->note->id}/state")->assertUnauthorized();
    $this->withToken(NOTES_HTTP_SECRET)->getJson("/internal/catatan/{$this->note->id}/state")
        ->assertOk()
        ->assertJsonPath('yjs_state', base64_encode("\x00\x01\x02"))
        ->assertJsonPath('content.content.0.content.0.text', 'Cocokkan surat jalan');

    // A signed-in session is not enough.
    $this->withoutToken()->actingAs($this->member)->getJson("/internal/catatan/{$this->note->id}/state")->assertUnauthorized();

    config(['collab.secret' => '']);
    $this->withToken('')->getJson("/internal/catatan/{$this->note->id}/state")->assertNotFound();
});

it('stores state from the collab server without a session or CSRF token', function () {
    $this->withToken(NOTES_HTTP_SECRET)->postJson("/internal/catatan/{$this->note->id}/state", [
        'yjs_state' => base64_encode("\x09\x08"),
        'body' => httpDoc(' Diedit bersama '),
        'editor_ids' => [$this->viewer->id, $this->member->id],
    ])->assertOk()->assertJsonPath('stored', true);

    $note = $this->note->fresh();
    expect($note->yjs_state)->toBe("\x09\x08")
        ->and($note->content_text)->toBe('Diedit bersama')
        ->and($note->content['content'][0]['content'][0]['text'])->toBe(' Diedit bersama ')
        ->and($note->updated_by)->toBe($this->member->id);

    $this->withToken('salah')->postJson("/internal/catatan/{$this->note->id}/state", ['yjs_state' => 'AA==', 'body' => null, 'editor_ids' => []])->assertUnauthorized();
    $this->withToken(NOTES_HTTP_SECRET)->postJson("/internal/catatan/{$this->note->id}/state", ['yjs_state' => '%%%', 'body' => null, 'editor_ids' => []])->assertStatus(422);

    $this->note->delete();
    $this->withToken(NOTES_HTTP_SECRET)->getJson("/internal/catatan/{$this->note->id}/state")->assertNotFound();
});

it('shows the restricted demo note to the invited HR lead only', function () {
    $restricted = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create();
    $hr = User::factory()->withRole(Role::Hr)->create();
    NoteShare::factory()->create(['note_id' => $restricted->id, 'user_id' => $hr->id, 'role' => NoteShareRole::View]);

    $this->actingAs($hr)->get("/catatan/{$restricted->id}")->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('note.current.can_edit', false)->where('note.current.access', NoteAccess::Restricted->value));
    $this->actingAs($this->member)->get("/catatan/{$restricted->id}")->assertNotFound();
});

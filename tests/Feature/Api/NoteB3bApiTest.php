<?php

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteShareRole;
use App\Domain\Notes\Notifications\NoteMentionNotification;
use App\Domain\Notes\Services\NoteViewerRights;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\AuditLog;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\NotePolicy;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — catatan Bagian 3 (B3-B): pohon bersarang + peran saya, buat
| folder/tab, pindah/urut, hapus, tab dokumen, notulensi cepat, berbagi,
| riwayat versi, pencarian, picker mention + mention dari body_html.
| Action/Policy web dipakai ulang; semua di balik features.notes.
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', str_repeat('ab', 32));
}

function dokB3b(string $text): array
{
    return ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]];
}

/** Signs `email` in through the real endpoint; later calls switch token via pakaiB3b(). */
function masukB3b(User $user): string
{
    static $tokens = [];

    app(Factory::class)->forgetGuards();

    // One login per user per test database state (ids are ULIDs, unique per test).
    if (isset($tokens[$user->id])) {
        return $tokens[$user->id];
    }

    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    // The login request also signs the web guard in (session); that session
    // user would win over the bearer token of the next call (sanctum.guard
    // = web), so the session is dropped.
    test()->flushSession();

    return $tokens[$user->id] = $token;
}

function pakaiB3b(User $user): TestCase
{
    $token = masukB3b($user);
    app(Factory::class)->forgetGuards();

    // The app instance is shared by all requests of a test: after a request
    // answered 403/404 for another token, the first call with a new token
    // can still see the previous user. One throwaway call settles it
    // (production boots a fresh app per request and is unaffected).
    test()->withToken($token)->getJson('/api/v1/auth/saya');
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.notes' => true]);
    $this->travelTo(CarbonImmutable::parse('2026-10-13 09:00', 'Asia/Jakarta'));

    $this->owner = User::factory()->create(['name' => 'Nadia Pemilik']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'visibility' => WorkspaceVisibility::Private]);
    addMember($this->workspace, $this->owner, WorkspaceRole::Owner);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->member->update(['name' => 'Maya Anggota']);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->viewer->update(['name' => 'Rani Pembaca']);
    $this->outsider = User::factory()->create(['name' => 'Luar Pintu']);
});

test('the workspace tab answers a nested tree with my role next to the flat rows', function () {
    $folder = Note::factory()->in($this->workspace)->by($this->owner)->folder()->create(['title' => 'Arsip 2026']);
    $inFolder = Note::factory()->in($this->workspace)->by($this->member)->childOf($folder)->create(['title' => 'Notulen Agustus']);
    $subPage = Note::factory()->in($this->workspace)->by($this->owner)->childOf($inFolder)->create(['title' => 'Lampiran']);
    $root = Note::factory()->in($this->workspace)->by($this->owner)->create(['title' => 'SOP gudang']);
    $secret = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create(['title' => 'Rahasia owner']);
    $secretChild = Note::factory()->in($this->workspace)->by($this->owner)->childOf($secret)->create(['title' => 'Anak rahasia', 'access' => NoteAccess::Workspace]);
    NoteShare::factory()->create(['note_id' => $secret->id, 'user_id' => $this->viewer->id, 'role' => NoteShareRole::Edit]);

    $response = pakaiB3b($this->member)->getJson('/api/v1/workspace/OPS/catatan');

    $response->assertOk()
        ->assertJsonPath('workspace.key', 'OPS')
        ->assertJsonPath('workspace.archived', false)
        ->assertJsonPath('can_create', true)
        // The original flat shape is untouched.
        ->assertJsonCount(5, 'notes')
        ->assertJsonPath('notes.0.id', $folder->id)
        ->assertJsonPath('notes.0.penulis', 'Nadia Pemilik');

    $tree = collect($response->json('tree'));

    // Roots: folder, then notes by position; the child of the invisible
    // restricted note is promoted to the root instead of vanishing.
    expect($tree->pluck('id')->all())->toContain($folder->id, $root->id, $secretChild->id)
        ->and($tree->pluck('id')->all())->not->toContain($secret->id, $inFolder->id);

    $folderNode = $tree->firstWhere('id', $folder->id);
    expect($folderNode['kind'])->toBe('folder')
        ->and($folderNode['children'])->toHaveCount(1)
        ->and($folderNode['children'][0]['id'])->toBe($inFolder->id)
        ->and($folderNode['children'][0]['my_role'])->toBe('author')
        ->and($folderNode['children'][0]['children'][0]['id'])->toBe($subPage->id)
        ->and($folderNode['children'][0]['children'][0]['my_role'])->toBe('edit')
        ->and($folderNode['children'][0]['children'][0]['can_edit'])->toBeTrue()
        ->and($folderNode['access'])->toBe('workspace')
        ->and($folderNode['invited_only'])->toBeFalse()
        ->and($folderNode['updated_at'])->toBeString();

    // A viewer reads everything, edits only what an invitation allows; the
    // restricted note shared with them shows "Hanya diundang" and edit rights.
    $viewerTree = collect(pakaiB3b($this->viewer)->getJson('/api/v1/workspace/OPS/catatan')->json('tree'));
    $sharedNode = $viewerTree->firstWhere('id', $secret->id);

    expect($sharedNode['invited_only'])->toBeTrue()
        ->and($sharedNode['my_role'])->toBe('edit')
        ->and($sharedNode['children'][0]['id'])->toBe($secretChild->id)
        ->and($viewerTree->firstWhere('id', $root->id)['my_role'])->toBe('view')
        ->and($viewerTree->firstWhere('id', $root->id)['can_edit'])->toBeFalse();

    pakaiB3b($this->viewer)->getJson('/api/v1/workspace/OPS/catatan')->assertJsonPath('can_create', false);
});

test('the tree rights agree with NotePolicy::canEdit for every user and note', function () {
    $other = Note::factory()->in($this->workspace)->by($this->owner)->create();
    $own = Note::factory()->in($this->workspace)->by($this->member)->create();
    $restricted = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create();
    $mine = Note::factory()->in($this->workspace)->by($this->member)->restricted()->create();
    $shared = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create();
    NoteShare::factory()->create(['note_id' => $shared->id, 'user_id' => $this->viewer->id, 'role' => NoteShareRole::Edit]);
    NoteShare::factory()->create(['note_id' => $other->id, 'user_id' => $this->member->id, 'role' => NoteShareRole::View]);

    $policy = app(NotePolicy::class);
    $notes = [$other, $own, $restricted, $mine, $shared];

    foreach ([$this->owner, $this->member, $this->viewer] as $user) {
        $rights = NoteViewerRights::forWorkspace($user, $this->workspace, array_map(fn (Note $note): string => $note->id, $notes));

        foreach ($notes as $note) {
            if (! $policy->canView($user, $note->fresh())) {
                continue;
            }

            expect($rights->canEdit($note->id, $note->access, $note->created_by))
                ->toBe($policy->canEdit($user, $note->fresh()), "{$user->name} / {$note->title}");
        }
    }

    // Archived workspaces are read only for everyone.
    $this->workspace->forceFill(['archived_at' => now()])->save();
    $archived = NoteViewerRights::forWorkspace($this->owner, $this->workspace->fresh(), [$own->id]);

    expect($archived->canEdit($own->id, $own->access, $own->created_by))->toBeFalse()
        ->and($archived->role($own->id, $own->access, $own->created_by))->toBe('view');
});

test('POST /catatan creates notes, folders, tabs and sub-pages through CreateNote', function () {
    $api = pakaiB3b($this->member);

    $folder = $api->postJson('/api/v1/catatan', ['workspace_id' => $this->workspace->id, 'title' => '  Arsip  ', 'kind' => 'folder'])
        ->assertCreated()
        ->assertJsonPath('note.kind', 'folder')
        ->assertJsonPath('note.title', 'Arsip')
        ->assertJsonPath('note.body_html', null)
        ->assertJsonPath('note.mobile_editable', false)
        ->json('note.id');

    $note = $api->postJson('/api/v1/catatan', ['workspace_id' => $this->workspace->id, 'parent_id' => $folder, 'title' => 'Notulen'])
        ->assertCreated()
        ->assertJsonPath('note.parent_id', $folder)
        ->assertJsonPath('note.kind', 'note')
        ->assertJsonPath('note.mobile_editable', true)
        ->assertJsonPath('note.can_edit', true)
        ->json('note.id');

    // A tab only needs parent_id: the workspace is the parent's.
    $api->postJson('/api/v1/catatan', ['parent_id' => $note, 'title' => 'Tab 2'])
        ->assertCreated()
        ->assertJsonPath('note.parent_id', $note)
        ->assertJsonPath('note.workspace_id', $this->workspace->id);

    // Folders never sit under a note.
    $api->postJson('/api/v1/catatan', ['parent_id' => $note, 'title' => 'Salah', 'kind' => 'folder'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.parent_id.0', 'Folder hanya bisa berada di akar atau di dalam folder lain.');

    $api->postJson('/api/v1/catatan', ['title' => ''])->assertUnprocessable()->assertJsonPath('errors.title.0', 'Judul wajib diisi.');
    $api->postJson('/api/v1/catatan', ['title' => 'Tanpa tempat'])->assertUnprocessable()
        ->assertJsonPath('errors.workspace_id.0', 'Pilih workspace catatan atau kirim parent_id.');
    $api->postJson('/api/v1/catatan', ['parent_id' => '01JZZZZZZZZZZZZZZZZZZZZZZZ', 'title' => 'Hilang'])->assertUnprocessable()
        ->assertJsonPath('errors.parent_id.0', 'Folder atau catatan induk tidak ditemukan.');

    // Viewers may not create; a workspace the caller cannot see is 404.
    pakaiB3b($this->viewer)->postJson('/api/v1/catatan', ['workspace_id' => $this->workspace->id, 'title' => 'Coba'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak dapat membuat catatan di workspace ini.');

    pakaiB3b($this->outsider)->postJson('/api/v1/catatan', ['workspace_id' => $this->workspace->id, 'title' => 'Coba'])->assertNotFound();
    pakaiB3b($this->outsider)->postJson('/api/v1/catatan', ['parent_id' => $note, 'title' => 'Coba'])->assertUnprocessable();
});

test('PATCH /catatan/{id}/pindah moves, reorders and refuses cycles', function () {
    $api = pakaiB3b($this->member);
    $folder = Note::factory()->in($this->workspace)->by($this->member)->folder()->create(['title' => 'Folder A']);
    $a = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'A', 'position' => 'a']);
    $b = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'B', 'position' => 'b']);
    $c = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'C', 'position' => 'c']);

    // Into the folder (at the end).
    $api->patchJson("/api/v1/catatan/{$a->id}/pindah", ['parent_id' => $folder->id])
        ->assertOk()
        ->assertJsonPath('note.parent_id', $folder->id);

    // Back to the root at index 0: before B and C.
    $api->patchJson("/api/v1/catatan/{$c->id}/pindah", ['parent_id' => null, 'position' => 0])
        ->assertOk()
        ->assertJsonPath('note.parent_id', null);

    $order = Note::query()->where('workspace_id', $this->workspace->id)->whereNull('parent_id')->where('kind', 'note')
        ->orderBy('position')->pluck('title')->all();

    expect($order)->toBe(['C', 'B']);

    // Reorder inside the same parent: C to the end (index past the end).
    $api->patchJson("/api/v1/catatan/{$c->id}/pindah", ['parent_id' => null, 'position' => 9])->assertOk();
    expect(Note::query()->whereNull('parent_id')->where('kind', 'note')->orderBy('position')->pluck('title')->all())->toBe(['B', 'C']);

    // Between B and C.
    $api->patchJson("/api/v1/catatan/{$a->id}/pindah", ['parent_id' => null, 'position' => 1])->assertOk();
    expect(Note::query()->whereNull('parent_id')->where('kind', 'note')->orderBy('position')->pluck('title')->all())->toBe(['B', 'A', 'C']);

    // Cycle and invalid input.
    $child = Note::factory()->in($this->workspace)->by($this->member)->childOf($b)->create();
    $api->patchJson("/api/v1/catatan/{$b->id}/pindah", ['parent_id' => $child->id])
        ->assertUnprocessable()
        ->assertJsonPath('errors.parent_id.0', 'Catatan tidak bisa dipindahkan ke dalam dirinya sendiri atau sub-catatannya.');
    $api->patchJson("/api/v1/catatan/{$b->id}/pindah", [])->assertUnprocessable()
        ->assertJsonPath('errors.parent_id.0', 'Kirim parent_id (null untuk memindahkan ke tingkat atas).');

    // Readers 403, others 404.
    pakaiB3b($this->viewer)->patchJson("/api/v1/catatan/{$b->id}/pindah", ['parent_id' => null])
        ->assertForbidden()->assertJsonPath('message', 'Anda hanya dapat membaca catatan ini.');
    pakaiB3b($this->outsider)->patchJson("/api/v1/catatan/{$b->id}/pindah", ['parent_id' => null])->assertNotFound();
});

test('DELETE /catatan/{id} soft deletes and lifts the children', function () {
    $folder = Note::factory()->in($this->workspace)->by($this->member)->folder()->create();
    $note = Note::factory()->in($this->workspace)->by($this->member)->childOf($folder)->create();
    $tab = Note::factory()->in($this->workspace)->by($this->member)->childOf($note)->create();

    pakaiB3b($this->viewer)->deleteJson("/api/v1/catatan/{$note->id}")->assertForbidden();
    pakaiB3b($this->outsider)->deleteJson("/api/v1/catatan/{$note->id}")->assertNotFound();

    pakaiB3b($this->member)->deleteJson("/api/v1/catatan/{$note->id}")
        ->assertOk()
        ->assertExactJson([
            'deleted' => true,
            'id' => $note->id,
            'kind' => 'note',
            'workspace_id' => $this->workspace->id,
            'parent_id' => $folder->id,
        ]);

    expect(Note::withTrashed()->find($note->id)->trashed())->toBeTrue()
        ->and($tab->fresh()->parent_id)->toBe($folder->id);

    pakaiB3b($this->member)->getJson("/api/v1/catatan/{$note->id}")->assertNotFound();
    pakaiB3b($this->member)->deleteJson("/api/v1/catatan/{$note->id}")->assertNotFound();
});

test('GET /catatan/{id}/tab lists the document tabs and sub-tabs like the web', function () {
    $doc = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'Rapat mingguan', 'position' => 'a']);
    $tab1 = Note::factory()->in($this->workspace)->by($this->member)->childOf($doc)->create(['title' => 'Tab 2', 'position' => 'a']);
    $sub = Note::factory()->in($this->workspace)->by($this->owner)->childOf($tab1)->create(['title' => 'Sub-tab 1']);
    $tab2 = Note::factory()->in($this->workspace)->by($this->member)->childOf($doc)->create(['title' => 'Tab 3', 'position' => 'b']);
    $deeper = Note::factory()->in($this->workspace)->by($this->member)->childOf($sub)->create(['title' => 'Terlalu dalam']);
    $folder = Note::factory()->in($this->workspace)->by($this->member)->folder()->childOf($doc)->create();

    // From a sub-tab the root is the top-most note above it.
    $response = pakaiB3b($this->member)->getJson("/api/v1/catatan/{$sub->id}/tab");

    $response->assertOk()
        ->assertJsonPath('root_id', $doc->id)
        ->assertJsonPath('active_id', $sub->id)
        ->assertJsonPath('can_create', true)
        ->assertJsonPath('next_tab_title', 'Tab 4')
        ->assertJsonCount(4, 'tabs');

    expect(collect($response->json('tabs'))->map(fn (array $tab): array => [$tab['id'], $tab['level'], $tab['tab_id'], $tab['active']])->all())
        ->toBe([
            [$doc->id, 0, $doc->id, false],
            [$tab1->id, 0, $tab1->id, false],
            [$sub->id, 1, $tab1->id, true],
            [$tab2->id, 0, $tab2->id, false],
        ]);

    $tabs = collect($response->json('tabs'));
    expect($tabs->firstWhere('id', $tab1->id)['next_subtab_title'])->toBe('Sub-tab 2')
        ->and($tabs->firstWhere('id', $tab2->id)['next_subtab_title'])->toBe('Sub-tab 1')
        ->and($tabs->firstWhere('id', $sub->id)['my_role'])->toBe('edit')
        ->and($tabs->pluck('id')->all())->not->toContain($deeper->id, $folder->id);

    // Readers see the tabs but cannot create; folders and invisible notes are 404.
    pakaiB3b($this->viewer)->getJson("/api/v1/catatan/{$doc->id}/tab")
        ->assertOk()->assertJsonPath('can_create', false)->assertJsonPath('tabs.0.can_edit', false);
    pakaiB3b($this->member)->getJson("/api/v1/catatan/{$folder->id}/tab")->assertNotFound();
    pakaiB3b($this->outsider)->getJson("/api/v1/catatan/{$doc->id}/tab")->assertNotFound();
});

test('quick minutes start in the personal workspace and the latest list answers newest first', function () {
    $api = pakaiB3b($this->member);

    $response = $api->postJson('/api/v1/catatan/notulensi')
        ->assertCreated()
        ->assertJsonPath('mode', 'catat')
        ->assertJsonPath('note.preset', 'minutes')
        ->assertJsonPath('note.title', 'Notulensi · Selasa, 13/10/2026 09.00')
        ->assertJsonPath('note.workspace_type', 'personal')
        ->assertJsonPath('note.can_edit', true)
        ->assertJsonPath('note.mobile_editable', false);

    expect($response->json('note.body_html'))->toContain('<h2>Peserta</h2>')
        ->and($response->json('note.body_text'))->toContain('Tanggal & jam: Selasa, 13/10/2026 09.00');

    $personal = app(EnsurePersonalWorkspace::class)->handle($this->member);
    expect(Note::query()->where('workspace_id', $personal->id)->count())->toBe(1);

    $this->travel(2)->hours();
    $second = $api->postJson('/api/v1/catatan/notulensi')->assertCreated()->json('note.id');

    foreach (['/api/v1/catatan/notulensi/terakhir', '/api/v1/catatan/notulensi'] as $path) {
        $list = $api->getJson($path)->assertOk();

        expect($list->json('minutes.0.id'))->toBe($second)
            ->and($list->json('minutes'))->toHaveCount(2)
            ->and($list->json('minutes.0.workspace_name'))->toBe('Pribadi')
            ->and($list->json('minutes.0'))->toHaveKeys(['id', 'title', 'workspace_name', 'updated_at']);
    }

    $api->getJson('/api/v1/catatan/notulensi/terakhir?limit=1')->assertJsonCount(1, 'minutes');

    // Other people's personal minutes stay private.
    pakaiB3b($this->owner)->getJson('/api/v1/catatan/notulensi/terakhir')->assertJsonCount(0, 'minutes');
});

test('sharing: read, set access and people with audit, remove one person', function () {
    $note = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'Draf kebijakan']);
    $api = pakaiB3b($this->member);

    $api->getJson("/api/v1/catatan/{$note->id}/akses")
        ->assertOk()
        ->assertJsonPath('share.access', 'workspace')
        ->assertJsonPath('share.access_label', 'Workspace')
        ->assertJsonPath('share.author.name', 'Maya Anggota')
        ->assertJsonPath('share.people', []);

    // Only the author or a workspace admin shares.
    pakaiB3b($this->viewer)->getJson("/api/v1/catatan/{$note->id}/akses")
        ->assertForbidden()
        ->assertJsonPath('message', 'Hanya penulis catatan atau admin workspace yang dapat mengatur akses.');
    pakaiB3b($this->outsider)->getJson("/api/v1/catatan/{$note->id}/akses")->assertNotFound();

    $api = pakaiB3b($this->member); // withToken() sticks to the test case: switch back.
    $invited = User::factory()->create(['name' => 'Tamu Undangan']);

    $api->putJson("/api/v1/catatan/{$note->id}/akses", [
        'access' => 'restricted',
        'people' => [
            ['user_id' => $invited->id, 'role' => 'edit'],
            ['user_id' => $this->viewer->id, 'role' => 'view'],
        ],
    ])->assertOk()
        ->assertJsonPath('share.access', 'restricted')
        ->assertJsonPath('share.access_label', 'Hanya diundang')
        ->assertJsonCount(2, 'share.people')
        ->assertJsonPath('share.people.0.name', 'Tamu Undangan')
        ->assertJsonPath('share.people.0.role', 'edit')
        ->assertJsonPath('share.people.0.role_label', 'Menyunting');

    expect(AuditLog::query()->where('action', 'note.share_updated')->count())->toBe(1);

    // The invited outsider now opens and edits it; a plain member cannot.
    pakaiB3b($invited)->getJson("/api/v1/catatan/{$note->id}")->assertOk()->assertJsonPath('note.can_edit', true);
    pakaiB3b($this->owner)->getJson("/api/v1/catatan/{$note->id}")->assertNotFound();

    // Remove one person.
    $api = pakaiB3b($this->member);
    $api->deleteJson("/api/v1/catatan/{$note->id}/akses/{$invited->id}")
        ->assertOk()
        ->assertJsonCount(1, 'share.people')
        ->assertJsonPath('share.people.0.user_id', $this->viewer->id);

    pakaiB3b($invited)->getJson("/api/v1/catatan/{$note->id}")->assertNotFound();
    $api = pakaiB3b($this->member);
    $api->deleteJson("/api/v1/catatan/{$note->id}/akses/{$invited->id}")->assertNotFound();

    // Validation: unknown / inactive people and bad payloads.
    $api->putJson("/api/v1/catatan/{$note->id}/akses", ['access' => 'restricted', 'people' => [['user_id' => '01JZZZZZZZZZZZZZZZZZZZZZZZ', 'role' => 'view']]])
        ->assertUnprocessable()->assertJsonPath('errors.people.0', 'Ada orang yang tidak dapat diundang ke catatan ini.');
    $api->putJson("/api/v1/catatan/{$note->id}/akses", ['access' => 'rahasia', 'people' => []])->assertUnprocessable();
    $api->putJson("/api/v1/catatan/{$note->id}/akses", ['access' => 'workspace'])->assertUnprocessable();

    // Personal workspace notes cannot be shared.
    $personal = Note::factory()->in(app(EnsurePersonalWorkspace::class)->handle($this->member))->by($this->member)->create();
    $api->getJson("/api/v1/catatan/{$personal->id}/akses")->assertForbidden();
});

test('versions: list, safe preview, restore with edit rights only', function () {
    $note = Note::factory()->in($this->workspace)->by($this->member)->create([
        'title' => 'Versi sekarang',
        'content' => dokB3b('Isi sekarang'),
        'content_text' => 'Isi sekarang',
    ]);
    $old = NoteVersion::factory()->of($note)->create([
        'title' => 'Judul lama',
        'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Isi <script>alert(1)</script> lama']]]]],
        'created_at' => now()->subDay(),
    ]);
    $newer = NoteVersion::factory()->of($note)->create(['label' => 'Dipulihkan dari versi 1 Okt 2026 10.12', 'created_at' => now()->subHour()]);
    $foreign = NoteVersion::factory()->of(Note::factory()->in($this->workspace)->by($this->owner)->create())->create();

    $api = pakaiB3b($this->member);
    $list = $api->getJson("/api/v1/catatan/{$note->id}/versi")->assertOk()->assertJsonPath('can_restore', true);

    expect(collect($list->json('versions'))->pluck('id')->all())->toBe([$newer->id, $old->id])
        ->and($list->json('versions.0.label'))->toBe('Dipulihkan dari versi 1 Okt 2026 10.12')
        ->and($list->json('versions.1.author.name'))->toBe('Maya Anggota')
        ->and($list->json('versions.0'))->not->toHaveKey('content');

    // Preview is escaped HTML, never a script.
    $preview = $api->getJson("/api/v1/catatan/{$note->id}/versi/{$old->id}")->assertOk()
        ->assertJsonPath('version.title', 'Judul lama');

    expect($preview->json('version.body_html'))->toBe('<p>Isi &lt;script&gt;alert(1)&lt;/script&gt; lama</p>')
        ->and($preview->json('version.body_text'))->toContain('lama');

    // A version of another note is 404, strangers 404.
    $api->getJson("/api/v1/catatan/{$note->id}/versi/{$foreign->id}")->assertNotFound();
    pakaiB3b($this->outsider)->getJson("/api/v1/catatan/{$note->id}/versi")->assertNotFound();
    $api = pakaiB3b($this->member);

    // Readers see the history but cannot restore.
    pakaiB3b($this->viewer)->getJson("/api/v1/catatan/{$note->id}/versi")->assertOk()->assertJsonPath('can_restore', false);
    pakaiB3b($this->viewer)->postJson("/api/v1/catatan/{$note->id}/versi/{$old->id}/pulihkan")->assertForbidden();
    $api = pakaiB3b($this->member);
    $api->postJson("/api/v1/catatan/{$note->id}/versi/{$foreign->id}/pulihkan")->assertNotFound();

    $restored = $api->postJson("/api/v1/catatan/{$note->id}/versi/{$old->id}/pulihkan")
        ->assertOk()
        ->assertJsonPath('note.title', 'Judul lama');

    expect($restored->json('note.body_html'))->toBe('<p>Isi &lt;script&gt;alert(1)&lt;/script&gt; lama</p>')
        ->and($restored->json('versions.0.label'))->toStartWith('Dipulihkan dari versi ')
        ->and($note->fresh()->title)->toBe('Judul lama');
});

test('search matches title and text in visible notes with snippets and per-workspace counts', function () {
    $hit = Note::factory()->in($this->workspace)->by($this->member)->create([
        'title' => 'Jadwal pengiriman',
        'content_text' => 'Kirim barang ke gudang timur setiap Selasa pagi sebelum jam sembilan.',
    ]);
    $titleOnly = Note::factory()->in($this->workspace)->by($this->owner)->create(['title' => 'Pengiriman darurat', 'content_text' => '']);
    $hidden = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create(['title' => 'Pengiriman rahasia']);
    Note::factory()->in($this->workspace)->by($this->owner)->create(['title' => 'Tidak terkait', 'content_text' => 'abc']);
    $personal = app(EnsurePersonalWorkspace::class)->handle($this->member);
    $mine = Note::factory()->in($personal)->by($this->member)->create(['title' => 'Catatan pribadi', 'content_text' => 'Daftar pengiriman buku']);
    Note::factory()->in(app(EnsurePersonalWorkspace::class)->handle($this->owner))->by($this->owner)->create(['title' => 'Pribadi owner pengiriman']);

    $api = pakaiB3b($this->member);
    $response = $api->getJson('/api/v1/catatan/cari?q=pengiriman')->assertOk()
        ->assertJsonPath('query', 'pengiriman')
        ->assertJsonPath('total', 3);

    $ids = collect($response->json('results'))->pluck('id')->all();
    expect($ids)->toContain($hit->id, $titleOnly->id, $mine->id)
        ->and($ids)->not->toContain($hidden->id);

    $first = collect($response->json('results'))->firstWhere('id', $hit->id);
    expect($first['snippet'])->toContain('Kirim barang')
        ->and($first['workspace_name'])->toBe($this->workspace->name)
        ->and($first['penulis'])->toBe('Maya Anggota')
        ->and(collect($response->json('results'))->firstWhere('id', $titleOnly->id)['snippet'])->toBeNull()
        ->and(collect($response->json('results'))->firstWhere('id', $mine->id)['workspace_name'])->toBe('Pribadi');

    $counts = collect($response->json('workspaces'))->mapWithKeys(fn (array $row): array => [$row['id'] => $row['count']]);
    expect($counts[$this->workspace->id])->toBe(2)->and($counts[$personal->id])->toBe(1);

    // Filter by workspace keeps the chip counts.
    $filtered = $api->getJson("/api/v1/catatan/cari?q=pengiriman&workspace_id={$personal->id}")->assertOk();
    expect($filtered->json('results'))->toHaveCount(1)->and($filtered->json('total'))->toBe(3);

    // Prefix on the last word works; limit caps the page; validation.
    $api->getJson('/api/v1/catatan/cari?q=pengir&limit=1')->assertOk()->assertJsonCount(1, 'results')->assertJsonPath('total', 3);
    $api->getJson('/api/v1/catatan/cari')->assertUnprocessable()->assertJsonPath('errors.q.0', 'Kata kunci pencarian wajib diisi.');
    $api->getJson('/api/v1/catatan/cari?q=a')->assertUnprocessable()->assertJsonPath('errors.q.0', 'Kata kunci minimal 2 karakter.');
    $api->getJson('/api/v1/catatan/cari?q=zzzzzz')->assertOk()->assertJsonPath('total', 0)->assertJsonPath('results', []);
});

test('the mention picker lists only people who can open the note', function () {
    $note = Note::factory()->in($this->workspace)->by($this->member)->create();
    $extra = addMember($this->workspace, User::factory()->create(['name' => 'Maya Tambahan']), WorkspaceRole::Member);
    User::factory()->create(['name' => 'Maya Luar']);

    $names = fn (string $query) => collect(pakaiB3b($this->member)->getJson("/api/v1/catatan/{$note->id}/mention{$query}")->assertOk()->json('people'))->pluck('name')->all();

    // Workspace members only (private workspace); the caller is left out.
    expect($names('?q=maya'))->toBe(['Maya Tambahan'])
        ->and($names(''))->toContain('Nadia Pemilik', 'Maya Tambahan')
        ->and($names(''))->not->toContain('Maya Luar', 'Maya Anggota');

    // Restricted note: invited people (and the author), not the rest.
    $note->forceFill(['access' => NoteAccess::Restricted])->save();
    NoteShare::factory()->create(['note_id' => $note->id, 'user_id' => $extra->id, 'role' => NoteShareRole::View]);

    expect($names(''))->toBe(['Maya Tambahan']);

    // The invited reader cannot write, so no picker; strangers 404.
    pakaiB3b($extra)->getJson("/api/v1/catatan/{$note->id}/mention")->assertForbidden();
    pakaiB3b($this->outsider)->getJson("/api/v1/catatan/{$note->id}/mention")->assertNotFound();
    pakaiB3b($this->member)->getJson("/api/v1/catatan/{$note->id}/mention?limit=99")->assertUnprocessable();
});

test('body_html with data-mention notifies the mentioned people who can open the note', function () {
    Notification::fake();

    $note = Note::factory()->in($this->workspace)->by($this->member)->create(['title' => 'Rapat', 'content' => dokB3b('Awal'), 'content_text' => 'Awal']);
    $api = pakaiB3b($this->member);

    $html = sprintf(
        '<p>Halo <span data-mention="%s">@Siapa saja</span> dan <span data-mention="%s">@Orang luar</span>, tolong cek.</p>',
        $this->owner->id,
        $this->outsider->id,
    );

    $response = $api->patchJson("/api/v1/catatan/{$note->id}", [
        'body_html' => $html,
        'updated_at' => $note->updated_at->toIso8601String(),
    ])->assertOk();

    // Stored as a mention node with the real name; the stranger stays plain text.
    expect($response->json('note.body_html'))->toContain('data-type="mention"', 'data-id="'.$this->owner->id.'"', '@Nadia Pemilik')
        ->and($response->json('note.body_html'))->not->toContain($this->outsider->id)
        ->and($response->json('note.body_text'))->toContain('@Orang luar');

    Notification::assertSentTo($this->owner, NoteMentionNotification::class);
    Notification::assertNotSentTo($this->outsider, NoteMentionNotification::class);
    Notification::assertNotSentTo($this->member, NoteMentionNotification::class);

    // The note is rich now: the plain-text editor is refused, the rich editor (`rich: true`) saves.
    $fresh = $note->fresh();

    $api->patchJson("/api/v1/catatan/{$note->id}", ['body_html' => '<p>Datar</p>', 'updated_at' => $fresh->updated_at->toIso8601String()])
        ->assertStatus(409)->assertJsonPath('code', 'rich_note');

    $api->patchJson("/api/v1/catatan/{$note->id}", ['body_html' => $html.'<h2>Judul</h2>', 'rich' => true, 'updated_at' => $fresh->updated_at->toIso8601String()])
        ->assertOk()
        ->assertJsonPath('note.mobile_editable', false);

    // The rendering form (data-type + data-id) is read back too.
    $again = $note->fresh();
    $api->patchJson("/api/v1/catatan/{$note->id}", ['body_html' => $response->json('note.body_html'), 'rich' => true, 'updated_at' => $again->updated_at->toIso8601String()])
        ->assertOk()
        ->assertJsonPath('note.body_html', $response->json('note.body_html'));
});

test('every B3-B endpoint answers 404 with the notes flag off and 401 without a token', function () {
    $note = Note::factory()->in($this->workspace)->by($this->member)->create();
    $version = NoteVersion::factory()->of($note)->create();

    $calls = [
        ['postJson', '/api/v1/catatan', ['workspace_id' => $this->workspace->id, 'title' => 'X']],
        ['patchJson', "/api/v1/catatan/{$note->id}/pindah", ['parent_id' => null]],
        ['deleteJson', "/api/v1/catatan/{$note->id}", []],
        ['getJson', "/api/v1/catatan/{$note->id}/tab", []],
        ['postJson', '/api/v1/catatan/notulensi', []],
        ['getJson', '/api/v1/catatan/notulensi/terakhir', []],
        ['getJson', '/api/v1/catatan/cari?q=abc', []],
        ['getJson', "/api/v1/catatan/{$note->id}/mention", []],
        ['getJson', "/api/v1/catatan/{$note->id}/akses", []],
        ['putJson', "/api/v1/catatan/{$note->id}/akses", ['access' => 'workspace', 'people' => []]],
        ['getJson', "/api/v1/catatan/{$note->id}/versi", []],
        ['getJson', "/api/v1/catatan/{$note->id}/versi/{$version->id}", []],
        ['postJson', "/api/v1/catatan/{$note->id}/versi/{$version->id}/pulihkan", []],
    ];

    foreach ($calls as [$method, $path, $payload]) {
        test()->{$method}($path, $payload)->assertUnauthorized();
    }

    $token = masukB3b($this->member);
    config(['features.notes' => false]);

    foreach ($calls as [$method, $path, $payload]) {
        app(Factory::class)->forgetGuards();
        test()->withToken($token)->{$method}($path, $payload)->assertNotFound();
    }
});

test('quick minutes with polos are plain paragraphs the phone editor can edit', function () {
    $response = pakaiB3b($this->member)->postJson('/api/v1/catatan/notulensi', ['polos' => true])
        ->assertCreated()
        ->assertJsonPath('note.preset', 'minutes')
        ->assertJsonPath('note.mobile_editable', true);

    expect($response->json('note.body_text'))
        ->toContain('Tanggal & jam: Selasa, 13/10/2026 09.00')
        ->toContain('Peserta:')
        ->toContain('Tindak lanjut:')
        ->and($response->json('note.body_html'))->not->toContain('<h2>');
});

<?php

use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\Note;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Tests\TestCase;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — catatan bersama untuk ponsel: daftar per workspace (baris
| NoteLibrary web + nama penulis/penyunting), buat lewat CreateNote web,
| detail dengan isi versi terakhir sebagai body_html (NoteHtml), dan simpan
| = fallback tanpa kolaborasi web (SaveNoteContent): konflik updated_at
| menjawab 409 dengan body yang sama. Kolaborasi realtime Yjs tetap di web.
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', str_repeat('ab', 32));
} // 64 hex (SHA-256)

function dokumenCatatan(string $text): array
{
    return ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]];
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.notes' => true]);
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00', 'Asia/Jakarta'));

    $this->owner = User::factory()->create(['name' => 'Nadia Pemilik']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'visibility' => WorkspaceVisibility::Private]);
    addMember($this->workspace, $this->owner, WorkspaceRole::Owner);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->outsider = User::factory()->create(['name' => 'Luar Pintu']);

    $this->note = Note::factory()->in($this->workspace)->by($this->member)->create([
        'title' => 'SOP penerimaan',
        'content' => dokumenCatatan('Cocokkan surat jalan'),
        'content_text' => 'Cocokkan surat jalan',
    ]);
    $this->folder = Note::factory()->in($this->workspace)->by($this->owner)->folder()->create(['title' => 'Arsip 2026']);
    $this->restricted = Note::factory()->in($this->workspace)->by($this->owner)->restricted()->create(['title' => 'Rahasia owner']);
    $this->outsideNote = Note::factory()->in(app(EnsurePersonalWorkspace::class)->handle($this->outsider))->by($this->outsider)->create();
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukCatatan(string $email): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * Calls as a (different) token: drop the cached guards first (see
 * AuthApiTest::sebagaiToken) so the second token really authenticates.
 */
function sebagaiTokenCatatan(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('a member lists the workspace notes with author names, folders first', function () {
    $token = masukCatatan($this->member->email);

    $response = $this->withToken($token)->getJson('/api/v1/workspace/OPS/catatan');

    $response->assertOk()
        ->assertJsonPath('workspace.key', 'OPS')
        ->assertJsonPath('can_create', true)
        ->assertJsonCount(2, 'notes')
        ->assertJsonPath('notes.0.id', $this->folder->id)
        ->assertJsonPath('notes.0.kind', 'folder')
        ->assertJsonPath('notes.0.penulis', 'Nadia Pemilik')
        ->assertJsonPath('notes.1.id', $this->note->id)
        ->assertJsonPath('notes.1.title', 'SOP penerimaan')
        ->assertJsonPath('notes.1.penulis', $this->member->name)
        ->assertJsonPath('notes.1.updated_at', fn (string $value): bool => $value !== '');

    // Catatan restricted orang lain dan catatan pribadi orang luar tak tampak.
    $ids = collect($response->json('notes'))->pluck('id');

    expect($ids)->not->toContain($this->restricted->id);

    $this->withToken($token)->getJson('/api/v1/workspace/'.app(EnsurePersonalWorkspace::class)->handle($this->outsider)->id.'/catatan')
        ->assertNotFound();

    // Anggota viewer boleh membaca daftar, tapi tidak boleh membuat.
    $viewer = masukCatatan($this->viewer->email);

    sebagaiTokenCatatan($viewer)->getJson('/api/v1/workspace/OPS/catatan')
        ->assertOk()->assertJsonPath('can_create', false);
});

test('a member creates an empty note through the web action', function () {
    $token = masukCatatan($this->member->email);

    $this->withToken($token)->postJson('/api/v1/workspace/OPS/catatan', ['title' => '  Daftar tugas divisi  '])
        ->assertCreated()
        ->assertJsonPath('note.kind', 'note')
        ->assertJsonPath('note.title', 'Daftar tugas divisi')
        ->assertJsonPath('note.body_html', '')
        ->assertJsonPath('note.body_text', '')
        ->assertJsonPath('note.can_edit', true);

    expect(Note::query()->where('workspace_id', $this->workspace->id)->count())->toBe(4);

    // Anggota viewer tidak boleh membuat; judul wajib.
    $viewer = masukCatatan($this->viewer->email);

    sebagaiTokenCatatan($viewer)->postJson('/api/v1/workspace/OPS/catatan', ['title' => 'Coba'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak dapat membuat catatan di workspace ini.');

    $this->withToken($token)->postJson('/api/v1/workspace/OPS/catatan', ['title' => ''])
        ->assertUnprocessable()
        ->assertJsonPath('errors.title.0', 'Judul wajib diisi.');
});

test('the detail answers the last version as body_html and keeps folders bodyless', function () {
    $token = masukCatatan($this->member->email);

    $this->withToken($token)->getJson("/api/v1/catatan/{$this->note->id}")
        ->assertOk()
        ->assertJsonPath('note.id', $this->note->id)
        ->assertJsonPath('note.title', 'SOP penerimaan')
        ->assertJsonPath('note.body_html', '<p>Cocokkan surat jalan</p>')
        ->assertJsonPath('note.body_text', 'Cocokkan surat jalan')
        ->assertJsonPath('note.can_edit', true)
        ->assertJsonMissingPath('note.content');

    // Folder tidak berisi; dokumen Tiptap mentah tidak pernah dikirim.
    $this->withToken($token)->getJson("/api/v1/catatan/{$this->folder->id}")
        ->assertOk()
        ->assertJsonPath('note.kind', 'folder')
        ->assertJsonPath('note.body_html', null);

    // Restricted orang lain → 404; pribadi orang luar → 404.
    $this->withToken($token)->getJson("/api/v1/catatan/{$this->restricted->id}")->assertNotFound();
    $this->withToken($token)->getJson("/api/v1/catatan/{$this->outsideNote->id}")->assertNotFound();
});

test('body_html saves a new version and keeps the previous one', function () {
    $token = masukCatatan($this->member->email);

    $response = $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", [
        'body_html' => '<h2>SOP penerimaan v2</h2><p>Cocokkan surat jalan <strong>dan</strong> faktur.</p>',
        'updated_at' => $this->note->updated_at->toIso8601String(),
    ]);

    $response->assertOk()
        ->assertJsonPath('note.title', 'SOP penerimaan')
        ->assertJsonPath('note.body_html', '<h2>SOP penerimaan v2</h2><p>Cocokkan surat jalan <strong>dan</strong> faktur.</p>')
        ->assertJsonPath('note.body_text', "SOP penerimaan v2\nCocokkan surat jalan dan faktur.")
        ->assertJsonPath('note.can_edit', true);

    $fresh = $this->note->fresh();

    expect($fresh->updated_by)->toBe($this->member->id)
        ->and($fresh->content['content'][0]['type'])->toBe('heading');

    // Versi sebelumnya tersimpan (StoreNoteState), berisi teks lama.
    $version = NoteVersion::query()->where('note_id', $this->note->id)->first();

    expect($version)->not->toBeNull()
        ->and($version->content['content'][0]['content'][0]['text'] ?? null)->toBe('Cocokkan surat jalan');

    // HTML asing (iframe/script) terdegradasi jadi teks, bukan node asing.
    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", [
        'body_html' => '<p>Aman</p><script>alert(1)</script><iframe src="https://jaha.t"></iframe>',
        'updated_at' => $fresh->updated_at->toIso8601String(),
    ])->assertOk()->assertJsonPath('note.body_html', '<p>Aman</p>');
});

test('a save on an older version conflicts with the same 409 body as the web', function () {
    $token = masukCatatan($this->member->email);

    // Waktu test dimajukan dulu supaya penyimpanan pertama benar-benar
    // memajukan updated_at melewati waktu pembuatan catatan.
    $this->travel(1)->minutes();

    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", [
        'body_html' => '<p>Revisi rekan</p>',
        'updated_at' => $this->note->updated_at->toIso8601String(),
    ])->assertOk();

    // Penyimpanan berdasarkan versi lama (waktu pembuatan) ditolak 409.
    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", [
        'body_html' => '<p>Revisi lawas</p>',
        'updated_at' => $this->note->updated_at->toIso8601String(),
    ])->assertStatus(409)
        ->assertJsonPath('message', 'Catatan ini baru saja diubah orang lain. Muat ulang untuk melihat versi terbaru sebelum menyimpan.');

    // Setelah memuat ulang (updated_at baru), penyimpanan berhasil.
    $fresh = $this->note->fresh();

    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", [
        'body_html' => '<p>Revisi lawas</p>',
        'updated_at' => $fresh->updated_at->toIso8601String(),
    ])->assertOk()->assertJsonPath('note.body_html', '<p>Revisi lawas</p>');
});

test('title renames and validation keeps the contract strict', function () {
    $token = masukCatatan($this->member->email);

    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", ['title' => 'SOP penerimaan barang'])
        ->assertOk()
        ->assertJsonPath('note.title', 'SOP penerimaan barang');

    expect($this->note->fresh()->updated_by)->toBe($this->member->id);

    // body_html tanpa updated_at ditolak; title + body_html sekaligus juga.
    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", ['body_html' => '<p>X</p>'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.updated_at.0', 'Kirim updated_at dasar penyimpanan (dari GET /catatan/{note}).');

    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", [
        'title' => 'X',
        'body_html' => '<p>Y</p>',
        'updated_at' => $this->note->updated_at->toIso8601String(),
    ])->assertUnprocessable()
        ->assertJsonPath('errors.title.0', 'Kirim title atau body_html, jangan keduanya.');

    // Anggota viewer hanya membaca.
    $viewer = masukCatatan($this->viewer->email);

    sebagaiTokenCatatan($viewer)->patchJson("/api/v1/catatan/{$this->note->id}", ['title' => 'Boleh?'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda hanya dapat membaca catatan ini.');
});

test('the notes flag off answers 404 like the web', function () {
    config(['features.notes' => false]);

    $token = masukCatatan($this->member->email);

    $this->withToken($token)->getJson('/api/v1/workspace/OPS/catatan')->assertNotFound();
    $this->withToken($token)->postJson('/api/v1/workspace/OPS/catatan', ['title' => 'X'])->assertNotFound();
    $this->withToken($token)->getJson("/api/v1/catatan/{$this->note->id}")->assertNotFound();
    $this->withToken($token)->patchJson("/api/v1/catatan/{$this->note->id}", ['title' => 'X'])->assertNotFound();
});

test('note endpoints reject requests without a token', function () {
    $this->getJson('/api/v1/workspace/OPS/catatan')->assertUnauthorized();
    $this->postJson('/api/v1/workspace/OPS/catatan', ['title' => 'X'])->assertUnauthorized();
    $this->getJson("/api/v1/catatan/{$this->note->id}")->assertUnauthorized();
    $this->patchJson("/api/v1/catatan/{$this->note->id}", ['title' => 'X'])->assertUnauthorized();
});

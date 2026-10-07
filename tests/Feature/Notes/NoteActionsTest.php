<?php

use App\Domain\Notes\Actions\CreateNote;
use App\Domain\Notes\Actions\DeleteNote;
use App\Domain\Notes\Actions\MoveNote;
use App\Domain\Notes\Actions\RenameNote;
use App\Domain\Notes\Actions\RestoreNoteVersion;
use App\Domain\Notes\Actions\SaveNoteContent;
use App\Domain\Notes\Actions\StoreNoteState;
use App\Domain\Notes\Actions\UpdateNoteShare;
use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Notes\Enums\NoteShareRole;
use App\Domain\Notes\Notifications\NoteMentionNotification;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Mention;
use App\Models\Note;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

require_once __DIR__.'/../../Support/workspace-helpers.php';

const COLLAB_TEST_SECRET = 'notes-test-secret-notes-test-secret-1234';

function doc(string ...$paragraphs): array
{
    return ['type' => 'doc', 'content' => array_map(
        fn (string $text): array => ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]],
        $paragraphs,
    )];
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-12 09:00', 'Asia/Jakarta'));
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'visibility' => WorkspaceVisibility::Private]);
    $this->editor = memberWithRole($this->workspace, WorkspaceRole::Member);
    config(['collab.secret' => '', 'collab.url' => 'http://collab.test']);
});

it('creates notes and folders at the end of their siblings', function () {
    $create = app(CreateNote::class);
    $folder = $create->handle($this->editor, $this->workspace, ['title' => '  SOP  ', 'kind' => 'folder']);
    $first = $create->handle($this->editor, $this->workspace, ['title' => 'Satu', 'parent_id' => $folder->id]);
    $second = $create->handle($this->editor, $this->workspace, ['title' => '', 'parent_id' => $folder->id]);
    $sub = $create->handle($this->editor, $this->workspace, ['title' => 'Sub', 'parent_id' => $first->id]);

    expect($folder->kind)->toBe(NoteKind::Folder)
        ->and($folder->title)->toBe('SOP')
        ->and($second->title)->toBe('Tanpa judul')
        ->and($second->position > $first->position)->toBeTrue()
        ->and($sub->parent_id)->toBe($first->id)
        ->and($first->access)->toBe(NoteAccess::Workspace)
        ->and($first->created_by)->toBe($this->editor->id);
});

it('keeps folders out of notes and parents inside the workspace', function () {
    $create = app(CreateNote::class);
    $note = Note::factory()->in($this->workspace)->create();
    $elsewhere = Note::factory()->folder()->in(Workspace::factory()->ownedBy($this->owner)->create())->create();

    expect(fn () => $create->handle($this->editor, $this->workspace, ['title' => 'F', 'kind' => 'folder', 'parent_id' => $note->id]))
        ->toThrow(ValidationException::class, 'Folder hanya bisa berada di akar atau di dalam folder lain.')
        ->and(fn () => $create->handle($this->editor, $this->workspace, ['title' => 'N', 'parent_id' => $elsewhere->id]))
        ->toThrow(ValidationException::class);
});

it('renames a note and keeps a blank title readable', function () {
    $note = Note::factory()->in($this->workspace)->create(['title' => 'Lama']);

    app(RenameNote::class)->handle($note, $this->editor, '  Baru   sekali ');
    expect($note->fresh()->title)->toBe('Baru sekali')->and($note->fresh()->updated_by)->toBe($this->editor->id);

    app(RenameNote::class)->handle($note, $this->editor, '   ');
    expect($note->fresh()->title)->toBe('Tanpa judul');
});

it('moves notes and refuses cycles', function () {
    $folder = Note::factory()->folder()->in($this->workspace)->create();
    $parent = Note::factory()->in($this->workspace)->create();
    $child = Note::factory()->childOf($parent)->create();
    $grandchild = Note::factory()->childOf($child)->create();
    $move = app(MoveNote::class);

    $move->handle($parent, $this->editor, $folder->id);
    expect($parent->fresh()->parent_id)->toBe($folder->id);

    expect(fn () => $move->handle($parent->fresh(), $this->editor, $grandchild->id))
        ->toThrow(ValidationException::class, 'Catatan tidak bisa dipindahkan ke dalam dirinya sendiri atau sub-catatannya.')
        ->and(fn () => $move->handle($parent->fresh(), $this->editor, $parent->id))
        ->toThrow(ValidationException::class)
        ->and(fn () => $move->handle($folder, $this->editor, $parent->id))
        ->toThrow(ValidationException::class, 'Folder hanya bisa berada di akar atau di dalam folder lain.');

    $move->handle($grandchild, $this->editor, null);
    expect($grandchild->fresh()->parent_id)->toBeNull();
});

it('deletes softly and lifts the children to the parent', function () {
    $folder = Note::factory()->folder()->in($this->workspace)->create();
    $note = Note::factory()->childOf($folder)->create();
    $child = Note::factory()->childOf($note)->create();

    app(DeleteNote::class)->handle($note, $this->editor);

    expect(Note::query()->find($note->id))->toBeNull()
        ->and(Note::withTrashed()->find($note->id))->not->toBeNull()
        ->and($child->fresh()->parent_id)->toBe($folder->id);
});

it('updates sharing, writes the audit log and asks the collab server to reconnect', function () {
    config(['collab.secret' => COLLAB_TEST_SECRET]);
    Http::fake(['collab.test/*' => Http::response(['loaded' => true])]);
    $note = Note::factory()->in($this->workspace)->by($this->editor)->create();
    $guest = User::factory()->create();

    app(UpdateNoteShare::class)->handle($note, $this->editor, NoteAccess::Restricted, [
        ['user_id' => $guest->id, 'role' => 'edit'],
    ]);

    expect($note->fresh()->access)->toBe(NoteAccess::Restricted)
        ->and($note->shares()->sole()->role)->toBe(NoteShareRole::Edit);

    $audit = AuditLog::query()->where('action', 'note.share_updated')->sole();
    expect($audit->old_values)->toBe(['access' => 'workspace', 'people' => []])
        ->and($audit->new_values)->toBe(['access' => 'restricted', 'people' => [$guest->id => 'edit']]);

    Http::assertSent(fn (HttpRequest $request) => $request->url() === "http://collab.test/internal/documents/{$note->id}/reconnect"
        && $request->hasHeader('Authorization', 'Bearer '.COLLAB_TEST_SECRET));

    // Removing everyone again.
    app(UpdateNoteShare::class)->handle($note, $this->editor, NoteAccess::Workspace, []);
    expect($note->shares()->count())->toBe(0)->and(AuditLog::query()->where('action', 'note.share_updated')->count())->toBe(2);
});

it('refuses to invite someone from another company or inactive', function () {
    $note = Note::factory()->in($this->workspace)->by($this->editor)->create();
    $foreign = User::factory()->create(['company_id' => Company::factory()->create()->id]);

    expect(fn () => app(UpdateNoteShare::class)->handle($note, $this->editor, NoteAccess::Restricted, [['user_id' => $foreign->id, 'role' => 'view']]))
        ->toThrow(ValidationException::class);
});

it('stores sanitized state and keeps a version every 5 minutes of editing', function () {
    $note = Note::factory()->in($this->workspace)->create(['content' => doc('Awal'), 'content_text' => 'Awal']);
    $store = app(StoreNoteState::class);
    $dirty = ['type' => 'doc', 'content' => [
        ['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => 'Satu '],
            ['type' => 'text', 'text' => 'tautan', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]],
        ]],
        ['type' => 'script', 'content' => [['type' => 'text', 'text' => 'x']]],
    ]];

    $store->handle($note, "\x00\x01yjs", $dirty, $this->editor);
    $note->refresh();

    expect($note->content)->toEqual(['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Satu '], ['type' => 'text', 'text' => 'tautan']]]]])
        ->and($note->content_text)->toBe('Satu tautan')
        ->and($note->yjs_state)->toBe("\x00\x01yjs")
        ->and($note->updated_by)->toBe($this->editor->id)
        ->and(NoteVersion::query()->where('note_id', $note->id)->count())->toBe(1);

    // Within 5 minutes of that version: no new one.
    $this->travel(2)->minutes();
    $store->handle($note, 'yjs-2', doc('Dua'), $this->editor);
    expect(NoteVersion::query()->where('note_id', $note->id)->count())->toBe(1);

    // Same content again: updated_at does not move.
    $before = $note->fresh()->updated_at;
    $this->travel(1)->minutes();
    $store->handle($note->fresh(), 'yjs-3', doc('Dua'), $this->editor);
    expect($note->fresh()->updated_at->equalTo($before))->toBeTrue()
        ->and($note->fresh()->yjs_state)->toBe('yjs-3');

    $this->travel(10)->minutes();
    $store->handle($note->fresh(), 'yjs-4', doc('Tiga'), $this->editor);
    $versions = NoteVersion::query()->where('note_id', $note->id)->orderBy('created_at')->get();

    expect($versions)->toHaveCount(2)
        ->and($versions->last()->content)->toEqual(doc('Dua'));
});

it('refuses content for a folder and oversized documents', function () {
    $folder = Note::factory()->folder()->in($this->workspace)->create();
    $note = Note::factory()->in($this->workspace)->create();

    expect(fn () => app(StoreNoteState::class)->handle($folder, 'x', doc('a'), $this->editor))->toThrow(ValidationException::class)
        ->and(fn () => app(StoreNoteState::class)->handle($note, 'x', ['type' => 'paragraph'], $this->editor))->toThrow(ValidationException::class, 'Format catatan tidak valid.');
});

it('keeps mentions only for people who can open the note and notifies them once', function () {
    Notification::fake();
    $note = Note::factory()->in($this->workspace)->by($this->editor)->create();
    $member = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $outsider = User::factory()->create();
    $mention = fn (User $user) => ['type' => 'mention', 'attrs' => ['id' => $user->id, 'label' => 'Nama palsu']];
    $content = ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [$mention($member), ['type' => 'text', 'text' => ' dan '], $mention($outsider)]]]];

    app(StoreNoteState::class)->handle($note, 'y', $content, $this->editor);
    app(StoreNoteState::class)->handle($note->fresh(), 'y2', [...$content, 'content' => [...$content['content'], ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'lagi']]]]], $this->editor);

    expect($note->fresh()->content['content'][0]['content'][0]['attrs']['label'])->toBe($member->name)
        ->and($note->fresh()->content['content'][0]['content'][2])->toEqual(['type' => 'text', 'text' => '@Nama palsu'])
        ->and(Mention::query()->where('mentionable_id', $note->id)->pluck('mentioned_user_id')->all())->toBe([$member->id]);

    Notification::assertSentToTimes($member, NoteMentionNotification::class, 1);
    Notification::assertNotSentTo($outsider, NoteMentionNotification::class);
});

it('saves without collaboration only from the latest version', function () {
    config(['collab.secret' => COLLAB_TEST_SECRET]);
    Http::fake(['collab.test/*' => Http::response(['loaded' => false])]);
    $note = Note::factory()->in($this->workspace)->create(['yjs_state' => 'old']);
    $base = $note->updated_at->toIso8601String();
    $this->travel(1)->minutes();

    app(SaveNoteContent::class)->handle($note, $this->editor, doc('Baru'), $base);

    expect($note->fresh()->content)->toEqual(doc('Baru'))
        ->and($note->fresh()->yjs_state)->toBeNull();
    Http::assertSent(fn (HttpRequest $request) => str_ends_with($request->url(), '/replace') && $request['content'] === doc('Baru'));

    $this->travel(1)->minutes();
    expect(fn () => app(SaveNoteContent::class)->handle($note->fresh(), $this->editor, doc('Basi'), $base))
        ->toThrow(HttpResponseException::class);
    expect($note->fresh()->content)->toEqual(doc('Baru'));
});

it('restores a version, keeps the current state and tells the collab server', function () {
    config(['collab.secret' => COLLAB_TEST_SECRET]);
    Http::fake(['collab.test/*' => Http::response(['loaded' => true])]);
    $note = Note::factory()->in($this->workspace)->create(['title' => 'Sekarang', 'content' => doc('Isi sekarang'), 'yjs_state' => 'state']);
    $old = NoteVersion::factory()->of($note)->create(['title' => 'Dulu', 'content' => doc('Isi dulu'), 'created_at' => now()->subDay()]);

    app(RestoreNoteVersion::class)->handle($note, $old, $this->editor);
    $note->refresh();
    $versions = NoteVersion::query()->where('note_id', $note->id)->orderBy('created_at')->orderBy('id')->get();

    expect($note->title)->toBe('Dulu')
        ->and($note->content)->toEqual(doc('Isi dulu'))
        ->and($note->content_text)->toBe('Isi dulu')
        ->and($note->yjs_state)->toBeNull()
        ->and($versions)->toHaveCount(3)
        ->and($versions[1]->content)->toEqual(doc('Isi sekarang'))
        ->and($versions[2]->label)->toStartWith('Dipulihkan dari versi');

    Http::assertSent(fn (HttpRequest $request) => $request->url() === "http://collab.test/internal/documents/{$note->id}/replace"
        && $request['content'] === doc('Isi dulu'));
});

it('refuses a version of another note', function () {
    $note = Note::factory()->in($this->workspace)->create();
    $other = NoteVersion::factory()->create();

    expect(fn () => app(RestoreNoteVersion::class)->handle($note, $other, $this->editor))->toThrow(ValidationException::class);
});

it('restores even when the collab server is down', function () {
    config(['collab.secret' => COLLAB_TEST_SECRET]);
    Http::fake(fn () => throw new ConnectionException('down'));
    $note = Note::factory()->in($this->workspace)->create(['content' => doc('Sekarang')]);
    $old = NoteVersion::factory()->of($note)->create(['content' => doc('Dulu'), 'created_at' => now()->subDay()]);

    app(RestoreNoteVersion::class)->handle($note, $old, $this->editor);

    expect($note->fresh()->content)->toEqual(doc('Dulu'));
});

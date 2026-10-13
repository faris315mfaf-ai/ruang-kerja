<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Notifications\MentionNotification;
use App\Domain\Tasks\Notifications\TaskCommentedNotification;
use App\Domain\Tasks\Services\CommentDocument;
use App\Domain\Tasks\Services\RichText;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Comment;
use App\Models\Mention;
use App\Models\Reaction;
use App\Models\TaskCommentRead;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\TaskPolicy;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — B3-A1 rich comments: mentions and #rujukan built server-side into
| the web's Tiptap document, edit/delete of one's own comment, explicit
| reactions, the read pointer ("Dibaca oleh") and the @ / # pickers.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-13 09:00', 'Asia/Jakarta'));
    Notification::fake();

    $this->lead = User::factory()->create(['name' => 'Dimas Pemimpin']);
    $this->sari = User::factory()->create(['name' => 'Sari Staf']);
    $this->maya = User::factory()->create(['name' => 'Maya Lestari']);
    $this->admin = User::factory()->create(['name' => 'Beni Admin']);
    $this->direksi = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Direksi']);
    $this->stranger = User::factory()->create(['name' => 'Orang Luar']);

    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMS']);
    $this->other = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'OPS']);
    foreach ([$this->sari, $this->maya] as $member) {
        addMember($this->team, $member);
    }
    addMember($this->team, $this->admin, WorkspaceRole::Admin);
    addMember($this->other, $this->sari);

    $this->task = app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Susun anggaran', 'assignee_ids' => [$this->sari->id]]);
    $this->ref = app(CreateTask::class)->handle($this->other, $this->lead, ['title' => 'Cek stok gudang']);
    $this->hidden = app(CreateTask::class)->handle(app(EnsurePersonalWorkspace::class)->handle($this->stranger), $this->stranger, ['title' => 'Rahasia']);

    Sanctum::actingAs($this->sari);
});

// ------------------------------------------------------------- the document

test('the builder turns picked people and tasks into the web nodes', function () {
    $doc = CommentDocument::build("Halo @Maya Lestari, lihat #OPS-1.\nBaris dua", ['m1' => 'Maya Lestari'], ['t1' => 'OPS-1']);

    expect($doc)->toBe(['type' => 'doc', 'content' => [
        ['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => 'Halo '],
            ['type' => 'mention', 'attrs' => ['id' => 'm1', 'label' => 'Maya Lestari']],
            ['type' => 'text', 'text' => ', lihat '],
            ['type' => 'taskReference', 'attrs' => ['id' => 't1', 'label' => 'OPS-1']],
            ['type' => 'text', 'text' => '.'],
        ]],
        ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Baris dua']]],
    ]]);

    // Case-insensitive, longest name first, and a token glued to more letters is plain text.
    $glued = CommentDocument::build('@mayalestari @maya lestari', ['m1' => 'Maya Lestari', 'm2' => 'Maya'], []);
    expect(collect($glued['content'][0]['content'])->where('type', 'mention')->pluck('attrs.id')->all())->toBe(['m1', 'm2']);

    // A picked person whose token vanished from the text is appended, not dropped.
    $appended = CommentDocument::build('Tanpa sebutan', ['m1' => 'Maya Lestari'], ['t1' => 'OPS-1']);
    expect(RichText::toText($appended))->toBe('Tanpa sebutan @Maya Lestari OPS-1');

    expect(CommentDocument::build('  ', [], []))->toBeNull();
});

// ---------------------------------------------------------------- posting

test('a comment with mentions and references is stored as the web document and notifies', function () {
    $response = $this->postJson("/api/v1/tugas/{$this->task->id}/komentar", [
        'body' => "Halo @Maya Lestari, cek #OPS-{$this->ref->number} dulu.",
        'mentions' => [$this->maya->id],
        'task_refs' => [$this->ref->id],
    ])->assertCreated()
        ->assertJsonPath('comment.mine', true)
        ->assertJsonPath('comment.can.edit', true)
        ->assertJsonPath('comment.can.delete', true)
        ->assertJsonPath('comment.can.react', true)
        ->assertJsonPath('comment.body_text', "Halo @Maya Lestari, cek OPS-{$this->ref->number} dulu.");

    $nodes = collect($response->json('comment.body.content.0.content'));
    expect($nodes->where('type', 'mention')->first()['attrs'])->toBe(['id' => $this->maya->id, 'label' => 'Maya Lestari'])
        ->and($nodes->where('type', 'taskReference')->first()['attrs']['id'])->toBe($this->ref->id)
        ->and($response->json('comment.body_html'))->toContain('data-id="'.$this->maya->id.'"');

    expect(Mention::query()->where('mentioned_user_id', $this->maya->id)->count())->toBe(1);
    Notification::assertSentTo($this->maya, MentionNotification::class);
});

test('a mention of someone who cannot see the task, or a task I cannot see, stays plain text', function () {
    $response = $this->postJson("/api/v1/tugas/{$this->task->id}/komentar", [
        'body' => 'Halo @Orang Luar, lihat #WXYZ-1',
        'mentions' => [$this->stranger->id],
        'task_refs' => [$this->hidden->id],
    ])->assertCreated();

    $types = collect($response->json('comment.body.content.0.content'))->pluck('type')->unique()->values()->all();
    expect($types)->toBe(['text'])
        ->and($response->json('comment.body_text'))->toBe('Halo @Orang Luar, lihat #WXYZ-1')
        ->and(Mention::query()->count())->toBe(0);
    Notification::assertNotSentTo($this->stranger, MentionNotification::class);
});

test('plain text alone still works and other watchers are notified', function () {
    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar", ['body' => "Baris satu\nBaris dua"])->assertCreated()
        ->assertJsonPath('comment.body_text', "Baris satu\nBaris dua");

    Notification::assertSentTo($this->lead, TaskCommentedNotification::class);
    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar", ['body' => ''])->assertUnprocessable()
        ->assertJsonPath('errors.body.0', 'Komentar tidak boleh kosong.');
    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar", ['body' => 'x', 'mentions' => ['bukan-ulid']])->assertUnprocessable()->assertJsonValidationErrors('mentions.0');
});

test('view-only management cannot comment and an unseen task is a 404', function () {
    Sanctum::actingAs($this->direksi);
    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar", ['body' => 'Halo'])->assertForbidden();
    $this->postJson("/api/v1/tugas/{$this->hidden->id}/komentar", ['body' => 'Halo'])->assertNotFound();
});

// -------------------------------------------------------------- list & edit

test('the list carries body_html, mine, my reactions and the per-comment rights', function () {
    $mine = app(PostComment::class)->handle($this->task, $this->sari, (array) RichText::fromText('Komentar saya'));
    $theirs = app(PostComment::class)->handle($this->task, $this->maya, (array) RichText::fromText('Komentar Maya'));
    $this->postJson("/api/v1/komentar/{$theirs->id}/reaksi", ['emoji' => '👍'])->assertOk();

    $response = $this->getJson("/api/v1/tugas/{$this->task->id}/komentar")->assertOk()
        ->assertJsonPath('can', ['comment' => true, 'moderate' => false]);
    $rows = collect($response->json('comments'))->keyBy('id');

    expect($rows[$mine->id])->toMatchArray(['mine' => true, 'body_html' => '<p>Komentar saya</p>'])
        ->and($rows[$mine->id]['can'])->toBe(['edit' => true, 'delete' => true, 'react' => true])
        ->and($rows[$theirs->id]['mine'])->toBeFalse()
        ->and($rows[$theirs->id]['can'])->toBe(['edit' => false, 'delete' => false, 'react' => true])
        ->and($rows[$theirs->id]['my_reactions'])->toBe(['👍'])
        ->and($rows[$theirs->id]['reactions'][0])->toMatchArray(['emoji' => '👍', 'count' => 1]);

    Sanctum::actingAs($this->admin);
    $admin = collect($this->getJson("/api/v1/tugas/{$this->task->id}/komentar")->assertOk()->json('comments'))->keyBy('id');
    expect($admin[$theirs->id]['can'])->toBe(['edit' => false, 'delete' => true, 'react' => true]);
});

test('I edit my own comment and the mentions are rebuilt; others cannot', function () {
    $comment = app(PostComment::class)->handle($this->task, $this->sari, (array) RichText::fromText('Awal'));

    $this->patchJson("/api/v1/komentar/{$comment->id}", [
        'body' => 'Revisi untuk @Maya Lestari',
        'mentions' => [$this->maya->id],
    ])->assertOk()
        ->assertJsonPath('comment.body_text', 'Revisi untuk @Maya Lestari')
        ->assertJsonPath('comment.edited_at', fn ($at) => is_string($at));

    expect(Mention::query()->where('mentioned_user_id', $this->maya->id)->count())->toBe(1);

    Sanctum::actingAs($this->maya);
    $this->patchJson("/api/v1/komentar/{$comment->id}", ['body' => 'Curian'])->assertForbidden();

    Sanctum::actingAs($this->stranger);
    $this->patchJson("/api/v1/komentar/{$comment->id}", ['body' => 'Curian'])->assertNotFound();
    expect($comment->fresh()->body_text)->toBe('Revisi untuk @Maya Lestari');
});

test('delete leaves a tombstone: the author and a workspace admin may, a bystander may not', function () {
    $mine = app(PostComment::class)->handle($this->task, $this->sari, (array) RichText::fromText('Hapus saya'));
    $other = app(PostComment::class)->handle($this->task, $this->maya, (array) RichText::fromText('Milik Maya'));

    $this->deleteJson("/api/v1/komentar/{$other->id}")->assertForbidden();

    $this->deleteJson("/api/v1/komentar/{$mine->id}")->assertOk()
        ->assertJsonPath('comment.deleted', true)
        ->assertJsonPath('comment.body', null)
        ->assertJsonPath('comment.body_html', null)
        ->assertJsonPath('comment.can', ['edit' => false, 'delete' => false, 'react' => false]);
    $this->patchJson("/api/v1/komentar/{$mine->id}", ['body' => 'Bangkit'])->assertNotFound();

    Sanctum::actingAs($this->admin);
    $this->deleteJson("/api/v1/komentar/{$other->id}")->assertOk()->assertJsonPath('comment.deleted', true);

    // The tombstones stay in the timeline.
    $rows = collect($this->getJson("/api/v1/tugas/{$this->task->id}/komentar")->json('comments'));
    expect($rows->where('deleted', true))->toHaveCount(2);
});

// ----------------------------------------------------------------- reactions

test('reactions are set and cleared explicitly, so a retry never flips them', function () {
    $comment = app(PostComment::class)->handle($this->task, $this->maya, (array) RichText::fromText('Bagus'));
    $url = "/api/v1/komentar/{$comment->id}/reaksi";

    $this->postJson($url, ['emoji' => '🎉'])->assertOk()->assertJsonPath('active', true)->assertJsonPath('comment.my_reactions', ['🎉']);
    $this->postJson($url, ['emoji' => '🎉'])->assertOk()->assertJsonPath('active', true)->assertJsonPath('comment.reactions.0.count', 1);
    expect(Reaction::query()->where('reactable_id', $comment->id)->count())->toBe(1);

    $this->deleteJson($url, ['emoji' => '🎉'])->assertOk()->assertJsonPath('active', false)->assertJsonPath('comment.reactions', []);
    $this->deleteJson($url.'?emoji=🎉')->assertOk()->assertJsonPath('active', false);

    $this->postJson($url, ['emoji' => '💩'])->assertUnprocessable()->assertJsonPath('errors.emoji.0', 'Reaksi tidak tersedia.');
    $this->postJson($url, [])->assertUnprocessable();

    Sanctum::actingAs($this->direksi);
    $this->postJson($url, ['emoji' => '👍'])->assertForbidden();
    Sanctum::actingAs($this->stranger);
    $this->postJson($url, ['emoji' => '👍'])->assertNotFound();
});

// --------------------------------------------------------------------- reads

test('the read pointer moves forward and "Dibaca oleh" lists who follows the discussion', function () {
    $first = app(PostComment::class)->handle($this->task, $this->maya, (array) RichText::fromText('Satu'));
    $second = app(PostComment::class)->handle($this->task, $this->maya, (array) RichText::fromText('Dua'));

    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar/dibaca", ['comment_id' => $second->id])->assertOk()
        ->assertJsonPath('read.user.id', $this->sari->id)
        ->assertJsonPath('read.last_read_comment_id', $second->id);
    // Never backwards.
    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar/dibaca", ['comment_id' => $first->id])->assertOk()
        ->assertJsonPath('read.last_read_comment_id', $second->id);

    $readers = $this->getJson("/api/v1/tugas/{$this->task->id}/dibaca-oleh")->assertOk()->assertJsonPath('tracking', true);
    expect(collect($readers->json('readers'))->pluck('user.id')->all())->toBe([$this->sari->id])
        ->and(TaskCommentRead::query()->where('task_id', $this->task->id)->count())->toBe(1);

    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar/dibaca", ['comment_id' => $this->hidden->id])->assertUnprocessable();
});

test('view-only management is neither recorded nor listed as a reader', function () {
    $comment = app(PostComment::class)->handle($this->task, $this->maya, (array) RichText::fromText('Satu'));

    Sanctum::actingAs($this->direksi);
    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar/dibaca", [])->assertForbidden()
        ->assertJsonPath('message', TaskPolicy::VIEW_ONLY);
    $this->getJson("/api/v1/tugas/{$this->task->id}/dibaca-oleh")->assertOk()->assertJsonPath('tracking', false)->assertJsonPath('readers', []);

    Sanctum::actingAs($this->maya);
    $this->postJson("/api/v1/tugas/{$this->task->id}/komentar/dibaca", [])->assertOk();
    Sanctum::actingAs($this->direksi);
    expect(collect($this->getJson("/api/v1/tugas/{$this->task->id}/dibaca-oleh")->json('readers'))->pluck('user.id')->all())->toBe([$this->maya->id]);
    expect($comment->exists)->toBeTrue();
});

// ------------------------------------------------------------------- pickers

test('the @ picker lists the people who can see the task, filtered by name', function () {
    $all = collect($this->getJson("/api/v1/tugas/{$this->task->id}/mention")->assertOk()->json('people'))->pluck('name')->all();
    expect($all)->toBe(['Beni Admin', 'Dimas Pemimpin', 'Maya Lestari', 'Sari Staf']);

    expect(collect($this->getJson("/api/v1/tugas/{$this->task->id}/mention?q=may")->json('people'))->pluck('name')->all())->toBe(['Maya Lestari']);
    expect($this->getJson("/api/v1/tugas/{$this->task->id}/mention?limit=2")->json('people'))->toHaveCount(2);
    $this->getJson("/api/v1/tugas/{$this->hidden->id}/mention")->assertNotFound();
    $this->getJson("/api/v1/tugas/{$this->task->id}/mention?limit=99")->assertUnprocessable();
});

test('the # picker finds visible tasks by key or title and puts the current workspace first', function () {
    $keys = fn (string $query): array => collect($this->getJson("/api/v1/tugas/rujukan?{$query}")->assertOk()->json('tasks'))->pluck('key')->all();

    expect($keys('q=stok'))->toBe(["OPS-{$this->ref->number}"])
        ->and($keys("q=OPS-{$this->ref->number}"))->toBe(["OPS-{$this->ref->number}"])
        ->and($keys('q=rahasia'))->toBe([])
        ->and($keys('q=TMS-'.$this->task->number))->toBe(['TMS-'.$this->task->number]);

    $second = app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Anggaran tambahan']);
    app(CreateTask::class)->handle($this->other, $this->lead, ['title' => 'Anggaran gudang']);
    $both = collect($this->getJson('/api/v1/tugas/rujukan?q=anggaran&workspace=TMS')->json('tasks'));
    expect($both->first()['workspace']['key'])->toBe('TMS')
        ->and($both->pluck('key')->all())->toContain('TMS-'.$second->number);

    // Number alone resolves inside the workspace being written in.
    expect($keys('q='.$this->task->number.'&workspace=TMS'))->toContain('TMS-'.$this->task->number);
    $this->getJson('/api/v1/tugas/rujukan?q=x&workspace='.str_repeat('a', 40))->assertUnprocessable();
});

test('the package routes need a token', function () {
    app('auth')->forgetGuards();
    $id = $this->task->id;

    foreach ([
        ['getJson', '/api/v1/tugas/rencana'],
        ['getJson', '/api/v1/tugas/tampilan'],
        ['getJson', '/api/v1/tugas/rujukan'],
        ['postJson', "/api/v1/tugas/{$id}/checklist"],
        ['getJson', "/api/v1/tugas/{$id}/aktivitas"],
        ['patchJson', '/api/v1/komentar/'.Comment::factory()->on($this->task)->create()->id],
    ] as $call) {
        $this->{$call[0]}($call[1])->assertUnauthorized();
    }
});

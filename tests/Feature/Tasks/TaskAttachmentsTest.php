<?php

use App\Domain\Google\Testing\FakeDriveClient;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\DeleteComment;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Events\Tasks\TaskAttachmentAdded;
use App\Events\Tasks\TaskAttachmentRemoved;
use App\Models\Activity;
use App\Models\Attachment;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Sprint 7 task 7 — Drive attachments in the task detail and on comments
 * (AttachmentController + AttachableTypes 'task'/'comment', timeline
 * activity, realtime broadcast, "Dipakai di tugas"). Google is faked.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('local');
    $this->drive = FakeDriveClient::fake();
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
    $this->root = $this->drive->seedFolder('Proyek Peluncuran Q4 [PLQ]');
    $this->workspace->forceFill(['drive_folder_id' => $this->root->id])->saveQuietly();
    $this->admin = memberWithRole($this->workspace, WorkspaceRole::Admin);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->direksi = User::factory()->withRole(Role::Direksi)->create();
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Landing page produk baru']);
    $this->taskBase = "/lampiran/task/{$this->task->id}";
});

function commentBy(Task $task, User $author, string $text = 'Draf brief terlampir.'): Comment
{
    return app(PostComment::class)->handle($task, $author, richDoc($text));
}

function attachDoc(User $user, string $base, string $name = 'Brief landing page'): Attachment
{
    test()->actingAs($user)->postJson("{$base}/dokumen", ['type' => 'document', 'name' => $name])->assertCreated();

    return Attachment::query()->latest('created_at')->latest('id')->firstOrFail();
}

describe('Task attachments', function () {
    it('records "melampirkan" / "melepas" in the timeline and broadcasts both changes', function () {
        Event::fake([TaskAttachmentAdded::class, TaskAttachmentRemoved::class]);

        $attachment = attachDoc($this->member, $this->taskBase);

        $added = Activity::query()->where('event', ActivityEvent::AttachmentAdded->value)->sole();
        expect($added->subject_id)->toBe($this->task->id)
            ->and($added->causer_id)->toBe($this->member->id)
            ->and($added->properties)->toEqual(['attachment_id' => $attachment->id, 'filename' => 'Brief landing page', 'kind' => 'doc']);

        Event::assertDispatched(TaskAttachmentAdded::class, function (TaskAttachmentAdded $event) use ($attachment): bool {
            return $event->broadcastOn()[0]->name === 'private-workspace.'.$this->workspace->id
                && $event->broadcastAs() === 'attachment.added'
                && $event->broadcastQueue() === 'realtime'
                && $event->broadcastWith() === [
                    'task_id' => $this->task->id,
                    'attachable_type' => 'task',
                    'attachable_id' => $this->task->id,
                    'attachment_id' => $attachment->id,
                    'attachments_count' => 1,
                ];
        });

        $this->actingAs($this->member)->deleteJson("/lampiran/{$attachment->id}")->assertOk()->assertJsonPath('removed', true);

        $removed = Activity::query()->where('event', ActivityEvent::AttachmentRemoved->value)->sole();
        expect($removed->causer_id)->toBe($this->member->id)
            ->and($removed->properties['filename'] ?? null)->toBe('Brief landing page');
        Event::assertDispatched(TaskAttachmentRemoved::class, fn (TaskAttachmentRemoved $event): bool => $event->broadcastAs() === 'attachment.removed'
            && $event->broadcastWith()['attachments_count'] === 0);
    });

    it('does not repeat the activity when the same Drive file is attached twice', function () {
        $picked = $this->drive->seedFile('Kontrak vendor.pdf', 'application/pdf', $this->drive->seedFolder('My Drive')->id);

        $this->actingAs($this->member)->postJson("{$this->taskBase}/drive", ['file_ids' => [$picked->id]])->assertCreated();
        $this->actingAs($this->member)->postJson("{$this->taskBase}/drive", ['file_ids' => [$picked->id]])->assertCreated();

        expect(Activity::query()->where('event', ActivityEvent::AttachmentAdded->value)->count())->toBe(1);
    });

    it('embeds the attachments, their count and the viewer rights in the task detail', function () {
        attachDoc($this->member, $this->taskBase, 'Brief landing page');
        attachDoc($this->member, $this->taskBase, 'Daftar fitur');

        $this->actingAs($this->viewer)->getJson("/tugas/{$this->task->id}")
            ->assertOk()
            ->assertJsonPath('task.attachments_count', 2)
            ->assertJsonPath('attachments.can_edit', false)
            ->assertJsonPath('attachments.drive.enabled', true)
            ->assertJsonPath('attachments.attachments.0.filename', 'Daftar fitur')
            ->assertJsonPath('attachments.attachments.0.can_remove', false)
            ->assertJsonPath('timeline.1.event', 'task.attachment_added');

        $this->actingAs($this->member)->get('/w/PLQ/tasks/'.$this->task->number)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('tasks/show')
                ->where('detail.attachments.can_edit', true)
                ->where('detail.attachments.attachments.1.can_remove', true)
                ->where('detail.task.attachments_count', 2));
    });

    it('lets only users who can edit the task attach or remove', function (string $who, int $list, int $add, int $remove) {
        $attachment = attachDoc($this->member, $this->taskBase);
        $actor = $this->{$who};

        $this->actingAs($actor)->getJson($this->taskBase)->assertStatus($list);
        $this->actingAs($actor)->postJson("{$this->taskBase}/dokumen", ['type' => 'spreadsheet', 'name' => 'Anggaran'])->assertStatus($add);
        $this->actingAs($actor)->postJson("{$this->taskBase}/unggah", ['name' => 'a.pdf', 'size' => 10, 'mime_type' => 'application/pdf'])->assertStatus($add);
        $this->actingAs($actor)->deleteJson("/lampiran/{$attachment->id}")->assertStatus($remove);
    })->with([
        'owner' => ['owner', 200, 201, 200],
        'workspace admin' => ['admin', 200, 201, 200],
        'member' => ['member', 200, 201, 200],
        'viewer' => ['viewer', 200, 403, 403],
        'Direksi (sees every shared workspace, not a member)' => ['direksi', 200, 403, 403],
        'employee outside the private workspace' => ['outsider', 404, 404, 404],
    ]);

    it('lets nobody change attachments of an archived workspace', function () {
        $attachment = attachDoc($this->member, $this->taskBase);
        $this->workspace->forceFill(['archived_at' => now()])->saveQuietly();

        $this->actingAs($this->member)->getJson($this->taskBase)->assertOk()->assertJsonPath('can_edit', false);
        $this->actingAs($this->owner)->postJson("{$this->taskBase}/dokumen", ['type' => 'document', 'name' => 'X'])->assertForbidden();
        $this->actingAs($this->owner)->deleteJson("/lampiran/{$attachment->id}")->assertForbidden();
    });

    it('stops an uploader demoted to viewer from removing their file', function () {
        $attachment = attachDoc($this->member, $this->taskBase);
        addMember($this->workspace, $this->member, WorkspaceRole::Viewer);

        $this->actingAs($this->member)->deleteJson("/lampiran/{$attachment->id}")->assertForbidden();
    });
});

describe('Comment attachments', function () {
    beforeEach(function () {
        $this->comment = commentBy($this->task, $this->member);
        $this->commentBase = "/lampiran/comment/{$this->comment->id}";
    });

    it('attaches to the comment (not the task), shows it under the comment and broadcasts it', function () {
        Event::fake([TaskAttachmentAdded::class]);

        $this->actingAs($this->member)
            ->postJson("{$this->commentBase}/dokumen", ['type' => 'document', 'name' => 'Draf brief'])
            ->assertCreated()
            ->assertJsonPath('attachments.0.filename', 'Draf brief')
            ->assertJsonPath('attachments.0.can_remove', true)
            ->assertJsonPath('can_edit', true);

        $attachment = Attachment::query()->sole();
        expect($attachment->attachable_type)->toBe($this->comment->getMorphClass())
            ->and($attachment->attachable_id)->toBe($this->comment->id)
            // Shown under the comment: no extra timeline entry.
            ->and(Activity::query()->where('event', ActivityEvent::AttachmentAdded->value)->exists())->toBeFalse();

        Event::assertDispatched(TaskAttachmentAdded::class, fn (TaskAttachmentAdded $event): bool => $event->broadcastOn()[0]->name === 'private-workspace.'.$this->workspace->id
            && $event->broadcastWith()['task_id'] === $this->task->id
            && $event->broadcastWith()['attachable_type'] === 'comment'
            && $event->broadcastWith()['attachable_id'] === $this->comment->id
            && $event->broadcastWith()['attachments_count'] === 0);

        $detail = $this->actingAs($this->viewer)->getJson("/tugas/{$this->task->id}")->assertOk()->json();
        $comment = collect($detail['timeline'])->firstWhere('id', $this->comment->id);

        expect($comment['attachments'])->toHaveCount(1)
            ->and($comment['attachments'][0]['drive_file']['kind'])->toBe('doc')
            ->and($detail['task']['attachments_count'])->toBe(0);
    });

    it('uploads into the workspace folder and attaches the file to the comment', function () {
        $session = $this->actingAs($this->member)
            ->postJson("{$this->commentBase}/unggah", ['name' => 'Wireframe v2.pdf', 'size' => 9, 'mime_type' => 'application/pdf'])
            ->assertCreated()
            ->json();

        $session = $this->actingAs($this->member)
            ->post("/unggah/{$session['id']}", [
                'offset' => 0,
                'chunk' => UploadedFile::fake()->createWithContent('blob', 'wireframe'),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->json();

        expect($session['state'])->toBe('done')
            ->and(Attachment::query()->findOrFail($session['attachment_id'])->attachable_id)->toBe($this->comment->id);
    });

    it('follows the comment edit rights: only its author attaches or removes', function (string $who, int $list, int $add, int $remove) {
        $attachment = attachDoc($this->member, $this->commentBase);
        $actor = $this->{$who};

        $this->actingAs($actor)->getJson($this->commentBase)->assertStatus($list);
        $this->actingAs($actor)->postJson("{$this->commentBase}/dokumen", ['type' => 'document', 'name' => 'Lain'])->assertStatus($add);
        $this->actingAs($actor)->deleteJson("/lampiran/{$attachment->id}")->assertStatus($remove);
    })->with([
        'author' => ['member', 200, 201, 200],
        'task owner (not the author)' => ['owner', 200, 403, 403],
        'workspace admin (not the author)' => ['admin', 200, 403, 403],
        'viewer' => ['viewer', 200, 403, 403],
        'outsider' => ['outsider', 404, 404, 404],
    ]);

    it('lets a viewer attach files to their own comment', function () {
        $own = commentBy($this->task, $this->viewer, 'Masukan dari saya.');

        $this->actingAs($this->viewer)
            ->postJson("/lampiran/comment/{$own->id}/dokumen", ['type' => 'document', 'name' => 'Masukan'])
            ->assertCreated();
    });

    it('hides the attachments of a deleted comment', function () {
        $attachment = attachDoc($this->member, $this->commentBase, 'Draf brief');

        app(DeleteComment::class)->handle($this->comment, $this->member);

        $this->actingAs($this->member)->getJson($this->commentBase)->assertNotFound();
        $this->actingAs($this->member)->postJson("{$this->commentBase}/dokumen", ['type' => 'document', 'name' => 'X'])->assertNotFound();
        $this->actingAs($this->member)->deleteJson("/lampiran/{$attachment->id}")->assertNotFound();

        $detail = $this->actingAs($this->member)->getJson("/tugas/{$this->task->id}")->assertOk()->json();
        $comment = collect($detail['timeline'])->firstWhere('id', $this->comment->id);

        expect($comment['deleted'])->toBeTrue()
            ->and($comment['attachments'])->toBe([]);

        // "Dipakai di tugas" no longer counts it.
        $this->actingAs($this->member)->get('/w/PLQ/file')
            ->assertInertia(fn (Assert $page) => $page->where('files.0.name', 'Draf brief')->where('files.0.used_in', []));
    });
});

describe('Leak protection', function () {
    it('answers 404 for attachments of tasks and comments in a workspace the user cannot see', function () {
        // Personal workspace: invisible even to Direksi and to the shared workspace owner.
        $personal = Workspace::query()->where('owner_id', $this->member->id)->where('type', WorkspaceType::Personal->value)->firstOrFail();
        $personal->forceFill(['drive_folder_id' => $this->drive->seedFolder('Pribadi [RA]')->id])->saveQuietly();
        $task = app(CreateTask::class)->handle($personal, $this->member, ['title' => 'Catatan pribadi']);
        $comment = commentBy($task, $this->member, 'Pengingat');
        $onTask = attachDoc($this->member, "/lampiran/task/{$task->id}", 'Rahasia');
        $onComment = attachDoc($this->member, "/lampiran/comment/{$comment->id}", 'Rahasia juga');

        foreach ([$this->direksi, $this->owner, $this->outsider] as $user) {
            $this->actingAs($user)->getJson("/lampiran/task/{$task->id}")->assertNotFound();
            $this->actingAs($user)->getJson("/lampiran/comment/{$comment->id}")->assertNotFound();
            $this->actingAs($user)->postJson("/lampiran/comment/{$comment->id}/drive", ['file_ids' => ['1AbCdEfGhIjKlMn']])->assertNotFound();
            $this->actingAs($user)->deleteJson("/lampiran/{$onTask->id}")->assertNotFound();
            $this->actingAs($user)->deleteJson("/lampiran/{$onComment->id}")->assertNotFound();
        }

        expect(Attachment::query()->count())->toBe(2);
    });

    it('rejects malformed ids and unknown types', function () {
        $this->actingAs($this->member)->getJson('/lampiran/comment/not-a-ulid')->assertNotFound();
        $this->actingAs($this->member)->getJson("/lampiran/comment/{$this->task->id}")->assertNotFound();
        $this->actingAs($this->member)->getJson("/lampiran/message/{$this->task->id}")->assertNotFound();
    });
});

describe('Dipakai di tugas', function () {
    it('links files attached to a task or to one of its comments to the full-screen task', function () {
        $brief = attachDoc($this->member, $this->taskBase, 'Brief landing page');
        $other = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Integrasi CRM']);
        $comment = commentBy($other, $this->member);
        $this->actingAs($this->member)->postJson("/lampiran/comment/{$comment->id}/drive", ['file_ids' => [$brief->driveFile?->google_file_id]])->assertCreated();

        $this->actingAs($this->viewer)->get('/w/PLQ/file')
            ->assertInertia(fn (Assert $page) => $page
                ->where('files.0.name', 'Brief landing page')
                ->where('files.0.used_in', [
                    ['key' => 'PLQ-1', 'title' => 'Landing page produk baru', 'url' => '/w/PLQ/tasks/1'],
                    ['key' => 'PLQ-2', 'title' => 'Integrasi CRM', 'url' => '/w/PLQ/tasks/2'],
                ]));
    });
});

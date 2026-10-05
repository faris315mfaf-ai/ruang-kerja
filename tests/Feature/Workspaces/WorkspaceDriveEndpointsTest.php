<?php

use App\Domain\Google\Data\DriveUploadSession;
use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Jobs\SyncDriveFolderContents;
use App\Domain\Google\Services\DriveFolderContentsSync;
use App\Domain\Google\Services\DriveUploadSessions;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Fixtures\Google\GoogleTesting;
use Tests\TestCase;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('local');
    $this->drive = FakeDriveClient::fake();
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create(['email' => 'dimas@demo.test']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
    $this->root = $this->drive->seedFolder('Proyek Peluncuran Q4 [PLQ]');
    $this->workspace->forceFill(['drive_folder_id' => $this->root->id])->saveQuietly();
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
});

/**
 * Sends a whole file in chunks through the session endpoints.
 */
function uploadInChunks(TestCase $test, User $user, string $startUrl, string $content, array $extra = [], int $chunk = 300_000): array
{
    $session = $test->actingAs($user)
        ->postJson($startUrl, ['name' => 'Nota Oktober.pdf', 'size' => strlen($content), 'mime_type' => 'application/pdf'] + $extra)
        ->assertCreated()
        ->json();

    foreach (str_split($content, $chunk) as $index => $bytes) {
        $session = $test->actingAs($user)
            ->post("/unggah/{$session['id']}", [
                'offset' => $index * $chunk,
                'chunk' => UploadedFile::fake()->createWithContent('blob', $bytes),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->json();
    }

    return $session;
}

describe('File tab', function () {
    it('syncs a stale folder level and lists folders first, with tasks using each file', function () {
        $sub = $this->drive->seedFolder('Materi desain', $this->root->id);
        $brief = $this->drive->seedFile('Brief landing page', 'application/vnd.google-apps.document', $this->root->id);
        $this->drive->seedFile('Wireframe v2.pdf', 'application/pdf', $this->root->id, size: 2_400_000);
        $this->drive->seedFile('Logo.png', 'image/png', $sub->id);

        $this->actingAs($this->member)->get('/w/PLQ/file')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('workspaces/files')
                ->where('drive.enabled', true)
                ->where('drive.can_contribute', true)
                ->where('drive.folder_url', 'https://drive.google.com/drive/folders/'.$this->root->id)
                ->where('drive.syncing', false)
                ->where('breadcrumbs', [['id' => null, 'name' => 'Proyek Peluncuran Q4 [PLQ]']])
                ->has('files', 3)
                ->where('files.0.name', 'Materi desain')
                ->where('files.1.name', 'Brief landing page')
                ->where('drive_counts', ['documents' => 1, 'files' => 2]));

        $file = DriveFile::query()->where('google_file_id', $brief->id)->sole();
        $task = Task::factory()->create(['workspace_id' => $this->workspace->id, 'title' => 'Landing page produk baru']);
        Attachment::factory()->create(['attachable_type' => $task->getMorphClass(), 'attachable_id' => $task->id, 'drive_file_id' => $file->id]);

        $this->actingAs($this->member)->get('/w/PLQ/file')
            ->assertInertia(fn (Assert $page) => $page
                ->where('files.1.used_in.0.key', 'PLQ-'.$task->number)
                ->where('files.1.linked', false));

        $this->actingAs($this->member)->get('/w/PLQ/file?folder='.$sub->id)
            ->assertInertia(fn (Assert $page) => $page
                ->where('folder.name', 'Materi desain')
                ->where('breadcrumbs.1', ['id' => $sub->id, 'name' => 'Materi desain'])
                ->has('files', 1)
                ->where('files.0.name', 'Logo.png'));
    });

    it('reads from the cache while the folder is fresh and refreshes on demand', function () {
        app(DriveFolderContentsSync::class)->sync($this->workspace->id, $this->root->id);
        Queue::fake();

        $this->actingAs($this->member)->get('/w/PLQ/file')->assertOk();
        Queue::assertNotPushed(SyncDriveFolderContents::class);

        $this->travel(6)->minutes();
        $this->actingAs($this->member)->get('/w/PLQ/file')->assertInertia(fn (Assert $page) => $page->where('drive.syncing', true));
        Queue::assertPushed(SyncDriveFolderContents::class, 1);
    });

    it('hides files and endpoints from users without workspace access', function () {
        $file = DriveFile::factory()->create(['workspace_id' => $this->workspace->id, 'parent_google_id' => $this->root->id]);

        $this->actingAs($this->outsider)->get('/w/PLQ/file')->assertNotFound();
        $this->actingAs($this->outsider)->get('/w/PLQ/dokumen')->assertNotFound();
        $this->actingAs($this->outsider)->postJson('/w/PLQ/dokumen', ['type' => 'document', 'name' => 'X'])->assertNotFound();
        $this->actingAs($this->outsider)->postJson('/w/PLQ/file/unggah', ['name' => 'a.pdf', 'size' => 10])->assertNotFound();
        $this->actingAs($this->outsider)->post('/w/PLQ/file/folder', ['name' => 'Rahasia'])->assertNotFound();
        $this->actingAs($this->outsider)->post('/w/PLQ/file/tautkan', ['file_ids' => ['abcdefghijklmnop']])->assertNotFound();

        expect(DriveFile::query()->visibleTo($this->outsider)->count())->toBe(0)
            ->and(DriveFile::query()->visibleTo($this->member)->pluck('id')->all())->toBe([$file->id])
            ->and($this->outsider->can('view', $file))->toBeFalse()
            ->and($this->viewer->can('view', $file))->toBeTrue();
    });

    it('lets viewers read but not add files', function () {
        $this->actingAs($this->viewer)->get('/w/PLQ/file')->assertInertia(fn (Assert $page) => $page->where('drive.can_contribute', false));
        $this->actingAs($this->viewer)->postJson('/w/PLQ/dokumen', ['type' => 'document'])
            ->assertForbidden()
            ->assertJson(['message' => 'Anda tidak punya akses untuk menambah file di workspace ini.']);
        $this->actingAs($this->viewer)->postJson('/w/PLQ/file/unggah', ['name' => 'a.pdf', 'size' => 10])->assertForbidden();
    });

    it('rejects folders that do not belong to the workspace', function () {
        $foreign = $this->drive->seedFolder('Lain');

        $this->actingAs($this->member)->get('/w/PLQ/file?folder='.$foreign->id)->assertNotFound();
        $this->actingAs($this->member)->postJson('/w/PLQ/dokumen', ['type' => 'document', 'folder' => $foreign->id])->assertNotFound();
    });

    it('queues the folder of a shared workspace that has none yet', function () {
        $fresh = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'name' => 'Divisi Operasional']);

        $this->actingAs($this->owner)->get('/w/OPS/file')->assertOk();

        $this->drive->assertFolderCreated('Divisi Operasional [OPS]');
        expect($fresh->fresh()->drive_folder_id)->not->toBeNull();
    });

    it('shows the not-configured state with the missing keys for the Super Admin only', function () {
        GoogleTesting::disable();

        $this->actingAs($this->member)->get('/w/PLQ/file')
            ->assertInertia(fn (Assert $page) => $page
                ->where('drive.enabled', false)
                ->where('drive.missing_settings', [])
                ->where('drive.access.state', 'disabled'));

        $this->actingAs($this->member)->postJson('/w/PLQ/dokumen', ['type' => 'document'])
            ->assertStatus(503)
            ->assertJson(['code' => 'google_not_configured']);
        $this->actingAs($this->member)->postJson('/w/PLQ/file/unggah', ['name' => 'a.pdf', 'size' => 10])->assertStatus(503);
    });

    it('creates a sub-folder synchronously and opens it', function () {
        $response = $this->actingAs($this->member)->post('/w/PLQ/file/folder', ['name' => 'Kontrak & legal']);

        $folder = $this->drive->assertFolderCreated('Kontrak & legal', $this->root->id);
        $response->assertRedirect('/w/PLQ/file?folder='.$folder->id);
        expect(DriveFile::query()->where('google_file_id', $folder->id)->sole()->kind)->toBe(DriveFileKind::Folder);
    });

    it('links files picked with Google Picker to the workspace', function () {
        $picked = $this->drive->seedFile('Daftar harga', 'application/vnd.google-apps.spreadsheet', $this->drive->seedFolder('My Drive')->id);

        $this->actingAs($this->member)->post('/w/PLQ/file/tautkan', ['file_ids' => [$picked->id]])->assertRedirect();

        $this->actingAs($this->member)->get('/w/PLQ/file')
            ->assertInertia(fn (Assert $page) => $page->where('files.0.name', 'Daftar harga')->where('files.0.linked', true));

        $this->actingAs($this->member)->post('/w/PLQ/file/tautkan', ['file_ids' => ['../etc']])->assertSessionHasErrors('file_ids.0');
    });
});

describe('Dokumen tab', function () {
    it('creates a Google Doc synchronously and returns the link to open', function () {
        $response = $this->actingAs($this->member)
            ->postJson('/w/PLQ/dokumen', ['type' => 'spreadsheet', 'name' => 'Anggaran peluncuran'])
            ->assertCreated()
            ->assertJsonPath('file.kind', 'sheet')
            ->assertJsonPath('file.added_by.id', $this->member->id);

        $created = $this->drive->assertFileCreated('Anggaran peluncuran', 'application/vnd.google-apps.spreadsheet', $this->root->id);
        expect($response->json('file.web_view_link'))->toBe($created->webViewLink);

        $this->actingAs($this->viewer)->get('/w/PLQ/dokumen')
            ->assertInertia(fn (Assert $page) => $page
                ->component('workspaces/documents')
                ->has('documents', 1)
                ->where('documents.0.name', 'Anggaran peluncuran'));
    });

    it('validates the document type', function () {
        $this->actingAs($this->member)->postJson('/w/PLQ/dokumen', ['type' => 'drawing'])->assertJsonValidationErrors('type');
    });
});

describe('Chunked upload', function () {
    it('assembles the chunks and uploads to the browsed folder', function () {
        $sub = $this->drive->seedFolder('Nota', $this->root->id);
        app(DriveFolderContentsSync::class)->sync($this->workspace->id, $this->root->id);
        $content = random_bytes(700_000);

        $session = uploadInChunks($this, $this->member, '/w/PLQ/file/unggah', $content, ['folder' => $sub->id]);

        expect($session['state'])->toBe(DriveUploadSession::DONE)
            ->and($session['received'])->toBe(700_000);

        $file = DriveFile::query()->findOrFail($session['drive_file_id']);
        expect($file->parent_google_id)->toBe($sub->id)
            ->and($file->added_by)->toBe($this->member->id)
            ->and($this->drive->uploadedContent($file->google_file_id))->toBe($content)
            ->and(Storage::disk('local')->allFiles())->toBe([]);

        $this->actingAs($this->member)->getJson("/unggah/{$session['id']}")->assertOk()->assertJsonPath('state', 'done');
    });

    it('refuses files over 100 MB', function () {
        $this->actingAs($this->member)
            ->postJson('/w/PLQ/file/unggah', ['name' => 'video.mp4', 'size' => 100 * 1024 * 1024 + 1])
            ->assertJsonValidationErrors(['size' => 'Ukuran file maksimal 100 MB.']);
    });

    it('answers 409 with the received offset so the browser can resume', function () {
        $session = $this->actingAs($this->member)->postJson('/w/PLQ/file/unggah', ['name' => 'a.bin', 'size' => 20])->json();

        $this->actingAs($this->member)
            ->post("/unggah/{$session['id']}", ['offset' => 10, 'chunk' => UploadedFile::fake()->createWithContent('blob', str_repeat('x', 10))], ['Accept' => 'application/json'])
            ->assertStatus(409)
            ->assertJsonPath('received', 0);

        $this->actingAs($this->member)
            ->post("/unggah/{$session['id']}", ['offset' => 0, 'chunk' => UploadedFile::fake()->createWithContent('blob', str_repeat('x', 30))], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors('chunk');
    });

    it('keeps sessions private to their uploader and can cancel them', function () {
        $session = $this->actingAs($this->member)->postJson('/w/PLQ/file/unggah', ['name' => 'a.bin', 'size' => 20])->json();

        $this->actingAs($this->owner)->getJson("/unggah/{$session['id']}")->assertNotFound();
        $this->actingAs($this->owner)->deleteJson("/unggah/{$session['id']}")->assertNotFound();

        $this->actingAs($this->member)->deleteJson("/unggah/{$session['id']}")->assertOk()->assertJson(['cancelled' => true]);
        $this->actingAs($this->member)->getJson("/unggah/{$session['id']}")->assertNotFound();
        expect(Storage::disk('local')->allFiles())->toBe([]);
    });

    it('sizes chunks below the PHP upload limits', function () {
        expect(DriveUploadSessions::iniBytes('2M'))->toBe(2 * 1024 * 1024)
            ->and(DriveUploadSessions::iniBytes('512K'))->toBe(512 * 1024)
            ->and(DriveUploadSessions::iniBytes('0'))->toBe(0)
            ->and(DriveUploadSessions::chunkBytes())->toBeGreaterThanOrEqual(256 * 1024)
            ->and(DriveUploadSessions::chunkBytes())->toBeLessThanOrEqual(8 * 1024 * 1024);
    });

    it('prunes abandoned temporary uploads after a day', function () {
        $this->actingAs($this->member)->postJson('/w/PLQ/file/unggah', ['name' => 'a.bin', 'size' => 20])->assertCreated();

        $this->travelTo(CarbonImmutable::now()->addHours(25));
        Artisan::call('ruangkerja:drive-uploads:prune');

        expect(Storage::disk('local')->allFiles())->toBe([]);
    });
});

describe('Attachments endpoints', function () {
    beforeEach(function () {
        $this->task = Task::factory()->create(['workspace_id' => $this->workspace->id]);
        $this->base = "/lampiran/task/{$this->task->id}";
    });

    it('creates a document attached to the task and lists it', function () {
        $this->actingAs($this->member)
            ->postJson("{$this->base}/dokumen", ['type' => 'document', 'name' => 'Notulen'])
            ->assertCreated()
            ->assertJsonPath('attachments.0.filename', 'Notulen')
            ->assertJsonPath('attachments.0.can_remove', true);

        $this->actingAs($this->viewer)->getJson($this->base)
            ->assertOk()
            ->assertJsonPath('can_edit', false)
            ->assertJsonPath('attachments.0.drive_file.kind', 'doc')
            ->assertJsonPath('attachments.0.can_remove', false);
    });

    it('uploads into the workspace folder and attaches the file', function () {
        $session = uploadInChunks($this, $this->member, "{$this->base}/unggah", 'isi nota');

        expect($session['state'])->toBe('done')
            ->and(Attachment::query()->findOrFail($session['attachment_id'])->attachable_id)->toBe($this->task->id);
    });

    it('attaches files picked with Google Picker once', function () {
        $picked = $this->drive->seedFile('Kontrak vendor.pdf', 'application/pdf', $this->drive->seedFolder('My Drive')->id);

        $this->actingAs($this->member)->postJson("{$this->base}/drive", ['file_ids' => [$picked->id]])->assertCreated();
        $this->actingAs($this->member)->postJson("{$this->base}/drive", ['file_ids' => [$picked->id]])->assertCreated()->assertJsonCount(1, 'attachments');
    });

    it('lets the uploader or an editor detach, never outsiders', function () {
        $this->actingAs($this->member)->postJson("{$this->base}/dokumen", ['type' => 'document', 'name' => 'Notulen']);
        $attachment = Attachment::query()->sole();

        $this->actingAs($this->outsider)->deleteJson("/lampiran/{$attachment->id}")->assertNotFound();
        $this->actingAs($this->viewer)->deleteJson("/lampiran/{$attachment->id}")->assertForbidden();
        $this->actingAs($this->owner)->deleteJson("/lampiran/{$attachment->id}")->assertOk();

        expect(Attachment::query()->count())->toBe(0)
            ->and(DriveFile::query()->count())->toBe(1);
    });

    it('hides attachments of tasks the user cannot see and rejects unknown types', function () {
        $this->actingAs($this->outsider)->getJson($this->base)->assertNotFound();
        $this->actingAs($this->outsider)->postJson("{$this->base}/dokumen", ['type' => 'document'])->assertNotFound();
        $this->actingAs($this->viewer)->postJson("{$this->base}/dokumen", ['type' => 'document'])->assertForbidden();
        $this->actingAs($this->member)->getJson("/lampiran/request/{$this->task->id}")->assertNotFound();
    });
});

describe('Personal workspace', function () {
    it('creates its folder on first use only', function () {
        $personal = Workspace::query()->where('owner_id', $this->member->id)->where('type', WorkspaceType::Personal->value)->firstOrFail();

        $this->actingAs($this->member)->get("/w/{$personal->key}/file")
            ->assertInertia(fn (Assert $page) => $page->where('drive.access.state', 'unused'));
        expect($personal->fresh()->drive_folder_id)->toBeNull();

        $this->actingAs($this->member)->postJson("/w/{$personal->key}/dokumen", ['type' => 'document', 'name' => 'Catatan'])->assertCreated();

        expect($personal->fresh()->drive_folder_id)->not->toBeNull();
        $this->drive->assertPermission($personal->fresh()->drive_folder_id, $this->member->email, DriveRole::Writer);
    });
});

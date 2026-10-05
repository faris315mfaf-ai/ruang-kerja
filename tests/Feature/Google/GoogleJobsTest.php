<?php

use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Jobs\CreateDriveFolder;
use App\Domain\Google\Jobs\SyncDriveFolderContents;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Domain\Google\Services\DriveFolderContentsSync;
use App\Domain\Google\Services\DriveFolderService;
use App\Domain\Google\Services\DrivePermissionSync;
use App\Domain\Google\Services\GoogleBackoff;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Models\DriveFile;
use Illuminate\Http\Client\Request;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\Fixtures\Google\FolderOwner;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    $this->drive = FakeDriveClient::fake();
    config(['google.retry.jitter' => false]);
    $this->owner = FolderOwner::createWith('Proyek Peluncuran Q4 [PLQ]', [
        'dimas@demo.test' => 'owner',
        'rizky@demo.test' => 'member',
        'hendra@demo.test' => 'viewer',
    ]);
});

describe('CreateDriveFolder', function () {
    it('creates the folder, stores its id and grants the members access', function () {
        CreateDriveFolder::dispatch($this->owner);

        $folder = $this->drive->assertFolderCreated('Proyek Peluncuran Q4 [PLQ]');

        expect($this->owner->fresh()->drive_folder_id)->toBe($folder->id)
            ->and($this->drive->directAccess($folder->id))->toBe([
                'dimas@demo.test' => 'writer',
                'hendra@demo.test' => 'reader',
                'rizky@demo.test' => 'writer',
            ]);
    });

    it('is safe to run again', function () {
        CreateDriveFolder::dispatch($this->owner);
        CreateDriveFolder::dispatch($this->owner->fresh());

        $this->drive->assertFolderCount(1);
        $this->drive->assertCalled('permissions.create', 3);
    });

    it('is unique per owner while queued', function () {
        expect((new CreateDriveFolder($this->owner))->uniqueId())->toBe($this->owner->driveFolderKey());
    });

    it('does nothing (and says why) when Google is not configured', function () {
        GoogleTesting::disable();
        Log::spy();

        $job = (new CreateDriveFolder($this->owner))->withFakeQueueInteractions();
        $job->handle(app(DriveFolderService::class), app(DrivePermissionSync::class));

        $job->assertNotFailed()->assertNotReleased();
        $this->drive->assertNothingCalled();
        Log::shouldHaveReceived('info')->withArgs(fn ($message, $context) => $message === 'google.job.skipped'
            && in_array('GOOGLE_SHARED_DRIVE_ID', $context['missing'], true));
    });
});

describe('retry policy', function () {
    function runCreateFolder(FolderOwner $owner, int $attempt = 1): CreateDriveFolder
    {
        $job = (new CreateDriveFolder($owner))->withFakeQueueInteractions();
        $job->job->attempts = $attempt;

        app()->call([$job, 'handle']);

        return $job;
    }

    it('backs off exponentially on rate limits (429)', function (int $attempt, int $delay) {
        $this->drive->rateLimitNext('files.create_folder');

        runCreateFolder($this->owner, $attempt)->assertReleased($delay)->assertNotFailed();
    })->with([
        [1, 10],
        [2, 20],
        [3, 40],
        [5, 160],
    ]);

    it('honours Retry-After when it is longer', function () {
        $this->drive->rateLimitNext('files.create_folder', retryAfter: 120);

        runCreateFolder($this->owner)->assertReleased(120);
    });

    it('treats 403 rate-limit reasons and 5xx as retryable', function (int $status, string $reason) {
        $this->drive->failNext('files.create_folder', $status, $reason);

        runCreateFolder($this->owner)->assertReleased(10);
    })->with([
        [403, 'userRateLimitExceeded'],
        [403, 'sharingRateLimitExceeded'],
        [500, 'backendError'],
        [503, 'backendError'],
    ]);

    it('gives up after the last attempt', function () {
        $this->drive->rateLimitNext('files.create_folder');

        runCreateFolder($this->owner, 6)->assertFailed()->assertNotReleased();
    });

    it('fails permanently on errors retrying cannot fix', function (int $status, string $reason) {
        $this->drive->failNext('files.create_folder', $status, $reason);

        runCreateFolder($this->owner)
            ->assertFailedWith(DriveRequestFailed::class)
            ->assertNotReleased();
    })->with([
        [403, 'insufficientFilePermissions'],
        [404, 'notFound'],
        [400, 'invalid'],
    ]);

    it('caps the delay and adds jitter when enabled', function () {
        config(['google.retry.jitter' => true]);

        expect(GoogleBackoff::delay(20))->toBe(900)
            ->and(GoogleBackoff::delay(1))->toBeGreaterThanOrEqual(10)->toBeLessThanOrEqual(20)
            ->and(GoogleBackoff::schedule(4))->toBe([10, 20, 40])
            ->and((new CreateDriveFolder($this->owner))->tries())->toBe(6);
    });

    it('logs failures without tokens', function () {
        GoogleTesting::useRealServiceAccount();
        Http::preventStrayRequests();
        $logged = [];
        Log::listen(function ($event) use (&$logged) {
            $logged[] = $event->message.' '.json_encode($event->context);
        });

        Http::fake([
            ...GoogleTesting::tokenResponse(),
            'www.googleapis.com/*' => Http::response(['error' => ['errors' => [['reason' => 'rateLimitExceeded']], 'message' => 'Rate Limit Exceeded']], 429),
        ]);

        runCreateFolder($this->owner)->assertReleased(10);

        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer '.GoogleTesting::SA_TOKEN));
        expect($logged)->not->toBeEmpty()
            ->and(implode("\n", $logged))->not->toContain(GoogleTesting::SA_TOKEN)
            ->and(implode("\n", $logged))->toContain('google.job.retrying')
            ->and(implode("\n", $logged))->toContain('rateLimitExceeded');
    });
});

describe('SyncDrivePermissions', function () {
    beforeEach(function () {
        CreateDriveFolder::dispatch($this->owner);
        $this->folderId = (string) $this->owner->fresh()->drive_folder_id;
    });

    it('gives a new member access', function () {
        $this->owner->setMembers([
            'dimas@demo.test' => 'owner',
            'rizky@demo.test' => 'member',
            'hendra@demo.test' => 'viewer',
            'sari@demo.test' => 'member',
        ]);

        SyncDrivePermissions::dispatch($this->owner);

        $this->drive->assertPermission($this->folderId, 'sari@demo.test', DriveRole::Writer);
    });

    it('removes access of a member who was removed', function () {
        $this->owner->setMembers(['dimas@demo.test' => 'owner', 'hendra@demo.test' => 'viewer']);

        SyncDrivePermissions::dispatch($this->owner);

        $this->drive->assertNoPermission($this->folderId, 'rizky@demo.test');
        $this->drive->assertPermission($this->folderId, 'dimas@demo.test', DriveRole::Writer);
    });

    it('is safe to repeat', function () {
        SyncDrivePermissions::dispatch($this->owner);
        $this->drive->resetCalls();

        SyncDrivePermissions::dispatch($this->owner);
        SyncDrivePermissions::dispatch($this->owner);

        $this->drive->assertNoWrites();
    });

    it('recreates a deleted folder (404) and applies permissions to it', function () {
        $this->drive->forget($this->folderId);

        SyncDrivePermissions::dispatch($this->owner->fresh());

        $newFolder = (string) $this->owner->fresh()->drive_folder_id;
        expect($newFolder)->not->toBe($this->folderId)
            ->and($this->drive->directAccess($newFolder))->toHaveCount(3);
    });

    it('creates the folder on first use (e.g. personal workspace)', function () {
        $personal = FolderOwner::createWith('Ruang pribadi Rizky', ['rizky@demo.test' => 'owner']);

        SyncDrivePermissions::dispatch($personal);

        expect($personal->fresh()->drive_folder_id)->not->toBeNull();
        $this->drive->assertPermission((string) $personal->fresh()->drive_folder_id, 'rizky@demo.test', DriveRole::Writer);
    });

    it('backs off when Drive throttles sharing', function () {
        $this->drive->failNext('permissions.list', 403, 'sharingRateLimitExceeded');

        $job = (new SyncDrivePermissions($this->owner))->withFakeQueueInteractions();
        app()->call([$job, 'handle']);

        $job->assertReleased(10);
    });

    it('does not overlap for the same owner', function () {
        $middleware = (new SyncDrivePermissions($this->owner))->middleware();

        expect($middleware[0])->toBeInstanceOf(WithoutOverlapping::class)
            ->and($middleware[0]->key)->toBe('google-permissions:'.$this->owner->driveFolderKey());
    });
});

describe('SyncDriveFolderContents', function () {
    it('caches the folder children and drops files removed from Drive', function () {
        $folder = $this->drive->seedFolder('Proyek');
        $doc = $this->drive->seedFile('Brief', 'application/vnd.google-apps.document', $folder->id);
        $pdf = $this->drive->seedFile('Wireframe v2.pdf', 'application/pdf', $folder->id, 2_400_000, 'sari@demo.test');
        $this->drive->seedFolder('Materi desain', $folder->id);
        $picked = DriveFile::factory()->create(['workspace_id' => $this->owner->id, 'parent_google_id' => 'somewhere-else']);

        SyncDriveFolderContents::dispatch($this->owner->id, $folder->id);

        expect(DriveFile::query()->inFolder($folder->id)->pluck('name')->sort()->values()->all())
            ->toBe(['Brief', 'Materi desain', 'Wireframe v2.pdf'])
            ->and(DriveFile::query()->where('google_file_id', $pdf->id)->value('size_bytes'))->toBe(2_400_000);

        $this->drive->forget($doc->id);
        app(DriveFolderContentsSync::class)->sync($this->owner->id, $folder->id);

        expect(DriveFile::query()->inFolder($folder->id)->count())->toBe(2)
            ->and(DriveFile::withTrashed()->where('google_file_id', $doc->id)->first()?->trashed())->toBeTrue()
            ->and($picked->fresh()?->trashed())->toBeFalse();
    });

    it('restores a cached file that comes back', function () {
        $folder = $this->drive->seedFolder('Proyek');
        $file = $this->drive->seedFile('a.pdf', 'application/pdf', $folder->id, 1);
        $sync = app(DriveFolderContentsSync::class);

        $sync->sync($this->owner->id, $folder->id);
        DriveFile::query()->where('google_file_id', $file->id)->delete();
        $sync->sync($this->owner->id, $folder->id);

        expect(DriveFile::query()->where('google_file_id', $file->id)->exists())->toBeTrue();
    });

    it('knows when the cache is older than five minutes', function () {
        $this->travelTo(now());
        $folder = $this->drive->seedFolder('Proyek');
        $sync = app(DriveFolderContentsSync::class);

        expect($sync->isStale($folder->id))->toBeTrue();

        $sync->sync($this->owner->id, $folder->id);
        expect($sync->isStale($folder->id))->toBeFalse();

        $this->travel(6)->minutes();
        expect($sync->isStale($folder->id))->toBeTrue();

        $sync->sync($this->owner->id, $folder->id);
        $sync->markStale($folder->id);
        expect($sync->isStale($folder->id))->toBeTrue();
    });
});

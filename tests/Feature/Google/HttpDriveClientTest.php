<?php

use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Http\HttpDriveClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    Http::preventStrayRequests();
    config(['google.retry.jitter' => false]);
});

function driveFile(array $overrides = []): array
{
    return array_merge([
        'id' => 'file-1',
        'name' => 'Brief landing page',
        'mimeType' => 'application/vnd.google-apps.document',
        'webViewLink' => 'https://docs.google.com/document/d/file-1/edit',
        'iconLink' => 'https://icons/doc.png',
        'owners' => [['emailAddress' => 'maya@demo.test']],
        'modifiedTime' => '2026-10-05T00:12:00.000Z',
        'parents' => ['folder-1'],
        'driveId' => 'shared-drive-123',
    ], $overrides);
}

it('fetches file metadata with the bearer token on all drives', function () {
    Http::fake(['www.googleapis.com/drive/v3/files/file-1*' => Http::response(driveFile(['size' => '2400000', 'mimeType' => 'application/pdf']))]);

    $item = (new HttpDriveClient(GoogleTesting::tokens()))->getFile('file-1');

    expect($item->id)->toBe('file-1')
        ->and($item->size)->toBe(2400000)
        ->and($item->ownerEmail)->toBe('maya@demo.test')
        ->and($item->modifiedAt?->toIso8601ZuluString())->toBe('2026-10-05T00:12:00Z')
        ->and($item->parents)->toBe(['folder-1']);

    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer ya29.test-token')
        && $request['supportsAllDrives'] === 'true'
        && str_contains((string) $request['fields'], 'webViewLink'));
});

it('creates a tagged folder inside the Shared Drive', function () {
    Http::fake(['www.googleapis.com/drive/v3/files*' => Http::response(driveFile(['id' => 'folder-9', 'mimeType' => 'application/vnd.google-apps.folder']))]);

    $folder = (new HttpDriveClient(GoogleTesting::tokens()))->createFolder('Proyek X [PRX]', 'shared-drive-123', ['rk_owner' => 'workspaces:01J']);

    expect($folder->isFolder())->toBeTrue();

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_contains($request->url(), 'supportsAllDrives=true')
        && $request->data() === [
            'name' => 'Proyek X [PRX]',
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => ['shared-drive-123'],
            'appProperties' => ['rk_owner' => 'workspaces:01J'],
        ]);
});

it('finds an orphaned folder by app property with an escaped query', function () {
    Http::fake(['www.googleapis.com/drive/v3/files*' => Http::response(['files' => [driveFile(['id' => 'folder-7', 'mimeType' => 'application/vnd.google-apps.folder'])]])]);

    $found = (new HttpDriveClient(GoogleTesting::tokens()))->findFolderByAppProperty('rk_owner', "it's", 'shared-drive-123');

    expect($found?->id)->toBe('folder-7');

    Http::assertSent(fn (Request $request) => $request['corpora'] === 'drive'
        && $request['driveId'] === 'shared-drive-123'
        && str_contains((string) $request['q'], "appProperties has { key='rk_owner' and value='it\\'s' }")
        && str_contains((string) $request['q'], 'trashed=false'));
});

it('lists folder children across pages', function () {
    Http::fake(['www.googleapis.com/drive/v3/files*' => Http::sequence()
        ->push(['files' => [driveFile(['id' => 'a'])], 'nextPageToken' => 'page-2'])
        ->push(['files' => [driveFile(['id' => 'b'])]])]);

    $children = (new HttpDriveClient(GoogleTesting::tokens()))->listChildren('folder-1', 'shared-drive-123');

    expect(array_map(fn ($item) => $item->id, $children))->toBe(['a', 'b']);

    Http::assertSent(fn (Request $request) => ($request['pageToken'] ?? null) === 'page-2'
        && $request['q'] === "'folder-1' in parents and trashed=false");
});

it('manages permissions without e-mailing people', function () {
    Http::fake([
        'www.googleapis.com/drive/v3/files/folder-1/permissions/p-1*' => fn (Request $request) => $request->method() === 'DELETE'
            ? Http::response(null, 204)
            : Http::response(['id' => 'p-1', 'type' => 'user', 'role' => 'reader', 'emailAddress' => 'rizky@demo.test']),
        'www.googleapis.com/drive/v3/files/folder-1/permissions*' => fn (Request $request) => $request->method() === 'POST'
            ? Http::response(['id' => 'p-2', 'type' => 'user', 'role' => 'writer', 'emailAddress' => 'sari@demo.test'])
            : Http::response(['permissions' => [
                ['id' => 'p-0', 'type' => 'user', 'role' => 'organizer', 'emailAddress' => 'drive-admin@demo.test', 'permissionDetails' => [['inherited' => true, 'role' => 'organizer']]],
                ['id' => 'p-1', 'type' => 'user', 'role' => 'writer', 'emailAddress' => 'rizky@demo.test'],
            ]]),
    ]);

    $client = new HttpDriveClient(GoogleTesting::tokens());

    $permissions = $client->listPermissions('folder-1');
    $created = $client->createPermission('folder-1', 'sari@demo.test', DriveRole::Writer);
    $updated = $client->updatePermission('folder-1', 'p-1', DriveRole::Reader);
    $client->deletePermission('folder-1', 'p-1');

    expect($permissions[0]->inherited)->toBeTrue()
        ->and($permissions[1]->isManagedUser())->toBeTrue()
        ->and($created->id)->toBe('p-2')
        ->and($updated->role)->toBe('reader');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_contains($request->url(), 'sendNotificationEmail=false')
        && $request->data() === ['type' => 'user', 'role' => 'writer', 'emailAddress' => 'sari@demo.test']);
    Http::assertSent(fn (Request $request) => $request->method() === 'PATCH' && $request->data() === ['role' => 'reader']);
    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && str_contains($request->url(), 'supportsAllDrives=true'));
});

it('retries once with a fresh token after a 401', function () {
    Http::fake(['www.googleapis.com/drive/v3/files/file-1*' => Http::sequence()
        ->push(['error' => ['code' => 401, 'message' => 'Invalid Credentials']], 401)
        ->push(driveFile())]);

    $tokens = GoogleTesting::tokens();
    (new HttpDriveClient($tokens))->getFile('file-1');

    expect($tokens->forgotten)->toBe(1);
    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer ya29.test-token-renewed'));
});

it('classifies Drive errors', function (int $status, array $body, array $headers, string $reason, bool $rateLimited, bool $retryable, ?int $retryAfter) {
    Http::fake(['www.googleapis.com/*' => Http::response($body, $status, $headers)]);

    try {
        (new HttpDriveClient(GoogleTesting::tokens()))->getFile('file-1');
        $this->fail('Expected DriveRequestFailed.');
    } catch (DriveRequestFailed $exception) {
        expect($exception->status)->toBe($status)
            ->and($exception->operation)->toBe('files.get')
            ->and($exception->reason)->toBe($reason)
            ->and($exception->isRateLimited())->toBe($rateLimited)
            ->and($exception->isRetryable())->toBe($retryable)
            ->and($exception->retryAfter)->toBe($retryAfter)
            ->and($exception->getMessage())->not->toContain('ya29');
    }
})->with([
    '429' => [429, ['error' => ['errors' => [['reason' => 'rateLimitExceeded']], 'message' => 'Rate Limit Exceeded']], ['Retry-After' => '30'], 'rateLimitExceeded', true, true, 30],
    '403 user rate limit' => [403, ['error' => ['errors' => [['reason' => 'userRateLimitExceeded']], 'message' => 'User Rate Limit Exceeded']], [], 'userRateLimitExceeded', true, true, null],
    '403 forbidden' => [403, ['error' => ['errors' => [['reason' => 'insufficientFilePermissions']], 'message' => 'no access']], [], 'insufficientFilePermissions', false, false, null],
    '404' => [404, ['error' => ['errors' => [['reason' => 'notFound']], 'message' => 'File not found: file-1.']], [], 'notFound', false, false, null],
    '503' => [503, ['error' => ['errors' => [['reason' => 'backendError']], 'message' => 'Backend Error']], [], 'backendError', false, true, null],
]);

it('turns connection failures into retryable errors', function () {
    Http::fake(['www.googleapis.com/*' => Http::failedConnection()]);

    try {
        (new HttpDriveClient(GoogleTesting::tokens()))->getFile('file-1');
        $this->fail('Expected DriveRequestFailed.');
    } catch (DriveRequestFailed $exception) {
        expect($exception->status)->toBe(0)
            ->and($exception->isRetryable())->toBeTrue()
            ->and($exception->userMessage())->toBe('Google Drive tidak merespons. Coba lagi beberapa saat lagi.');
    }
});

it('speaks the resumable upload protocol', function () {
    Http::fake([
        'www.googleapis.com/upload/drive/v3/files?upload_id=xyz' => Http::sequence()
            ->push(null, 308, ['Range' => 'bytes=0-262143'])
            ->push(driveFile(['id' => 'up-1', 'mimeType' => 'application/pdf', 'size' => '300000']))
            ->push(null, 308, ['Range' => 'bytes=0-99']),
        'www.googleapis.com/upload/drive/v3/files*' => Http::response(null, 200, ['Location' => 'https://www.googleapis.com/upload/drive/v3/files?upload_id=xyz']),
    ]);

    $client = new HttpDriveClient(GoogleTesting::tokens());

    $session = $client->startResumableUpload('Wireframe v2.pdf', 'application/pdf', 300000, 'folder-1');
    $first = $client->uploadChunk($session, str_repeat('a', 262144), 0, 300000);
    $last = $client->uploadChunk($session, str_repeat('b', 37856), 262144, 300000);
    $status = $client->uploadStatus($session, 300000);

    expect($session)->toBe('https://www.googleapis.com/upload/drive/v3/files?upload_id=xyz')
        ->and($first->complete)->toBeFalse()
        ->and($first->nextOffset)->toBe(262144)
        ->and($last->complete)->toBeTrue()
        ->and($last->item?->id)->toBe('up-1')
        ->and($status->nextOffset)->toBe(100);

    Http::assertSent(fn (Request $request) => $request->hasHeader('X-Upload-Content-Type', 'application/pdf')
        && $request->hasHeader('X-Upload-Content-Length', '300000')
        && str_contains($request->url(), 'uploadType=resumable')
        && $request->data() === ['name' => 'Wireframe v2.pdf', 'mimeType' => 'application/pdf', 'parents' => ['folder-1']]);
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT' && $request->hasHeader('Content-Range', 'bytes 262144-299999/300000'));
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT' && $request->hasHeader('Content-Range', 'bytes */300000'));
});

it('reports a missing upload session location', function () {
    Http::fake(['www.googleapis.com/upload/*' => Http::response(null, 200)]);

    (new HttpDriveClient(GoogleTesting::tokens()))->startResumableUpload('a.pdf', 'application/pdf', 1, 'folder-1');
})->throws(DriveRequestFailed::class, 'missing_location');

it('reads the Shared Drive name', function () {
    Http::fake(['www.googleapis.com/drive/v3/drives/shared-drive-123*' => Http::response(['id' => 'shared-drive-123', 'name' => 'RuangKerja'])]);

    expect((new HttpDriveClient(GoogleTesting::tokens()))->getSharedDrive('shared-drive-123')->name)->toBe('RuangKerja');
});

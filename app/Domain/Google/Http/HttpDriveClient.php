<?php

namespace App\Domain\Google\Http;

use App\Domain\Google\Contracts\AccessTokenProvider;
use App\Domain\Google\Contracts\DriveClient;
use App\Domain\Google\Data\DriveItem;
use App\Domain\Google\Data\DrivePermission;
use App\Domain\Google\Data\SharedDrive;
use App\Domain\Google\Data\UploadProgress;
use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Thin Drive v3 REST client on top of Laravel's HTTP client, so tests can use
 * Http::fake(). A 401 drops the cached token and retries once; any other
 * non-2xx answer becomes DriveRequestFailed (status + reason, never tokens).
 */
final class HttpDriveClient implements DriveClient
{
    public const string API = 'https://www.googleapis.com/drive/v3';

    public const string UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

    private const array ALL_DRIVES = ['supportsAllDrives' => 'true'];

    public function __construct(
        private readonly AccessTokenProvider $tokens,
        private readonly int $timeout = 30,
        private readonly int $connectTimeout = 5,
        private readonly int $uploadTimeout = 120,
    ) {}

    public function getSharedDrive(string $driveId): SharedDrive
    {
        $response = $this->send('drives.get', fn (PendingRequest $http) => $http
            ->get(self::API.'/drives/'.rawurlencode($driveId), ['fields' => 'id,name']));

        return new SharedDrive((string) $response->json('id'), (string) $response->json('name'));
    }

    public function getFile(string $fileId): DriveItem
    {
        $response = $this->send('files.get', fn (PendingRequest $http) => $http
            ->get(self::API.'/files/'.rawurlencode($fileId), self::ALL_DRIVES + ['fields' => DriveItem::FIELDS]));

        return DriveItem::fromApi($this->json($response));
    }

    public function findFolderByAppProperty(string $key, string $value, string $driveId): ?DriveItem
    {
        $query = sprintf(
            "appProperties has { key='%s' and value='%s' } and mimeType='%s' and trashed=false",
            self::escape($key),
            self::escape($value),
            DriveFileKind::FOLDER_MIME,
        );

        $response = $this->send('files.list', fn (PendingRequest $http) => $http
            ->get(self::API.'/files', self::ALL_DRIVES + [
                'q' => $query,
                'corpora' => 'drive',
                'driveId' => $driveId,
                'includeItemsFromAllDrives' => 'true',
                'pageSize' => 10,
                'fields' => 'files('.DriveItem::FIELDS.')',
            ]));

        $files = $response->json('files');
        $first = is_array($files) ? ($files[0] ?? null) : null;

        return is_array($first) ? DriveItem::fromApi($first) : null;
    }

    public function listChildren(string $folderId, ?string $driveId = null): array
    {
        $items = [];
        $pageToken = null;

        do {
            $query = self::ALL_DRIVES + [
                'q' => sprintf("'%s' in parents and trashed=false", self::escape($folderId)),
                'includeItemsFromAllDrives' => 'true',
                'pageSize' => 200,
                'orderBy' => 'folder,name',
                'fields' => 'nextPageToken,files('.DriveItem::FIELDS.')',
            ] + ($driveId !== null ? ['corpora' => 'drive', 'driveId' => $driveId] : ['corpora' => 'allDrives'])
              + ($pageToken !== null ? ['pageToken' => $pageToken] : []);

            $response = $this->send('files.list', fn (PendingRequest $http) => $http->get(self::API.'/files', $query));

            foreach ((array) $response->json('files', []) as $file) {
                if (is_array($file)) {
                    $items[] = DriveItem::fromApi($file);
                }
            }

            $next = $response->json('nextPageToken');
            $pageToken = is_string($next) && $next !== '' ? $next : null;
        } while ($pageToken !== null);

        return $items;
    }

    public function createFolder(string $name, string $parentId, array $appProperties = []): DriveItem
    {
        $body = [
            'name' => $name,
            'mimeType' => DriveFileKind::FOLDER_MIME,
            'parents' => [$parentId],
        ] + ($appProperties === [] ? [] : ['appProperties' => $appProperties]);

        $response = $this->send('files.create_folder', fn (PendingRequest $http) => $http
            ->withQueryParameters(self::ALL_DRIVES + ['fields' => DriveItem::FIELDS])
            ->post(self::API.'/files', $body));

        return DriveItem::fromApi($this->json($response));
    }

    public function createFile(string $name, string $mimeType, string $parentId): DriveItem
    {
        $response = $this->send('files.create', fn (PendingRequest $http) => $http
            ->withQueryParameters(self::ALL_DRIVES + ['fields' => DriveItem::FIELDS])
            ->post(self::API.'/files', [
                'name' => $name,
                'mimeType' => $mimeType,
                'parents' => [$parentId],
            ]));

        return DriveItem::fromApi($this->json($response));
    }

    public function rename(string $fileId, string $name): DriveItem
    {
        $response = $this->send('files.update', fn (PendingRequest $http) => $http
            ->withQueryParameters(self::ALL_DRIVES + ['fields' => DriveItem::FIELDS])
            ->patch(self::API.'/files/'.rawurlencode($fileId), ['name' => $name]));

        return DriveItem::fromApi($this->json($response));
    }

    public function deleteFile(string $fileId): void
    {
        $this->send('files.delete', fn (PendingRequest $http) => $http
            ->withQueryParameters(self::ALL_DRIVES)
            ->delete(self::API.'/files/'.rawurlencode($fileId)));
    }

    public function listPermissions(string $fileId): array
    {
        $permissions = [];
        $pageToken = null;

        do {
            $query = self::ALL_DRIVES + ['fields' => DrivePermission::FIELDS, 'pageSize' => 100]
                + ($pageToken !== null ? ['pageToken' => $pageToken] : []);

            $response = $this->send('permissions.list', fn (PendingRequest $http) => $http
                ->get(self::API.'/files/'.rawurlencode($fileId).'/permissions', $query));

            foreach ((array) $response->json('permissions', []) as $permission) {
                if (is_array($permission)) {
                    $permissions[] = DrivePermission::fromApi($permission);
                }
            }

            $next = $response->json('nextPageToken');
            $pageToken = is_string($next) && $next !== '' ? $next : null;
        } while ($pageToken !== null);

        return $permissions;
    }

    public function createPermission(string $fileId, string $email, DriveRole $role, bool $notify = false): DrivePermission
    {
        $response = $this->send('permissions.create', fn (PendingRequest $http) => $http
            ->withQueryParameters(self::ALL_DRIVES + [
                'sendNotificationEmail' => $notify ? 'true' : 'false',
                'fields' => 'id,type,role,emailAddress,permissionDetails(inherited,role,permissionType)',
            ])
            ->post(self::API.'/files/'.rawurlencode($fileId).'/permissions', [
                'type' => 'user',
                'role' => $role->value,
                'emailAddress' => $email,
            ]));

        return DrivePermission::fromApi($this->json($response));
    }

    public function updatePermission(string $fileId, string $permissionId, DriveRole $role): DrivePermission
    {
        $response = $this->send('permissions.update', fn (PendingRequest $http) => $http
            ->withQueryParameters(self::ALL_DRIVES + ['fields' => 'id,type,role,emailAddress,permissionDetails(inherited,role,permissionType)'])
            ->patch(self::API.'/files/'.rawurlencode($fileId).'/permissions/'.rawurlencode($permissionId), [
                'role' => $role->value,
            ]));

        return DrivePermission::fromApi($this->json($response));
    }

    public function deletePermission(string $fileId, string $permissionId): void
    {
        $this->send('permissions.delete', fn (PendingRequest $http) => $http
            ->withQueryParameters(self::ALL_DRIVES)
            ->delete(self::API.'/files/'.rawurlencode($fileId).'/permissions/'.rawurlencode($permissionId)));
    }

    public function startResumableUpload(string $name, string $mimeType, int $size, string $parentId): string
    {
        $response = $this->send('upload.start', fn (PendingRequest $http) => $http
            ->withHeaders([
                'X-Upload-Content-Type' => $mimeType,
                'X-Upload-Content-Length' => (string) $size,
            ])
            ->withQueryParameters(self::ALL_DRIVES + ['uploadType' => 'resumable', 'fields' => DriveItem::FIELDS])
            ->post(self::UPLOAD_API.'/files', [
                'name' => $name,
                'mimeType' => $mimeType,
                'parents' => [$parentId],
            ]));

        $location = $response->header('Location');

        if ($location === '') {
            throw new DriveRequestFailed('upload.start', $response->status(), 'missing_location');
        }

        return $location;
    }

    public function uploadChunk(string $sessionUri, string $bytes, int $offset, int $total): UploadProgress
    {
        $length = strlen($bytes);
        $range = $total === 0 ? 'bytes */0' : sprintf('bytes %d-%d/%d', $offset, $offset + $length - 1, $total);

        $response = $this->send('upload.chunk', fn (PendingRequest $http) => $http
            ->timeout($this->uploadTimeout)
            ->withHeaders(['Content-Range' => $range])
            ->withBody($bytes, 'application/octet-stream')
            ->put($sessionUri));

        return $this->uploadProgress($response, $total);
    }

    public function uploadStatus(string $sessionUri, int $total): UploadProgress
    {
        $response = $this->send('upload.status', fn (PendingRequest $http) => $http
            ->withHeaders(['Content-Range' => "bytes */{$total}"])
            ->withBody('', 'application/octet-stream')
            ->put($sessionUri));

        return $this->uploadProgress($response, $total);
    }

    /**
     * @param  Closure(PendingRequest): Response  $call
     *
     * @throws DriveRequestFailed
     */
    private function send(string $operation, Closure $call): Response
    {
        try {
            $response = $call($this->request());

            if ($response->status() === 401) {
                // Cached token revoked or expired early: fetch a new one once.
                $this->tokens->forget();
                $response = $call($this->request());
            }
        } catch (ConnectionException $exception) {
            throw DriveRequestFailed::fromConnection($operation, $exception);
        }

        if ($response->failed()) {
            throw DriveRequestFailed::fromResponse($operation, $response);
        }

        return $response;
    }

    private function request(): PendingRequest
    {
        return Http::withToken($this->tokens->token())
            ->acceptJson()
            ->timeout($this->timeout)
            ->connectTimeout($this->connectTimeout)
            ->withoutRedirecting();
    }

    private function uploadProgress(Response $response, int $total): UploadProgress
    {
        if ($response->status() === 308) {
            // "Range: bytes=0-524287" → next byte to send is 524288.
            $range = $response->header('Range');
            $next = preg_match('/bytes=\d+-(\d+)/', $range, $matches) === 1 ? ((int) $matches[1]) + 1 : 0;

            return UploadProgress::incomplete($next);
        }

        return UploadProgress::completed(DriveItem::fromApi($this->json($response)), $total);
    }

    /**
     * @return array<array-key, mixed>
     */
    private function json(Response $response): array
    {
        $data = $response->json();

        return is_array($data) ? $data : [];
    }

    /**
     * Escapes a value for a Drive `q` string literal.
     */
    private static function escape(string $value): string
    {
        return str_replace(['\\', "'"], ['\\\\', "\\'"], $value);
    }
}

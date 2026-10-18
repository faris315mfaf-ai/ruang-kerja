<?php

namespace App\Domain\Organization\Services;

use App\Domain\Tenancy\Support\CompanyFiles;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Keeps an uploaded import file between the dry run and the commit.
 *
 * The file lives on the private disk under company/<company>/employee-imports
 * (Fase 1 multi-perusahaan); the cache holds only its location, owner
 * and the client-safe preview/result (never row values such as NIK). The cache
 * entry expires TTL_MINUTES after the upload (updates never extend it). Files
 * contain NIK, so they never outlive their session:
 * - deleted after a commit (controller),
 * - deleted when the same user uploads a new file (one open import per user),
 * - otherwise removed by `employee-imports:prune` (hourly) once older than the TTL.
 */
final class EmployeeImportStore
{
    public const string DISK = 'local';

    public const string DIRECTORY = 'employee-imports';

    public const int TTL_MINUTES = 60;

    /**
     * @return string token
     */
    public function put(UploadedFile $file, User $owner): string
    {
        $this->discardOpenImport($owner);

        $token = Str::random(40);
        $extension = strtolower($file->getClientOriginalExtension()) === 'xlsx' ? 'xlsx' : 'csv';
        $path = $file->storeAs(self::directoryFor($owner->company_id), "{$token}.{$extension}", self::DISK);
        $expiresAt = now()->addMinutes(self::TTL_MINUTES);

        Cache::put($this->key($token), [
            'user_id' => $owner->id,
            'path' => $path,
            'name' => Str::limit($file->getClientOriginalName(), 120),
            'preview' => null,
            'result' => null,
            'expires_at' => $expiresAt->getTimestamp(),
        ], $expiresAt);

        Cache::put($this->ownerKey($owner), $token, $expiresAt);

        return $token;
    }

    /**
     * @return array{user_id: string, path: string|false, name: string, preview: array<string, mixed>|null, result: array<string, mixed>|null, expires_at: int}|null
     */
    public function get(string $token, User $owner): ?array
    {
        /** @var array{user_id: string, path: string|false, name: string, preview: array<string, mixed>|null, result: array<string, mixed>|null, expires_at: int}|null $state */
        $state = Cache::get($this->key($token));

        return $state !== null && $state['user_id'] === $owner->id ? $state : null;
    }

    /**
     * Merges values into the session without extending its lifetime.
     *
     * @param  array<string, mixed>  $values
     */
    public function update(string $token, array $values): void
    {
        $state = Cache::get($this->key($token));

        if (! is_array($state) || ! is_int($state['expires_at'] ?? null)) {
            return;
        }

        $expiresAt = Carbon::createFromTimestamp($state['expires_at']);

        if ($expiresAt->isFuture()) {
            Cache::put($this->key($token), [...$state, ...$values], $expiresAt);
        }
    }

    /**
     * Upload directory of a company's imports.
     */
    public static function directoryFor(string $companyId): string
    {
        return CompanyFiles::directory($companyId, self::DIRECTORY);
    }

    public function deleteFile(string $path): void
    {
        Storage::disk(self::DISK)->delete($path);
    }

    /**
     * Deletes upload files older than the TTL (their session has expired).
     *
     * @return int number of files deleted
     */
    public function pruneExpired(): int
    {
        $disk = Storage::disk(self::DISK);
        $threshold = now()->subMinutes(self::TTL_MINUTES)->getTimestamp();
        $deleted = 0;

        // Every company's directory, plus the one used before the company prefix.
        $directories = [self::DIRECTORY];

        foreach ($disk->directories(CompanyFiles::ROOT) as $company) {
            $directories[] = $company.'/'.self::DIRECTORY;
        }

        foreach ($directories as $directory) {
            foreach ($disk->files($directory) as $path) {
                if ($disk->lastModified($path) <= $threshold && $disk->delete($path)) {
                    $deleted++;
                }
            }
        }

        return $deleted;
    }

    /**
     * A new upload replaces the owner's previous, uncommitted one (file + session).
     */
    private function discardOpenImport(User $owner): void
    {
        $previous = Cache::pull($this->ownerKey($owner));

        if (! is_string($previous)) {
            return;
        }

        $state = $this->get($previous, $owner);

        if ($state === null || $state['result'] !== null) {
            return;
        }

        if ($state['path'] !== false) {
            $this->deleteFile($state['path']);
        }

        Cache::forget($this->key($previous));
    }

    private function key(string $token): string
    {
        return "employee-import:{$token}";
    }

    private function ownerKey(User $owner): string
    {
        return "employee-import:owner:{$owner->id}";
    }
}

<?php

namespace App\Domain\Organization\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Keeps an uploaded import file between the dry run and the commit.
 *
 * The file lives on the private disk; the cache holds only its location, owner
 * and the client-safe preview/result (never row values such as NIK). Both expire
 * after TTL_MINUTES; the file is deleted after a commit.
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
        $token = Str::random(40);
        $extension = strtolower($file->getClientOriginalExtension()) === 'xlsx' ? 'xlsx' : 'csv';
        $path = $file->storeAs(self::DIRECTORY, "{$token}.{$extension}", self::DISK);

        Cache::put($this->key($token), [
            'user_id' => $owner->id,
            'path' => $path,
            'name' => Str::limit($file->getClientOriginalName(), 120),
            'preview' => null,
            'result' => null,
        ], now()->addMinutes(self::TTL_MINUTES));

        return $token;
    }

    /**
     * @return array{user_id: string, path: string|false, name: string, preview: array<string, mixed>|null, result: array<string, mixed>|null}|null
     */
    public function get(string $token, User $owner): ?array
    {
        /** @var array{user_id: string, path: string|false, name: string, preview: array<string, mixed>|null, result: array<string, mixed>|null}|null $state */
        $state = Cache::get($this->key($token));

        return $state !== null && $state['user_id'] === $owner->id ? $state : null;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function update(string $token, array $values): void
    {
        $state = Cache::get($this->key($token));

        if (is_array($state)) {
            Cache::put($this->key($token), [...$state, ...$values], now()->addMinutes(self::TTL_MINUTES));
        }
    }

    public function deleteFile(string $path): void
    {
        Storage::disk(self::DISK)->delete($path);
    }

    private function key(string $token): string
    {
        return "employee-import:{$token}";
    }
}

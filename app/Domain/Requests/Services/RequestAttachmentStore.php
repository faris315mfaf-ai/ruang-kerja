<?php

namespace App\Domain\Requests\Services;

use App\Models\EmployeeRequest;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Request attachments (doctor's letters, …) on a private disk. Never Drive,
 * never a public URL: files are streamed by the controller after the policy check.
 */
final class RequestAttachmentStore
{
    public function disk(): Filesystem
    {
        return Storage::disk(config()->string('requests.attachments.disk', 'local'));
    }

    /**
     * @param  list<UploadedFile>  $files
     * @return list<array{path: string, filename: string, mime_type: string, size_bytes: int}>
     */
    public function store(EmployeeRequest $request, array $files): array
    {
        $directory = config()->string('requests.attachments.directory', 'request-attachments').'/'.$request->id;
        $stored = [];

        foreach ($files as $file) {
            $extension = strtolower($file->getClientOriginalExtension() ?: ($file->extension() ?? 'bin'));
            $path = $this->disk()->putFileAs($directory, $file, Str::ulid().'.'.$extension);

            if ($path === false) {
                $this->delete(array_column($stored, 'path'));

                throw new RuntimeException('Lampiran gagal disimpan.');
            }

            $stored[] = [
                'path' => $path,
                'filename' => self::safeName($file->getClientOriginalName(), $extension),
                'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
                'size_bytes' => (int) $file->getSize(),
            ];
        }

        return $stored;
    }

    /**
     * @param  list<string>  $paths
     */
    public function delete(array $paths): void
    {
        if ($paths !== []) {
            $this->disk()->delete($paths);
        }
    }

    private static function safeName(string $name, string $extension): string
    {
        $base = Str::of(pathinfo($name, PATHINFO_FILENAME))->ascii()->replaceMatches('/[^A-Za-z0-9 ._-]/', '')->trim()->limit(80, '')->toString();

        return ($base === '' ? 'lampiran' : $base).'.'.$extension;
    }
}

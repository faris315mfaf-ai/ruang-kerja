<?php

namespace App\Domain\Requests\Services;

use App\Domain\Google\Enums\AttachmentSource;
use App\Domain\Tenancy\Support\CompanyFiles;
use App\Models\Attachment;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Request attachments (doctor's letters, …): files on a private disk, rows in
 * `attachments` (source `storage`). Never Drive, never a public URL — files
 * are streamed by the controller after the policy check.
 */
final class RequestAttachmentStore
{
    public function disk(): Filesystem
    {
        return Storage::disk(config()->string('requests.attachments.disk', 'local'));
    }

    /**
     * Stores the files and creates their rows. Returns the stored paths so the
     * caller can remove them if the surrounding transaction fails.
     *
     * @param  list<UploadedFile>  $files
     * @return list<string>
     */
    public function store(EmployeeRequest $request, User $uploader, array $files): array
    {
        // company/<company>/request-attachments/<request>/… (older files keep
        // their path without the company prefix, read from attachments.storage_path).
        $directory = CompanyFiles::directory($request->company_id, config()->string('requests.attachments.directory', 'request-attachments'), $request->id);
        $paths = [];

        foreach ($files as $file) {
            $extension = strtolower($file->getClientOriginalExtension() ?: ($file->extension() ?? 'bin'));
            $path = $this->disk()->putFileAs($directory, $file, Str::ulid().'.'.$extension);

            if ($path === false) {
                $this->delete($paths);

                throw new RuntimeException('Lampiran gagal disimpan.');
            }

            $paths[] = $path;

            $request->attachments()->create([
                'source' => AttachmentSource::Storage,
                'storage_path' => $path,
                'filename' => self::safeName($file->getClientOriginalName(), $extension),
                'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
                'size_bytes' => (int) $file->getSize(),
                'uploaded_by' => $uploader->id,
            ]);
        }

        return $paths;
    }

    /**
     * Removes attachment rows of the request; returns their file paths
     * (delete them after the transaction commits).
     *
     * @param  list<string>  $ids
     * @return list<string>
     */
    public function detach(EmployeeRequest $request, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $attachments = $request->attachments()->whereKey($ids)->get();
        $paths = $attachments->pluck('storage_path')->filter()->values()->all();
        $attachments->each(fn (Attachment $attachment) => $attachment->forceDelete());

        return array_values(array_map('strval', $paths));
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

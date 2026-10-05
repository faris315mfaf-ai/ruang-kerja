<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Enums\GoogleDocType;
use App\Domain\Google\Services\DocCreator;
use App\Domain\Google\Services\DriveFileRecorder;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * "Dokumen baru": creates a Docs/Sheets/Slides file in the workspace folder
 * (synchronous, 10 s) and optionally attaches it to a task or comment.
 * Authorize first (e.g. Gate::authorize('update', $task)).
 */
final class CreateGoogleDoc
{
    public function __construct(
        private readonly DocCreator $creator,
        private readonly DriveFileRecorder $recorder,
    ) {}

    public function handle(Model&HasDriveFolder $owner, GoogleDocType $type, string $name, User $user, ?Model $attachable = null): DriveFile
    {
        $file = $this->creator->create($owner, $type, $name, $user);

        if ($attachable !== null) {
            $this->recorder->attach($file, $attachable, $user);
        }

        return $file;
    }
}

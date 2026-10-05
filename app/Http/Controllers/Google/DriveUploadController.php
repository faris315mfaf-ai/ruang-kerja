<?php

namespace App\Http\Controllers\Google;

use App\Domain\Google\Actions\AppendDriveUploadChunk;
use App\Domain\Google\Actions\CancelDriveUpload;
use App\Domain\Google\Actions\StartDriveUpload;
use App\Domain\Google\Data\DriveUploadSession;
use App\Domain\Google\Services\DriveUploadSessions;
use App\Domain\Workspaces\Queries\WorkspaceDriveListing;
use App\Http\Controllers\Controller;
use App\Http\Requests\Google\DriveUploadChunkRequest;
use App\Http\Requests\Google\StartDriveUploadRequest;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Chunked uploads to Google Drive (JSON). A session is opened for a
 * workspace folder here (or for an attachment by AttachmentController) and
 * belongs to the user who opened it; chunks, status and cancel are only
 * answered for that user (others get 404).
 */
class DriveUploadController extends Controller
{
    public function __construct(private readonly DriveUploadSessions $sessions) {}

    /**
     * POST /w/{KEY}/unggah — File tab ("Unggah", "Ambil foto dokumen").
     */
    public function store(StartDriveUploadRequest $request, Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveListing $listing, StartDriveUpload $start): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('create', [DriveFile::class, $workspace->id]);

        $folder = $listing->resolveFolder($workspace, $request->folder());
        abort_if($request->folder() !== null && $folder === null && $request->folder() !== $workspace->drive_folder_id, 404);

        $session = $start->handle(
            $workspace,
            $user,
            $request->string('name')->toString(),
            $request->integer('size'),
            $request->string('mime_type')->toString(),
            $folder?->google_file_id,
        );

        return self::sessionResponse($session, 201);
    }

    public function show(string $upload, #[CurrentUser] User $user): JsonResponse
    {
        return self::sessionResponse($this->owned($upload, $user));
    }

    /**
     * POST /unggah/{id} — one chunk. 409 with `received` when the offset is
     * not where the server is (the browser resumes from there).
     */
    public function chunk(DriveUploadChunkRequest $request, string $upload, #[CurrentUser] User $user, AppendDriveUploadChunk $append): JsonResponse
    {
        $session = $this->owned($upload, $user);
        $offset = $request->integer('offset');
        $chunk = $request->file('chunk');
        $bytes = $chunk === null || is_array($chunk) ? '' : (string) file_get_contents($chunk->getRealPath());

        $after = $append->handle($session, $offset, $bytes);

        return self::sessionResponse($after, $offset === $session->received ? 200 : 409);
    }

    public function destroy(string $upload, #[CurrentUser] User $user, CancelDriveUpload $cancel): JsonResponse
    {
        $session = $this->owned($upload, $user);

        return new JsonResponse(['cancelled' => $cancel->handle($session)]);
    }

    private function owned(string $id, User $user): DriveUploadSession
    {
        $session = $this->sessions->find($id);

        abort_if($session === null || $session->userId !== $user->id, 404);

        return $session;
    }

    private static function sessionResponse(DriveUploadSession $session, int $status = 200): JsonResponse
    {
        return new JsonResponse([
            ...$session->publicData(),
            'chunk_bytes' => DriveUploadSessions::chunkBytes(),
        ], $status);
    }
}

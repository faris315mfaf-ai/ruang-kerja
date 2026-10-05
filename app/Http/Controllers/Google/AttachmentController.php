<?php

namespace App\Http\Controllers\Google;

use App\Domain\Google\Actions\AttachDriveFile;
use App\Domain\Google\Actions\CreateGoogleDoc;
use App\Domain\Google\Actions\RemoveAttachment;
use App\Domain\Google\Actions\StartDriveUpload;
use App\Domain\Google\Queries\AttachmentList;
use App\Domain\Google\Services\DriveUploadSessions;
use App\Domain\Workspaces\Contracts\HasWorkspaceAttachments;
use App\Domain\Workspaces\Support\AttachableTypes;
use App\Http\Controllers\Controller;
use App\Http\Requests\Google\CreateDriveDocumentRequest;
use App\Http\Requests\Google\LinkDriveFilesRequest;
use App\Http\Requests\Google\StartDriveUploadRequest;
use App\Models\Attachment;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Drive attachments of any HasWorkspaceAttachments model (task, comment) — JSON endpoints behind
 * features/drive/attachments-panel.tsx. Listing needs `view` on the parent,
 * changes need AttachmentPolicy::create (`update` on the parent).
 */
class AttachmentController extends Controller
{
    private const string FORBIDDEN = 'Anda tidak punya akses untuk mengubah lampiran di sini.';

    public function __construct(private readonly AttachmentList $list) {}

    public function index(string $type, string $id, #[CurrentUser] User $user): JsonResponse
    {
        $attachable = $this->visible($type, $id);

        return new JsonResponse($this->payload($attachable, $user));
    }

    /**
     * "Pilih dari Drive" (Google Picker ids).
     */
    public function storeDrive(LinkDriveFilesRequest $request, string $type, string $id, #[CurrentUser] User $user, AttachDriveFile $attach): JsonResponse
    {
        $attachable = $this->editable($type, $id);
        $workspace = $attachable->attachmentWorkspace();

        foreach ($request->fileIds() as $fileId) {
            $attach->handle($user, $attachable, $workspace->id, $fileId);
        }

        return new JsonResponse($this->payload($attachable, $user), 201);
    }

    /**
     * "Dokumen baru": created in the workspace folder and attached (synchronous, 10 s).
     */
    public function storeDocument(CreateDriveDocumentRequest $request, string $type, string $id, #[CurrentUser] User $user, CreateGoogleDoc $create): JsonResponse
    {
        $attachable = $this->editable($type, $id);

        $file = $create->handle($attachable->attachmentWorkspace(), $request->type(), $request->string('name')->toString(), $user, $attachable);

        return new JsonResponse([
            ...$this->payload($attachable, $user),
            'web_view_link' => $file->web_view_link,
            'message' => "{$request->type()->label()} {$file->name} dibuat dan dilampirkan.",
        ], 201);
    }

    /**
     * "Unggah": opens a chunked upload session (then POST /unggah/{id}).
     */
    public function storeUpload(StartDriveUploadRequest $request, string $type, string $id, #[CurrentUser] User $user, StartDriveUpload $start): JsonResponse
    {
        $attachable = $this->editable($type, $id);

        $session = $start->handle(
            $attachable->attachmentWorkspace(),
            $user,
            $request->string('name')->toString(),
            $request->integer('size'),
            $request->string('mime_type')->toString(),
            null,
            $attachable,
        );

        return new JsonResponse([...$session->publicData(), 'chunk_bytes' => DriveUploadSessions::chunkBytes()], 201);
    }

    /**
     * "Lepas": soft delete; the Drive file stays.
     */
    public function destroy(Attachment $attachment, #[CurrentUser] User $user, RemoveAttachment $remove): JsonResponse
    {
        abort_unless(Gate::forUser($user)->allows('view', $attachment), 404);

        if (Gate::forUser($user)->denies('delete', $attachment)) {
            abort(403, self::FORBIDDEN);
        }

        $remove->handle($attachment, $user);

        return new JsonResponse(['removed' => true, 'message' => "{$attachment->filename} dilepas."]);
    }

    /**
     * @return Model&HasWorkspaceAttachments
     */
    private function visible(string $type, string $id): Model
    {
        $attachable = AttachableTypes::find($type, $id);

        abort_if($attachable === null || Gate::denies('view', $attachable), 404);

        return $attachable;
    }

    /**
     * @return Model&HasWorkspaceAttachments
     */
    private function editable(string $type, string $id): Model
    {
        $attachable = $this->visible($type, $id);

        if (Gate::denies('create', [Attachment::class, $attachable])) {
            abort(403, self::FORBIDDEN);
        }

        return $attachable;
    }

    /**
     * @param  Model&HasWorkspaceAttachments  $attachable
     * @return array<string, mixed>
     */
    private function payload(Model $attachable, User $user): array
    {
        return $this->list->for($attachable, $user);
    }
}

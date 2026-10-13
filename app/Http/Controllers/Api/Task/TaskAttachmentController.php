<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Google\Actions\QueueDriveUpload;
use App\Domain\Google\Actions\RemoveAttachment;
use App\Domain\Google\Exceptions\DriveUploadTooLarge;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Queries\AttachmentList;
use App\Domain\Tasks\Queries\TaskApiDetail;
use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Attachments of a task for the mobile app. Listing needs `view` of the task;
 * adding and removing need TaskPolicy::work through AttachmentPolicy (the
 * assignee of a task someone else assigned may attach deliverables). Files
 * live in the workspace's Google Drive folder, so uploads exist only while
 * the Drive integration does: otherwise 503 `drive_belum_siap`. An accepted
 * upload is queued like the web "Unggah" (the app never waits for Google —
 * poll GET until the file shows up). Picking an existing Drive file needs the
 * web Picker and the user's OAuth token, so it stays on the web.
 */
class TaskAttachmentController extends Controller
{
    private const string FORBIDDEN = 'Anda tidak punya akses untuk mengubah lampiran di sini.';

    public function __construct(private readonly AttachmentList $list) {}

    public function index(#[CurrentUser] User $user, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        return response()->json($this->payload($task, $user));
    }

    public function store(Request $request, Task $task, #[CurrentUser] User $user, QueueDriveUpload $queue): JsonResponse
    {
        Gate::authorize('view', $task);

        if (Gate::denies('create', [Attachment::class, $task])) {
            abort(403, self::FORBIDDEN);
        }

        if (! GoogleFeatures::enabled()) {
            return response()->json([
                'code' => 'drive_belum_siap',
                'message' => GoogleFeatures::DISABLED_MESSAGE,
            ], 503);
        }

        $maxKb = max(1, intdiv(GoogleFeatures::maxUploadBytes(), 1024));
        $request->validate(
            ['file' => ['required', 'file', 'max:'.$maxKb]],
            [
                'file.required' => 'Pilih berkas yang akan dilampirkan.',
                'file.file' => 'Berkas tidak valid.',
                'file.max' => 'Berkas terlalu besar (maksimal '.number_format($maxKb / 1024, 0, ',', '.').' MB).',
            ],
        );

        $file = $request->file('file');
        abort_if($file === null || is_array($file), 422);

        try {
            $uploadId = $queue->handle($task->workspace, $file, $user, $task);
        } catch (DriveUploadTooLarge) {
            return response()->json(['message' => 'Berkas terlalu besar.', 'errors' => ['file' => ['Berkas terlalu besar.']]], 422);
        }

        return response()->json([
            'upload_id' => $uploadId,
            'status' => 'diproses',
            'message' => 'Berkas sedang diunggah ke Drive workspace. Muat ulang daftar lampiran sebentar lagi.',
        ], 202);
    }

    public function destroy(Task $task, Attachment $attachment, #[CurrentUser] User $user, RemoveAttachment $remove): JsonResponse
    {
        // A file of another task (or comment) is "not found" under this one.
        abort_unless($attachment->attachable_type === $task->getMorphClass() && $attachment->attachable_id === $task->id, 404);
        Gate::authorize('view', $task);

        if (Gate::forUser($user)->denies('delete', $attachment)) {
            abort(403, self::FORBIDDEN);
        }

        $remove->handle($attachment, $user);

        return response()->json(['removed' => true, 'message' => "{$attachment->filename} dilepas.", ...$this->payload($task, $user)]);
    }

    /**
     * @return array{attachments: list<array<string, mixed>>, attachments_can_edit: bool, drive: array<string, mixed>}
     */
    private function payload(Task $task, User $user): array
    {
        $list = $this->list->for($task, $user);

        return [
            'attachments' => array_map(TaskApiDetail::attachment(...), $list['attachments']),
            'attachments_can_edit' => $list['can_edit'],
            'drive' => $list['drive'],
        ];
    }
}

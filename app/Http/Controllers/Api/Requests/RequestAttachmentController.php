<?php

namespace App\Http\Controllers\Api\Requests;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Actions\AddRequestAttachments;
use App\Domain\Requests\Actions\RemoveRequestAttachment;
use App\Domain\Requests\Services\RequestAttachmentStore;
use App\Http\Controllers\Api\Requests\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Pengajuan\RequestAttachmentUploadRequest;
use App\Http\Resources\Api\RequestDetail;
use App\Models\Attachment;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Attachments of a request (doctor's letter, assignment letter, …) for the
 * mobile app: upload to an own draft/revision, stream through the policy
 * (private disk, never a public URL, audited `request.attachment_viewed` like
 * the web) and remove from an own draft/revision.
 */
class RequestAttachmentController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly RequestDetail $detail) {}

    /**
     * 201 with the full request detail (its `attachments` list included).
     */
    public function store(RequestAttachmentUploadRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, AddRequestAttachments $add): JsonResponse
    {
        $this->visible($user, $employeeRequest);
        $this->allow($user, 'update', $employeeRequest, 'Lampiran hanya bisa diubah pada draf atau pengajuan yang diminta revisi.');

        $add->handle($user, $employeeRequest, $form->attachmentFiles());
        $fresh = $employeeRequest->fresh() ?? $employeeRequest;

        return response()->json(['request' => $this->detail->make($fresh, $user)], 201);
    }

    /**
     * Streams the file (Bearer). Sick-leave attachments are health data:
     * a substitute approver gets 403 (EmployeeRequestPolicy::viewAttachment).
     */
    public function show(#[CurrentUser] User $user, EmployeeRequest $employeeRequest, Attachment $attachment, RequestAttachmentStore $store, AuditLogger $audit): StreamedResponse
    {
        $this->visible($user, $employeeRequest);
        $this->allow($user, 'viewAttachment', $employeeRequest, 'Detail kesehatan disembunyikan untuk penyetuju pengganti.');

        $path = $attachment->storage_path;

        if ($path === null || ! $store->disk()->exists($path)) {
            abort(404);
        }

        $audit->log('request.attachment_viewed', $employeeRequest, null, ['attachment_id' => $attachment->id, 'filename' => $attachment->filename], $user);

        return $store->disk()->response($path, $attachment->filename, [
            'Content-Type' => $attachment->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function destroy(#[CurrentUser] User $user, EmployeeRequest $employeeRequest, Attachment $attachment, RemoveRequestAttachment $remove): JsonResponse
    {
        $this->visible($user, $employeeRequest);
        $this->allow($user, 'update', $employeeRequest, 'Lampiran hanya bisa diubah pada draf atau pengajuan yang diminta revisi.');

        $remove->handle($user, $employeeRequest, $attachment);
        $fresh = $employeeRequest->fresh() ?? $employeeRequest;

        return response()->json(['request' => $this->detail->make($fresh, $user)]);
    }
}

<?php

namespace App\Http\Controllers\Api\Requests;

use App\Domain\Requests\Actions\CancelRequest;
use App\Domain\Requests\Actions\DeleteRequestDraft;
use App\Domain\Requests\Actions\SaveRequestDraft;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Enums\RequestStatus;
use App\Http\Controllers\Api\Requests\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Pengajuan\SaveRequestApiRequest;
use App\Http\Resources\Api\RequestDetail;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/**
 * One request of the mobile app (B4-A): detail, draft save/edit/delete,
 * submit of a draft, resubmit after a revision and cancel by the requester.
 * Thin over the web actions (SaveRequestDraft, SubmitRequest, CancelRequest)
 * and EmployeeRequestPolicy; a request the caller may not see answers 404.
 */
class MyRequestController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly RequestDetail $detail) {}

    public function show(#[CurrentUser] User $user, EmployeeRequest $employeeRequest): JsonResponse
    {
        $this->visible($user, $employeeRequest);

        return response()->json(['request' => $this->detail->make($employeeRequest, $user)]);
    }

    /**
     * POST /pengajuan/draf — "Simpan draf" (multipart for attachments).
     * Locked types are refused like on the web, also for drafts.
     */
    public function storeDraft(SaveRequestApiRequest $form, #[CurrentUser] User $user, SaveRequestDraft $draft): JsonResponse
    {
        $this->allow($user, 'create', EmployeeRequest::class, 'Akun Anda tidak bisa membuat pengajuan.');

        $request = $draft->handle($user, $form->toInput());

        return $this->respond($request, $user, 201);
    }

    /**
     * PATCH /pengajuan/{id} — edit a draft or a request sent back for revision
     * without sending it (status unchanged). Only the fields sent change.
     */
    public function update(SaveRequestApiRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, SaveRequestDraft $draft): JsonResponse
    {
        $this->allow($user, 'update', $employeeRequest, 'Pengajuan ini tidak bisa diubah lagi.');

        return $this->respond($draft->handle($user, $form->toInput(), $employeeRequest), $user);
    }

    /**
     * POST /pengajuan/{id}/kirim — send a draft (fields sent are applied first).
     */
    public function submit(SaveRequestApiRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, SubmitRequest $submit): JsonResponse
    {
        $this->allow($user, 'update', $employeeRequest, 'Pengajuan ini tidak bisa diubah lagi.');

        if ($employeeRequest->status !== RequestStatus::Draft) {
            throw ValidationException::withMessages(['status' => 'Pengajuan ini bukan draf. Gunakan "Revisi & kirim ulang".']);
        }

        return $this->respond($submit->handle($user, $form->toInput(), $employeeRequest), $user);
    }

    /**
     * POST /pengajuan/{id}/kirim-ulang — send again after "Minta revisi"
     * (next round; the edited fields are applied first).
     */
    public function resubmit(SaveRequestApiRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, SubmitRequest $submit): JsonResponse
    {
        $this->allow($user, 'update', $employeeRequest, 'Pengajuan ini tidak bisa diubah lagi.');

        if ($employeeRequest->status !== RequestStatus::RevisionRequested) {
            throw ValidationException::withMessages(['status' => 'Pengajuan ini tidak sedang diminta revisi.']);
        }

        return $this->respond($submit->handle($user, $form->toInput(), $employeeRequest), $user);
    }

    /**
     * POST /pengajuan/{id}/batal — the requester cancels before the decision
     * (draft, pending, revision). Approved requests are voided by HR instead.
     */
    public function cancel(#[CurrentUser] User $user, EmployeeRequest $employeeRequest, CancelRequest $cancel): JsonResponse
    {
        $this->visible($user, $employeeRequest);

        if ($employeeRequest->user_id === $user->id && ! $employeeRequest->status->isCancelable()) {
            throw ValidationException::withMessages(['status' => 'Pengajuan yang sudah diputus tidak bisa dibatalkan.']);
        }

        $this->allow($user, 'cancel', $employeeRequest, 'Hanya pemohon yang bisa membatalkan pengajuan ini.');

        return $this->respond($cancel->handle($user, $employeeRequest), $user);
    }

    /**
     * DELETE /pengajuan/{id} — throw away an own draft that was never sent.
     */
    public function destroy(#[CurrentUser] User $user, EmployeeRequest $employeeRequest, DeleteRequestDraft $delete): Response
    {
        $this->visible($user, $employeeRequest);

        if ($employeeRequest->user_id === $user->id && $employeeRequest->status !== RequestStatus::Draft) {
            throw ValidationException::withMessages(['status' => 'Hanya draf yang bisa dihapus. Batalkan pengajuan ini.']);
        }

        $this->allow($user, 'delete', $employeeRequest, 'Hanya pemohon yang bisa menghapus draf ini.');
        $delete->handle($user, $employeeRequest);

        return response()->noContent();
    }

    private function respond(EmployeeRequest $request, User $user, int $status = 200): JsonResponse
    {
        $fresh = $request->fresh() ?? $request;

        return response()->json(['request' => $this->detail->make($fresh, $user)], $status);
    }
}

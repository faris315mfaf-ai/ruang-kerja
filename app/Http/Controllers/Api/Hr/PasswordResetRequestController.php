<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Auth\Actions\DecidePasswordReset;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Organization\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Presenters\EmployeePresenter;
use App\Http\Requests\Admin\RejectPasswordResetRequest;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Lupa kata sandi" requests decided from the phone (Bagian 5 / B5-B; the
 * employee waits on their screen). Same rules as the web Admin › Karyawan
 * panel: PasswordResetRequest::visibleTo (HR & Super Admin of the company,
 * never one's own, a Super Admin's request only for another Super Admin) —
 * anything else is 404 — then PasswordResetRequestPolicy::decide and the
 * web Action DecidePasswordReset (audit `user.password_reset_approved` /
 * `_rejected`, HR's "Perlu tindakan" resolved for every recipient).
 */
class PasswordResetRequestController extends Controller
{
    public const int LIMIT = 50;

    public function index(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', PasswordResetRequest::class);

        $requests = PasswordResetRequest::query()
            ->visibleTo($user)
            ->awaitingDecision()
            ->with(['user:id,name,avatar_url', 'user.roles:id,name'])
            ->oldest()
            ->limit(self::LIMIT)
            ->get();

        return response()->json([
            'requests' => array_values($requests->map(fn (PasswordResetRequest $request): array => $this->item($request, $user))->all()),
            'total' => $requests->count(),
        ]);
    }

    public function approve(string $passwordResetRequest, #[CurrentUser] User $user, DecidePasswordReset $decide): JsonResponse
    {
        $resetRequest = $this->findVisible($passwordResetRequest, $user);
        Gate::authorize('decide', $resetRequest);

        $decided = $decide->handle($user, $resetRequest, approve: true);
        $name = $resetRequest->user->name ?? $resetRequest->email;

        return response()->json([
            'message' => "Permintaan {$name} disetujui. Ia bisa membuat kata sandi baru dalam 30 menit.",
            'request' => $this->decision($decided),
        ]);
    }

    public function reject(RejectPasswordResetRequest $form, string $passwordResetRequest, #[CurrentUser] User $user, DecidePasswordReset $decide): JsonResponse
    {
        $resetRequest = $this->findVisible($passwordResetRequest, $user);
        Gate::authorize('decide', $resetRequest);

        $decided = $decide->handle($user, $resetRequest, approve: false, reason: $form->reason());
        $name = $resetRequest->user->name ?? $resetRequest->email;

        return response()->json([
            'message' => "Permintaan {$name} ditolak.",
            'request' => $this->decision($decided),
        ]);
    }

    private function findVisible(string $id, User $user): PasswordResetRequest
    {
        Gate::authorize('viewAny', PasswordResetRequest::class);

        return PasswordResetRequest::query()->visibleTo($user)->with('user')->findOrFail($id);
    }

    /**
     * @return array<string, mixed>
     */
    private function item(PasswordResetRequest $request, User $viewer): array
    {
        $privileged = $request->user?->hasAnyRole(Role::superAdminSetsPassword()) ?? false;

        return [
            ...EmployeePresenter::passwordReset($request),
            // The account holds direksi/hr/super_admin: approving is fine (the owner
            // types the new password), but "Atur kata sandi" is Super Admin only (R-06).
            'privileged_account' => $privileged,
            'can' => ['decide' => Gate::forUser($viewer)->allows('decide', $request)],
        ];
    }

    /**
     * @return array{id: string, status: string, decided_at: string|null, setup_expires_at: string|null}
     */
    private function decision(PasswordResetRequest $request): array
    {
        return [
            'id' => $request->id,
            'status' => $request->status->value,
            'decided_at' => $request->decided_at?->toIso8601String(),
            // Window for the employee to type the new password (approved only).
            'setup_expires_at' => $request->status === PasswordResetStatus::Approved ? $request->setupExpiresAt()?->toIso8601String() : null,
        ];
    }
}

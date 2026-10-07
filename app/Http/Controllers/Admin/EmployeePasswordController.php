<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Auth\Actions\DecidePasswordReset;
use App\Domain\Auth\Actions\SetEmployeePassword;
use App\Domain\Auth\Services\DefaultPassword;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectPasswordResetRequest;
use App\Http\Requests\Admin\SetEmployeePasswordRequest;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Admin › Karyawan: HR sets an employee's password and decides "Lupa kata
 * sandi" requests (owner decision 6 Oct 2026). Requests the viewer may not
 * decide are 404 (PasswordResetRequest::visibleTo).
 */
class EmployeePasswordController extends Controller
{
    public function store(SetEmployeePasswordRequest $request, User $employee, #[CurrentUser] User $user, SetEmployeePassword $setPassword): RedirectResponse
    {
        Gate::authorize('setPassword', $employee);

        $setPassword->handle($user, $employee, $request->password(), $request->boolean('must_change'));

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kata sandi {$employee->name} diperbarui. Semua perangkatnya sudah dikeluarkan."]);

        return back();
    }

    /**
     * The company default password for the "Sandi bawaan" option of the dialog,
     * fetched only when HR reveals it (never in page props, never cached).
     * 404 while EMPLOYEE_DEFAULT_PASSWORD is empty or for a Super Admin.
     */
    public function defaultPassword(User $employee, DefaultPassword $defaultPassword): JsonResponse
    {
        Gate::authorize('setPassword', $employee);
        abort_unless($defaultPassword->appliesTo($employee), 404);

        return response()
            ->json(['password' => $defaultPassword->value()])
            ->header('Cache-Control', 'no-store, private');
    }

    public function approve(string $passwordResetRequest, #[CurrentUser] User $user, DecidePasswordReset $decide): RedirectResponse
    {
        $resetRequest = $this->findVisible($passwordResetRequest, $user);
        Gate::authorize('decide', $resetRequest);

        $decide->handle($user, $resetRequest, approve: true);

        $name = $resetRequest->user->name ?? $resetRequest->email;
        Inertia::flash('toast', ['type' => 'success', 'message' => "Permintaan {$name} disetujui. Ia bisa membuat kata sandi baru dalam 30 menit."]);

        return back();
    }

    public function reject(RejectPasswordResetRequest $request, string $passwordResetRequest, #[CurrentUser] User $user, DecidePasswordReset $decide): RedirectResponse
    {
        $resetRequest = $this->findVisible($passwordResetRequest, $user);
        Gate::authorize('decide', $resetRequest);

        $decide->handle($user, $resetRequest, approve: false, reason: $request->reason());

        $name = $resetRequest->user->name ?? $resetRequest->email;
        Inertia::flash('toast', ['type' => 'success', 'message' => "Permintaan {$name} ditolak."]);

        return back();
    }

    private function findVisible(string $id, User $user): PasswordResetRequest
    {
        Gate::authorize('viewAny', PasswordResetRequest::class);

        return PasswordResetRequest::query()->visibleTo($user)->with('user')->findOrFail($id);
    }
}

<?php

use App\Http\Controllers\Admin\ApprovalFlowController;
use App\Http\Controllers\Admin\LeaveBalanceController;
use App\Http\Controllers\Admin\LeaveTypeController;
use App\Http\Controllers\Admin\RequestTypeController;
use App\Http\Controllers\Requests\ApprovalController;
use App\Http\Controllers\Requests\ApprovalDelegationController;
use App\Http\Controllers\Requests\RequestController;
use App\Http\Controllers\Requests\RequestPreviewController;
use Illuminate\Support\Facades\Route;

/*
| Pengajuan & persetujuan (Sprint 4). Loaded from routes/web.php.
*/

Route::middleware(['auth', 'verified'])->group(function () {
    Route::prefix('pengajuan')->name('requests.')->group(function () {
        Route::get('/', [RequestController::class, 'index'])->name('index');
        Route::get('baru', [RequestController::class, 'create'])->name('create');
        Route::get('pratinjau', RequestPreviewController::class)->middleware('throttle:120,1')->name('preview');
        Route::post('/', [RequestController::class, 'store'])->middleware('throttle:30,1')->name('store');
        Route::get('{employeeRequest}', [RequestController::class, 'show'])->name('show');
        Route::get('{employeeRequest}/ubah', [RequestController::class, 'edit'])->name('edit');
        // POST (not PUT) so multipart attachments arrive without method spoofing issues.
        Route::post('{employeeRequest}', [RequestController::class, 'update'])->middleware('throttle:30,1')->name('update');
        Route::post('{employeeRequest}/batal', [RequestController::class, 'cancel'])->name('cancel');
        Route::get('{employeeRequest}/lampiran/{index}', [RequestController::class, 'attachment'])
            ->whereNumber('index')
            ->name('attachment');
    });

    Route::prefix('persetujuan')->name('approvals.')->group(function () {
        Route::get('/', [ApprovalController::class, 'index'])->name('index');
        Route::post('massal', [ApprovalController::class, 'bulk'])->name('bulk');
        Route::post('delegasi', [ApprovalDelegationController::class, 'store'])->name('delegations.store');
        Route::delete('delegasi/{delegation}', [ApprovalDelegationController::class, 'destroy'])->name('delegations.destroy');
        Route::get('{employeeRequest}', [ApprovalController::class, 'show'])->name('show');
        Route::post('{employeeRequest}/setujui', [ApprovalController::class, 'approve'])->name('approve');
        Route::post('{employeeRequest}/tolak', [ApprovalController::class, 'reject'])->name('reject');
        Route::post('{employeeRequest}/revisi', [ApprovalController::class, 'revise'])->name('revise');
    });

    Route::prefix('admin')->name('admin.')->group(function () {
        Route::get('pengajuan', [RequestTypeController::class, 'index'])->name('request-types.index');
        Route::get('pengajuan/pratinjau', [RequestTypeController::class, 'preview'])->name('request-types.preview');
        Route::post('pengajuan/jenis', [LeaveTypeController::class, 'store'])->name('leave-types.store');
        Route::put('pengajuan/jenis/{leaveType}', [LeaveTypeController::class, 'update'])->name('leave-types.update');
        Route::delete('pengajuan/jenis/{leaveType}', [LeaveTypeController::class, 'destroy'])->name('leave-types.destroy');
        Route::post('pengajuan/alur', [ApprovalFlowController::class, 'store'])->name('approval-flows.store');
        Route::put('pengajuan/alur/{approvalFlow}', [ApprovalFlowController::class, 'update'])->name('approval-flows.update');
        Route::delete('pengajuan/alur/{approvalFlow}', [ApprovalFlowController::class, 'destroy'])->name('approval-flows.destroy');

        Route::get('saldo-cuti', [LeaveBalanceController::class, 'index'])->name('leave-balances.index');
        Route::post('saldo-cuti/buat', [LeaveBalanceController::class, 'generate'])->name('leave-balances.generate');
        Route::put('saldo-cuti/{leaveBalance}', [LeaveBalanceController::class, 'update'])->name('leave-balances.update');
    });
});

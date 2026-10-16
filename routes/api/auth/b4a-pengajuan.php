<?php

use App\Http\Controllers\Api\Requests\ApprovalController;
use App\Http\Controllers\Api\Requests\ApprovalDelegationController;
use App\Http\Controllers\Api\Requests\MyRequestController;
use App\Http\Controllers\Api\Requests\RequestAttachmentController;
use App\Http\Controllers\Requests\RequestPreviewController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B4-A Pengajuan & persetujuan (Bagian 4) — dimuat di dalam grup v1 `auth:sanctum` + `api-v1`
|--------------------------------------------------------------------------
|
| Draf, detail, kirim/kirim ulang, batal, lampiran, persetujuan (setujui/
| tolak/revisi, batalkan yang disetujui oleh HR) dan delegasi untuk aplikasi
| Android — controller tipis di atas Action/Policy/FormRequest web. Daftar,
| jenis dan kirim baru tetap di routes/api.php (diperluas di tempatnya).
| `GET /persetujuan` sudah dipakai persetujuan privasi (B2), jadi daftar
| antrean ada di `/persetujuan/daftar`. Dokumen: docs/sesi/ponsel-b4a-pengajuan.md.
*/

// Pengajuan saya
Route::post('pengajuan/draf', [MyRequestController::class, 'storeDraft'])
    ->middleware('throttle:30,1')->name('requests.draft');
// Ringkasan form (durasi, saldo non-staf, benturan, rekan absen, alur) — controller web.
Route::get('pengajuan/pratinjau', RequestPreviewController::class)
    ->middleware('throttle:120,1')->name('requests.preview');

Route::get('pengajuan/{employeeRequest}', [MyRequestController::class, 'show'])
    ->whereUlid('employeeRequest')->name('requests.show');
Route::patch('pengajuan/{employeeRequest}', [MyRequestController::class, 'update'])
    ->whereUlid('employeeRequest')->middleware('throttle:30,1')->name('requests.update');
Route::delete('pengajuan/{employeeRequest}', [MyRequestController::class, 'destroy'])
    ->whereUlid('employeeRequest')->name('requests.destroy');
Route::post('pengajuan/{employeeRequest}/kirim', [MyRequestController::class, 'submit'])
    ->whereUlid('employeeRequest')->middleware('throttle:30,1')->name('requests.submit');
Route::post('pengajuan/{employeeRequest}/kirim-ulang', [MyRequestController::class, 'resubmit'])
    ->whereUlid('employeeRequest')->middleware('throttle:30,1')->name('requests.resubmit');
Route::post('pengajuan/{employeeRequest}/batal', [MyRequestController::class, 'cancel'])
    ->whereUlid('employeeRequest')->name('requests.cancel');
Route::post('pengajuan/{employeeRequest}/batal-disetujui', [ApprovalController::class, 'cancelApproved'])
    ->whereUlid('employeeRequest')->middleware('throttle:30,1')->name('requests.cancel-approved');

// Lampiran (disk privat; unduh lewat Policy + audit)
Route::post('pengajuan/{employeeRequest}/lampiran', [RequestAttachmentController::class, 'store'])
    ->whereUlid('employeeRequest')->middleware('throttle:30,1')->name('requests.attachments.store');
Route::get('pengajuan/{employeeRequest}/lampiran/{attachment}', [RequestAttachmentController::class, 'show'])
    ->whereUlid(['employeeRequest', 'attachment'])->scopeBindings()->name('requests.attachments.show');
Route::delete('pengajuan/{employeeRequest}/lampiran/{attachment}', [RequestAttachmentController::class, 'destroy'])
    ->whereUlid(['employeeRequest', 'attachment'])->scopeBindings()->name('requests.attachments.destroy');

// Persetujuan
Route::get('persetujuan/daftar', [ApprovalController::class, 'index'])->name('approvals.index');
Route::get('persetujuan/hitung', [ApprovalController::class, 'count'])->name('approvals.count');

// Delegasi
Route::get('persetujuan/delegasi', [ApprovalDelegationController::class, 'index'])->name('approvals.delegations.index');
Route::post('persetujuan/delegasi', [ApprovalDelegationController::class, 'store'])
    ->middleware('throttle:30,1')->name('approvals.delegations.store');
Route::patch('persetujuan/delegasi/{delegation}', [ApprovalDelegationController::class, 'update'])
    ->whereUlid('delegation')->middleware('throttle:30,1')->name('approvals.delegations.update');
Route::delete('persetujuan/delegasi/{delegation}', [ApprovalDelegationController::class, 'destroy'])
    ->whereUlid('delegation')->name('approvals.delegations.destroy');

Route::get('persetujuan/{employeeRequest}', [ApprovalController::class, 'show'])
    ->whereUlid('employeeRequest')->name('approvals.show');
Route::post('persetujuan/{employeeRequest}/setujui', [ApprovalController::class, 'approve'])
    ->whereUlid('employeeRequest')->middleware('throttle:60,1')->name('approvals.approve');
Route::post('persetujuan/{employeeRequest}/tolak', [ApprovalController::class, 'reject'])
    ->whereUlid('employeeRequest')->middleware('throttle:60,1')->name('approvals.reject');
Route::post('persetujuan/{employeeRequest}/revisi', [ApprovalController::class, 'revise'])
    ->whereUlid('employeeRequest')->middleware('throttle:60,1')->name('approvals.revise');

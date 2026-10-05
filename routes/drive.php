<?php

use App\Domain\Workspaces\Support\AttachableTypes;
use App\Http\Controllers\Google\AttachmentController;
use App\Http\Controllers\Google\DriveUploadController;
use App\Http\Controllers\Workspaces\WorkspaceDocumentController;
use App\Http\Controllers\Workspaces\WorkspaceDriveController;
use App\Http\Controllers\Workspaces\WorkspaceFileController;
use Illuminate\Support\Facades\Route;

/*
| Google Drive in workspaces (Sprint 7 part B). The tab pages
| (GET /w/{KEY}/file, /w/{KEY}/dokumen) are declared in routes/workspaces.php
| next to the other tabs; `{workspace}` is bound there (key or ULID).
*/
Route::middleware(['auth', 'verified'])->group(function () {
    Route::prefix('w/{workspace}')->group(function () {
        Route::post('dokumen', [WorkspaceDocumentController::class, 'store'])->name('workspaces.documents.store');
        Route::post('file/folder', [WorkspaceFileController::class, 'storeFolder'])->name('workspaces.files.folders.store');
        Route::post('file/tautkan', [WorkspaceFileController::class, 'link'])->name('workspaces.files.link');
        Route::post('file/segarkan', [WorkspaceFileController::class, 'refresh'])->name('workspaces.files.refresh');
        Route::post('file/unggah', [DriveUploadController::class, 'store'])->name('workspaces.files.upload');
        Route::post('drive/sinkron', [WorkspaceDriveController::class, 'sync'])->name('workspaces.drive.sync');
    });

    // Chunked uploads (sessions opened above or by the attachments endpoints).
    Route::get('unggah/{upload}', [DriveUploadController::class, 'show'])->name('drive-uploads.show');
    Route::post('unggah/{upload}', [DriveUploadController::class, 'chunk'])->middleware('throttle:600,1')->name('drive-uploads.chunk');
    Route::delete('unggah/{upload}', [DriveUploadController::class, 'destroy'])->name('drive-uploads.destroy');

    // Attachments of tasks (and, from Sprint 6, comments): features/drive/attachments-panel.tsx.
    Route::prefix('lampiran/{type}/{id}')->whereIn('type', AttachableTypes::aliases())->group(function () {
        Route::get('/', [AttachmentController::class, 'index'])->name('attachments.index');
        Route::post('drive', [AttachmentController::class, 'storeDrive'])->name('attachments.drive');
        Route::post('dokumen', [AttachmentController::class, 'storeDocument'])->name('attachments.document');
        Route::post('unggah', [AttachmentController::class, 'storeUpload'])->name('attachments.upload');
    });
    Route::delete('lampiran/{attachment}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');
});

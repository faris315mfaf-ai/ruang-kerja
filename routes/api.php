<?php

use App\Http\Controllers\Api\Account\DesktopLinkController;
use App\Http\Controllers\Api\Attendance\AttendanceHistoryController;
use App\Http\Controllers\Api\Attendance\CheckInController;
use App\Http\Controllers\Api\Attendance\CheckOutController;
use App\Http\Controllers\Api\Attendance\MyAttendanceController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Briefings\LatestBriefingController;
use App\Http\Controllers\Api\Chat\ChannelController as ChatChannelController;
use App\Http\Controllers\Api\Chat\ChannelReadController;
use App\Http\Controllers\Api\Chat\MessageController as ChatMessageController;
use App\Http\Controllers\Api\Devices\DeviceBiometricController;
use App\Http\Controllers\Api\Devices\DeviceController;
use App\Http\Controllers\Api\Inbox\InboxController;
use App\Http\Controllers\Api\Meetings\AgendaController as MeetingAgendaController;
use App\Http\Controllers\Api\Meetings\CalendarController as MeetingCalendarController;
use App\Http\Controllers\Api\Meetings\MeetingController as MeetingApiController;
use App\Http\Controllers\Api\Meetings\MinutesController as MeetingMinutesController;
use App\Http\Controllers\Api\Meetings\RsvpController as MeetingRsvpController;
use App\Http\Controllers\Api\Notes\NoteController;
use App\Http\Controllers\Api\Notes\WorkspaceNotesController;
use App\Http\Controllers\Api\Privacy\ConsentController as PrivacyConsentController;
use App\Http\Controllers\Api\Privacy\MyDataController;
use App\Http\Controllers\Api\Privacy\PrivacyPolicyController as ApiPrivacyPolicyController;
use App\Http\Controllers\Api\Requests\RequestController;
use App\Http\Controllers\Api\Task\TaskCommentController;
use App\Http\Controllers\Api\Task\TaskController;
use App\Http\Controllers\Api\Task\TaskStatusController;
use App\Http\Controllers\Api\Workspaces\WorkspaceBoardController;
use App\Http\Controllers\Api\Workspaces\WorkspaceController;
use App\Http\Controllers\Api\Workspaces\WorkspaceMemberController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API aplikasi ponsel (Tahap 1 — /api/v1)
|--------------------------------------------------------------------------
|
| JSON API untuk aplikasi Android (Expo). Autentikasi: token Sanctum per
| perangkat (diterbitkan POST /auth/login); otorisasi tetap lewat Policy
| per endpoint — token tidak memakai abilities granular (config/sanctum.php).
| Galat selalu JSON (shouldRenderJsonWhen di bootstrap/app.php). Rute modul
| berikutnya (absensi, tugas, inbox, …) ditambahkan di berkas routes/<modul>.php
| miliknya lalu di-require dari sini, seperti pola routes/web.php.
*/

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    // Masuk (tamu): throttle per IP; kegagalan kredensial juga menghitung
    // ke limiter `login` Fortify lewat AuthenticateEmployee.
    Route::post('auth/login', [AuthController::class, 'store'])
        ->middleware('throttle:api-login')
        ->name('auth.login');

    // --- B2 privasi (publik) ---
    // Kebijakan privasi JSON tanpa sesi (layar Masuk & peninjau Play Store);
    // sumber Markdown yang sama dengan halaman web.
    Route::get('kebijakan-privasi', ApiPrivacyPolicyController::class)
        ->middleware('throttle:api-v1')->name('privacy.policy');
    // --- /B2 ---

    Route::middleware(['auth:sanctum', 'throttle:api-v1'])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'destroy'])->name('auth.logout');
        Route::get('auth/saya', [AuthController::class, 'show'])->name('auth.saya');

        // Perangkat saya (DevicePolicy: hanya pemilik — HR/Super Admin sengaja
        // tanpa akses). "{device}" = ULID.
        Route::get('perangkat', [DeviceController::class, 'index'])->name('devices.index');
        Route::delete('perangkat/{device}', [DeviceController::class, 'destroy'])->name('devices.destroy');
        Route::put('perangkat/{device}/push-token', [DeviceController::class, 'updatePushToken'])->name('devices.push-token');

        // absensi & tugas — pemilik token sendiri; Action, presenter dan Policy
        // web dipakai ulang. Check-in/out memakai limiter `check-in` yang sama
        // dengan web (6/menit per user); penolakan bisnis berbody identik
        // ({message, reason, context} 422).
        Route::get('absensi/hari-ini', [MyAttendanceController::class, 'today'])->name('attendance.today');
        Route::get('absensi/riwayat', AttendanceHistoryController::class)->name('attendance.history');
        Route::post('absensi/check-in', CheckInController::class)
            ->middleware('throttle:check-in')->name('attendance.check-in');
        Route::post('absensi/check-out', CheckOutController::class)
            ->middleware('throttle:check-in')->name('attendance.check-out');

        // tugas — Action, presenter dan Policy web dipakai ulang. Tulis
        // (Tahap 2 paritas fitur): buat = editTasks workspace target (404
        // bila tak terlihat, 403 bila hanya bisa melihat), sunting/hapus =
        // aturan 9 Okt (tugas titipan orang lain hanya pembuat/atasan);
        // komentar teks polos menjadi dokumen Tiptap yang sama dengan web,
        // jadi notifikasi mention/pengikut tetap jalan.
        Route::get('tugas/hari-ini', [TaskController::class, 'today'])->name('tasks.today');
        Route::get('tugas', [TaskController::class, 'index'])->name('tasks.index');
        Route::post('tugas', [TaskController::class, 'store'])->name('tasks.store');
        Route::get('tugas/{task}', [TaskController::class, 'show'])->whereUlid('task')->name('tasks.show');
        Route::patch('tugas/{task}', [TaskController::class, 'update'])->whereUlid('task')->name('tasks.update');
        Route::delete('tugas/{task}', [TaskController::class, 'destroy'])->whereUlid('task')->name('tasks.destroy');
        Route::patch('tugas/{task}/status', TaskStatusController::class)->whereUlid('task')->name('tasks.status');
        Route::get('tugas/{task}/komentar', [TaskCommentController::class, 'index'])->whereUlid('task')->name('tasks.comments.index');
        Route::post('tugas/{task}/komentar', [TaskCommentController::class, 'store'])->whereUlid('task')
            ->middleware('throttle:comments')->name('tasks.comments.store');

        // papan workspace — kolom (statuses) + kartu query BoardTasks web
        // (tugas terbuka + yang ditutup ≤30 hari, tanpa N+1); "{workspace}"
        // binding web (key/ULID, 404 bila tak terlihat) dipakai ulang.
        Route::get('workspace/{workspace}/papan', WorkspaceBoardController::class)->name('workspaces.board');

        // catatan — di balik flag `notes` seperti web (404 saat mati). Daftar
        // + buat per workspace (NoteLibrary/CreateNote web), detail dengan
        // isi versi terakhir sebagai body_html (NoteHtml), simpan =
        // fallback tanpa kolaborasi web (SaveNoteContent; konflik 409 bila
        // updated_at dasarnya lebih tua). Kolaborasi realtime Yjs tetap web.
        Route::middleware(EnsureFeatureEnabled::class.':notes')->group(function (): void {
            Route::get('workspace/{workspace}/catatan', [WorkspaceNotesController::class, 'index'])->name('workspaces.notes');
            Route::post('workspace/{workspace}/catatan', [WorkspaceNotesController::class, 'store'])->name('workspaces.notes.store');
            Route::get('catatan/{note}', [NoteController::class, 'show'])->whereUlid('note')->name('notes.show');
            Route::patch('catatan/{note}', [NoteController::class, 'update'])->whereUlid('note')->name('notes.update');
        });

        // obrolan — di balik flag `chat` seperti web (404 saat mati). Kanal
        // ChatInbox web (jumlah belum dibaca, pratinjau terakhir), timeline
        // 30 pesan dengan ?sebelum= untuk scroll balik, dan kirim teks polos
        // lewat PostMessage web (broadcast Reverb untuk pengguna web tetap
        // jalan; aplikasi v1 memakai polling).
        Route::middleware(EnsureFeatureEnabled::class.':chat')->group(function (): void {
            Route::get('obrolan/kanal', ChatChannelController::class)->name('chat.channels.index');
            Route::post('obrolan/kanal/{channel}/dibaca', ChannelReadController::class)->name('chat.channels.read');
            Route::get('obrolan/kanal/{channel}/pesan', [ChatMessageController::class, 'index'])
                ->whereUlid('channel')->name('chat.messages.index');
            Route::post('obrolan/kanal/{channel}/pesan', [ChatMessageController::class, 'store'])
                ->whereUlid('channel')->middleware('throttle:messages')->name('chat.messages.store');
        });

        // rapat & kalender — di balik flag `meetings` seperti web (404 saat
        // mati). Agenda/detail/notulen/RSVP ponsel memakai query, presenter,
        // Action dan Policy web rapat: kemunculan seri diperluas
        // (MeetingFeed/MeetingOccurrences, tanpa N+1), notulen dibaca dari
        // MinutesStore + MeetingPresenter, RSVP lewat UpdateRsvp (berlaku
        // untuk seluruh seri), kalender = CalendarFeed web. Rapat tak
        // terlihat → 404 (denyAsNotFound), isi tidak pernah bocor. Ruang
        // video v1 dibuka di browser: detail menyertakan join_href web,
        // tanpa token LiveKit lewat API.
        Route::middleware(EnsureFeatureEnabled::class.':meetings')->group(function (): void {
            Route::get('rapat', MeetingAgendaController::class)->name('meetings.index');
            Route::get('rapat/{meeting}', [MeetingApiController::class, 'show'])->whereUlid('meeting')->name('meetings.show');
            Route::post('rapat/{meeting}/kehadiran', [MeetingRsvpController::class, 'store'])->whereUlid('meeting')->name('meetings.rsvp');
            Route::get('rapat/{meeting}/notulen', [MeetingMinutesController::class, 'show'])->whereUlid('meeting')->name('meetings.minutes.show');
            Route::get('kalender', MeetingCalendarController::class)->name('meetings.calendar');
        });

        // inbox — feed notifikasi aktif pemilik token (presenter web
        // InboxNotificationResource; ?belum-dibaca=1 menyaring) dan tandai
        // satu dibaca lewat Action web. Notifikasi orang lain tidak pernah
        // ter-resolve (scope visibleTo → 404); "{notification}" = UUID.
        Route::get('inbox', [InboxController::class, 'index'])->name('inbox.index');
        Route::post('inbox/{notification}/baca', [InboxController::class, 'read'])
            ->whereUuid('notification')->name('inbox.read');

        // workspace — semua yang terlihat pemilik (Workspace::visibleTo),
        // digroup seperti direktori web: pribadi · divisi · proyek · lainnya.
        Route::get('workspace', WorkspaceController::class)->name('workspaces.index');
        Route::get('workspace/{workspace}/anggota', WorkspaceMemberController::class)->name('workspaces.members');

        // pengajuan — "Pengajuan saya" pemilik (presenter web), jenis yang
        // bisa diajukan (LeaveType terlihat+aktif, tanpa yang terkunci/
        // belum eligible), dan kirim pengajuan baru lewat Action SubmitRequest
        // web (alur approval + notifikasinya sama; draf tetap alur web).
        Route::get('pengajuan/jenis', [RequestController::class, 'types'])->name('requests.types');
        Route::get('pengajuan', [RequestController::class, 'index'])->name('requests.index');
        // Same limit as the web form (routes/requests.php: 30/menit).
        Route::post('pengajuan', [RequestController::class, 'store'])->middleware('throttle:30,1')->name('requests.store');

        // briefing — catatan terakhir perusahaan pemilik (baca saja);
        // 204 bila belum ada. Mencatat & delegasi tetap di web.
        Route::get('briefing/terakhir', LatestBriefingController::class)->name('briefing.latest');

        // --- B2 privasi ---
        // Data Saya (hanya data pemilik token; NIK selalu tersamar) + ekspor
        // berkas yang sama dengan web lewat Bearer (diaudit, 10/menit);
        // persetujuan lokasi+selfie (Action web dipakai ulang, HR diberi
        // tahu saat dicabut); sakelar biometrik per perangkat (DevicePolicy:
        // hanya perangkat sendiri); tautan desktop ke email pemilik token
        // (allowlist config/api_app_links.php, 3/menit).
        Route::get('privasi/data-saya', [MyDataController::class, 'show'])->name('privacy.my-data');
        Route::get('privasi/ekspor', [MyDataController::class, 'export'])
            ->middleware('throttle:10,1')->name('privacy.export');
        Route::get('persetujuan', [PrivacyConsentController::class, 'show'])->name('consent.show');
        Route::post('persetujuan', [PrivacyConsentController::class, 'store'])
            ->middleware('throttle:20,1')->name('consent.store');
        Route::delete('persetujuan', [PrivacyConsentController::class, 'destroy'])
            ->middleware('throttle:20,1')->name('consent.destroy');
        Route::match(['PATCH', 'PUT'], 'perangkat/{device}/biometrik', DeviceBiometricController::class)
            ->whereUlid('device')->name('devices.biometric');
        Route::post('tautan-desktop', DesktopLinkController::class)
            ->middleware('throttle:3,1')->name('desktop-link');
        // --- /B2 ---
    });
});

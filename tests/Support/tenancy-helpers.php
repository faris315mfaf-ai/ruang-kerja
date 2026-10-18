<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Chat\Actions\CreateChannel;
use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Devices\Models\Device;
use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Guests\Actions\AddMeetingGuest;
use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Announcement;
use App\Models\ApprovalDelegation;
use App\Models\ApprovalFlow;
use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\AutomationRule;
use App\Models\Briefing;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateNote;
use App\Models\Channel;
use App\Models\ChecklistItem;
use App\Models\Comment;
use App\Models\Company;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\Division;
use App\Models\DriveFile;
use App\Models\EmployeeProfile;
use App\Models\EmployeeRequest;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\InboxNotification;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Label;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\ManagementNote;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingTranscript;
use App\Models\Message;
use App\Models\Milestone;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\Objective;
use App\Models\PasswordResetRequest;
use App\Models\Position;
use App\Models\ProjectDirection;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\Reaction;
use App\Models\RecurringTask;
use App\Models\SavedView;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\TaskStatus;
use App\Models\TaskTemplate;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Carbon\CarbonImmutable;
use Database\Factories\CompanyFactory;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/*
 * Two-company test world (Fase 1 multi-perusahaan, tests/Feature/Tenancy).
 * require_once in each file that needs it.
 *
 * homeWorld()    perusahaan A, the default company of every factory (SPKD-like):
 *                one actor per global role plus a little data of its own,
 *                named with the marker ZZA0H0M (reverse check).
 * foreignWorld() perusahaan B, every module filled, every name/title/body
 *                carrying the marker ZZB0C0R. A response, export, job or
 *                notification for company A that contains the marker (case-
 *                insensitive: chat channel names are lower-cased) leaks B.
 *
 * B is flagged as foreign (CompanyFactory::foreign()), so it never becomes the
 * default company of later factories, and it is built inside
 * CompanyFactory::within(), so nested factories (owners, authors, divisions)
 * land in B too.
 */

if (! function_exists('foreignWorld')) {
    function tenancyMarker(): string
    {
        return 'ZZB0C0R';
    }

    /** Marker of company A's names (reverse check: B must never see it). */
    function homeMarker(): string
    {
        return 'ZZA0H0M';
    }

    /**
     * Summary lines of the leak suites, printed with TENANCY_DEBUG=1 (route
     * counts, unexpected leaks), so the normal suite output stays clean.
     */
    function tenancyReport(string $line): void
    {
        if (getenv('TENANCY_DEBUG')) {
            fwrite(STDERR, $line);
        }
    }

    /** Whether $text mentions company B. */
    function leaksForeign(?string $text): bool
    {
        return $text !== null && stripos($text, tenancyMarker()) !== false;
    }

    /**
     * Perusahaan A: actors for every global role, a division with a team and
     * a project workspace, shifts, a task due today, a meeting at 10.00 and an
     * objective. Created first, so it is the default company.
     */
    function homeWorld(): object
    {
        test()->seed(RoleSeeder::class);

        $h = homeMarker();
        $now = CarbonImmutable::now();
        $today = $now->setTimezone(config()->string('app.office_timezone'))->toDateString();
        $company = Company::query()->find(CompanyFactory::defaultId()) ?? throw new RuntimeException('Tidak ada perusahaan A.');
        $direksi = User::factory()->withRole(Role::Direksi)->create(['name' => "Hendra {$h}"]);
        $kadiv = User::factory()->withRole(Role::KepalaDivisi)->managedBy($direksi)->create(['name' => "Dimas {$h}"]);
        $division = Division::factory()->headedBy($kadiv)->create(['name' => "Operasional {$h}", 'code' => 'OPR']);
        $kadiv->forceFill(['division_id' => $division->id])->save();
        $anggota = User::factory()->withRole(Role::Anggota)->inDivision($division)->managedBy($kadiv)->create(['name' => "Rizky {$h}"]);
        $hr = User::factory()->withRole(Role::Hr)->managedBy($direksi)->create(['name' => "Hana {$h}"]);
        $workspace = Workspace::factory()->team()->ownedBy($kadiv)->withMember($anggota)->create(['name' => "Tim {$h}", 'key' => 'RMH']);
        $project = Workspace::factory()->project()->ownedBy($kadiv)->withMember($anggota)->create([
            'name' => "Proyek {$h}",
            'key' => 'RMHP',
            'lead_user_id' => $kadiv->id,
            'sponsor_user_id' => $direksi->id,
            'start_date' => CarbonImmutable::parse($today)->subMonth()->toDateString(),
            'target_date' => CarbonImmutable::parse($today)->addMonth()->toDateString(),
            'project_status' => 'active',
        ]);

        // Scheduled work days, a task due today and a meeting at 10.00, so the
        // background jobs (reminders, digest) have something to say to A too.
        $office = OfficeLocation::factory()->create(['name' => "Kantor {$h}"]);
        $shift = Shift::factory()->atLocation($office)->create(['name' => "Shift {$h}"]);

        foreach ([$anggota, $kadiv, $hr, $direksi] as $employee) {
            ShiftAssignment::factory()->create(['user_id' => $employee->id, 'shift_id' => $shift->id]);
        }

        $task = app(CreateTask::class)->handle($workspace, $kadiv, [
            'title' => "Tugas {$h}",
            'assignee_ids' => [$anggota->id],
            'due_date' => $today,
        ]);
        app(CreateTask::class)->handle($project, $kadiv, ['title' => "Tugas proyek {$h}", 'assignee_ids' => [$anggota->id], 'due_date' => $today]);
        $meeting = Meeting::factory()->by($kadiv)->video()->at($today.' 10:00')->withParticipants([$anggota, $direksi], Rsvp::Yes)
            ->create(['title' => "Rapat {$h}", 'agenda' => ["Agenda {$h}"]]);
        $objective = Objective::factory()->forDivision($division)->ownedBy($kadiv)->create(['title' => "Objective {$h}"]);
        KeyResult::factory()->create(['objective_id' => $objective->id, 'title' => "Hasil utama {$h}", 'owner_id' => $kadiv->id]);

        return (object) [
            'company' => $company,
            'division' => $division,
            'superAdmin' => User::factory()->withRole(Role::SuperAdmin)->create(['name' => "Admin {$h}"]),
            'hr' => $hr,
            'direksi' => $direksi,
            'kadiv' => $kadiv,
            'anggota' => $anggota,
            'workspace' => $workspace,
            'project' => $project,
            'office' => $office,
            'shift' => $shift,
            'meeting' => $meeting,
            'task' => $task,
        ];
    }

    /**
     * Perusahaan B with data in every module (see the file comment).
     *
     * `models` maps a model class to one B instance (route-binding tests);
     * `params` maps string route parameters to B values.
     */
    function foreignWorld(): object
    {
        test()->seed(RoleSeeder::class);

        $m = tenancyMarker();
        $company = Company::factory()->foreign()->create(['name' => "PT {$m} Asing", 'google_domain' => 'zzb0c0r.test']);

        return CompanyFactory::within($company, fn (): object => buildForeignWorld($company, $m));
    }

    function buildForeignWorld(Company $company, string $m): object
    {
        $now = CarbonImmutable::now();
        $today = $now->setTimezone(config()->string('app.office_timezone'))->toDateString();

        // Organisasi: Direksi, satu divisi + tim, jabatan, semua peran.
        $board = Division::factory()->board()->create(['name' => "Direksi {$m}", 'code' => 'ZZD']);
        $direksi = User::factory()->withRole(Role::Direksi)->create(['name' => "Direktur {$m}", 'division_id' => $board->id]);
        $kadiv = User::factory()->withRole(Role::KepalaDivisi)->managedBy($direksi)->create(['name' => "Kadiv {$m}"]);
        $division = Division::factory()->headedBy($kadiv)->create(['name' => "Divisi {$m}", 'code' => 'ZZB']);
        $team = Team::factory()->ledBy($kadiv)->create(['division_id' => $division->id, 'name' => "Tim {$m}", 'code' => 'ZZT']);
        $position = Position::factory()->create(['name' => "Jabatan {$m}"]);
        $kadiv->forceFill(['division_id' => $division->id, 'team_id' => $team->id, 'position_id' => $position->id])->save();
        $hr = User::factory()->withRole(Role::Hr)->managedBy($direksi)->create(['name' => "Personalia {$m}"]);
        $superAdmin = User::factory()->withRole(Role::SuperAdmin)->create(['name' => "Admin {$m}"]);
        $anggota = User::factory()->withRole(Role::Anggota)->inDivision($division, $team)->managedBy($kadiv)
            ->create(['name' => "Anggota {$m}", 'position_id' => $position->id]);
        EmployeeProfile::factory()->create(['user_id' => $anggota->id, 'employee_number' => 'ZZB0C0R-001', 'address' => "Alamat {$m}"]);

        // Absensi: kantor, shift, jadwal, kiosk, hari ini (log + selfie), libur.
        $office = OfficeLocation::factory()->create(['name' => "Kantor {$m}", 'address' => "Jalan {$m}"]);
        $shift = Shift::factory()->atLocation($office)->create(['name' => "Shift {$m}"]);

        foreach ([$anggota, $kadiv, $hr, $direksi] as $employee) {
            ShiftAssignment::factory()->create(['user_id' => $employee->id, 'shift_id' => $shift->id]);
        }

        $shiftAssignment = ShiftAssignment::query()->where('user_id', $anggota->id)->firstOrFail();
        $kiosk = Kiosk::factory()->at($office)->create(['name' => "Kiosk {$m}", 'code' => 'ZZB-LOBI']);
        $holiday = Holiday::factory()->on(CarbonImmutable::parse($today)->addDays(40)->toDateString(), "Libur {$m}")->create();
        $day = AttendanceDay::factory()->create([
            'user_id' => $anggota->id,
            'work_date' => $today,
            'shift_id' => $shift->id,
            'status' => AttendanceStatus::Late,
            'check_in_at' => $now->subHour(),
            'late_minutes' => 12,
            'note' => "Catatan absen {$m}",
            'work_plan' => ["Rencana kerja {$m}"],
        ]);
        $log = AttendanceLog::factory()->forDay($day)->create([
            'occurred_at' => $now->subHour(),
            'office_location_id' => $office->id,
            'selfie_path' => 'selfies/'.$company->id.'/zzb0c0r.jpg',
            'note' => "Log absen {$m}",
            'flags' => [LogFlag::LowAccuracy],
            'is_suspicious' => true,
        ]);
        $day->forceFill(['check_in_log_id' => $log->id])->save();

        // Pengajuan: alur, jenis, saldo, delegasi, pengajuan bernomor berbagai status.
        $flow = ApprovalFlow::factory()->managerThenHr()->create(['name' => ApprovalFlow::DEFAULT_NAME]);
        $permit = LeaveType::factory()->category(RequestCategory::Permit)->withFlow($flow)->create(['code' => 'IZN', 'name' => "Izin {$m}"]);
        $annual = LeaveType::factory()->category(RequestCategory::Leave)->withFlow($flow)
            ->create(['code' => 'CUT', 'name' => "Cuti {$m}", 'annual_quota_days' => 12]);
        $balance = LeaveBalance::factory()->create(['user_id' => $anggota->id, 'leave_type_id' => $annual->id]);
        $delegation = ApprovalDelegation::factory()->create(['delegator_id' => $kadiv->id, 'delegate_id' => $hr->id, 'reason' => "Delegasi {$m}"]);
        $nextWeekday = CarbonImmutable::parse($today)->addWeek()->startOfWeek()->addDay();

        $pending = app(SubmitRequest::class)->handle($anggota, RequestInput::fromArray($permit, [
            'start_date' => $nextWeekday->toDateString(),
            'end_date' => $nextWeekday->toDateString(),
            'reason' => "Keperluan {$m}",
        ]));

        $requests = ['pending' => $pending];

        foreach ([RequestStatus::Approved, RequestStatus::Rejected, RequestStatus::Draft, RequestStatus::Canceled] as $index => $status) {
            $requests[$status->value] = EmployeeRequest::factory()->status($status)->create([
                'user_id' => $anggota->id,
                'leave_type_id' => $annual->id,
                'reason' => "Cuti {$m} {$status->value}",
                'number' => $status === RequestStatus::Draft ? null : 'CUT-ZZB0C0R-'.($index + 1),
            ]);
        }

        // Workspace: divisi, tim, proyek, pribadi + tugas, komentar, checklist, label, berkas.
        // Created with the division (observer); otherwise by the factory.
        $divisionWs = Workspace::query()->where('type', 'division')->where('division_id', $division->id)->first()
            ?? Workspace::factory()->division($division, $kadiv)->create(['key' => 'ZZBD']);
        $divisionWs->forceFill(['name' => "Workspace divisi {$m}"])->save();
        $teamWs = Workspace::factory()->team($team)->ownedBy($kadiv)->internal()
            ->withMember($anggota)->withMember($hr, WorkspaceRole::Viewer)
            ->create(['name' => "Workspace tim {$m}", 'key' => 'ZZBT', 'description' => "Deskripsi {$m}"]);
        $projectWs = Workspace::factory()->project()->ownedBy($kadiv)->withMember($anggota)->withMember($direksi)->create([
            'name' => "Proyek {$m}",
            'key' => 'ZZBP',
            'lead_user_id' => $kadiv->id,
            'sponsor_user_id' => $direksi->id,
            'division_id' => $division->id,
            'start_date' => CarbonImmutable::parse($today)->subMonth()->toDateString(),
            'target_date' => CarbonImmutable::parse($today)->addMonths(2)->toDateString(),
            'project_status' => 'active',
        ]);
        $personalWs = Workspace::query()->where('type', 'personal')->where('owner_id', $anggota->id)->first()
            ?? Workspace::factory()->personal($anggota)->create(['name' => "Pribadi {$m}", 'key' => 'ZZBA']);
        $label = Label::factory()->create(['workspace_id' => $teamWs->id, 'name' => "Label {$m}"]);
        $status = TaskStatus::query()->where('workspace_id', $teamWs->id)->orderBy('position')->firstOrFail();

        $task = app(CreateTask::class)->handle($teamWs, $kadiv, [
            'title' => "Tugas {$m}",
            'description' => richDocumentOf("Deskripsi tugas {$m}"),
            'assignee_ids' => [$anggota->id],
            'label_ids' => [$label->id],
            'due_date' => $today,
        ]);
        $projectTask = app(CreateTask::class)->handle($projectWs, $kadiv, ['title' => "Tugas proyek {$m}", 'assignee_ids' => [$anggota->id], 'due_date' => $today]);
        $personalTask = app(CreateTask::class)->handle($personalWs, $anggota, ['title' => "Tugas pribadi {$m}", 'assignee_ids' => [$anggota->id]]);

        $comment = Comment::factory()->on($task)->by($anggota)->create([
            'body' => richDocumentOf("Komentar {$m}"),
            'body_text' => "Komentar {$m}",
        ]);
        $checklist = ChecklistItem::query()->create(['task_id' => $task->id, 'title' => "Checklist {$m}", 'is_done' => false, 'position' => 'V0001']);
        $driveFile = DriveFile::factory()->create(['workspace_id' => $teamWs->id, 'name' => "Berkas {$m}", 'added_by' => $kadiv->id]);
        $attachment = Attachment::factory()->create([
            'attachable_type' => $task->getMorphClass(),
            'attachable_id' => $task->id,
            'drive_file_id' => $driveFile->id,
            'filename' => "berkas-{$m}.pdf",
            'uploaded_by' => $kadiv->id,
        ]);
        $savedView = SavedView::factory()->shared()->create(['user_id' => $kadiv->id, 'workspace_id' => $teamWs->id, 'name' => "Tampilan {$m}"]);
        TaskPlan::factory()->create(['user_id' => $anggota->id, 'task_id' => $task->id]);

        // Proyek: milestone, update, risiko, arahan.
        $milestone = Milestone::factory()->create(['workspace_id' => $projectWs->id, 'name' => "Milestone {$m}", 'created_by' => $kadiv->id]);
        $projectUpdate = ProjectUpdate::factory()->withDecision("Keputusan {$m}")
            ->create(['workspace_id' => $projectWs->id, 'author_id' => $kadiv->id, 'summary' => "Update proyek {$m}", 'blockers' => "Hambatan {$m}"]);
        $risk = ProjectRisk::factory()->create(['workspace_id' => $projectWs->id, 'title' => "Risiko {$m}", 'owner_id' => $kadiv->id]);
        ProjectDirection::query()->create(['workspace_id' => $projectWs->id, 'project_update_id' => $projectUpdate->id, 'author_id' => $direksi->id, 'body' => "Arahan {$m}"]);
        $projectWs->forceFill(['health' => $projectUpdate->health, 'last_update_at' => $now])->save();

        // Otomasi & templat.
        $rule = AutomationRule::factory()->forWorkspace($teamWs)->create(['name' => "Aturan {$m}", 'created_by' => $kadiv->id]);
        $recurring = RecurringTask::factory()->forWorkspace($teamWs)->create(['title' => "Tugas berulang {$m}", 'created_by' => $kadiv->id]);
        $taskTemplate = TaskTemplate::factory()->forWorkspace($teamWs)->create(['name' => "Templat {$m}", 'title' => "Templat tugas {$m}", 'created_by' => $kadiv->id]);
        $workspaceTemplate = WorkspaceTemplate::factory()->create(['name' => "Templat workspace {$m}", 'created_by' => $kadiv->id]);

        // Laporan harian, catatan tindakan, pengumuman, briefing.
        $dailyReport = DailyReport::factory()->create([
            'user_id' => $anggota->id,
            'report_date' => $today,
            'summary' => "Ringkasan laporan {$m}",
            'blockers' => "Hambatan laporan {$m}",
            'notes' => "Notulensi laporan {$m}",
            'submitted_at' => $now,
        ]);
        DailyReportItem::query()->create([
            'daily_report_id' => $dailyReport->id,
            'task_id' => $task->id,
            'task_key' => 'ZZBT-1',
            'task_title' => $task->title,
            'progress_note' => "Progres {$m}",
            'position' => 0,
        ]);
        $managementNote = ManagementNote::factory()->ownedBy($direksi)->create(['body' => "Catatan tindakan {$m}"]);
        $announcement = Announcement::factory()->by($hr)->create(['title' => "Pengumuman {$m}", 'body' => "Isi pengumuman {$m}"]);
        Briefing::query()->create(['company_id' => $company->id, 'period' => 'pagi', 'briefing_date' => $today, 'content' => "Briefing {$m}", 'created_by' => $direksi->id]);

        // Rapat video + notulen + tindak lanjut + tamu + transkrip.
        $meeting = Meeting::factory()->by($kadiv)->video()->at($today.' 10:00')->withParticipants([$anggota, $direksi], Rsvp::Yes)
            ->create(['title' => "Rapat {$m}", 'description' => "Deskripsi rapat {$m}", 'agenda' => ["Agenda {$m}"], 'minute_taker_id' => $anggota->id]);
        $occurrence = app(MeetingOccurrences::class)->resolve($meeting->fresh() ?? $meeting, $today);
        app(SaveMinutes::class)->handle($occurrence, $kadiv, [
            'attendance' => [['user_id' => $anggota->id, 'present' => true]],
            'sections' => [['title' => "Agenda {$m}", 'body' => "Pembahasan {$m}"]],
            'decisions' => ["Keputusan rapat {$m}"],
        ]);
        $actionItem = app(AddActionItem::class)->handle($occurrence, $kadiv, ['text' => "Tindak lanjut {$m}", 'assignee_id' => $anggota->id, 'due_date' => $today]);
        $guest = app(AddMeetingGuest::class)->handle($kadiv, $meeting, 'tamu@zzb0c0r.test', "Tamu {$m}");
        $minutes = MeetingMinutes::query()->where('meeting_id', $meeting->id)->firstOrFail();
        MeetingTranscript::factory()->ready([[$anggota->id, $anggota->name, 3, "Transkrip {$m}"]])->create([
            'meeting_id' => $meeting->id,
            'occurrence_date' => $today,
        ]);

        // Obrolan: kanal + DM dengan pesan.
        $channel = app(CreateChannel::class)->handle($kadiv, ['name' => "kanal {$m}", 'member_ids' => [$anggota->id, $hr->id]]);
        $direct = app(OpenDirectConversation::class)->handle($kadiv, [$anggota->id]);
        $message = app(PostMessage::class)->handle($channel, $kadiv, richDocumentOf("Pesan kanal {$m}"));
        app(PostMessage::class)->handle($direct, $anggota, richDocumentOf("Pesan langsung {$m}"));
        app(PostMessage::class)->handle($channel, $anggota, richDocumentOf("Balasan {$m}"), [], $message);

        // Catatan bersama.
        $note = Note::factory()->in($teamWs)->by($kadiv)->create(['title' => "Catatan {$m}", 'content' => richDocumentOf("Isi catatan {$m}"), 'content_text' => "Isi catatan {$m}"]);
        $noteVersion = NoteVersion::factory()->of($note)->create(['title' => "Versi {$m}"]);
        NoteShare::factory()->create(['note_id' => $note->id, 'user_id' => $anggota->id]);

        // OKR.
        $objective = Objective::factory()->forDivision($division)->ownedBy($kadiv)->create(['title' => "Objective {$m}"]);
        $keyResult = KeyResult::factory()->create(['objective_id' => $objective->id, 'title' => "Hasil utama {$m}", 'owner_id' => $kadiv->id]);
        KeyResultCheckin::factory()->create(['key_result_id' => $keyResult->id, 'note' => "Check-in OKR {$m}", 'author_id' => $kadiv->id]);

        // Hiring.
        $hiringPosition = HiringPosition::factory()->interviewers([$kadiv])->approvers([$direksi])->create(['title' => "Lowongan {$m}", 'description' => "Deskripsi lowongan {$m}"]);
        $question = HiringQuestion::factory()->create(['position_id' => $hiringPosition->id, 'prompt' => "Pertanyaan {$m}?"]);
        $candidate = Candidate::factory()->forPosition($hiringPosition)->withChecklist()->create(['full_name' => "Kandidat {$m}", 'email' => 'kandidat@zzb0c0r.test']);
        $candidateNote = CandidateNote::query()->create(['candidate_id' => $candidate->id, 'author_id' => $hr->id, 'body' => "Notulensi kandidat {$m}"]);
        $candidateItem = CandidateChecklistItem::query()->where('candidate_id', $candidate->id)->orderBy('position')->firstOrFail();

        // Perangkat, permintaan reset sandi, notifikasi, audit.
        $device = Device::factory()->create(['user_id' => $anggota->id, 'name' => "Ponsel {$m}"]);
        $passwordReset = PasswordResetRequest::query()->forceCreate([
            'company_id' => $company->id,
            'user_id' => $anggota->id,
            'email' => $anggota->email,
            'request_token_hash' => hash('sha256', Str::random(40)),
            'status' => 'pending',
            'expires_at' => $now->addDay(),
        ]);

        $notifications = [];

        foreach ([$anggota, $kadiv, $hr, $direksi, $superAdmin] as $recipient) {
            $notifications[] = InboxNotification::factory()->recipient($recipient)->ofType(NotificationType::TaskAssigned)
                ->withData(['title' => "Notifikasi {$m}", 'body' => "Isi notifikasi {$m}", 'url' => '/tugas'])
                ->create(['subject_type' => $task->getMorphClass(), 'subject_id' => $task->id]);
        }

        AuditLog::factory()->by($hr)->forSubject($anggota)->create(['action' => 'user.updated', 'new_values' => ['name' => "Audit {$m}"]]);
        // System entry (no actor): belongs to B through its subject (C1, audit_logs.company_id).
        AuditLog::factory()->forSubject($anggota)->create(['action' => 'attendance.closed', 'new_values' => ['note' => "Audit sistem {$m}"]]);

        // Smaller link tables, so B fills nearly every company-scoped table.
        $stamp = ['created_at' => $now, 'updated_at' => $now];
        AttendanceConsent::factory()->create(['user_id' => $anggota->id]);
        Reaction::query()->create(['reactable_type' => $message->getMorphClass(), 'reactable_id' => $message->id, 'user_id' => $anggota->id, 'emoji' => '👍']);
        DB::table('milestone_tasks')->insert(['milestone_id' => $milestone->id, 'task_id' => $projectTask->id]);
        DB::table('key_result_tasks')->insert(['key_result_id' => $keyResult->id, 'task_id' => $task->id, 'linked_by' => $kadiv->id, 'created_at' => $now]);
        DB::table('task_comment_reads')->insert(['task_id' => $task->id, 'user_id' => $kadiv->id, 'last_read_comment_id' => $comment->id, 'last_read_at' => $now, ...$stamp]);
        DB::table('interview_answers')->insert(['id' => (string) Str::ulid(), 'candidate_id' => $candidate->id, 'question_id' => $question->id, 'answer' => "Jawaban {$m}", 'recorded_by' => $hr->id, ...$stamp]);
        DB::table('interview_scores')->insert(['id' => (string) Str::ulid(), 'candidate_id' => $candidate->id, 'question_id' => $question->id, 'interviewer_id' => $kadiv->id, 'score' => 4, 'note' => "Nilai {$m}", ...$stamp]);
        DB::table('meeting_attendances')->insert([
            'id' => (string) Str::ulid(),
            'meeting_id' => $meeting->id,
            'occurrence_date' => $today,
            'user_id' => $anggota->id,
            'room' => 'rk-'.strtolower($meeting->id).'-'.str_replace('-', '', $today),
            'participant_sid' => 'PA_zzb0c0r',
            'joined_at' => $now->subMinutes(30),
            ...$stamp,
        ]);

        $guestToken = app(GuestLinks::class)->token($guest->fresh() ?? $guest);

        return (object) [
            'company' => $company,
            'superAdmin' => $superAdmin,
            'hr' => $hr,
            'direksi' => $direksi,
            'kadiv' => $kadiv,
            'anggota' => $anggota,
            'division' => $division,
            'board' => $board,
            'team' => $team,
            'teamWorkspace' => $teamWs,
            'projectWorkspace' => $projectWs,
            'divisionWorkspace' => $divisionWs,
            'personalWorkspace' => $personalWs,
            'task' => $task,
            'projectTask' => $projectTask,
            'personalTask' => $personalTask,
            'meeting' => $meeting,
            'minutes' => $minutes,
            'guest' => $guest,
            'guestToken' => $guestToken,
            'channel' => $channel,
            'direct' => $direct,
            'message' => $message,
            'note' => $note,
            'office' => $office,
            'day' => $day,
            'log' => $log,
            'pendingRequest' => $pending,
            'hiringPosition' => $hiringPosition,
            'candidate' => $candidate,
            'models' => [
                Announcement::class => $announcement,
                ApprovalFlow::class => $flow,
                Attachment::class => $attachment,
                AttendanceLog::class => $log,
                Candidate::class => $candidate,
                CandidateChecklistItem::class => $candidateItem,
                CandidateNote::class => $candidateNote,
                Channel::class => $channel,
                ChecklistItem::class => $checklist,
                Comment::class => $comment,
                DailyReport::class => $dailyReport,
                ApprovalDelegation::class => $delegation,
                Device::class => $device,
                Division::class => $division,
                User::class => $anggota,
                EmployeeRequest::class => $pending,
                Holiday::class => $holiday,
                MeetingActionItem::class => $actionItem,
                KeyResult::class => $keyResult,
                Kiosk::class => $kiosk,
                Label::class => $label,
                LeaveBalance::class => $balance,
                LeaveType::class => $annual,
                OfficeLocation::class => $office,
                ManagementNote::class => $managementNote,
                Meeting::class => $meeting,
                Message::class => $message,
                Milestone::class => $milestone,
                Note::class => $note,
                InboxNotification::class => $notifications[0],
                Objective::class => $objective,
                HiringPosition::class => $hiringPosition,
                Position::class => $position,
                ProjectUpdate::class => $projectUpdate,
                HiringQuestion::class => $question,
                RecurringTask::class => $recurring,
                ProjectRisk::class => $risk,
                AutomationRule::class => $rule,
                Shift::class => $shift,
                ShiftAssignment::class => $shiftAssignment,
                TaskStatus::class => $status,
                Task::class => $task,
                Team::class => $team,
                TaskTemplate::class => $taskTemplate,
                WorkspaceTemplate::class => $workspaceTemplate,
                NoteVersion::class => $noteVersion,
                SavedView::class => $savedView,
                Workspace::class => $teamWs,
            ],
            'params' => [
                'passwordResetRequest' => $passwordReset->id,
                'participant' => $guest->id,
                'minutes' => $minutes->id,
                'task' => $task->id,
                'message' => $message->id,
                'note' => $note->id,
                'notification' => $notifications[0]->id,
                'employee' => $anggota->id,
                'person' => $anggota->id,
                'subject' => $anggota->id,
                'user' => $anggota->id,
                'identity' => $anggota->id,
                'source' => $teamWs->id,
                'version' => (string) DB::table('meeting_minute_versions')->where('minutes_id', $minutes->id)->value('id'),
                'date' => $today,
                'suggestion' => 'tl-1',
                'token' => $guestToken,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    function richDocumentOf(string $text): array
    {
        return ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]];
    }

    /**
     * Snapshot of every row belonging to $companyId, following config/tenancy.php
     * (company / via / user / morph): per table the row count, latest
     * updated_at and deleted_at. Two equal snapshots = the company's data did
     * not change. One SQL round trip.
     *
     * @param  list<string>  $morphIds  ids of the company's rows (morph tables follow them)
     * @return array<string, string>
     */
    function tenancyFingerprint(string $companyId, array $morphIds = []): array
    {
        $parts = [];
        $bindings = [];

        foreach (tenancyScopedTables() as $table => $where) {
            $columns = tenancyColumns($table);
            $updated = in_array('updated_at', $columns, true) ? 'max(updated_at)::text' : "''";
            $deleted = in_array('deleted_at', $columns, true) ? 'max(deleted_at)::text' : "''";
            [$sql, $values] = $where;

            if (str_contains($sql, ':morph') && $morphIds === []) {
                continue;
            }

            $sql = str_replace(':morph', "'{".implode(',', $morphIds)."}'::text[]", $sql);
            $parts[] = "select '{$table}' as t, count(*)::text || '|' || coalesce({$updated}, '') || '|' || coalesce({$deleted}, '') as f from {$table} where {$sql}";
            array_push($bindings, ...array_fill(0, $values, $companyId));
        }

        $rows = DB::select(implode(' union all ', $parts), $bindings);

        return collect($rows)->mapWithKeys(fn (object $row): array => [$row->t => $row->f])->sort()->all();
    }

    /**
     * Ids (as text) of every row of $companyId in the tables with an `id` column.
     *
     * @return list<string>
     */
    function tenancyRowIds(string $companyId): array
    {
        $ids = [];

        foreach (tenancyScopedTables() as $table => [$sql, $values]) {
            if (str_contains($sql, ':morph') || ! in_array('id', tenancyColumns($table), true)) {
                continue;
            }

            $rows = DB::select("select id::text as id from {$table} where {$sql}", array_fill(0, $values, $companyId));
            array_push($ids, ...array_map(fn (object $row): string => $row->id, $rows));
        }

        return $ids;
    }

    /**
     * table => [SQL condition selecting the company's rows (`?` = company id, `:morph` = id list), number of `?`].
     *
     * @return array<string, array{0: string, 1: int}>
     */
    function tenancyScopedTables(): array
    {
        /** @var array<string, string|array<string, string>> $registry */
        $registry = config('tenancy.tables');
        $resolved = [];

        $condition = function (string $table) use (&$condition, &$resolved, $registry): ?array {
            if (array_key_exists($table, $resolved)) {
                return $resolved[$table];
            }

            $kind = $registry[$table] ?? 'global';
            $kind = $kind === 'user' ? ['user' => 'user_id'] : $kind;

            $result = match (true) {
                $table === 'companies' => ['id = ?', 1],
                $kind === 'company' => ['company_id = ?', 1],
                $kind === 'global' => null,
                isset($kind['user']) => ["{$kind['user']} in (select id from users where company_id = ?)", 1],
                isset($kind['morph']) => ["{$kind['morph']}_id::text = any(:morph)", 0],
                isset($kind['via']) => (function () use ($kind, $condition): ?array {
                    [$parent, $column] = explode('.', $kind['via'], 2);
                    $inner = $condition($parent);

                    return $inner === null ? null : ["{$column} in (select id from {$parent} where {$inner[0]})", $inner[1]];
                })(),
                default => null,
            };

            return $resolved[$table] = $result;
        };

        $tables = [];

        foreach (array_keys($registry) as $table) {
            $where = $condition($table);

            if ($where !== null) {
                $tables[$table] = $where;
            }
        }

        return $tables;
    }

    /**
     * @return list<string>
     */
    function tenancyColumns(string $table): array
    {
        static $columns = [];

        return $columns[$table] ??= array_map(
            fn (object $row): string => $row->column_name,
            DB::select('select column_name from information_schema.columns where table_schema = current_schema() and table_name = ?', [$table]),
        );
    }
}

<?php

/*
|--------------------------------------------------------------------------
| Registri tabel multi-perusahaan (Fase 1, Langkah 1)
|--------------------------------------------------------------------------
|
| Setiap tabel di database diklasifikasikan menurut cara barisnya terikat ke
| satu perusahaan. Isolasi tetap ditegakkan manual oleh scope visibleTo() dan
| Policy; registri ini memastikan tidak ada tabel baru yang lupa dipikirkan
| (tests/Feature/Tenancy/TenancyRegistryTest.php gagal bila migrasi menambah
| tabel yang belum terdaftar, atau mengubah kolom yang dirujuk di sini).
|
| Jenis:
| - 'company'                     kolom company_id langsung.
| - ['via' => 'induk.kolom']      lewat FK ke tabel induk yang terdaftar
|                                 (mis. tasks via workspaces.workspace_id).
| - 'user' / ['user' => 'kolom']  milik seorang pengguna (users.company_id);
|                                 kolom bawaan user_id.
| - ['morph' => 'nama']           polimorfik (<nama>_type / <nama>_id): mengikuti
|                                 baris induk yang dirujuk.
| - 'global'                      infrastruktur / data bersama lintas perusahaan.
|
| Tabel yang ditandai "CELAH" sudah diketahui belum terisolasi penuh; ditutup
| di Langkah 2 (docs/sesi/fase1-celah.md).
*/

return [
    'tables' => [
        // Organisasi & akses
        'companies' => 'global', // tabel penyewa itu sendiri
        'divisions' => 'company',
        'teams' => ['via' => 'divisions.division_id'],
        'positions' => 'company',
        'users' => 'company',
        'employee_profiles' => 'user', // CELAH: employee_number unik global (Langkah 2a)
        'audit_logs' => 'user', // CELAH: user_id null untuk log sistem, tanpa company_id (Langkah 2a)
        'password_reset_requests' => 'company',
        'passkeys' => 'user',
        'roles' => 'global', // spatie: peran global, sama untuk semua perusahaan
        'permissions' => 'global', // spatie
        'role_has_permissions' => 'global', // spatie
        'model_has_roles' => ['morph' => 'model'], // spatie: peran milik pengguna
        'model_has_permissions' => ['morph' => 'model'], // spatie
        'personal_access_tokens' => ['morph' => 'tokenable'], // Sanctum: token milik pengguna
        'api_idempotency_keys' => 'user',
        'devices' => 'company',
        'google_accounts' => 'user',

        // Absensi
        'office_locations' => 'company',
        'shifts' => 'company',
        'shift_assignments' => 'user',
        'holidays' => 'company', // CELAH: HolidayAwareWorkdayCalendar membaca semua perusahaan (Langkah 2a)
        'attendance_days' => 'user',
        'attendance_logs' => 'user', // CELAH: selfie tanpa prefiks perusahaan di storage (Langkah 2a)
        'qr_tokens' => ['via' => 'office_locations.office_location_id'],
        'kiosks' => 'company',
        'attendance_consents' => 'user',

        // Pengajuan
        'leave_types' => 'company',
        'leave_balances' => 'user',
        'leave_balance_adjustments' => ['via' => 'leave_balances.balance_id'],
        'requests' => 'user', // CELAH: nomor unik global (Langkah 2a)
        'request_sequences' => 'global', // CELAH: kunci {kode}-{bulan} dipakai bersama semua perusahaan (Langkah 2a)
        'request_approvals' => ['via' => 'requests.request_id'],
        'approval_flows' => 'company',
        'approval_flow_steps' => ['via' => 'approval_flows.approval_flow_id'],
        'approval_delegations' => ['user' => 'delegator_id'],

        // Workspace & tugas
        'workspaces' => 'company',
        'workspace_members' => ['via' => 'workspaces.workspace_id'],
        'task_statuses' => ['via' => 'workspaces.workspace_id'],
        'labels' => ['via' => 'workspaces.workspace_id'],
        'tasks' => ['via' => 'workspaces.workspace_id'],
        'task_assignees' => ['via' => 'tasks.task_id'],
        'task_labels' => ['via' => 'tasks.task_id'],
        'task_watchers' => ['via' => 'tasks.task_id'],
        'task_comment_reads' => ['via' => 'tasks.task_id'],
        'task_plans' => 'user',
        'checklist_items' => ['via' => 'tasks.task_id'],
        'comments' => ['morph' => 'commentable'],
        'mentions' => ['morph' => 'mentionable'],
        'reactions' => ['morph' => 'reactable'],
        'activities' => ['via' => 'workspaces.workspace_id'],
        'saved_views' => 'user',
        'milestones' => ['via' => 'workspaces.workspace_id'],
        'milestone_tasks' => ['via' => 'milestones.milestone_id'],
        'project_updates' => ['via' => 'workspaces.workspace_id'],
        'project_directions' => ['via' => 'workspaces.workspace_id'],
        'project_risks' => ['via' => 'workspaces.workspace_id'],
        'project_progress_snapshots' => ['via' => 'workspaces.workspace_id'],
        'management_notes' => 'company',
        'daily_reports' => 'company',
        'daily_report_items' => ['via' => 'daily_reports.daily_report_id'],
        'briefings' => 'company',
        'briefing_delegations' => 'company',

        // Otomasi
        'automation_rules' => 'company',
        'automation_runs' => ['via' => 'automation_rules.rule_id'],
        'recurring_tasks' => 'company',
        'recurring_task_occurrences' => ['via' => 'recurring_tasks.recurring_task_id'],
        'task_templates' => 'company',
        'workspace_templates' => 'company',

        // Hiring
        'hiring_settings' => 'company',
        'hiring_positions' => 'company',
        'hiring_questions' => ['via' => 'hiring_positions.position_id'],
        'candidates' => 'company',
        'candidate_checklist_items' => ['via' => 'candidates.candidate_id'],
        'candidate_notes' => ['via' => 'candidates.candidate_id'],
        'candidate_decisions' => ['via' => 'candidates.candidate_id'],
        'interview_answers' => ['via' => 'candidates.candidate_id'],
        'interview_scores' => ['via' => 'candidates.candidate_id'],

        // Google & berkas
        'drive_files' => ['via' => 'workspaces.workspace_id'], // CELAH: Shared Drive tunggal untuk semua perusahaan (Langkah 2c)
        'attachments' => ['morph' => 'attachable'],

        // Notifikasi & pengumuman
        'notifications' => ['morph' => 'notifiable'],
        'notification_preferences' => 'user',
        'notification_settings' => 'user',
        'notification_dispatch_logs' => 'user',
        'announcements' => 'company',
        'announcement_dismissals' => ['via' => 'announcements.announcement_id'],

        // Obrolan & catatan (Fase 2)
        'channels' => 'company',
        'channel_members' => ['via' => 'channels.channel_id'],
        'messages' => ['via' => 'channels.channel_id'],
        'notes' => 'company',
        'note_versions' => ['via' => 'notes.note_id'],
        'note_shares' => ['via' => 'notes.note_id'],

        // Rapat (Fase 2)
        'meetings' => 'company',
        'meeting_participants' => ['via' => 'meetings.meeting_id'],
        'meeting_minutes' => ['via' => 'meetings.meeting_id'],
        'meeting_minute_versions' => ['via' => 'meeting_minutes.minutes_id'],
        'meeting_action_items' => ['via' => 'meeting_minutes.minutes_id'],
        'meeting_attendances' => ['via' => 'meetings.meeting_id'],
        'meeting_transcripts' => ['via' => 'meetings.meeting_id'],
        'meeting_transcript_consents' => ['via' => 'meetings.meeting_id'],
        'meeting_speaking_times' => ['via' => 'meetings.meeting_id'],
        'meeting_video_removals' => ['via' => 'meetings.meeting_id'],

        // OKR (Fase 3)
        'objectives' => 'company',
        'key_results' => ['via' => 'objectives.objective_id'],
        'key_result_checkins' => ['via' => 'key_results.key_result_id'],
        'key_result_tasks' => ['via' => 'key_results.key_result_id'],

        // Infrastruktur Laravel & paket (tanpa data perusahaan yang dibaca aplikasi)
        'migrations' => 'global',
        'cache' => 'global', // CELAH: kunci MetricCache & once-prop tanpa company_id (Langkah 2a)
        'cache_locks' => 'global',
        'jobs' => 'global', // muatan job membawa tenantCompanyId (CompanyAware)
        'job_batches' => 'global',
        'failed_jobs' => 'global',
        'sessions' => 'global', // sesi web; user_id hanya penunjuk
        'password_reset_tokens' => 'global', // Fortify, tidak dipakai (lupa sandi lewat HR)
        'pulse_aggregates' => 'global', // Laravel Pulse: metrik server
        'pulse_entries' => 'global',
        'pulse_values' => 'global',
    ],
];

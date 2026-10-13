<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationTarget;

/*
| NotificationTarget: tujuan ketukan notifikasi (Inbox & push) dihitung dari
| jenis + subjek (+ url sebagai cadangan) sehingga aplikasi tidak mem-parsing
| URL web. Payload di bawah meniru yang ditulis kelas notifikasi modul.
*/

function targetOf(NotificationType $type, ?string $url, ?array $subject = null): ?array
{
    return (new NotificationTarget)->resolve($type, ['url' => $url, 'subject' => $subject]);
}

function subjectOf(string $class, string $id, ?string $code = null): array
{
    return ['type' => 'App\\Models\\'.$class, 'id' => $id, 'code' => $code, 'title' => null];
}

function expectTarget(?array $target, string $type, ?string $id, ?string $anchor = null, array $params = []): void
{
    expect($target)->toBe(['type' => $type, 'id' => $id, 'anchor' => $anchor, 'params' => $params]);
}

it('maps task notifications to the task with the comment anchor', function (NotificationType $type) {
    expectTarget(targetOf($type, '/w/TMS/tasks/7#komentar-01CMT', subjectOf('Task', '01TASK', 'TMS-7')), 'tugas', '01TASK', 'komentar-01CMT');
})->with([
    NotificationType::TaskAssigned, NotificationType::TaskCommented, NotificationType::TaskDueSoon, NotificationType::TaskOverdue, NotificationType::AutomationNotify,
]);

it('maps mentions by what was mentioned in', function () {
    expectTarget(targetOf(NotificationType::Mention, '/w/TMS/tasks/7#komentar-01C', subjectOf('Task', '01TASK')), 'tugas', '01TASK', 'komentar-01C');
    expectTarget(targetOf(NotificationType::Mention, '/catatan/01NOTE', subjectOf('Note', '01NOTE')), 'catatan', '01NOTE');
    expectTarget(targetOf(NotificationType::Mention, '/obrolan/01CH#pesan-01MSG', subjectOf('Channel', '01CH')), 'obrolan', '01CH', 'pesan-01MSG');
});

it('maps chat, meetings and minutes', function () {
    expectTarget(targetOf(NotificationType::ChatMessage, '/obrolan/01CH#pesan-01MSG', subjectOf('Channel', '01CH')), 'obrolan', '01CH', 'pesan-01MSG');
    expectTarget(targetOf(NotificationType::MeetingInvited, '/rapat/01MTG', subjectOf('Meeting', '01MTG')), 'rapat', '01MTG');
    expectTarget(targetOf(NotificationType::MeetingStarting, '/rapat/01MTG?tanggal=2026-10-06', subjectOf('Meeting', '01MTG')), 'rapat', '01MTG', null, ['tanggal' => '2026-10-06']);
    expectTarget(targetOf(NotificationType::MinutesFinalized, '/rapat/01MTG/notulen?tanggal=2026-10-06', subjectOf('Meeting', '01MTG')), 'rapat', '01MTG', 'notulen', ['tanggal' => '2026-10-06']);
    expectTarget(targetOf(NotificationType::ActionItemDue, '/rapat/01MTG/notulen', subjectOf('MeetingActionItem', '01ITEM')), 'rapat', '01MTG', 'notulen');
    // A malformed date is dropped rather than forwarded.
    expectTarget(targetOf(NotificationType::MeetingStarting, '/rapat/01MTG?tanggal=besok', subjectOf('Meeting', '01MTG')), 'rapat', '01MTG');
});

it('sends approvers to persetujuan and requesters to pengajuan', function () {
    $subject = subjectOf('EmployeeRequest', '01REQ', 'CUT-2026-10-0001');

    expectTarget(targetOf(NotificationType::RequestSubmitted, '/persetujuan/01REQ', $subject), 'persetujuan', '01REQ');
    expectTarget(targetOf(NotificationType::RequestApproved, '/pengajuan/01REQ', $subject), 'pengajuan', '01REQ');
    expectTarget(targetOf(NotificationType::RequestRejected, '/pengajuan/01REQ', $subject), 'pengajuan', '01REQ');
    expectTarget(targetOf(NotificationType::RequestRevisionRequested, '/pengajuan/01REQ', $subject), 'pengajuan', '01REQ');
    expectTarget(targetOf(NotificationType::RequestVoided, '/pengajuan/01REQ', $subject), 'pengajuan', '01REQ');
    // The cancel notice to an approver links to the decided list but still knows the request.
    expectTarget(targetOf(NotificationType::RequestCanceled, '/persetujuan?tab=diputus', $subject), 'persetujuan', '01REQ');
});

it('maps attendance, report and security screens without ids', function () {
    expectTarget(targetOf(NotificationType::CheckInReminder, '/absensi'), 'absensi', null);
    expectTarget(targetOf(NotificationType::CheckOutReminder, '/absensi', subjectOf('AttendanceDay', '01DAY')), 'absensi', null);
    expectTarget(targetOf(NotificationType::ConsentRevoked, '/absensi/hari-ini'), 'absensi', null, 'hari-ini');
    expectTarget(targetOf(NotificationType::ReportReminder, '/laporan/hari-ini'), 'laporan', null);
    expectTarget(targetOf(NotificationType::PasswordSetByHr, '/settings/security'), 'keamanan', null);
    expectTarget(targetOf(NotificationType::PasswordResetRequested, '/admin/karyawan/01EMP', subjectOf('PasswordResetRequest', '01PRR')), 'karyawan', '01EMP', 'permintaan-reset');
});

it('maps projects by workspace key and OKR and hiring by record', function () {
    $workspace = subjectOf('Workspace', '01WS', 'PLQ');
    $update = subjectOf('ProjectUpdate', '01UPD', 'PLQ');

    expectTarget(targetOf(NotificationType::ProjectUpdateReminder, '/w/PLQ/ringkasan?update=1', $workspace), 'proyek', 'PLQ');
    expectTarget(targetOf(NotificationType::ProjectDirection, '/w/PLQ/ringkasan#arahan', $workspace), 'proyek', 'PLQ', 'arahan');
    expectTarget(targetOf(NotificationType::ProjectDecisionNeeded, '/portofolio#keputusan', $update), 'proyek', 'PLQ', 'keputusan');
    expectTarget(targetOf(NotificationType::ProjectDecisionResolved, '/w/PLQ/ringkasan', $update), 'proyek', 'PLQ');
    expectTarget(targetOf(NotificationType::OkrObjectiveAtRisk, '/okr/01OBJ', subjectOf('Objective', '01OBJ')), 'okr', '01OBJ');
    // The weekly check-in reminder is about the owner; the URL knows the objective (or none).
    expectTarget(targetOf(NotificationType::OkrCheckinReminder, '/okr/01OBJ', subjectOf('User', '01USR')), 'okr', '01OBJ');
    expectTarget(targetOf(NotificationType::OkrCheckinReminder, '/okr', subjectOf('User', '01USR')), 'okr', null);

    foreach ([NotificationType::HiringCandidateReceived, NotificationType::HiringDecisionNeeded, NotificationType::HiringCandidateDecided] as $type) {
        expectTarget(targetOf($type, '/hiring/kandidat/01CAND', subjectOf('Candidate', '01CAND')), 'hiring', '01CAND');
    }
});

it('maps announcements and briefings by record and leaves free-form notices without a target', function () {
    expectTarget(targetOf(NotificationType::SystemAnnouncement, '/pengumuman?pilih=01ANN', subjectOf('Announcement', '01ANN')), 'pengumuman', '01ANN');
    expectTarget(targetOf(NotificationType::BriefingPosted, '/inbox', subjectOf('Briefing', '01BRF')), 'briefing', '01BRF');

    // Free-form system notice (e.g. briefing delegation) and the test notification: the app shows the detail sheet.
    expect(targetOf(NotificationType::SystemAnnouncement, '/dashboard'))->toBeNull()
        ->and(targetOf(NotificationType::SystemTest, '/pengaturan/notifikasi'))->toBeNull()
        ->and(targetOf(NotificationType::TaskAssigned, null))->toBeNull()
        ->and((new NotificationTarget)->resolve('jenis.tidak.dikenal', ['url' => '/absensi']))->toBe(['type' => 'absensi', 'id' => null, 'anchor' => null, 'params' => []]);
});

it('never throws on any notification type with an empty payload', function () {
    foreach (NotificationType::cases() as $type) {
        expect(fn () => (new NotificationTarget)->resolve($type, []))->not->toThrow(Throwable::class);
    }
});

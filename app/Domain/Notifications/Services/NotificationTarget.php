<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Enums\NotificationType;

/**
 * Where tapping a notification (Inbox row or push) should take the mobile
 * app, so the app never parses web URLs.
 *
 * Shape: {type, id, anchor, params}
 * - type: tugas · catatan · obrolan · rapat · pengajuan · persetujuan ·
 *   pengumuman · briefing · proyek · okr · hiring · karyawan · absensi ·
 *   laporan · keamanan
 * - id: record id (proyek: the workspace key, accepted by the workspace
 *   routes; null for list/screen targets such as absensi, laporan, keamanan)
 * - anchor: place inside the screen (komentar-{id}, pesan-{id}, notulen,
 *   arahan, keputusan, permintaan-reset, hari-ini …) or null
 * - params: extra query values (rapat: tanggal = YYYY-MM-DD of the occurrence)
 *
 * null = nothing to open (system.test, free-form announcements) → the app
 * shows the notification detail sheet.
 */
final class NotificationTarget
{
    /**
     * @param  array<string, mixed>  $data  notification payload (`data` column): url, subject{type,id,code,title}
     * @return array{type: string, id: string|null, anchor: string|null, params: array<string, string>}|null
     */
    public function resolve(NotificationType|string|null $type, array $data): ?array
    {
        $type = $type instanceof NotificationType ? $type : (is_string($type) ? NotificationType::tryFrom($type) : null);

        if ($type === NotificationType::SystemTest) {
            return null;
        }

        $url = is_string($data['url'] ?? null) ? $data['url'] : null;
        $parts = $url === null ? [] : (parse_url($url) ?: []);
        $path = is_string($parts['path'] ?? null) ? rtrim($parts['path'], '/') : '';
        $fragment = is_string($parts['fragment'] ?? null) && $parts['fragment'] !== '' ? $parts['fragment'] : null;
        parse_str(is_string($parts['query'] ?? null) ? $parts['query'] : '', $query);

        $subject = is_array($data['subject'] ?? null) ? $data['subject'] : [];
        $subjectClass = is_string($subject['type'] ?? null) ? class_basename($subject['type']) : null;
        $subjectId = is_string($subject['id'] ?? null) && $subject['id'] !== '' ? $subject['id'] : null;
        $subjectCode = is_string($subject['code'] ?? null) && $subject['code'] !== '' ? $subject['code'] : null;

        $bySubject = match ($subjectClass) {
            'Task' => $subjectId === null ? null : $this->make('tugas', $subjectId, $fragment),
            'Note' => $subjectId === null ? null : $this->make('catatan', $subjectId, $fragment),
            'Channel' => $subjectId === null ? null : $this->make('obrolan', $subjectId, $fragment),
            'Meeting' => $subjectId === null ? null : $this->meeting($subjectId, $path, $query),
            'MeetingActionItem' => preg_match('#^/rapat/([^/]+)#', $path, $match) === 1 ? $this->meeting($match[1], $path, $query) : null,
            'EmployeeRequest' => $subjectId === null ? null : $this->make(str_starts_with($path, '/persetujuan') ? 'persetujuan' : 'pengajuan', $subjectId, $fragment),
            'Announcement' => $subjectId === null ? null : $this->make('pengumuman', $subjectId, null),
            'Briefing' => $subjectId === null ? null : $this->make('briefing', $subjectId, null),
            // Project notifications: subject = the project workspace (code = key) or one of its updates (code = key).
            'Workspace', 'ProjectUpdate' => ($subjectCode ?? $subjectId) === null ? null : $this->make('proyek', $subjectCode ?? $subjectId, $fragment),
            'Objective' => $subjectId === null ? null : $this->make('okr', $subjectId, $fragment),
            'Candidate' => $subjectId === null ? null : $this->make('hiring', $subjectId, $fragment),
            'PasswordResetRequest' => preg_match('#^/admin/karyawan/([^/]+)#', $path, $match) === 1 ? $this->make('karyawan', $match[1], 'permintaan-reset') : null,
            'AttendanceDay' => $this->make('absensi', null, null),
            default => null,
        };

        return $bySubject ?? $this->byPath($path, $fragment);
    }

    /**
     * Fallback for notifications without a usable subject (reminders, links to screens).
     *
     * @return array{type: string, id: string|null, anchor: string|null, params: array<string, string>}|null
     */
    private function byPath(string $path, ?string $fragment): ?array
    {
        return match (true) {
            $path === '/absensi' || str_starts_with($path, '/absensi/') => $this->make('absensi', null, $fragment ?? (str_ends_with($path, '/hari-ini') ? 'hari-ini' : null)),
            $path === '/laporan/hari-ini' => $this->make('laporan', null, null),
            $path === '/settings/security' => $this->make('keamanan', null, null),
            preg_match('#^/okr/([^/]+)$#', $path, $match) === 1 => $this->make('okr', $match[1], $fragment),
            $path === '/okr' => $this->make('okr', null, null),
            preg_match('#^/w/([^/]+)/ringkasan$#', $path, $match) === 1 => $this->make('proyek', $match[1], $fragment),
            default => null,
        };
    }

    /**
     * @param  array<int|string, mixed>  $query
     * @return array{type: string, id: string|null, anchor: string|null, params: array<string, string>}
     */
    private function meeting(string $id, string $path, array $query): array
    {
        $date = is_string($query['tanggal'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $query['tanggal']) === 1 ? $query['tanggal'] : null;

        return $this->make('rapat', $id, str_ends_with($path, '/notulen') ? 'notulen' : null, $date === null ? [] : ['tanggal' => $date]);
    }

    /**
     * @param  array<string, string>  $params
     * @return array{type: string, id: string|null, anchor: string|null, params: array<string, string>}
     */
    private function make(string $type, ?string $id, ?string $anchor, array $params = []): array
    {
        return ['type' => $type, 'id' => $id, 'anchor' => $anchor, 'params' => $params];
    }
}

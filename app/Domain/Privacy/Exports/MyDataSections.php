<?php

namespace App\Domain\Privacy\Exports;

use App\Domain\Privacy\Services\MyData;
use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * The content of the "Data Saya" export: one section per kind of data, used
 * both as Excel worksheets and as PDF tables (same rows).
 */
final readonly class MyDataSections
{
    public function __construct(
        private MyData $data,
        private PrivacyPolicy $policy,
    ) {}

    /**
     * @return list<array{title: string, headings: list<string>, rows: array<int, array<int, mixed>>}>
     */
    public function build(User $user): array
    {
        $profile = $this->data->profile($user);
        $consent = $this->data->consent($user);

        return [
            [
                'title' => 'Profil',
                'headings' => ['Data', 'Nilai'],
                'rows' => [
                    ['Nama', $profile['name']],
                    ['Email', $profile['email']],
                    ['Nomor karyawan', $profile['employee_number']],
                    ['NIK (tersamar)', $profile['nik_masked']],
                    ['Telepon', $profile['phone']],
                    ['Tanggal lahir', $profile['birth_date']],
                    ['Alamat', $profile['address']],
                    ['Kontak darurat', $profile['emergency_contact']],
                    ['Divisi', $profile['division']],
                    ['Tim', $profile['team']],
                    ['Jabatan', $profile['position']],
                    ['Atasan langsung', $profile['manager']],
                    ['Mode kerja', $profile['work_mode']],
                    ['Status', $profile['status']],
                    ['Tanggal bergabung', $profile['joined_at']],
                    ['Peran akses', implode(', ', $profile['roles'])],
                    ['Akun Google tertaut', $profile['google_linked'] ? 'Ya' : 'Tidak'],
                    ['Verifikasi dua langkah', $profile['two_factor'] ? 'Aktif' : 'Tidak aktif'],
                ],
            ],
            [
                'title' => 'Persetujuan data',
                'headings' => ['Jenis', 'Versi kebijakan', 'Diberikan', 'Dicabut'],
                'rows' => [
                    ...array_map(fn (array $row): array => [
                        $row['type_label'],
                        $row['version'],
                        MyData::at(self::instant($row['granted_at'])),
                        MyData::at(self::instant($row['revoked_at'])) ?? '–',
                    ], $consent['history']),
                    ['Status saat ini', $this->policy->version(), $consent['granted'] ? 'Disetujui' : 'Belum/dicabut', null],
                ],
            ],
            [
                'title' => 'Absensi harian',
                'headings' => ['Tanggal', 'Status', 'Shift', 'Masuk', 'Pulang', 'Metode', 'Lokasi', 'Terlambat (menit)', 'Pulang cepat (menit)', 'Kerja (menit)', 'Lembur (menit)', 'Catatan'],
                'rows' => array_map(fn (array $day): array => [
                    $day['date'], $day['status_label'], $day['shift'], $day['check_in'], $day['check_out'], $day['method'], $day['location'],
                    $day['late_minutes'], $day['early_leave_minutes'], $day['work_minutes'], $day['overtime_minutes'], $day['note'],
                ], $this->data->allDays($user)),
            ],
            [
                'title' => 'Log absensi',
                'headings' => ['Waktu', 'Jenis', 'Metode', 'Lokasi kantor', 'Lintang', 'Bujur', 'Akurasi (m)', 'Jarak (m)', 'Selfie', 'Penanda', 'Alamat IP', 'Browser', 'Penanda perangkat', 'Catatan', 'Koreksi manual'],
                'rows' => array_map(fn (array $log): array => [
                    $log['occurred_at'], $log['type'], $log['method'], $log['location'], $log['latitude'], $log['longitude'], $log['accuracy_m'],
                    $log['distance_m'], $log['selfie'], $log['flags'], $log['ip_address'], $log['user_agent'], $log['device'], $log['note'], $log['manual'] ? 'Ya' : 'Tidak',
                ], $this->data->allLogs($user)),
            ],
            [
                'title' => 'Pengajuan saya',
                'headings' => ['Nomor', 'Jenis', 'Periode', 'Alasan', 'Status', 'Diajukan', 'Diputus'],
                'rows' => array_map(fn (array $request): array => [
                    $request['number'], $request['type'], $request['summary'], $request['reason'], $request['status_label'],
                    MyData::at(self::instant($request['submitted_at'])), MyData::at(self::instant($request['decided_at'])),
                ], $this->data->requests($user, null)['items']),
            ],
            [
                'title' => 'Keputusan saya',
                'headings' => ['Nomor', 'Pemohon', 'Jenis', 'Periode', 'Keputusan', 'Catatan', 'Waktu'],
                'rows' => array_map(fn (array $step): array => [
                    $step['number'], $step['requester'], $step['type'], $step['summary'], $step['decision_label'], $step['note'],
                    MyData::at(self::instant($step['decided_at'])),
                ], $this->data->decisions($user, null)['items']),
            ],
        ];
    }

    private static function instant(mixed $iso): ?CarbonImmutable
    {
        return is_string($iso) ? CarbonImmutable::parse($iso) : null;
    }
}

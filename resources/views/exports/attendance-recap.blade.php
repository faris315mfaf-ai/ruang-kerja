{{-- Monthly attendance recap (dompdf). PDF output cannot read the CSS tokens, so plain greys are used. --}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        @page { margin: 28px 32px; }
        body { font-family: "DejaVu Sans", sans-serif; font-size: 9px; color: #111; }
        h1 { font-size: 15px; margin: 0 0 2px; }
        .muted { color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border-bottom: 1px solid #ccc; padding: 4px 5px; text-align: left; vertical-align: top; }
        th { background: #eee; font-weight: bold; }
        td.num, th.num { text-align: right; }
        .summary td { border: none; padding: 2px 16px 2px 0; }
        footer { position: fixed; bottom: -16px; left: 0; right: 0; font-size: 8px; color: #777; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <div class="muted">{{ $companyName }} · {{ $periodLine }} · dibuat {{ $generatedAt }} oleh {{ $generatedBy }}</div>

    <table class="summary">
        <tr>
            <td>Karyawan: <strong>{{ $employees }}</strong></td>
            <td>Hari kerja kalender: <strong>{{ $calendarWorkDays }}</strong></td>
            <td>Rata-rata kehadiran: <strong>{{ $attendanceRate === null ? '–' : number_format($attendanceRate, 1, ',', '.').'%' }}</strong></td>
            <td>Total terlambat: <strong>{{ $lateCount }} kali</strong></td>
            <td>Total lembur: <strong>{{ number_format($overtimeHours, 1, ',', '.') }} jam</strong></td>
        </tr>
    </table>

    <table>
        <thead>
            <tr>
                @foreach ($headings as $heading)
                    <th class="{{ $numeric[$loop->index] ? 'num' : '' }}">{{ $heading }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr>
                    @foreach ($row as $value)
                        <td class="{{ $numeric[$loop->index] ? 'num' : '' }}">{{ is_float($value) ? number_format($value, 1, ',', '.') : ($value ?? '–') }}</td>
                    @endforeach
                </tr>
            @empty
                <tr><td colspan="{{ count($headings) }}" class="muted">Tidak ada data absensi pada periode ini.</td></tr>
            @endforelse
        </tbody>
    </table>

    <footer>Terlambat ditulis kali dan total menit, sudah termasuk dalam Hadir. Lembur hanya yang disetujui. Dokumen internal RuangKerja.</footer>
</body>
</html>

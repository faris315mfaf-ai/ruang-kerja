{{-- Personal monthly attendance recap (dompdf). PDF output cannot read the CSS tokens, so plain greys are used. --}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        @page { margin: 32px 36px; }
        body { font-family: "DejaVu Sans", sans-serif; font-size: 10px; color: #111; }
        h1 { font-size: 16px; margin: 0 0 2px; }
        .muted { color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border-bottom: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #eee; }
        .stats td { border: 1px solid #ccc; padding: 6px 8px; width: 12.5%; }
        .stats strong { display: block; font-size: 14px; }
        .off { color: #888; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <div class="muted">{{ $employee }} · {{ $subtitle }} · dibuat {{ $generatedAt }}</div>

    <table class="stats">
        <tr>
            @foreach ($stats as $label => $value)
                <td>{{ $label }}<strong>{{ $value }}</strong></td>
            @endforeach
        </tr>
    </table>

    <table>
        <thead>
            <tr><th>Tanggal</th><th>Status</th><th>Masuk</th><th>Pulang</th><th>Metode</th><th>Lokasi</th><th>Catatan</th></tr>
        </thead>
        <tbody>
            @foreach ($days as $day)
                <tr class="{{ $day['muted'] ? 'off' : '' }}">
                    <td>{{ $day['date'] }}</td>
                    <td>{{ $day['status'] }}</td>
                    <td>{{ $day['in'] ?? '–' }}</td>
                    <td>{{ $day['out'] ?? '–' }}</td>
                    <td>{{ $day['method'] ?? '' }}</td>
                    <td>{{ $day['location'] ?? '' }}</td>
                    <td>{{ $day['note'] ?? '' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>

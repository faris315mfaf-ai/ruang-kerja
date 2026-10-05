{{-- "Data saya" export (Privasi, Sprint 10; dompdf). PDF output cannot read the CSS tokens, so plain greys are used. --}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        @page { margin: 28px 30px; }
        body { font-family: "DejaVu Sans", sans-serif; font-size: 8px; color: #111; }
        h1 { font-size: 15px; margin: 0 0 2px; }
        h2 { font-size: 11px; margin: 16px 0 4px; }
        .muted { color: #555; }
        table { width: 100%; border-collapse: collapse; table-layout: auto; }
        th, td { border-bottom: 1px solid #ccc; padding: 3px 4px; text-align: left; vertical-align: top; word-wrap: break-word; }
        th { background: #eee; }
        .empty { color: #777; font-style: italic; padding: 4px 0; }
        .note { margin-top: 18px; color: #555; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <div class="muted">Dibuat {{ $generatedAt }} · kebijakan privasi versi {{ $policyVersion }} · NIK ditampilkan tersamar, selfie tidak disertakan.</div>

    @foreach ($sections as $section)
        <h2>{{ $section['title'] }} ({{ count($section['rows']) }})</h2>
        @if (count($section['rows']) === 0)
            <div class="empty">Tidak ada data.</div>
        @else
            <table>
                <thead>
                    <tr>
                        @foreach ($section['headings'] as $heading)
                            <th>{{ $heading }}</th>
                        @endforeach
                    </tr>
                </thead>
                <tbody>
                    @foreach ($section['rows'] as $row)
                        <tr>
                            @foreach ($row as $cell)
                                <td>{{ $cell ?? '–' }}</td>
                            @endforeach
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    @endforeach

    <p class="note">Salinan ini berisi data pribadi Anda. Simpan dengan aman. Untuk koreksi atau permintaan lain, hubungi HR.</p>
</body>
</html>

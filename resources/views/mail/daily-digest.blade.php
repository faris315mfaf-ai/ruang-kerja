@extends('mail.layout')

@php
    /** @var \App\Domain\Notifications\Digest\Data\DailyDigest $digest */
    $c = [
        'text' => '#0F1A1F', 'muted' => '#5A6A72', 'border' => '#E2E8EB', 'surface' => '#FFFFFF',
        'primary' => '#0A7C85', 'danger' => '#C42B2B', 'dangerBg' => '#FCEFEF', 'dangerBorder' => '#F3C4C4',
    ];
    $badge = [
        'neutral' => ['#F1F4F6', '#5A6A72'],
        'info' => ['#E8F0FC', '#1F66D1'],
        'warning' => ['#FBF1DD', '#9A6200'],
        'danger' => ['#FCEFEF', '#C42B2B'],
        'success' => ['#E3F4EB', '#13804F'],
        'primary' => ['#E6F5F5', '#0A7C85'],
    ];
    $avatarColors = ['#7A4E6A', '#5B6B2E', '#3E4C8A', '#0A6C70', '#8A5A2B', '#4B5563'];
    $initials = fn (string $name): string => \Illuminate\Support\Str::of($name)->explode(' ')->filter()->take(2)->map(fn ($p) => mb_strtoupper(mb_substr($p, 0, 1)))->implode('');
    $tiles = array_slice($digest->sections, 0, 3);
@endphp

@section('title', 'Ringkasan harian · '.$dateLabel)
@section('preview', $greeting.', '.$firstName.'. Ini ringkasan '.$dateLabel.'.')
@section('preheader')
    Ringkasan harian · {{ $dateLabel }} · <a href="{{ $browserUrl }}" style="color:#0A7C85;">Lihat di browser</a>
@endsection

@section('content')
    <h1 style="margin:0 0 4px;font-size:22px;line-height:30px;font-weight:600;color:{{ $c['text'] }};">{{ $greeting }}, {{ $firstName }}.</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:20px;color:{{ $c['muted'] }};">Ini ringkasan {{ $dateLabel }}.</p>

    {{-- KPI tiles --}}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
            @foreach ($tiles as $tile)
                @php $danger = $tile->tone === 'danger'; @endphp
                <td class="rk-stat" width="{{ floor(100 / max(count($tiles), 1)) }}%" style="padding:{{ $loop->first ? '0 4px 0 0' : ($loop->last ? '0 0 0 4px' : '0 4px') }};vertical-align:top;">
                    <div style="border:1px solid {{ $danger ? $c['dangerBorder'] : $c['border'] }};background:{{ $danger ? $c['dangerBg'] : $c['surface'] }};border-radius:8px;padding:12px 12px 10px;">
                        <div style="font-size:12px;line-height:16px;color:{{ $danger ? $c['danger'] : $c['muted'] }};">{{ $tile->tileLabel }}</div>
                        <div style="margin-top:6px;font-size:24px;line-height:30px;font-weight:600;color:{{ $danger ? $c['danger'] : $c['text'] }};">{{ $tile->count }}</div>
                    </div>
                </td>
            @endforeach
        </tr>
    </table>

    @foreach ($digest->sections as $section)
        @php $danger = $section->tone === 'danger'; @endphp
        <h2 style="margin:0 0 8px;font-size:15px;line-height:22px;font-weight:600;color:{{ $danger ? $c['danger'] : $c['text'] }};">{{ $section->title }}</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ $danger ? $c['dangerBorder'] : $c['border'] }};background:{{ $danger ? $c['dangerBg'] : $c['surface'] }};border-radius:8px;border-collapse:separate;">
            @foreach ($section->items as $item)
                <tr>
                    <td style="padding:10px 12px;{{ $loop->last && ! $section->more ? '' : 'border-bottom:1px solid '.$c['border'].';' }}font-size:13px;line-height:20px;color:{{ $c['text'] }};">
                        @if ($item->avatarName)
                            <span style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:10px;background:{{ $avatarColors[crc32($item->avatarName) % count($avatarColors)] }};color:#FFFFFF;font-size:9px;font-weight:600;text-align:center;vertical-align:middle;margin-right:6px;">{{ $initials($item->avatarName) }}</span>
                        @endif
                        @if ($item->code)
                            <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:12px;color:{{ $c['muted'] }};margin-right:8px;">{{ $item->code }}</span>
                        @endif
                        <span>{{ $item->title }}</span>
                        @if ($item->detail)
                            <span style="color:{{ $c['muted'] }};"> · {{ $item->detail }}</span>
                        @endif
                    </td>
                    <td align="right" style="padding:10px 12px;{{ $loop->last && ! $section->more ? '' : 'border-bottom:1px solid '.$c['border'].';' }}white-space:nowrap;vertical-align:middle;">
                        @if ($item->badge)
                            @php [$bg, $fg] = $badge[$item->badgeTone] ?? $badge['neutral']; @endphp
                            <span style="display:inline-block;padding:1px 8px;border-radius:999px;background:{{ $bg }};color:{{ $fg }};font-size:12px;line-height:18px;">{{ $item->badge }}</span>
                        @endif
                        @if ($item->trailing)
                            <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:12px;color:{{ $c['muted'] }};">{{ $item->trailing }}</span>
                        @endif
                    </td>
                </tr>
            @endforeach
            @if ($section->more)
                <tr>
                    <td colspan="2" style="padding:10px 12px;font-size:12px;line-height:18px;color:{{ $c['muted'] }};">{{ $section->more }}</td>
                </tr>
            @endif
        </table>
        @if ($section->note)
            <p style="margin:8px 0 0;font-size:12px;line-height:18px;color:{{ $c['muted'] }};">{{ $section->note }}</p>
        @endif
        <div style="height:24px;line-height:24px;">&nbsp;</div>
    @endforeach

    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
        <tr>
            <td style="border-radius:8px;background:{{ $c['primary'] }};">
                <a href="{{ $appUrl }}" style="display:inline-block;padding:11px 24px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">Buka RuangKerja</a>
            </td>
        </tr>
    </table>
    <p style="margin:12px 0 0;text-align:center;font-size:12px;line-height:18px;color:{{ $c['muted'] }};">Item yang perlu tindakan bisa langsung diproses dari <a href="{{ $inboxUrl }}" style="color:#0A7C85;">Inbox</a>.</p>
@endsection

@section('footer')
    Email ini dikirim pukul {{ $sendTimeLabel }} karena Anda mengaktifkan ringkasan harian. <a href="{{ $settingsUrl }}" style="color:#0A7C85;">Atur notifikasi</a>
@endsection

@extends('mail.layout')

@php
    /** @var \App\Domain\Notifications\Digest\Data\DailyDigest $digest */
    $c = [
        'text' => '#0B1A2B', 'muted' => '#46576B', 'border' => '#DDE4EC', 'divider' => '#EEF2F7', 'surface' => '#FFFFFF',
        'link' => '#09656E', 'danger' => '#C42137', 'dangerBg' => '#FDE7EA', 'dangerBorder' => '#F6C7CE',
    ];
    $badge = [
        'neutral' => ['#EEF2F7', '#46576B'],
        'info' => ['#E6EEFE', '#1A4CB0'],
        'warning' => ['#FFF1DC', '#9A5800'],
        'danger' => ['#FDE7EA', '#C42137'],
        'success' => ['#E3F6EE', '#0F7A55'],
        'primary' => ['#E8FBF8', '#09656E'],
    ];
    // Avatar tones (Komponen "Avatar"): background + text pairs.
    $avatarColors = [['#D9E6FF', '#1A4CB0'], ['#C8F4EE', '#0A4E57'], ['#FFF1DC', '#9A5800']];
    $initials = fn (string $name): string => \Illuminate\Support\Str::of($name)->explode(' ')->filter()->take(2)->map(fn ($p) => mb_strtoupper(mb_substr($p, 0, 1)))->implode('');
    $tiles = array_slice($digest->sections, 0, 3);
@endphp

@section('title', 'Ringkasan harian · '.$dateLabel)
@section('preview', $greeting.', '.$firstName.'. Ini ringkasan '.$dateLabel.'.')
@section('preheader')
    Ringkasan harian · {{ $dateLabel }} · <a href="{{ $browserUrl }}" style="color:#09656E;font-weight:700;">Lihat di browser</a>
@endsection

@section('content')
    <h1 style="margin:0 0 6px;font-size:26px;line-height:34px;font-weight:800;letter-spacing:-0.015em;color:{{ $c['text'] }};">{{ $greeting }}, {{ $firstName }}.</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:{{ $c['muted'] }};">Ini ringkasan {{ $dateLabel }}.</p>

    {{-- KPI tiles --}}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
            @foreach ($tiles as $tile)
                @php $danger = $tile->tone === 'danger'; @endphp
                <td class="rk-stat" width="{{ floor(100 / max(count($tiles), 1)) }}%" style="padding:{{ $loop->first ? '0 5px 0 0' : ($loop->last ? '0 0 0 5px' : '0 5px') }};vertical-align:top;">
                    <div style="border:1px solid {{ $danger ? $c['dangerBorder'] : $c['border'] }};background:{{ $danger ? $c['dangerBg'] : $c['surface'] }};border-radius:20px;padding:14px 16px;">
                        <div style="font-size:14px;line-height:20px;font-weight:600;color:{{ $danger ? $c['danger'] : $c['muted'] }};">{{ $tile->tileLabel }}</div>
                        <div style="margin-top:4px;font-size:32px;line-height:40px;font-weight:800;letter-spacing:-0.02em;color:{{ $danger ? $c['danger'] : $c['text'] }};">{{ $tile->count }}</div>
                    </div>
                </td>
            @endforeach
        </tr>
    </table>

    @foreach ($digest->sections as $section)
        @php $danger = $section->tone === 'danger'; @endphp
        <h2 style="margin:0 0 10px;font-size:18px;line-height:26px;font-weight:700;color:{{ $danger ? $c['danger'] : $c['text'] }};">{{ $section->title }}</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ $danger ? $c['dangerBorder'] : $c['border'] }};background:{{ $danger ? $c['dangerBg'] : $c['surface'] }};border-radius:16px;border-collapse:separate;">
            @foreach ($section->items as $item)
                <tr>
                    <td style="padding:12px 16px;{{ $loop->last && ! $section->more ? '' : 'border-bottom:1px solid '.$c['divider'].';' }}font-size:15px;line-height:22px;color:{{ $c['text'] }};">
                        @if ($item->avatarName)
                            @php [$avatarBg, $avatarFg] = $avatarColors[crc32($item->avatarName) % count($avatarColors)]; @endphp
                            <span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:{{ $avatarBg }};color:{{ $avatarFg }};font-size:11px;font-weight:700;text-align:center;vertical-align:middle;margin-right:8px;">{{ $initials($item->avatarName) }}</span>
                        @endif
                        @if ($item->code)
                            <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:14px;font-weight:600;color:{{ $c['muted'] }};margin-right:8px;">{{ $item->code }}</span>
                        @endif
                        <span>{{ $item->title }}</span>
                        @if ($item->detail)
                            <span style="color:{{ $c['muted'] }};"> · {{ $item->detail }}</span>
                        @endif
                    </td>
                    <td align="right" style="padding:12px 16px;{{ $loop->last && ! $section->more ? '' : 'border-bottom:1px solid '.$c['divider'].';' }}white-space:nowrap;vertical-align:middle;">
                        @if ($item->badge)
                            @php [$bg, $fg] = $badge[$item->badgeTone] ?? $badge['neutral']; @endphp
                            <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:{{ $bg }};color:{{ $fg }};font-size:13px;line-height:18px;font-weight:700;">{{ $item->badge }}</span>
                        @endif
                        @if ($item->trailing)
                            <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:13px;color:{{ $c['muted'] }};">{{ $item->trailing }}</span>
                        @endif
                    </td>
                </tr>
            @endforeach
            @if ($section->more)
                <tr>
                    <td colspan="2" style="padding:12px 16px;font-size:14px;line-height:20px;color:{{ $c['muted'] }};">{{ $section->more }}</td>
                </tr>
            @endif
        </table>
        @if ($section->note)
            <p style="margin:8px 0 0;font-size:14px;line-height:20px;color:{{ $c['muted'] }};">{{ $section->note }}</p>
        @endif
        <div style="height:24px;line-height:24px;">&nbsp;</div>
    @endforeach

    @include('mail.partials.button', ['url' => $appUrl, 'label' => 'Buka RuangKerja'])
    <p style="margin:16px 0 0;text-align:center;font-size:14px;line-height:20px;color:{{ $c['muted'] }};">Item yang perlu tindakan bisa langsung diproses dari <a href="{{ $inboxUrl }}" style="color:#09656E;font-weight:700;">Inbox</a>.</p>
@endsection

@section('footer')
    Email ini dikirim pukul {{ $sendTimeLabel }} karena Anda mengaktifkan ringkasan harian. <a href="{{ $settingsUrl }}" style="color:#09656E;font-weight:700;">Atur notifikasi</a>
@endsection

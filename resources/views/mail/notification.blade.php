@extends('mail.layout')

@php
    /** @var \App\Domain\Notifications\Data\NotificationPayload $payload */
    $c = ['text' => '#0B1A2B', 'muted' => '#46576B', 'border' => '#DDE4EC', 'surface2' => '#F3F6FA', 'primary' => '#0B7F86', 'danger' => '#C42137'];
    $context = is_string($payload->meta['context'] ?? null) ? $payload->meta['context'] : null;
@endphp

@section('title', $payload->title)
@section('preview', $payload->body ?? $payload->title)
@section('preheader', $typeLabel)

@section('content')
    @if ($user)
        <p style="margin:0 0 6px;font-size:14px;line-height:20px;color:{{ $c['muted'] }};">Halo, {{ \Illuminate\Support\Str::before($user->name, ' ') }}.</p>
    @endif
    <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;font-weight:600;color:{{ $c['text'] }};">{{ $payload->title }}</h1>

    @if ($payload->subject && ($payload->subject->code || $payload->subject->title))
        <p style="margin:0 0 12px;font-size:13px;line-height:20px;color:{{ $c['muted'] }};">
            @if ($payload->subject->code)<span style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;">{{ $payload->subject->code }}</span>@endif
            @if ($payload->subject->code && $payload->subject->title) · @endif
            {{ $payload->subject->title }}
            @if ($context) · <span style="color:{{ ($payload->meta['context_tone'] ?? null) === 'danger' ? $c['danger'] : $c['muted'] }};">{{ $context }}</span>@endif
        </p>
    @endif

    @if ($payload->body)
        <div style="margin:0 0 24px;padding:12px 14px;background:{{ $c['surface2'] }};border:1px solid {{ $c['border'] }};border-radius:8px;font-size:14px;line-height:22px;color:{{ $c['text'] }};">{{ $payload->body }}</div>
    @endif

    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
        <tr>
            <td style="border-radius:8px;background:{{ $c['primary'] }};">
                <a href="{{ $actionUrl }}" style="display:inline-block;padding:11px 24px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">{{ $actionLabel }}</a>
            </td>
        </tr>
    </table>
@endsection

@section('footer')
    Anda menerima email ini karena notifikasi email untuk kejadian ini aktif. <a href="{{ $settingsUrl }}" style="color:#0B7F86;">Atur notifikasi</a>
@endsection

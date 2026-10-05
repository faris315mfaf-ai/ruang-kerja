@extends('mail.layout')

@php
    /** @var \App\Domain\Notifications\Data\NotificationPayload $payload */
    $c = ['text' => '#0B1A2B', 'muted' => '#46576B', 'bg' => '#F3F6FA', 'border' => '#DDE4EC', 'link' => '#09656E', 'danger' => '#C42137'];
    $context = is_string($payload->meta['context'] ?? null) ? $payload->meta['context'] : null;
@endphp

@section('title', $payload->title)
@section('preview', $payload->body ?? $payload->title)
@section('preheader', $typeLabel)

@section('content')
    @if ($user)
        <p style="margin:0 0 8px;font-size:16px;line-height:24px;color:{{ $c['muted'] }};">Halo, {{ \Illuminate\Support\Str::before($user->name, ' ') }}.</p>
    @endif
    <h1 style="margin:0 0 12px;font-size:26px;line-height:34px;font-weight:800;letter-spacing:-0.015em;color:{{ $c['text'] }};">{{ $payload->title }}</h1>

    @if ($payload->subject && ($payload->subject->code || $payload->subject->title))
        <p style="margin:0 0 16px;font-size:15px;line-height:22px;color:{{ $c['muted'] }};">
            @if ($payload->subject->code)<span style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-weight:600;color:{{ $c['text'] }};">{{ $payload->subject->code }}</span>@endif
            @if ($payload->subject->code && $payload->subject->title) · @endif
            {{ $payload->subject->title }}
            @if ($context) · <span style="color:{{ ($payload->meta['context_tone'] ?? null) === 'danger' ? $c['danger'] : $c['muted'] }};">{{ $context }}</span>@endif
        </p>
    @endif

    @if ($payload->body)
        <div style="margin:0 0 28px;padding:16px 18px;background:{{ $c['bg'] }};border:1px solid {{ $c['border'] }};border-radius:16px;font-size:16px;line-height:24px;color:{{ $c['text'] }};">{{ $payload->body }}</div>
    @endif

    @include('mail.partials.button', ['url' => $actionUrl, 'label' => $actionLabel])
@endsection

@section('footer')
    Anda menerima email ini karena notifikasi email untuk kejadian ini aktif. <a href="{{ $settingsUrl }}" style="color:#09656E;font-weight:700;">Atur notifikasi</a>
@endsection

@extends('mail.layout')

@php
    $c = ['text' => '#0B1A2B', 'muted' => '#46576B', 'bg' => '#F3F6FA', 'border' => '#DDE4EC'];
@endphp

@section('title', 'Tautan untuk dibuka di komputer')
@section('preview', 'Buka tautan ini di komputer Anda.')
@section('preheader', 'Dikirim dari aplikasi ponsel')

@section('content')
    <p style="margin:0 0 8px;font-size:16px;line-height:24px;color:{{ $c['muted'] }};">Halo, {{ $firstName }}.</p>
    <h1 style="margin:0 0 12px;font-size:26px;line-height:34px;font-weight:800;letter-spacing:-0.015em;color:{{ $c['text'] }};">Buka di komputer</h1>
    <div style="margin:0 0 28px;padding:16px 18px;background:{{ $c['bg'] }};border:1px solid {{ $c['border'] }};border-radius:16px;font-size:16px;line-height:24px;color:{{ $c['text'] }};">
        Anda meminta tautan ini dari aplikasi ponsel karena fitur tersebut tersedia di komputer. Masuk dengan akun Anda bila diminta.
    </div>

    @include('mail.partials.button', ['url' => $url, 'label' => 'Buka halaman'])
@endsection

@section('footer')
    Tidak merasa meminta tautan ini? Abaikan saja email ini; tautan hanya bisa dibuka setelah masuk dengan akun Anda.
@endsection

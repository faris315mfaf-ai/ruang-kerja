@php
    // Arus error page (overrides the framework's errors::minimal used by every
    // default status view). Plain CSS on purpose: no Vite assets, so it renders
    // even when the build is missing. Colours mirror resources/css/tokens.css.
    $code = trim($__env->yieldContent('code'));
    $raw = trim(html_entity_decode($__env->yieldContent('message')));
    $copy = [
        '401' => ['Perlu masuk', 'Silakan masuk dulu untuk membuka halaman ini.'],
        '402' => ['Pembayaran diperlukan', 'Halaman ini belum tersedia untuk akun Anda.'],
        '403' => ['Akses ditolak', 'Anda tidak punya akses ke halaman ini. Hubungi atasan atau HR bila seharusnya bisa.'],
        '404' => ['Halaman tidak ditemukan', 'Tautan mungkin salah atau halamannya sudah dipindahkan.'],
        '419' => ['Sesi kedaluwarsa', 'Halaman terlalu lama terbuka. Muat ulang lalu coba lagi.'],
        '429' => ['Terlalu banyak permintaan', 'Tunggu sebentar, lalu coba lagi.'],
        '500' => ['Terjadi kesalahan', 'Ada masalah di server. Coba lagi beberapa saat lagi.'],
        '503' => ['Sedang pemeliharaan', 'RuangKerja sedang diperbarui. Coba lagi beberapa menit lagi.'],
    ][$code] ?? ['Terjadi kesalahan', 'Coba lagi beberapa saat lagi.'];
    // Framework defaults are English; app-specific messages (abort(403, '…')) are shown as-is.
    $defaults = ['Unauthorized', 'Payment Required', 'Forbidden', 'This action is unauthorized.', 'Not Found', 'Page Expired', 'Too Many Requests', 'Server Error', 'Service Unavailable'];
    $defaults = [...$defaults, ...array_map(fn (string $text): string => __($text), $defaults)];
    $detail = $raw !== '' && ! in_array($raw, $defaults, true) && $code !== '500' ? $raw : $copy[1];
    $appearance = request()->cookie('appearance') ?? 'system';
@endphp
<!DOCTYPE html>
<html lang="id" @class(['dark' => $appearance === 'dark', 'light' => $appearance === 'light'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="robots" content="noindex">
        <title>{{ $copy[0] }} · {{ config('branding.name', config('app.name', 'RuangKerja')) }}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <style nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
            :root {
                --bg: #F3F6FA; --surface: #FFFFFF; --border: #DDE4EC; --text: #0B1A2B;
                --muted: #46576B; --subtle: #8495A8; --link: #09656E;
                --glow-a: rgb(45 191 177 / 0.14); --glow-b: rgb(91 140 246 / 0.14);
                --shadow: 0 1px 2px rgb(11 26 43 / 0.06), 0 8px 24px rgb(11 26 43 / 0.06);
            }
            @media (prefers-color-scheme: dark) {
                :root:not(.light) {
                    --bg: #070B14; --surface: #0F1622; --border: #233247; --text: #EAF1F8;
                    --muted: #A6B4C6; --subtle: #7D8FA5; --link: #5EEAD4;
                    --glow-a: rgb(45 191 177 / 0.16); --glow-b: rgb(91 140 246 / 0.16);
                    --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.35);
                }
            }
            :root.dark {
                --bg: #070B14; --surface: #0F1622; --border: #233247; --text: #EAF1F8;
                --muted: #A6B4C6; --subtle: #7D8FA5; --link: #5EEAD4;
                --glow-a: rgb(45 191 177 / 0.16); --glow-b: rgb(91 140 246 / 0.16);
                --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.35);
            }
            * { box-sizing: border-box; }
            html { background: var(--bg); }
            body {
                margin: 0; min-height: 100vh; min-height: 100svh; display: grid; place-items: center;
                padding: 24px 16px; color: var(--text);
                font: 16px/24px Figtree, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                -webkit-font-smoothing: antialiased;
                background: radial-gradient(1000px 480px at 0% 0%, var(--glow-a), transparent 65%),
                    radial-gradient(1000px 480px at 100% 0%, var(--glow-b), transparent 65%), var(--bg);
                background-repeat: no-repeat;
            }
            main { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 20px; }
            .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 17px; }
            .tile {
                display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px;
                color: #FFFFFF; font-weight: 800; background: linear-gradient(135deg, #14B8A6 0%, #2F7BEA 100%);
                box-shadow: 0 4px 12px rgb(30 95 214 / 0.25);
            }
            .card {
                background: var(--surface); border: 1px solid var(--border); border-radius: 24px;
                padding: 28px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px;
            }
            .code { margin: 0; font-size: 14px; line-height: 20px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--link); }
            h1 { margin: 0; font-size: 26px; line-height: 34px; letter-spacing: -0.015em; }
            p { margin: 0; color: var(--muted); }
            .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
            a.button {
                display: inline-flex; align-items: center; justify-content: center; height: 44px; padding: 0 20px;
                border-radius: 12px; font-weight: 700; text-decoration: none; color: #FFFFFF;
                background: linear-gradient(135deg, #0B7F86 0%, #1E5FD6 100%); box-shadow: 0 8px 20px rgb(30 95 214 / 0.3);
            }
            a:focus-visible { outline: 3px solid rgb(45 191 177 / 0.55); outline-offset: 2px; }
        </style>
    </head>
    <body>
        <main>
            <div class="brand">
                <span class="tile" aria-hidden="true">{{ config('branding.short_name', 'RK') }}</span>
                {{ config('branding.name', config('app.name', 'RuangKerja')) }}
            </div>
            <section class="card" aria-labelledby="error-title">
                <p class="code">Galat {{ $code }}</p>
                <h1 id="error-title">{{ $copy[0] }}</h1>
                <p>{{ $detail }}</p>
                <div class="actions">
                    <a class="button" href="{{ url('/dashboard') }}">Ke beranda</a>
                </div>
            </section>
        </main>
    </body>
</html>

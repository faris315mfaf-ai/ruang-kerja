@php
    /*
     * Branded email shell in the Arus style (DESIGN.md, Komponen "Kartu"):
     * gradient aksi header band, white card with a 24px radius on the page
     * background, Figtree with a system fallback stack. Email clients do not
     * support CSS variables, so the light-theme token values from
     * resources/css/tokens.css are inlined here (the only place hex colors are
     * allowed). Every gradient has a solid `bgcolor`/`background-color`
     * fallback for clients that drop background-image (Outlook desktop).
     */
    $c = [
        'bg' => '#F3F6FA',
        'surface' => '#FFFFFF',
        'border' => '#DDE4EC',
        'text' => '#0B1A2B',
        'muted' => '#46576B',
        'subtle' => '#8495A8',
        'primary' => '#0B7F86',
        'link' => '#09656E',
        'gradAksi' => 'linear-gradient(135deg,#0B7F86 0%,#1E5FD6 100%)',
    ];
    $font = "'Figtree',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    $brandName = config('branding.name', config('app.name'));
    // The recipient's company (Fase 1 multi-perusahaan), never one fixed name:
    // explicit $companyName, else $user / the digest's user, else the context.
    $companyName = \App\Domain\Tenancy\Support\CompanyBranding::name(
        $companyName ?? null,
        $user ?? (isset($digest) ? $digest->user : null),
    );
    $shortName = config('branding.short_name', 'RK');
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>@yield('title', $brandName)</title>
    <style>
        @media (max-width: 600px) {
            .rk-container { width: 100% !important; }
            .rk-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .rk-stat { display: block !important; width: 100% !important; padding: 0 0 8px !important; }
        }
        a { color: {{ $c['link'] }}; }
    </style>
</head>
<body style="margin:0;padding:0;background:{{ $c['bg'] }};font-family:{{ $font }};color:{{ $c['text'] }};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">@yield('preview')</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $c['bg'] }};">
        <tr>
            <td align="center" style="padding:32px 12px;">
                <table role="presentation" class="rk-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
                    <tr>
                        <td align="center" style="padding:0 0 16px;font-family:{{ $font }};font-size:14px;line-height:20px;color:{{ $c['muted'] }};">
                            @yield('preheader')
                        </td>
                    </tr>
                    <tr>
                        <td style="background:{{ $c['surface'] }};border:1px solid {{ $c['border'] }};border-radius:24px;box-shadow:0 1px 2px rgba(11,26,43,0.06),0 8px 24px rgba(11,26,43,0.06);">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td class="rk-pad" bgcolor="{{ $c['primary'] }}" style="padding:22px 32px;background-color:{{ $c['primary'] }};background-image:{{ $c['gradAksi'] }};border-radius:23px 23px 0 0;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="vertical-align:middle;font-family:{{ $font }};">
                                                    <span style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:11px;background-color:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);color:#FFFFFF;font-size:14px;font-weight:800;text-align:center;vertical-align:middle;">{{ $shortName }}</span>
                                                    <span style="font-size:18px;font-weight:700;color:#FFFFFF;vertical-align:middle;margin-left:10px;">{{ $brandName }}</span>
                                                </td>
                                                @if ($companyName)
                                                    <td align="right" style="vertical-align:middle;font-family:{{ $font }};font-size:14px;color:#FFFFFF;">{{ $companyName }}</td>
                                                @endif
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="rk-pad" style="padding:32px 32px 36px;font-family:{{ $font }};">
                                        @yield('content')
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:20px 16px 0;font-family:{{ $font }};font-size:14px;line-height:22px;color:{{ $c['muted'] }};">
                            @yield('footer')
                            @if ($companyName)
                                <br><span style="color:{{ $c['subtle'] }};">{{ $companyName }} · internal</span>
                            @endif
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>

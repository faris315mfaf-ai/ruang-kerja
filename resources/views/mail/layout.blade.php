@php
    /*
     * Branded email shell (mockup EmailRingkasan). Email clients do not support
     * CSS variables, so the light-theme token values from resources/css/tokens.css
     * are inlined here (the only place hex colors are allowed).
     */
    $c = [
        'bg' => '#F1F4F6',
        'surface' => '#FFFFFF',
        'surface2' => '#F6F8F9',
        'border' => '#E2E8EB',
        'text' => '#0F1A1F',
        'muted' => '#5A6A72',
        'subtle' => '#8A979E',
        'primary' => '#0A7C85',
        'brand500' => '#14A3A0',
        'blue' => '#2F7BEA',
        'danger' => '#C42B2B',
        'dangerBg' => '#FCEFEF',
        'dangerBorder' => '#F3C4C4',
        'warning' => '#9A6200',
        'warningBg' => '#FBF1DD',
        'info' => '#1F66D1',
        'infoBg' => '#E8F0FC',
        'success' => '#13804F',
        'successBg' => '#E3F4EB',
    ];
    $brandName = config('branding.name', config('app.name'));
    $companyName = config('branding.company_name');
    $shortName = config('branding.short_name', 'RK');
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>@yield('title', $brandName)</title>
    <style>
        @media (max-width: 600px) {
            .rk-container { width: 100% !important; }
            .rk-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .rk-stat { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
        }
        a { color: {{ $c['primary'] }}; }
    </style>
</head>
<body style="margin:0;padding:0;background:{{ $c['bg'] }};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{{ $c['text'] }};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">@yield('preview')</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $c['bg'] }};">
        <tr>
            <td align="center" style="padding:28px 12px;">
                <table role="presentation" class="rk-container" width="592" cellpadding="0" cellspacing="0" style="width:592px;max-width:592px;">
                    <tr>
                        <td align="center" style="padding:0 0 16px;font-size:12px;line-height:18px;color:{{ $c['muted'] }};">
                            @yield('preheader')
                        </td>
                    </tr>
                    <tr>
                        <td style="background:{{ $c['surface'] }};border:1px solid {{ $c['border'] }};border-radius:12px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td class="rk-pad" style="padding:20px 28px;border-bottom:1px solid {{ $c['border'] }};">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="vertical-align:middle;">
                                                    <span style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:7px;background:{{ $c['brand500'] }};background-image:linear-gradient(135deg,{{ $c['brand500'] }},{{ $c['blue'] }});color:#FFFFFF;font-size:11px;font-weight:600;text-align:center;vertical-align:middle;">{{ $shortName }}</span>
                                                    <span style="font-size:16px;font-weight:600;color:{{ $c['text'] }};vertical-align:middle;margin-left:8px;">{{ $brandName }}</span>
                                                </td>
                                                @if ($companyName)
                                                    <td align="right" style="vertical-align:middle;font-size:12px;color:{{ $c['muted'] }};">{{ $companyName }}</td>
                                                @endif
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="rk-pad" style="padding:28px 28px 32px;">
                                        @yield('content')
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:20px 12px 0;font-size:12px;line-height:20px;color:{{ $c['muted'] }};">
                            @yield('footer')
                            @if ($companyName)
                                <br>{{ $companyName }} · internal
                            @endif
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>

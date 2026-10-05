<?php

namespace App\Domain\Attendance\Services;

use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

/**
 * Renders the kiosk QR as inline SVG (bacon/bacon-qr-code). Error correction
 * H so the brand mark in the middle does not break scanning. Modules use
 * `currentColor` and the background is transparent: colours come from the
 * design tokens of the card around it.
 */
final class QrImageRenderer
{
    public function svg(string $text): string
    {
        $writer = new Writer(new ImageRenderer(
            new RendererStyle(400, 0, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(0, 0, 0))),
            new SvgImageBackEnd,
        ));

        $svg = $writer->writeString($text, 'UTF-8', ErrorCorrectionLevel::H());
        $svg = (string) preg_replace('/^<\?xml[^>]*>\s*/', '', $svg);
        $svg = (string) preg_replace('/<rect x="0" y="0" width="\d+" height="\d+" fill="#ffffff"\/>/', '', $svg);
        $svg = (string) preg_replace('/ width="\d+" height="\d+"/', '', $svg, 1);

        return str_replace('fill="#000000"', 'fill="currentColor"', $svg);
    }
}

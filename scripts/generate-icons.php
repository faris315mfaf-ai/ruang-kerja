<?php

/*
 * Generates the RuangKerja app icons: a rounded square with the brand gradient
 * (#14A3A0 → #2F7BEA, see config/branding.php) and a white "RK".
 *
 * Run from the project root (PHP 8.4 with GD, nothing else):
 *   php scripts/generate-icons.php
 *
 * Writes:
 *   public/favicon.svg                 vector favicon
 *   public/favicon.ico                 16 + 32 + 48 px (32-bit BMP entries)
 *   public/apple-touch-icon.png        180 px, opaque (iOS applies its own mask)
 *   public/icons/icon-192.png          PWA "any", transparent rounded corners
 *   public/icons/icon-512.png          PWA "any", transparent rounded corners
 *   public/icons/icon-maskable-512.png PWA "maskable", opaque, letters in safe zone
 *
 * The "RK" outlines come from Plus Jakarta Sans 700 (the UI font) and are
 * embedded below, so no font has to be installed. To regenerate them:
 *   node scripts/glyphs.mjs node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff RK
 *
 * PNGs are rasterized by a small anti-aliased scanline filler (non-zero
 * winding) and written with GD, so the output is identical on every machine.
 */

if (! extension_loaded('gd')) {
    fwrite(STDERR, "The GD extension is required.\n");
    exit(1);
}

const ICON_GRADIENT_FROM = [0x14, 0xA3, 0xA0];
const ICON_GRADIENT_TO = [0x2F, 0x7B, 0xEA];

/** Corner radius in a 512 × 512 artboard (~22.6%). */
const ICON_RADIUS = 116;

/** Glyph path in font units (baseline y = 0, y down) and its bounding box. */
const ICON_LETTERS = 'M72 0L72 -745L349 -745Q425 -745 483.5 -717.5Q542 -690 575 -637.5Q608 -585 608 -510Q608 -433 571.5 -379Q535 -325 473 -299L644 0L490 0L336 -275L208 -275L208 0L72 0ZM208 -395L351 -395Q388 -395 415 -409.5Q442 -424 457 -450Q472 -476 472 -510Q472 -545 457 -570.5Q442 -596 415 -610.5Q388 -625 351 -625L208 -625L208 -395ZM733 0L733 -745L869 -745L869 -414L1149 -745L1320 -745L1062 -439L1329 0L1169 0L969 -328L869 -209L869 0L733 0Z';
const ICON_LETTERS_BBOX = [72, -745, 1329, 0];

/** Letter scale (font units → artboard units) per use. */
const SCALE_APP = 0.24;
const SCALE_MASKABLE = 0.2; // keeps the letters inside the 80% safe zone
const SCALE_FAVICON = 0.3;  // larger letters stay legible at 16 px

/** Vertical samples per pixel; horizontal coverage is computed exactly. */
const SUBSAMPLES = 8;

$root = dirname(__DIR__);
$public = $root.'/public';

if (! is_dir($public.'/icons')) {
    mkdir($public.'/icons', 0755, true);
}

/**
 * Letters as polygons in artboard units (512 × 512), centered.
 *
 * @return list<list<array{float, float}>>
 */
function letterContours(float $scale): array
{
    [$minX, $minY, $maxX, $maxY] = ICON_LETTERS_BBOX;
    $dx = 256 - ($minX + $maxX) / 2 * $scale;
    $dy = 256 - ($minY + $maxY) / 2 * $scale;

    $contours = [];
    $current = [];
    $pen = [0.0, 0.0];

    preg_match_all('/([MLQZ])([^MLQZ]*)/', ICON_LETTERS, $commands, PREG_SET_ORDER);

    foreach ($commands as [, $command, $args]) {
        $n = array_map('floatval', preg_split('/[\s,]+/', trim($args), -1, PREG_SPLIT_NO_EMPTY) ?: []);
        $map = fn (float $x, float $y): array => [$x * $scale + $dx, $y * $scale + $dy];

        switch ($command) {
            case 'M':
                $pen = $map($n[0], $n[1]);
                $current = [$pen];
                break;
            case 'L':
                $pen = $map($n[0], $n[1]);
                $current[] = $pen;
                break;
            case 'Q':
                [$cx, $cy] = $map($n[0], $n[1]);
                [$x, $y] = $map($n[2], $n[3]);
                for ($i = 1; $i <= 8; $i++) {
                    $t = $i / 8;
                    $u = 1 - $t;
                    $current[] = [
                        $u * $u * $pen[0] + 2 * $u * $t * $cx + $t * $t * $x,
                        $u * $u * $pen[1] + 2 * $u * $t * $cy + $t * $t * $y,
                    ];
                }
                $pen = [$x, $y];
                break;
            case 'Z':
                $contours[] = $current;
                $current = [];
                break;
        }
    }

    return $contours;
}

/**
 * Rounded square covering the whole artboard, as one polygon.
 *
 * @return list<list<array{float, float}>>
 */
function roundedSquare(float $radius): array
{
    $corners = [
        [512 - $radius, $radius, -90],
        [512 - $radius, 512 - $radius, 0],
        [$radius, 512 - $radius, 90],
        [$radius, $radius, 180],
    ];
    $points = [];

    foreach ($corners as [$cx, $cy, $start]) {
        for ($i = 0; $i <= 16; $i++) {
            $angle = deg2rad($start + 90 * $i / 16);
            $points[] = [$cx + $radius * cos($angle), $cy + $radius * sin($angle)];
        }
    }

    return [$points];
}

/**
 * Anti-aliased coverage (0..1) of the polygons on a size × size grid, using
 * the non-zero winding rule.
 *
 * @param  list<list<array{float, float}>>  $contours  in artboard units
 * @return array<int, float> indexed by y * size + x
 */
function coverage(array $contours, int $size): array
{
    $k = $size / 512;
    $edges = [];

    foreach ($contours as $points) {
        $count = count($points);
        for ($i = 0; $i < $count; $i++) {
            [$x0, $y0] = $points[$i];
            [$x1, $y1] = $points[($i + 1) % $count];
            if ($y0 === $y1) {
                continue;
            }
            $edges[] = [$x0 * $k, $y0 * $k, $x1 * $k, $y1 * $k, $y1 > $y0 ? 1 : -1];
        }
    }

    $cover = array_fill(0, $size * $size, 0.0);
    $weight = 1 / SUBSAMPLES;

    for ($row = 0; $row < $size; $row++) {
        for ($s = 0; $s < SUBSAMPLES; $s++) {
            $y = $row + ($s + 0.5) / SUBSAMPLES;
            $hits = [];

            foreach ($edges as [$x0, $y0, $x1, $y1, $dir]) {
                if (($y0 <= $y && $y < $y1) || ($y1 <= $y && $y < $y0)) {
                    $hits[] = [$x0 + ($y - $y0) * ($x1 - $x0) / ($y1 - $y0), $dir];
                }
            }

            usort($hits, fn (array $a, array $b): int => $a[0] <=> $b[0]);

            $winding = 0;
            $spanStart = 0.0;

            foreach ($hits as [$x, $dir]) {
                $was = $winding;
                $winding += $dir;

                if ($was === 0 && $winding !== 0) {
                    $spanStart = $x;
                } elseif ($was !== 0 && $winding === 0) {
                    $a = max(0.0, $spanStart);
                    $b = min((float) $size, $x);
                    for ($px = (int) floor($a); $px < $b; $px++) {
                        $overlap = min($b, $px + 1) - max($a, $px);
                        if ($overlap > 0) {
                            $cover[$row * $size + $px] += $overlap * $weight;
                        }
                    }
                }
            }
        }
    }

    return $cover;
}

/**
 * Renders the mark as straight (non-premultiplied) RGBA, alpha 0..255.
 *
 * @return list<array{int, int, int, int}>
 */
function renderIcon(int $size, float $letterScale, bool $rounded): array
{
    $shape = $rounded ? coverage(roundedSquare(ICON_RADIUS), $size) : null;
    $letters = coverage(letterContours($letterScale), $size);
    $pixels = [];

    for ($y = 0; $y < $size; $y++) {
        for ($x = 0; $x < $size; $x++) {
            $i = $y * $size + $x;

            // SVG linearGradient from (0,0) to (512,512) in artboard units.
            $t = min(1.0, max(0.0, ($x + $y + 1) / (2 * $size)));
            $bg = [];
            for ($c = 0; $c < 3; $c++) {
                $bg[$c] = ICON_GRADIENT_FROM[$c] + (ICON_GRADIENT_TO[$c] - ICON_GRADIENT_FROM[$c]) * $t;
            }

            $bgAlpha = $shape === null ? 1.0 : min(1.0, $shape[$i]);
            $fg = min(1.0, $letters[$i]) * ($shape === null ? 1.0 : $bgAlpha);
            $alpha = $fg + $bgAlpha * (1 - $fg);

            if ($alpha <= 0) {
                $pixels[] = [0, 0, 0, 0];

                continue;
            }

            $rgb = [];
            for ($c = 0; $c < 3; $c++) {
                $rgb[$c] = (int) round((255 * $fg + $bg[$c] * $bgAlpha * (1 - $fg)) / $alpha);
            }

            $pixels[] = [$rgb[0], $rgb[1], $rgb[2], (int) round($alpha * 255)];
        }
    }

    return $pixels;
}

/**
 * @param  list<array{int, int, int, int}>  $pixels
 */
function writePng(array $pixels, int $size, bool $withAlpha, string $path): void
{
    $image = imagecreatetruecolor($size, $size);
    imagealphablending($image, false);
    imagesavealpha($image, $withAlpha);

    foreach ($pixels as $i => [$r, $g, $b, $a]) {
        $gdAlpha = $withAlpha ? 127 - (int) round($a * 127 / 255) : 0;
        imagesetpixel($image, $i % $size, intdiv($i, $size), imagecolorallocatealpha($image, $r, $g, $b, $gdAlpha));
    }

    imagepng($image, $path, 9);
}

/**
 * Writes a multi-size .ico with 32-bit BMP entries (alpha + AND mask).
 *
 * @param  array<int, list<array{int, int, int, int}>>  $images  size => pixels
 */
function writeIco(array $images, string $path): void
{
    $directory = pack('vvv', 0, 1, count($images));
    $offset = 6 + 16 * count($images);
    $data = '';

    foreach ($images as $size => $pixels) {
        $xor = '';
        $maskRowBytes = (int) ceil($size / 32) * 4;
        $mask = '';

        for ($y = $size - 1; $y >= 0; $y--) {
            $maskRow = array_fill(0, $maskRowBytes, 0);
            for ($x = 0; $x < $size; $x++) {
                [$r, $g, $b, $a] = $pixels[$y * $size + $x];
                $xor .= pack('CCCC', $b, $g, $r, $a);
                if ($a === 0) {
                    $maskRow[$x >> 3] |= 0x80 >> ($x & 7);
                }
            }
            $mask .= pack('C*', ...$maskRow);
        }

        $bitmap = pack('VVVvvVVVVVV', 40, $size, $size * 2, 1, 32, 0, strlen($xor) + strlen($mask), 0, 0, 0, 0).$xor.$mask;
        $directory .= pack('CCCCvvVV', $size % 256, $size % 256, 0, 0, 1, 32, strlen($bitmap), $offset);
        $offset += strlen($bitmap);
        $data .= $bitmap;
    }

    file_put_contents($path, $directory.$data);
}

function faviconSvg(): string
{
    [$minX, $minY, $maxX, $maxY] = ICON_LETTERS_BBOX;
    $hex = fn (array $rgb): string => sprintf('#%02X%02X%02X', ...$rgb);
    $tx = -($minX + $maxX) / 2;
    $ty = -($minY + $maxY) / 2;

    return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
        .'<defs><linearGradient id="rk-g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">'
        .'<stop offset="0" stop-color="'.$hex(ICON_GRADIENT_FROM).'"/>'
        .'<stop offset="1" stop-color="'.$hex(ICON_GRADIENT_TO).'"/>'
        .'</linearGradient></defs>'
        .'<rect width="512" height="512" rx="'.ICON_RADIUS.'" fill="url(#rk-g)"/>'
        .'<path fill="#FFFFFF" transform="translate(256 256) scale('.SCALE_FAVICON.') translate('.$tx.' '.$ty.')" d="'.ICON_LETTERS.'"/>'
        .'</svg>'."\n";
}

file_put_contents($public.'/favicon.svg', faviconSvg());

writeIco([
    16 => renderIcon(16, SCALE_FAVICON, true),
    32 => renderIcon(32, SCALE_FAVICON, true),
    48 => renderIcon(48, SCALE_FAVICON, true),
], $public.'/favicon.ico');

writePng(renderIcon(180, SCALE_APP, false), 180, false, $public.'/apple-touch-icon.png');
writePng(renderIcon(192, SCALE_APP, true), 192, true, $public.'/icons/icon-192.png');
writePng(renderIcon(512, SCALE_APP, true), 512, true, $public.'/icons/icon-512.png');
writePng(renderIcon(512, SCALE_MASKABLE, false), 512, false, $public.'/icons/icon-maskable-512.png');

echo "Icons written to public/.\n";

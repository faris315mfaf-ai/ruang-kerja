<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Models\AttendanceLog;
use Carbon\CarbonImmutable;
use GdImage;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Composes the stamped selfie sent to the management WhatsApp group
 * (owner decision 13 Oct 2026): the employee's selfie with, over a dark
 * gradient at the bottom, the big clock time, weekday + date, the place name
 * and a small OpenStreetMap thumbnail with a pin.
 *
 * Everything happens in memory — the stamped image is never written to disk,
 * the stored selfie stays untouched. Network helpers (map tiles, Nominatim)
 * degrade quietly: no map / text-only place, the photo is still produced.
 * `render()` returns null only when there is no usable selfie at all, so the
 * caller falls back to a plain text message.
 */
final class StampedSelfie
{
    private const string FONT = 'fonts/DejaVuSans-Bold.ttf';

    private const int TILE = 256;

    public function __construct(private readonly SelfieStorage $selfies) {}

    /**
     * @param  string  $fallbackPlace  descriptive location text used when the place name cannot be resolved
     * @return string|null JPEG bytes, or null when the log has no readable selfie
     */
    public function render(AttendanceLog $log, string $fallbackPlace): ?string
    {
        if ($log->selfie_path === null || ! is_file($this->fontPath())) {
            return null;
        }

        try {
            $bytes = $this->selfies->disk()->get($log->selfie_path);

            if (! is_string($bytes) || $bytes === '') {
                return null;
            }

            $photo = $this->loadPhoto($bytes);

            if ($photo === null) {
                return null;
            }

            $map = null;

            if ($log->hasCoordinates() && (bool) config('attendance.stamp.map')) {
                $map = $this->mapThumbnail((float) $log->latitude, (float) $log->longitude);
            }

            $place = $this->placeName($log, $fallbackPlace);
            $at = (new CarbonImmutable($log->occurred_at))->setTimezone((string) config('app.office_timezone'));

            $this->stamp($photo, $at, $place, $map);

            return $this->encode($photo);
        } catch (Throwable $e) {
            Log::warning('whatsapp.stamp failed', ['log' => $log->id, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Office geofence name, "WFH", or a reverse-geocoded neighbourhood;
     * the fallback text when nothing better is known.
     */
    public function placeName(AttendanceLog $log, string $fallback): string
    {
        if ($log->officeLocation !== null) {
            return $log->officeLocation->name;
        }

        if ($log->method === AttendanceMethod::Wfh) {
            return 'WFH';
        }

        if ($log->hasCoordinates() && (bool) config('attendance.stamp.map')) {
            $name = $this->reverseGeocode((float) $log->latitude, (float) $log->longitude);

            if ($name !== null) {
                return $name;
            }
        }

        return $fallback;
    }

    private function fontPath(): string
    {
        return resource_path(self::FONT);
    }

    // ── photo ──────────────────────────────────────────────────────────────

    private function loadPhoto(string $bytes): ?GdImage
    {
        $source = @imagecreatefromstring($bytes);

        if ($source === false) {
            return null;
        }

        $source = $this->applyExifOrientation($source, $bytes);

        $width = imagesx($source);
        $height = imagesy($source);
        $maxWidth = max(320, (int) config('attendance.stamp.max_width'));
        $targetWidth = min($width, $maxWidth);
        $targetHeight = (int) round($height * $targetWidth / $width);

        $targetHeight = max(1, $targetHeight);
        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        imagecopyresampled($canvas, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        return $canvas;
    }

    private function applyExifOrientation(GdImage $image, string $bytes): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data('data://image/jpeg;base64,'.base64_encode($bytes));
        $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;

        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        return $rotated === false ? $image : $rotated;
    }

    private function encode(GdImage $image): string
    {
        ob_start();
        imagejpeg($image, null, (int) config('attendance.stamp.jpeg_quality'));

        return (string) ob_get_clean();
    }

    // ── stamp ──────────────────────────────────────────────────────────────

    private function stamp(GdImage $image, CarbonImmutable $at, string $place, ?GdImage $map): void
    {
        imagealphablending($image, true);

        $width = imagesx($image);
        $height = imagesy($image);
        $u = $width / 100;
        $margin = 3 * $u;
        $mapSide = $map === null ? 0 : (int) round(min(24 * $u, 0.3 * $height));
        $block = max($mapSide, 17 * $u);
        $bandHeight = (int) round(min($block + 2 * $margin + 4 * $u, 0.55 * $height));

        $this->gradientBand($image, $bandHeight);

        $bottom = $height - $margin;
        $leftMax = $width - 2 * $margin - ($mapSide > 0 ? $mapSide + $margin : 0);

        // Big time: left, baseline a little above the place line.
        $time = $at->format('H:i');
        $timeSize = $this->fit($time, 13 * $u, $leftMax * 0.62);
        $timeBox = $this->textBox($timeSize, $time);
        $timeBaseline = (int) round($bottom - 4.6 * $u - 2.6 * $u);
        $this->text($image, $timeSize, (int) round($margin), $timeBaseline, $time, 0xFFFFFF);

        // Weekday + date: right of the time, split by a thin accent line.
        $locale = $at->settings(['locale' => 'id']);
        $weekday = $locale->translatedFormat('l');
        $date = $locale->translatedFormat('d F Y');
        $metaSize = 3.4 * $u;
        $lineX = (int) round($margin + $timeBox['width'] + 1.6 * $u);
        $metaX = (int) round($lineX + 1.8 * $u);
        $metaMax = $leftMax - ($metaX - $margin);
        $metaSize = $this->fit($date, $metaSize, $metaMax);
        imagefilledrectangle(
            $image,
            $lineX,
            (int) round($timeBaseline - $timeBox['height']),
            $lineX + max(2, (int) round(0.45 * $u)),
            $timeBaseline,
            $this->color($image, 0x2DBFB1),
        );
        $this->text($image, $metaSize, $metaX, (int) round($timeBaseline - $timeBox['height'] * 0.5 - 0.6 * $u), $weekday, 0xFFFFFF);
        $this->text($image, $metaSize, $metaX, $timeBaseline, $date, 0xFFFFFF);

        // Place name: small line under the time.
        $placeSize = $this->fit($place, 3.1 * $u, $leftMax, ellipsize: true);
        $this->text($image, $placeSize, (int) round($margin), (int) round($bottom - 0.4 * $u), $this->ellipsize($place, $placeSize, $leftMax), 0xE6EEF6);

        if ($map !== null && $mapSide > 0) {
            $this->placeMap($image, $map, $mapSide, (int) round($width - $margin - $mapSide), (int) round($height - $margin - $mapSide), $u);
        }
    }

    private function gradientBand(GdImage $image, int $bandHeight): void
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $top = $height - $bandHeight;

        for ($y = 0; $y < $bandHeight; $y++) {
            $t = $y / max(1, $bandHeight - 1);
            // GD alpha: 127 = transparent, 0 = opaque; up to ~72% black.
            $alpha = max(0, min(127, (int) round(127 - 91 * ($t ** 1.35))));
            $color = imagecolorallocatealpha($image, 4, 10, 18, $alpha);
            imageline($image, 0, $top + $y, $width, $top + $y, $color === false ? 0 : $color);
        }
    }

    /**
     * @param  int<0, 127>  $alpha  GD alpha (0 opaque … 127 transparent)
     */
    private function color(GdImage $image, int $rgb, int $alpha = 0): int
    {
        $color = imagecolorallocatealpha($image, ($rgb >> 16) & 255, ($rgb >> 8) & 255, $rgb & 255, $alpha);

        return $color === false ? 0 : $color;
    }

    /**
     * @return array{width: int, height: int}
     */
    private function textBox(float $size, string $text): array
    {
        $box = imagettfbbox($size, 0, $this->fontPath(), $text);

        if ($box === false) {
            return ['width' => 0, 'height' => 0];
        }

        return [
            'width' => (int) (max($box[2], $box[4]) - min($box[0], $box[6])),
            'height' => (int) (max($box[1], $box[3]) - min($box[5], $box[7])),
        ];
    }

    /** Shrinks the size until the text fits `$maxWidth` (ellipsis handled by the caller). */
    private function fit(string $text, float $size, float $maxWidth, bool $ellipsize = false): float
    {
        $minimum = $ellipsize ? $size * 0.85 : $size * 0.4;

        while ($size > $minimum && $this->textBox($size, $text)['width'] > $maxWidth) {
            $size *= 0.94;
        }

        return $size;
    }

    private function ellipsize(string $text, float $size, float $maxWidth): string
    {
        if ($this->textBox($size, $text)['width'] <= $maxWidth) {
            return $text;
        }

        $text = trim($text);

        while (mb_strlen($text) > 1 && $this->textBox($size, $text.'…')['width'] > $maxWidth) {
            $text = mb_substr($text, 0, -1);
        }

        return rtrim($text).'…';
    }

    /** White text with a soft shadow so it stays readable on bright photos. */
    private function text(GdImage $image, float $size, int $x, int $baseline, string $text, int $rgb): void
    {
        $shadow = $this->color($image, 0x000000, 80);
        $offset = max(1, (int) round($size / 22));

        imagettftext($image, $size, 0, $x + $offset, $baseline + $offset, $shadow, $this->fontPath(), $text);
        imagettftext($image, $size, 0, $x, $baseline, $this->color($image, $rgb), $this->fontPath(), $text);
    }

    // ── map ────────────────────────────────────────────────────────────────

    private function placeMap(GdImage $image, GdImage $map, int $side, int $x, int $y, float $u): void
    {
        $border = max(2, (int) round(0.5 * $u));
        imagefilledrectangle($image, $x - $border, $y - $border, $x + $side + $border - 1, $y + $side + $border - 1, $this->color($image, 0xFFFFFF));
        imagecopyresampled($image, $map, $x, $y, 0, 0, $side, $side, imagesx($map), imagesy($map));

        // Pin: red disc with a white ring at the centre.
        $cx = $x + intdiv($side, 2);
        $cy = $y + intdiv($side, 2);
        $radius = max(5, (int) round($side * 0.055));
        imagefilledellipse($image, $cx, $cy, ($radius + 3) * 2, ($radius + 3) * 2, $this->color($image, 0xFFFFFF));
        imagefilledellipse($image, $cx, $cy, $radius * 2, $radius * 2, $this->color($image, 0xE5322D));
        imagefilledellipse($image, $cx, $cy, (int) round($radius * 0.7), (int) round($radius * 0.7), $this->color($image, 0xFFFFFF));

        // Attribution required by the OpenStreetMap tile policy.
        $label = '© OpenStreetMap';
        $size = max(6.0, $side * 0.052);
        $box = $this->textBox($size, $label);
        $pad = max(2, (int) round($size * 0.3));
        $lx = $x + $side - $box['width'] - $pad * 2;
        $ly = $y + $side - $box['height'] - $pad * 2;
        imagefilledrectangle($image, $lx, $ly, $x + $side - 1, $y + $side - 1, $this->color($image, 0xFFFFFF, 40));
        imagettftext($image, $size, 0, $lx + $pad, $y + $side - $pad, $this->color($image, 0x222222), $this->fontPath(), $label);
    }

    /**
     * Square map crop (256 px) centred on the point, composed from at most
     * 2×2 OSM tiles. All or nothing: any missing tile skips the map.
     */
    private function mapThumbnail(float $lat, float $lng): ?GdImage
    {
        try {
            $zoom = (int) config('attendance.stamp.zoom');
            $n = 2 ** $zoom;
            $latRad = deg2rad(max(-85.0511, min(85.0511, $lat)));
            $px = (($lng + 180.0) / 360.0) * $n * self::TILE;
            $py = ((1.0 - log(tan($latRad) + 1.0 / cos($latRad)) / M_PI) / 2.0) * $n * self::TILE;

            $half = self::TILE / 2;
            $left = $px - $half;
            $topEdge = $py - $half;
            $tx0 = (int) floor($left / self::TILE);
            $tx1 = (int) floor(($left + self::TILE - 1) / self::TILE);
            $ty0 = (int) floor($topEdge / self::TILE);
            $ty1 = (int) floor(($topEdge + self::TILE - 1) / self::TILE);

            $wanted = [];

            for ($tx = $tx0; $tx <= $tx1; $tx++) {
                for ($ty = $ty0; $ty <= $ty1; $ty++) {
                    $wanted[] = [(($tx % $n) + $n) % $n, (int) max(0, min($n - 1, $ty)), $tx, $ty];
                }
            }

            $tiles = $this->fetchTiles($zoom, $wanted);

            if ($tiles === null) {
                return null;
            }

            $mosaic = imagecreatetruecolor(max(1, self::TILE * ($tx1 - $tx0 + 1)), max(1, self::TILE * ($ty1 - $ty0 + 1)));

            foreach ($wanted as [$wx, $wy, $tx, $ty]) {
                $tile = @imagecreatefromstring($tiles["$wx/$wy"]);

                if ($tile === false) {
                    return null;
                }

                imagecopy($mosaic, $tile, ($tx - $tx0) * self::TILE, ($ty - $ty0) * self::TILE, 0, 0, self::TILE, self::TILE);
            }

            $crop = imagecreatetruecolor(self::TILE, self::TILE);
            imagecopy($crop, $mosaic, 0, 0, (int) round($left - $tx0 * self::TILE), (int) round($topEdge - $ty0 * self::TILE), self::TILE, self::TILE);

            return $crop;
        } catch (Throwable $e) {
            Log::info('whatsapp.stamp map skipped', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @param  list<array{int, int, int, int}>  $wanted
     * @return array<string, string>|null raw PNG bytes keyed "x/y"
     */
    private function fetchTiles(int $zoom, array $wanted): ?array
    {
        $ttl = now()->addHours((int) config('attendance.stamp.cache_hours'));
        $tiles = [];
        $missing = [];

        foreach ($wanted as [$x, $y]) {
            $cached = Cache::get("osm-tile:$zoom/$x/$y");

            if (is_string($cached) && ($raw = base64_decode($cached, true)) !== false && $raw !== '') {
                $tiles["$x/$y"] = $raw;
            } else {
                $missing["$x/$y"] = [$x, $y];
            }
        }

        if ($missing !== []) {
            $template = (string) config('services.osm.tile_url');
            $agent = (string) config('services.osm.user_agent');

            $responses = Http::pool(function (Pool $pool) use ($missing, $template, $agent, $zoom) {
                foreach ($missing as $key => [$x, $y]) {
                    $pool->as($key)->withUserAgent($agent)->timeout(4)->get(strtr($template, ['{z}' => $zoom, '{x}' => $x, '{y}' => $y]));
                }
            });

            foreach ($missing as $key => [$x, $y]) {
                $response = $responses[$key] ?? null;

                if (! $response instanceof Response || ! $response->successful() || $response->body() === '') {
                    return null;
                }

                $tiles[$key] = $response->body();
                Cache::put("osm-tile:$zoom/$x/$y", base64_encode($response->body()), $ttl);
            }
        }

        return $tiles;
    }

    // ── reverse geocoding ──────────────────────────────────────────────────

    private function reverseGeocode(float $lat, float $lng): ?string
    {
        $key = sprintf('osm-place:%.3f,%.3f', $lat, $lng);
        $cached = Cache::get($key);

        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        try {
            $this->throttleNominatim();

            $response = Http::withUserAgent((string) config('services.osm.user_agent'))
                ->timeout(4)
                ->acceptJson()
                ->get((string) config('services.osm.nominatim_url'), [
                    'format' => 'jsonv2',
                    'lat' => $lat,
                    'lon' => $lng,
                    'zoom' => 16,
                    'accept-language' => 'id',
                ]);

            if (! $response->successful()) {
                return null;
            }

            $address = $response->json('address');

            if (! is_array($address)) {
                return null;
            }

            foreach (['suburb', 'neighbourhood', 'city_district', 'village', 'town', 'city'] as $part) {
                $value = $address[$part] ?? null;

                if (is_string($value) && trim($value) !== '') {
                    $name = Str::limit(trim($value), 40, '');
                    Cache::put($key, $name, now()->addHours((int) config('attendance.stamp.cache_hours')));

                    return $name;
                }
            }
        } catch (Throwable $e) {
            Log::info('whatsapp.stamp geocode skipped', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /** Nominatim policy: at most one request per second. */
    private function throttleNominatim(): void
    {
        $interval = (int) config('attendance.stamp.nominatim_interval_s');

        if ($interval <= 0) {
            return;
        }

        try {
            Cache::lock('osm-nominatim-throttle', $interval)->block($interval + 2);
            // Deliberately never released: the lock expiring is the pause.
        } catch (Throwable) {
            // No lock support or contention timeout: go ahead, geocoding is best-effort.
        }
    }
}

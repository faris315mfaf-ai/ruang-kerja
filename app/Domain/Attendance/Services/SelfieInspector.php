<?php

namespace App\Domain\Attendance\Services;

use Illuminate\Http\UploadedFile;

/**
 * Cheap image check for "selfie kosong/gelap" (docs/PRD.md M2): mean luminance
 * and contrast of a 32×32 thumbnail. Needs ext-gd; without it nothing is flagged.
 */
final class SelfieInspector
{
    private const int SAMPLE_SIZE = 32;

    /**
     * Below this luminance standard deviation the picture is a flat colour.
     */
    private const float MIN_CONTRAST = 6.0;

    public function isDarkOrBlank(UploadedFile $file): bool
    {
        $stats = $this->luminance($file);

        if ($stats === null) {
            return false;
        }

        [$mean, $deviation] = $stats;

        return $mean < config()->integer('attendance.selfie.dark_threshold') || $deviation < self::MIN_CONTRAST;
    }

    /**
     * @return array{0: float, 1: float}|null [mean, standard deviation] on a 0–255 scale
     */
    public function luminance(UploadedFile $file): ?array
    {
        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $contents = @file_get_contents($file->getRealPath());

        if ($contents === false || $contents === '') {
            return null;
        }

        $image = @imagecreatefromstring($contents);

        if ($image === false) {
            return null;
        }

        $sample = imagescale($image, self::SAMPLE_SIZE, self::SAMPLE_SIZE);

        if ($sample === false) {
            return null;
        }

        $values = [];

        for ($x = 0; $x < self::SAMPLE_SIZE; $x++) {
            for ($y = 0; $y < self::SAMPLE_SIZE; $y++) {
                $rgb = imagecolorat($sample, $x, $y);

                if ($rgb === false) {
                    continue;
                }

                $values[] = 0.299 * (($rgb >> 16) & 0xFF) + 0.587 * (($rgb >> 8) & 0xFF) + 0.114 * ($rgb & 0xFF);
            }
        }

        if ($values === []) {
            return null;
        }

        $mean = array_sum($values) / count($values);
        $variance = array_sum(array_map(fn (float $value): float => ($value - $mean) ** 2, $values)) / count($values);

        return [$mean, sqrt($variance)];
    }
}

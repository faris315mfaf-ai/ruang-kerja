<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

/**
 * "Laporan kerja" of a check-out (keputusan pemilik 13 Okt 2026): the points
 * the employee did today, same shape as the morning "rencana kerja" (max 8
 * points of 300 characters). Blank points are dropped *before* validation so
 * "at least one point" cannot be satisfied by an empty line.
 *
 * @mixin FormRequest
 */
trait HasWorkReport
{
    protected function prepareForValidation(): void
    {
        $report = $this->input('work_report');

        if (is_array($report)) {
            $this->merge(['work_report' => array_values(array_filter(
                array_map(fn (mixed $point): mixed => is_string($point) ? trim($point) : $point, $report),
                fn (mixed $point): bool => $point !== null && $point !== '',
            ))]);
        }
    }

    /**
     * @return array<string, array<mixed>>
     */
    protected function workReportRules(): array
    {
        return [
            'work_report' => ['required', 'array', 'min:1', 'max:8'],
            'work_report.*' => ['string', 'max:300'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function workReportMessages(): array
    {
        return [
            'work_report.required' => 'Laporan kerja wajib diisi sebelum absen pulang.',
            'work_report.min' => 'Laporan kerja wajib diisi sebelum absen pulang.',
            'work_report.array' => 'Laporan kerja tidak valid.',
            'work_report.max' => 'Maksimal 8 poin laporan kerja.',
            'work_report.*.string' => 'Tiap poin laporan kerja harus berupa teks.',
            'work_report.*.max' => 'Tiap poin maksimal 300 karakter.',
        ];
    }

    /**
     * @return list<string>|null
     */
    protected function workReportPoints(): ?array
    {
        $points = array_values($this->collect('work_report')
            ->map(fn (mixed $point): string => Str::limit(trim((string) $point), 300, ''))
            ->filter(fn (string $point): bool => $point !== '')
            ->all());

        return $points === [] ? null : $points;
    }
}

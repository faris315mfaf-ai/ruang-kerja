<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Concerns\HasWorkReport;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Multipart check-out of the mobile app (POST /api/v1/absensi/check-out):
 * the check-in payload minus the work plan — the plan belongs to the start of
 * the day (keputusan pemilik 9 Okt 2026) — plus the required "laporan kerja"
 * written at the end of the day (keputusan pemilik 13 Okt 2026).
 */
class AttendanceCheckOutRequest extends AttendanceCheckInRequest
{
    use HasWorkReport;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [...parent::rules(), ...$this->workReportRules()];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [...parent::messages(), ...$this->workReportMessages()];
    }

    protected function acceptsWorkPlan(): bool
    {
        return false;
    }

    /**
     * @return list<string>|null
     */
    protected function workReport(): ?array
    {
        return $this->workReportPoints();
    }
}

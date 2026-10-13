<?php

namespace App\Http\Requests\Attendance;

use App\Http\Requests\Concerns\HasWorkReport;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Multipart GPS + selfie check-out: the check-in payload minus the work plan,
 * plus the required "laporan kerja" (keputusan pemilik 13 Okt 2026). QR
 * check-out has no form and stays on QrCheckInRequest.
 */
class CheckOutRequest extends CheckInRequest
{
    use HasWorkReport;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['work_plan'], $rules['work_plan.*']);

        return [...$rules, ...$this->workReportRules()];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $messages = parent::messages();
        unset($messages['work_plan.max'], $messages['work_plan.*.max']);

        return [...$messages, ...$this->workReportMessages()];
    }

    protected function workPlan(): ?array
    {
        return null;
    }

    /**
     * @return list<string>|null
     */
    protected function workReport(): ?array
    {
        return $this->workReportPoints();
    }
}

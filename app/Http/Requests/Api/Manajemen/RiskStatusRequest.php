<?php

namespace App\Http\Requests\Api\Manajemen;

use App\Domain\Projects\Enums\RiskStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PATCH /api/v1/proyek/{key}/risiko/{id}/status — "Tandai teratasi" /
 * "Buka lagi" without resending the whole risk form.
 */
class RiskStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['status' => ['required', Rule::enum(RiskStatus::class)]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['status.*' => 'Status risiko tidak valid.'];
    }

    public function status(): RiskStatus
    {
        return RiskStatus::from($this->string('status')->toString());
    }
}

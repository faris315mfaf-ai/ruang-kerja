<?php

namespace App\Http\Requests\Api\Manajemen;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * PATCH /api/v1/proyek/{key}/milestone/{id}/selesai — `completed` true marks
 * the milestone done, false reopens it (authorization in the controller).
 */
class MilestoneCompletionRequest extends FormRequest
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
        return ['completed' => ['required', 'boolean']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['completed.*' => 'Pilih tandai selesai atau buka kembali.'];
    }
}

<?php

namespace App\Http\Requests\Requests;

use App\Domain\Requests\Actions\CancelApprovedRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * HR cancels an approved request: the reason is required (also enforced by the action).
 */
class CancelApprovedRequestRequest extends FormRequest
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
        return [
            'reason' => ['required', 'string', 'min:'.CancelApprovedRequest::REASON_MIN, 'max:'.CancelApprovedRequest::reasonMax()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Alasan pembatalan wajib diisi.',
            'reason.min' => 'Tulis alasan pembatalan minimal :min karakter.',
            'reason.max' => 'Alasan pembatalan maksimal :max karakter.',
        ];
    }

    public function reason(): string
    {
        return trim((string) $this->string('reason'));
    }
}

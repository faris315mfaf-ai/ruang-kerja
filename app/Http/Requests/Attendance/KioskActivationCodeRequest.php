<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Pairing code typed on the unpaired kiosk screen (/kiosk). Public: the
 * device has no account yet; attempts are limited per IP in the controller.
 */
class KioskActivationCodeRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.required' => 'Masukkan kode aktivasi.',
            'code.max' => 'Kode aktivasi tidak berlaku.',
        ];
    }

    public function code(): string
    {
        return $this->string('code')->toString();
    }
}

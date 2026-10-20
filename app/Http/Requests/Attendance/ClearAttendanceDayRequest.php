<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Absensi › Pegawai: remove a day without check-in logs. Authorization:
 * AttendanceDayPolicy::clear in the controller.
 */
class ClearAttendanceDayRequest extends FormRequest
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
        return ['reason' => ['required', 'string', 'min:5', 'max:500']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Alasan wajib diisi.',
            'reason.min' => 'Tulis alasan minimal 5 karakter.',
        ];
    }

    public function reason(): string
    {
        return trim($this->string('reason')->toString());
    }
}

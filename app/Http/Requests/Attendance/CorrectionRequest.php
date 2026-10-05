<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Data\CorrectionData;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * HR manual correction. Authorization: AttendanceDayPolicy::correct in the
 * controller (needs the employee).
 */
class CorrectionRequest extends FormRequest
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
            'user_id' => ['required', 'string', 'exists:users,id'],
            'work_date' => ['required', 'date_format:Y-m-d'],
            'check_in' => ['nullable', 'date_format:H:i', 'required_without:check_out'],
            'check_out' => ['nullable', 'date_format:H:i'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'check_in.required_without' => 'Isi jam masuk, jam pulang, atau keduanya.',
            'check_in.date_format' => 'Format jam masuk JJ:MM, mis. 08:05.',
            'check_out.date_format' => 'Format jam pulang JJ:MM, mis. 17:00.',
            'reason.required' => 'Alasan koreksi wajib diisi.',
            'reason.min' => 'Tulis alasan koreksi minimal 5 karakter.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['work_date' => 'tanggal', 'reason' => 'alasan', 'user_id' => 'karyawan'];
    }

    public function toData(): CorrectionData
    {
        return new CorrectionData(
            workDate: $this->string('work_date')->toString(),
            checkIn: $this->filled('check_in') ? $this->string('check_in')->toString() : null,
            checkOut: $this->filled('check_out') ? $this->string('check_out')->toString() : null,
            reason: trim($this->string('reason')->toString()),
        );
    }
}

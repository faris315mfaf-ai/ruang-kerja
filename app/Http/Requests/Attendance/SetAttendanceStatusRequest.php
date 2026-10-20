<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Actions\SetAttendanceStatus;
use App\Domain\Attendance\Enums\AttendanceStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Absensi › Pegawai: set a day's status by hand. Authorization:
 * AttendanceDayPolicy::setStatus in the controller (needs the employee).
 */
class SetAttendanceStatusRequest extends FormRequest
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
            'status' => ['required', 'string', Rule::in(array_map(fn (AttendanceStatus $status): string => $status->value, SetAttendanceStatus::ALLOWED))],
            'check_in' => ['nullable', 'date_format:H:i'],
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
            'status.required' => 'Pilih status absensi.',
            'status.in' => 'Status ini tidak bisa diatur manual.',
            'check_in.date_format' => 'Format jam masuk JJ:MM, mis. 08:05.',
            'check_out.date_format' => 'Format jam pulang JJ:MM, mis. 17:00.',
            'reason.required' => 'Alasan wajib diisi.',
            'reason.min' => 'Tulis alasan minimal 5 karakter.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['reason' => 'alasan', 'status' => 'status'];
    }

    public function status(): AttendanceStatus
    {
        return AttendanceStatus::from($this->string('status')->toString());
    }

    public function time(string $field): ?string
    {
        return $this->filled($field) ? $this->string($field)->toString() : null;
    }

    public function reason(): string
    {
        return trim($this->string('reason')->toString());
    }
}

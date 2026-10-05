<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Models\OfficeLocation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Authorization: ShiftPolicy in the controller.
 */
class ShiftRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'different:start_time'],
            'break_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'late_tolerance_min' => ['required', 'integer', 'min:0', 'max:240'],
            'early_leave_tolerance_min' => ['required', 'integer', 'min:0', 'max:240'],
            'check_in_window_before_min' => ['required', 'integer', 'min:0', 'max:480'],
            'office_location_id' => [
                'nullable',
                'string',
                Rule::exists(OfficeLocation::class, 'id')
                    ->where('company_id', $this->user()?->company_id)
                    ->whereNull('deleted_at'),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama shift',
            'start_time' => 'jam masuk',
            'end_time' => 'jam pulang',
            'break_minutes' => 'istirahat',
            'late_tolerance_min' => 'toleransi terlambat',
            'early_leave_tolerance_min' => 'toleransi pulang cepat',
            'check_in_window_before_min' => 'jendela check-in',
            'office_location_id' => 'lokasi',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'end_time.different' => 'Jam pulang harus berbeda dari jam masuk.',
        ];
    }

    /**
     * @return array{name: string, start_time: string, end_time: string, break_minutes: int, late_tolerance_min: int, early_leave_tolerance_min: int, check_in_window_before_min: int, office_location_id: string|null}
     */
    public function attributesForAction(): array
    {
        return [
            'name' => $this->string('name')->toString(),
            'start_time' => $this->string('start_time')->toString(),
            'end_time' => $this->string('end_time')->toString(),
            'break_minutes' => $this->integer('break_minutes'),
            'late_tolerance_min' => $this->integer('late_tolerance_min'),
            'early_leave_tolerance_min' => $this->integer('early_leave_tolerance_min'),
            'check_in_window_before_min' => $this->integer('check_in_window_before_min'),
            'office_location_id' => $this->filled('office_location_id') ? $this->string('office_location_id')->toString() : null,
        ];
    }
}

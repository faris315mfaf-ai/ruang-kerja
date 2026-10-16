<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Data\AttendanceWindows;
use App\Domain\Attendance\Models\OfficeLocation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Admin › Jam absen: four optional 24h times (office timezone). Empty = no
 * limit. Authorization: attendance.manage (same gate as the settings page).
 */
class AttendanceWindowsRequest extends FormRequest
{
    private const array FIELDS = ['check_in_from', 'check_in_until', 'check_out_from', 'check_out_until'];

    public function authorize(): bool
    {
        return $this->user()?->can('manage', OfficeLocation::class) === true;
    }

    protected function prepareForValidation(): void
    {
        $clean = [];

        foreach (self::FIELDS as $field) {
            $value = $this->input($field);
            // <input type="time" step> may send HH:MM:SS.
            $clean[$field] = is_string($value) && preg_match('/^\d{2}:\d{2}:\d{2}$/', trim($value)) === 1 ? substr(trim($value), 0, 5) : $value;
        }

        $this->merge($clean);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return array_fill_keys(self::FIELDS, ['nullable', 'date_format:H:i']);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'check_in_from' => 'absen masuk dari jam',
            'check_in_until' => 'absen masuk sampai jam',
            'check_out_from' => 'absen pulang dari jam',
            'check_out_until' => 'absen pulang sampai jam',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*.date_format' => 'Isi jam dengan format 24 jam, mis. 06.00 atau 17.30.',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach (['check_in' => 'Absen masuk', 'check_out' => 'Absen pulang'] as $key => $label) {
                    $from = $this->input("{$key}_from");
                    $until = $this->input("{$key}_until");

                    if (is_string($from) && is_string($until) && $until <= $from && ! $validator->errors()->hasAny(["{$key}_from", "{$key}_until"])) {
                        $validator->errors()->add("{$key}_until", "{$label}: jam akhir harus setelah jam awal.");
                    }
                }
            },
        ];
    }

    public function windows(): AttendanceWindows
    {
        $time = fn (string $field): ?string => $this->filled($field) ? $this->string($field)->toString() : null;

        return new AttendanceWindows($time('check_in_from'), $time('check_in_until'), $time('check_out_from'), $time('check_out_until'));
    }
}

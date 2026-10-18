<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Tenancy\Support\CurrentCompany;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Authorization: HolidayPolicy in the controller.
 */
class HolidayRequest extends FormRequest
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
        $holiday = $this->route('holiday');

        return [
            'date' => [
                'required',
                'date_format:Y-m-d',
                Rule::unique(Holiday::class, 'date')
                    ->where('company_id', $this->user()?->company_id)
                    ->ignore($holiday instanceof Holiday ? $holiday->id : null),
            ],
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::enum(HolidayType::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['date' => 'tanggal', 'name' => 'nama', 'type' => 'jenis'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['date.unique' => 'Tanggal ini sudah terdaftar sebagai hari libur.'];
    }

    public function holidayDate(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('date')->toString(), CurrentCompany::timezone());
    }

    public function type(): HolidayType
    {
        return HolidayType::from($this->string('type')->toString());
    }
}

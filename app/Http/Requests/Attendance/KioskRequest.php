<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Models\Kiosk;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Authorization: KioskPolicy in the controller.
 */
class KioskRequest extends FormRequest
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
        $user = $this->user();
        $companyId = $user instanceof User ? $user->company_id : null;
        $kiosk = $this->route('kiosk');

        return [
            'name' => ['required', 'string', 'max:80'],
            'code' => [
                'required', 'string', 'max:20', 'regex:/^[A-Za-z0-9][A-Za-z0-9-]*$/',
                Rule::unique('kiosks', 'code')
                    ->where('company_id', $companyId)
                    ->ignore($kiosk instanceof Kiosk ? $kiosk->id : null),
            ],
            'office_location_id' => [
                'required', 'string',
                Rule::exists('office_locations', 'id')->where('company_id', $companyId)->whereNull('deleted_at'),
            ],
            'is_active' => ['required', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama',
            'code' => 'kode',
            'office_location_id' => 'lokasi',
            'is_active' => 'status aktif',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.regex' => 'Kode hanya boleh huruf, angka, dan tanda hubung (mis. KP-LOBI).',
            'code.unique' => 'Kode kiosk ini sudah dipakai.',
        ];
    }

    /**
     * @return array{name: string, code: string, office_location_id: string, is_active: bool}
     */
    public function attributesForAction(): array
    {
        return [
            'name' => $this->string('name')->toString(),
            'code' => $this->string('code')->toString(),
            'office_location_id' => $this->string('office_location_id')->toString(),
            'is_active' => $this->boolean('is_active'),
        ];
    }
}

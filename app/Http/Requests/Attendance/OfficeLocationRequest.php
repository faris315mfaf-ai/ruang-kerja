<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Authorization: OfficeLocationPolicy in the controller.
 */
class OfficeLocationRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius_m' => ['required', 'integer', 'min:'.config()->integer('attendance.geofence.min_radius_m'), 'max:'.config()->integer('attendance.geofence.max_radius_m')],
            'is_active' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama',
            'address' => 'alamat',
            'radius_m' => 'radius',
            'is_active' => 'status aktif',
        ];
    }

    /**
     * @return array{name: string, address: string|null, latitude: float, longitude: float, radius_m: int, is_active: bool}
     */
    public function attributesForAction(): array
    {
        return [
            'name' => $this->string('name')->toString(),
            'address' => $this->filled('address') ? $this->string('address')->toString() : null,
            'latitude' => (float) $this->input('latitude'),
            'longitude' => (float) $this->input('longitude'),
            'radius_m' => $this->integer('radius_m'),
            'is_active' => $this->boolean('is_active'),
        ];
    }
}

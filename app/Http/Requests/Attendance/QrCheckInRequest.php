<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Data\QrCheckInData;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Throwable;

/**
 * QR kiosk check-in/out: the scanned payload, plus GPS when the employee
 * allowed it (docs/ARCHITECTURE.md §3.2). Authorization:
 * AttendanceDayPolicy::checkIn in the controller.
 */
class QrCheckInRequest extends FormRequest
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
            'payload' => ['required', 'string', 'max:512'],
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'client_time' => ['nullable', 'date'],
            'device_id' => ['nullable', 'string', 'max:128'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'payload.required' => 'Kode QR belum terbaca. Arahkan kamera ke kode di layar kiosk.',
            'payload.*' => 'Kode QR tidak dikenali. Pindai kode yang tampil di layar kiosk RuangKerja.',
            'latitude.*' => 'Koordinat lokasi tidak valid.',
            'longitude.*' => 'Koordinat lokasi tidak valid.',
        ];
    }

    public function toData(): QrCheckInData
    {
        $clientTime = null;

        if ($this->filled('client_time')) {
            try {
                $clientTime = CarbonImmutable::parse($this->string('client_time')->toString());
            } catch (Throwable) {
                $clientTime = null;
            }
        }

        return new QrCheckInData(
            payload: $this->string('payload')->toString(),
            latitude: $this->filled('latitude') ? (float) $this->input('latitude') : null,
            longitude: $this->filled('longitude') ? (float) $this->input('longitude') : null,
            accuracyM: $this->filled('accuracy') ? (float) $this->input('accuracy') : null,
            clientTime: $clientTime,
            deviceFingerprint: $this->filled('device_id') ? $this->string('device_id')->toString() : null,
            ipAddress: $this->ip(),
            userAgent: $this->userAgent(),
        );
    }
}

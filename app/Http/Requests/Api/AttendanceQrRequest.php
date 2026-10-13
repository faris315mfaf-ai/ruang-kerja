<?php

namespace App\Http\Requests\Api;

use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Devices\Models\Device;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Throwable;

/**
 * Check-in / check-out by a scanned kiosk QR code from the mobile app
 * (POST /api/v1/absensi/check-in/qr and /check-out/qr, JSON or form). Mirrors
 * the web QrCheckInRequest — same rules and Indonesian messages — with these
 * differences: the scanned text may arrive as `payload` (web name) or `code`;
 * the device fingerprint is never taken from the client but from the
 * installation that owns the Sanctum token (like AttendanceCheckInRequest);
 * `mock_location` (Android Location.mocked) is only a flag for HR review.
 */
class AttendanceQrRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('payload') && $this->filled('code')) {
            $this->merge(['payload' => $this->input('code')]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'payload' => ['required', 'string', 'max:512'],
            'code' => ['nullable', 'string', 'max:512'],
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'client_time' => ['nullable', 'date'],
            'device_id' => ['nullable', 'string', 'regex:/^[0-9a-fA-F]{64}$/'],
            'mock_location' => ['nullable', 'in:0,1,true,false'],
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
            'device_id.regex' => 'Identitas perangkat tidak valid.',
            'mock_location.in' => 'Sinyal lokasi palsu tidak valid.',
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
            deviceFingerprint: $this->deviceFingerprint(),
            ipAddress: $this->ip(),
            userAgent: $this->userAgent(),
            mockLocation: $this->boolean('mock_location'),
        );
    }

    /** The device hash registered with the caller's token, never client input. */
    private function deviceFingerprint(): ?string
    {
        $user = $this->user();

        return $user instanceof User ? Device::forAccessToken($user)?->device_id_hash : null;
    }
}

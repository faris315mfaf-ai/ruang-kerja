<?php

namespace App\Http\Requests\Api;

use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Devices\Models\Device;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use LogicException;
use Throwable;

/**
 * Multipart check-in of the mobile app (POST /api/v1/absensi/check-in).
 * Mirrors the web App\Http\Requests\Attendance\CheckInRequest — same rules
 * and Indonesian messages — except the device fingerprint: it is never
 * taken from the client (`device_id` is still validated for compatibility but
 * ignored) but from the installation that owns the Sanctum token
 * (Device::forAccessToken), i.e. the hash registered at login. A token that
 * is not tied to a device yields no fingerprint. `mock_location` (Android
 * Location.mocked) is only a flag for HR review, never a block.
 */
class AttendanceCheckInRequest extends FormRequest
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
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'client_time' => ['nullable', 'date'],
            'selfie' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:'.config()->integer('attendance.selfie.max_kilobytes')],
            'device_id' => ['nullable', 'string', 'regex:/^[0-9a-fA-F]{64}$/'],
            'note' => ['nullable', 'string', 'max:500'],
            // Location.mocked of the Android app; multipart sends "true"/"false"/"1"/"0".
            'mock_location' => ['nullable', 'in:0,1,true,false'],
            ...$this->workPlanRules(),
        ];
    }

    /**
     * @return array<string, array<mixed>>
     */
    private function workPlanRules(): array
    {
        if (! $this->acceptsWorkPlan()) {
            return [];
        }

        return [
            'work_plan' => ['nullable', 'array', 'max:8'],
            'work_plan.*' => ['nullable', 'string', 'max:300'],
        ];
    }

    /** Only check-in carries a work plan; check-out never reads it. */
    protected function acceptsWorkPlan(): bool
    {
        return true;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $messages = [
            'latitude.required' => 'Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.',
            'longitude.required' => 'Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.',
            'latitude.*' => 'Koordinat lokasi tidak valid.',
            'longitude.*' => 'Koordinat lokasi tidak valid.',
            'selfie.required' => 'Ambil selfie terlebih dulu.',
            'selfie.mimes' => 'Selfie harus berupa foto JPEG, PNG, atau WebP.',
            'selfie.max' => 'Ukuran selfie terlalu besar. Coba ambil ulang.',
            'selfie.*' => 'Selfie tidak valid. Coba ambil ulang.',
            'device_id.regex' => 'Identitas perangkat tidak valid.',
            'note.max' => 'Catatan maksimal 500 karakter.',
            'mock_location.in' => 'Sinyal lokasi palsu tidak valid.',
        ];

        if ($this->acceptsWorkPlan()) {
            $messages['work_plan.max'] = 'Maksimal 8 poin rencana kerja.';
            $messages['work_plan.*.max'] = 'Tiap poin maksimal 300 karakter.';
        }

        return $messages;
    }

    public function toData(): CheckInData
    {
        $selfie = $this->file('selfie');
        $clientTime = null;

        if ($this->filled('client_time')) {
            try {
                $clientTime = CarbonImmutable::parse($this->string('client_time')->toString());
            } catch (Throwable) {
                $clientTime = null;
            }
        }

        return new CheckInData(
            latitude: (float) $this->input('latitude'),
            longitude: (float) $this->input('longitude'),
            accuracyM: $this->filled('accuracy') ? (float) $this->input('accuracy') : null,
            clientTime: $clientTime,
            selfie: $selfie instanceof UploadedFile ? $selfie : throw new LogicException('Selfie divalidasi sebelumnya.'),
            deviceFingerprint: $this->deviceFingerprint(),
            ipAddress: $this->ip(),
            userAgent: $this->userAgent(),
            note: $this->filled('note') ? $this->string('note')->toString() : null,
            workPlan: $this->workPlan(),
            mockLocation: $this->boolean('mock_location'),
            workReport: $this->workReport(),
        );
    }

    /** The device hash registered with the caller's token, never client input. */
    private function deviceFingerprint(): ?string
    {
        $user = $this->user();

        return $user instanceof User ? Device::forAccessToken($user)?->device_id_hash : null;
    }

    /**
     * Only check-out carries a work report (AttendanceCheckOutRequest).
     *
     * @return list<string>|null
     */
    protected function workReport(): ?array
    {
        return null;
    }

    /**
     * @return list<string>|null
     */
    private function workPlan(): ?array
    {
        if (! $this->acceptsWorkPlan() || ! $this->filled('work_plan')) {
            return null;
        }

        $points = $this->collect('work_plan')
            ->filter(fn ($point): bool => trim((string) $point) !== '')
            ->map(fn ($point): string => Str::limit(trim((string) $point), 300, ''))
            ->values()
            ->all();

        return $points === [] ? null : array_values($points);
    }
}

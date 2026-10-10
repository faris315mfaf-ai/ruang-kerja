<?php

namespace App\Http\Requests\Api;

use App\Domain\Attendance\Data\CheckInData;
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
 * and Indonesian messages — except `device_id`, which the app always sends
 * as the SHA-256 hash of the raw device identifier (64 hex, like the login).
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
            deviceFingerprint: $this->filled('device_id') ? strtolower($this->string('device_id')->toString()) : null,
            ipAddress: $this->ip(),
            userAgent: $this->userAgent(),
            note: $this->filled('note') ? $this->string('note')->toString() : null,
            workPlan: $this->workPlan(),
        );
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

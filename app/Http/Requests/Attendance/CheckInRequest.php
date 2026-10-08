<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Data\CheckInData;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use LogicException;
use Throwable;

/**
 * Multipart check-in/out: lat, lng, accuracy, client_time, selfie, device id,
 * note and work_plan (docs/ARCHITECTURE.md §3.1). Authorization: AttendanceDayPolicy::checkIn
 * in the controller.
 */
class CheckInRequest extends FormRequest
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
            'device_id' => ['nullable', 'string', 'max:128'],
            'note' => ['nullable', 'string', 'max:500'],
            'work_plan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'latitude.required' => 'Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.',
            'longitude.required' => 'Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.',
            'latitude.*' => 'Koordinat lokasi tidak valid.',
            'longitude.*' => 'Koordinat lokasi tidak valid.',
            'selfie.required' => 'Ambil selfie terlebih dulu.',
            'selfie.mimes' => 'Selfie harus berupa foto JPEG, PNG, atau WebP.',
            'selfie.max' => 'Ukuran selfie terlalu besar. Coba ambil ulang.',
            'selfie.*' => 'Selfie tidak valid. Coba ambil ulang.',
            'note.max' => 'Catatan maksimal 500 karakter.',
            'work_plan.max' => 'Rencana kerja maksimal 2000 karakter.',
        ];
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
            deviceFingerprint: $this->filled('device_id') ? $this->string('device_id')->toString() : null,
            ipAddress: $this->ip(),
            userAgent: $this->userAgent(),
            note: $this->filled('note') ? $this->string('note')->toString() : null,
            workPlan: $this->filled('work_plan') ? $this->string('work_plan')->toString() : null,
        );
    }
}

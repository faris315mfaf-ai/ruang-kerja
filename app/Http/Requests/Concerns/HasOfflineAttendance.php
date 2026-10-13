<?php

namespace App\Http\Requests\Concerns;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Throwable;

/**
 * `offline` + `offline_at` of the mobile app's check-in/out requests (owner
 * decision 14 Oct 2026). Only the shape is validated here; whether the device
 * time is acceptable (required, ≤ now + 5 min, ≥ now − 72 h, after the
 * check-in) is a business rule answered by the Action with the usual
 * {message, reason, context} 422 (`offline_clock_invalid` / `offline_expired`).
 * `offline_at` is ignored unless `offline` is true.
 *
 * @mixin FormRequest
 */
trait HasOfflineAttendance
{
    /**
     * @return array<string, array<mixed>>
     */
    protected function offlineRules(): array
    {
        return [
            // Multipart sends "true"/"false"/"1"/"0".
            'offline' => ['nullable', 'in:0,1,true,false'],
            'offline_at' => ['nullable', 'string', 'max:40'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function offlineMessages(): array
    {
        return [
            'offline.in' => 'Penanda absen offline tidak valid.',
            'offline_at.*' => 'Jam absen offline tidak valid.',
        ];
    }

    protected function isOffline(): bool
    {
        return $this->boolean('offline');
    }

    /**
     * The device time of the press; null when missing, unparsable or without
     * a UTC offset (the Action then answers `offline_clock_invalid`).
     */
    protected function offlineAt(): ?CarbonImmutable
    {
        if (! $this->isOffline() || ! $this->filled('offline_at')) {
            return null;
        }

        $value = trim($this->string('offline_at')->toString());

        if (preg_match('/(Z|[+-]\d{2}:?\d{2})$/i', $value) !== 1) {
            return null;
        }

        try {
            return CarbonImmutable::parse($value);
        } catch (Throwable) {
            return null;
        }
    }
}

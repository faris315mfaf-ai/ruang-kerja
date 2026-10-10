<?php

namespace App\Http\Requests\Api;

/**
 * Multipart check-out of the mobile app (POST /api/v1/absensi/check-out):
 * the same payload as check-in minus the work plan — the plan belongs to the
 * start of the day (keputusan pemilik 9 Okt 2026).
 */
class AttendanceCheckOutRequest extends AttendanceCheckInRequest
{
    protected function acceptsWorkPlan(): bool
    {
        return false;
    }
}

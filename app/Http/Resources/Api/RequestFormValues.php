<?php

namespace App\Http\Resources\Api;

use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;

/**
 * Stored form values of a request, in the field names of the request form
 * (SaveEmployeeRequestRequest) — the same "initial" values the web edit page
 * fills its form with. The mobile app prefills its edit form from them, and
 * PATCH/kirim merge the fields the app sends over them.
 */
final class RequestFormValues
{
    /**
     * @return array<string, mixed>
     */
    public static function of(EmployeeRequest $request): array
    {
        $request->loadMissing('leaveType');
        $payload = $request->payload;
        $start = OfficeTime::local($request->start_at);
        $end = OfficeTime::local($request->end_at);
        $hours = ($payload['mode'] ?? null) === 'hours';

        return [
            'leave_type_id' => $request->leave_type_id,
            'mode' => $request->leaveType->category->value === 'permit' ? ($hours ? 'hours' : 'days') : null,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'date' => $payload['date'] ?? $start->toDateString(),
            'start_time' => $payload['start_time'] ?? null,
            'end_time' => $payload['end_time'] ?? null,
            'check_in' => $payload['check_in'] ?? null,
            'check_out' => $payload['check_out'] ?? null,
            'half_day' => (bool) ($payload['half_day'] ?? false),
            'destination' => $payload['destination'] ?? null,
            'item_name' => $payload['item_name'] ?? null,
            'quantity' => $payload['quantity'] ?? null,
            'unit' => $payload['unit'] ?? null,
            'unit_price' => $payload['unit_price'] ?? null,
            'reference_url' => $payload['reference_url'] ?? null,
            'urgency' => $payload['urgency'] ?? null,
            'substitute_id' => $request->substitute_id,
            'reason' => $request->reason,
        ];
    }
}

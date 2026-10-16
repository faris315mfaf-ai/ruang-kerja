<?php

namespace App\Http\Requests\Api\Meetings;

use App\Http\Requests\Meetings\MeetingRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** PATCH /api/v1/rapat/{meeting}/notulen-otomatis {enabled} (web: PUT …/pengaturan {auto_minutes}). */
class AutoMinutesToggleRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['enabled' => 'notulen otomatis'];
    }
}

<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Meetings\Enums\MinutesSource;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/** Pre-join "Notulen yang dipakai" (POST /rapat/{meeting}/video/sumber-notulen). */
class ChooseMinutesSourceRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'source' => ['required', 'string', Rule::enum(MinutesSource::class)],
        ];
    }

    public function source(): MinutesSource
    {
        return MinutesSource::from((string) $this->input('source'));
    }
}

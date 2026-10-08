<?php

namespace App\Http\Requests\Meetings;

use Illuminate\Contracts\Validation\ValidationRule;

/** Raise / lower one's own hand (POST /rapat/{meeting}/video/tangan). */
class RaiseHandRequest extends OccurrenceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [...parent::rules(), 'raised' => ['required', 'boolean']];
    }
}

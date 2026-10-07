<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Meetings\Actions\SetOwnAttributes;
use Illuminate\Contracts\Validation\ValidationRule;

/** Own LiveKit attributes through the server (POST /rapat/{meeting}/video/atribut). */
class OwnAttributesRequest extends OccurrenceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'attributes' => ['required', 'array', 'min:1', 'max:'.count(SetOwnAttributes::ATTRIBUTES)],
        ];
    }
}

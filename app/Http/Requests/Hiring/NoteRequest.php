<?php

namespace App\Http\Requests\Hiring;

use Illuminate\Contracts\Validation\ValidationRule;

/** Interview minutes (notulensi). */
class NoteRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:2', 'max:20000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['body' => 'notulensi'];
    }
}

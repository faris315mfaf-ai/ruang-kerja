<?php

namespace App\Http\Requests\Chat;

use App\Models\Reaction;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class ReactRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['emoji' => ['required', 'string', Rule::in(Reaction::EMOJI)]];
    }
}

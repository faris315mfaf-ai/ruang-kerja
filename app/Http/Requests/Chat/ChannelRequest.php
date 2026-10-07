<?php

namespace App\Http\Requests\Chat;

use Illuminate\Contracts\Validation\ValidationRule;

/** New public/private channel ("Obrolan baru" › Channel). */
class ChannelRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'topic' => ['nullable', 'string', 'max:250'],
            'private' => ['sometimes', 'boolean'],
            'member_ids' => ['sometimes', 'array', 'max:100'],
            'member_ids.*' => ['string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['name' => 'nama channel', 'topic' => 'topik'];
    }
}

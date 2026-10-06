<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\Actions\OpenDirectConversation;
use Illuminate\Contracts\Validation\ValidationRule;

/** "Obrolan baru" › Pesan langsung: 1 person = DM, 2+ = group. */
class DirectRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'user_ids' => ['required', 'array', 'min:1', 'max:'.(OpenDirectConversation::MAX_PEOPLE - 1)],
            'user_ids.*' => ['string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_ids.required' => 'Pilih minimal satu orang.',
            'user_ids.max' => 'Grup maksimal '.OpenDirectConversation::MAX_PEOPLE.' orang. Buat channel untuk tim yang lebih besar.',
        ];
    }
}

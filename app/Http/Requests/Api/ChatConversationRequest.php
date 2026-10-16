<?php

namespace App\Http\Requests\Api;

use App\Domain\Chat\Actions\OpenDirectConversation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/obrolan — "Obrolan baru". `jenis` = `langsung` (user_ids: 1
 * person = DM, 2–8 = group) or `kanal` (name, topic, private, member_ids).
 */
class ChatConversationRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $direct = $this->input('jenis') === 'langsung';
        $channel = $this->input('jenis') === 'kanal';

        return [
            'jenis' => ['required', Rule::in(['langsung', 'kanal'])],
            'user_ids' => [Rule::requiredIf($direct), 'array', 'min:1', 'max:'.(OpenDirectConversation::MAX_PEOPLE - 1)],
            'user_ids.*' => ['string', 'ulid'],
            'name' => [Rule::requiredIf($channel), 'string', 'min:2', 'max:80'],
            'topic' => ['sometimes', 'nullable', 'string', 'max:250'],
            'private' => ['sometimes', 'boolean'],
            'member_ids' => ['sometimes', 'array', 'max:100'],
            'member_ids.*' => ['string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'jenis.required' => 'Pilih jenis obrolan: langsung atau kanal.',
            'jenis.in' => 'Jenis obrolan harus langsung atau kanal.',
            'user_ids.required' => 'Pilih minimal satu orang.',
            'user_ids.min' => 'Pilih minimal satu orang.',
            'user_ids.max' => 'Grup maksimal '.OpenDirectConversation::MAX_PEOPLE.' orang. Buat channel untuk tim yang lebih besar.',
            'name.required' => 'Nama channel wajib diisi.',
            'name.min' => 'Nama channel minimal 2 karakter.',
        ];
    }
}

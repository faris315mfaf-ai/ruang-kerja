<?php

namespace App\Http\Requests\Notes;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteShareRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/** "Bagikan": general access + invited people with their role. */
class ShareNoteRequest extends NoteRequest
{
    public const int MAX_PEOPLE = 100;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'access' => ['required', Rule::enum(NoteAccess::class)],
            'people' => ['present', 'array', 'max:'.self::MAX_PEOPLE],
            'people.*.user_id' => ['required', 'string', 'ulid', 'distinct'],
            'people.*.role' => ['required', Rule::enum(NoteShareRole::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['people.max' => 'Maksimal '.self::MAX_PEOPLE.' orang per catatan.'];
    }
}

<?php

namespace App\Http\Requests\Notulen;

use App\Http\Requests\Meetings\MeetingRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** POST …/notulen-otomatis/tindak-lanjut/{suggestion}/tugas — optional workspace. */
class SuggestionTaskRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'workspace_id' => ['sometimes', 'nullable', 'string', 'ulid'],
        ];
    }
}

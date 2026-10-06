<?php

namespace App\Http\Requests\Meetings;

use Illuminate\Contracts\Validation\ValidationRule;

/** "Jadikan tugas" for some follow-ups (workspace_id when the meeting has none). */
class ConvertActionItemsRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'item_ids' => ['required', 'array', 'min:1', 'max:50'],
            'item_ids.*' => ['string', 'ulid'],
            'workspace_id' => ['sometimes', 'nullable', 'string', 'ulid'],
        ];
    }

    /**
     * @return list<string>
     */
    public function itemIds(): array
    {
        return array_values(array_map(strval(...), (array) $this->input('item_ids', [])));
    }
}

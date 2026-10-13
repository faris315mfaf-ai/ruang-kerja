<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Tasks\ChecklistItemRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * POST/PATCH /api/v1/tugas/{task}/checklist[/{item}] — the web
 * ChecklistItemRequest (title, is_done; 404 to people who cannot see the
 * task) plus the reorder pair of the mobile "geser butir":
 * `after_id` / `before_id` = the line directly above / below the new place.
 */
class TaskChecklistRequest extends ChecklistItemRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'after_id' => ['sometimes', 'nullable', 'string', 'size:26'],
            'before_id' => ['sometimes', 'nullable', 'string', 'size:26'],
        ];
    }

    public function afterId(): ?string
    {
        return $this->filled('after_id') ? strtolower($this->string('after_id')->toString()) : null;
    }

    public function beforeId(): ?string
    {
        return $this->filled('before_id') ? strtolower($this->string('before_id')->toString()) : null;
    }

    public function reorders(): bool
    {
        return $this->afterId() !== null || $this->beforeId() !== null;
    }
}

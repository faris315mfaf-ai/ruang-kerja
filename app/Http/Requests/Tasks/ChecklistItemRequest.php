<?php

namespace App\Http\Requests\Tasks;

use App\Models\ChecklistItem;
use App\Models\Task;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Add (POST: title) or change (PATCH: title and/or is_done) a checklist line.
 * authorize() answers 404 to people who cannot see the task before validating
 * (write permission is checked in the controller).
 */
class ChecklistItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        $task = $this->route('task');
        $item = $this->route('item');

        if ($task instanceof Task) {
            Gate::authorize('view', $task);
        }

        if ($item instanceof ChecklistItem) {
            Gate::authorize('view', $item);
        }

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $presence = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'title' => [$presence, 'string', 'max:255', 'not_regex:/^\s*$/'],
            'is_done' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Isi checklist wajib diisi.',
            'title.not_regex' => 'Isi checklist wajib diisi.',
            'title.max' => 'Isi checklist maksimal 255 karakter.',
        ];
    }

    /**
     * @return array{title?: string, is_done?: bool}
     */
    public function changes(): array
    {
        $changes = [];

        if ($this->has('title')) {
            $changes['title'] = $this->string('title')->toString();
        }

        if ($this->has('is_done')) {
            $changes['is_done'] = $this->boolean('is_done');
        }

        return $changes;
    }
}

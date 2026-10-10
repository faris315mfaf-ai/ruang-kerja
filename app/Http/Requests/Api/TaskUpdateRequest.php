<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use App\Models\Task;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PATCH /api/v1/tugas/{task} — partial update from the mobile app: only the
 * given keys, the mobile subset of the web TaskRequest (plain-text
 * `description`, members of the task's workspace as assignees). Someone who
 * may not see the task gets 404 before validation runs
 * (HidesInvisibleWorkspaces); the controller still checks TaskPolicy::update
 * (keputusan 9 Okt 2026: a task assigned by someone else is only editable by
 * its creator or a superior).
 */
class TaskUpdateRequest extends FormRequest
{
    use HidesInvisibleWorkspaces;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $task = $this->route('task');
        $workspaceId = $task instanceof Task ? $task->workspace_id : '';

        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'assignee_ids' => ['sometimes', 'array', 'max:20'],
            'assignee_ids.*' => ['string', 'distinct', Rule::exists('workspace_members', 'user_id')->where('workspace_id', $workspaceId)],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'priority' => ['sometimes', 'integer', 'between:0,4'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.max' => 'Judul tugas maksimal 255 karakter.',
            'assignee_ids.*.exists' => 'Penanggung jawab harus anggota workspace.',
            'due_date.date_format' => 'Tenggat tidak valid.',
            'priority.between' => 'Prioritas tidak valid.',
        ];
    }

    /**
     * Only the keys the client sent, in the shape expected by UpdateTask.
     *
     * @return array{title?: string, description_text?: string|null, due_date?: string|null, priority?: int, assignee_ids?: list<string>}
     */
    public function payload(): array
    {
        $data = [];

        foreach (['title', 'description', 'due_date'] as $field) {
            if ($this->has($field)) {
                $value = $this->input($field);
                $data[$field === 'description' ? 'description_text' : $field] = is_string($value) && $value !== '' ? $value : null;
            }
        }

        if (array_key_exists('title', $data)) {
            $data['title'] = (string) $data['title'];
        }

        if ($this->has('priority')) {
            $data['priority'] = $this->integer('priority');
        }

        if ($this->has('assignee_ids')) {
            $data['assignee_ids'] = array_values(array_filter(
                (array) $this->input('assignee_ids', []),
                fn (mixed $id): bool => is_string($id),
            ));
        }

        return $data;
    }
}

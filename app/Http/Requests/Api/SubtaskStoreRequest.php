<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\TaskExtraFields;
use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use App\Models\Task;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/tugas/{task}/subtugas — a sub-task of {task}, in the same
 * workspace (the parent is the route task, never the body). Same fields as a
 * new task minus workspace/parent. Someone who may not see the parent gets 404
 * before validation (HidesInvisibleWorkspaces); the controller checks
 * TaskPolicy::work (the web editTasks rule).
 */
class SubtaskStoreRequest extends FormRequest
{
    use HidesInvisibleWorkspaces, TaskExtraFields;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $task = $this->route('task');
        $workspaceId = $task instanceof Task ? $task->workspace_id : '';

        return [
            'title' => ['required', 'string', 'max:255', 'not_regex:/^\s*$/'],
            'description' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'assignee_ids' => ['sometimes', 'array', 'max:20'],
            'assignee_ids.*' => ['string', 'distinct', Rule::exists('workspace_members', 'user_id')->where('workspace_id', $workspaceId)],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'priority' => ['sometimes', 'integer', 'between:0,4'],
            ...Arr::except($this->extraRules($workspaceId, true), ['parent_id']),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul sub-tugas wajib diisi.',
            'title.not_regex' => 'Judul sub-tugas wajib diisi.',
            'title.max' => 'Judul sub-tugas maksimal 255 karakter.',
            'assignee_ids.*.exists' => 'Penanggung jawab harus anggota workspace.',
            'due_date.date_format' => 'Tenggat tidak valid.',
            'priority.between' => 'Prioritas tidak valid.',
            ...$this->extraMessages(),
        ];
    }

    /**
     * Attributes in the shape of CreateTask; `parent_id` is the route task.
     *
     * @return array{title: string, parent_id: string, description_text?: string|null, due_date?: string|null, priority?: int, assignee_ids?: list<string>, start_date?: string|null, estimate_hours?: string|null, label_ids?: list<string>, status_id?: string}
     */
    public function payload(Task $parent): array
    {
        $data = ['title' => $this->string('title')->toString(), 'parent_id' => $parent->id];

        foreach (['description', 'due_date'] as $field) {
            if ($this->has($field)) {
                $value = $this->input($field);
                $data[$field === 'description' ? 'description_text' : $field] = is_string($value) && $value !== '' ? $value : null;
            }
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

        $extra = $this->extraPayload(true);
        unset($extra['parent_id']);

        return [...$data, ...$extra];
    }
}

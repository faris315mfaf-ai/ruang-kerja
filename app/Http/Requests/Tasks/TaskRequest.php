<?php

namespace App\Http\Requests\Tasks;

use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use App\Models\Task;
use App\Models\Workspace;
use App\Rules\RichTextDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create (POST /w/{key}/tugas) or partially update (PATCH /tugas/{task}) a task.
 * Ids are validated against the task's workspace. Non-viewers get 404 before
 * validation (HidesInvisibleWorkspaces); the specific ability is checked in
 * the controller (WorkspacePolicy::editTasks / TaskPolicy::update).
 */
class TaskRequest extends FormRequest
{
    use HidesInvisibleWorkspaces;

    public function workspace(): Workspace
    {
        $task = $this->route('task');

        if ($task instanceof Task) {
            return $task->workspace;
        }

        $workspace = $this->route('workspace');

        abort_unless($workspace instanceof Workspace, 404);

        return $workspace;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $workspaceId = $this->workspace()->id;
        $presence = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'title' => [$presence, 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'array', new RichTextDocument],
            'description_text' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'status_id' => ['sometimes', 'nullable', 'string', Rule::exists('task_statuses', 'id')->where('workspace_id', $workspaceId)],
            'priority' => ['sometimes', 'integer', 'between:0,4'],
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'estimate_hours' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999'],
            'assignee_ids' => ['sometimes', 'array', 'max:20'],
            'assignee_ids.*' => ['string', 'distinct', Rule::exists('workspace_members', 'user_id')->where('workspace_id', $workspaceId)],
            'label_ids' => ['sometimes', 'array', 'max:20'],
            'label_ids.*' => ['string', 'distinct', Rule::exists('labels', 'id')->where('workspace_id', $workspaceId)],
            'parent_id' => ['sometimes', 'nullable', 'string', Rule::exists('tasks', 'id')->where('workspace_id', $workspaceId)->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul tugas wajib diisi.',
            'title.max' => 'Judul tugas maksimal 255 karakter.',
            'status_id.exists' => 'Kolom status tidak ada di workspace ini.',
            'priority.between' => 'Prioritas tidak valid.',
            'start_date.date_format' => 'Tanggal mulai tidak valid.',
            'due_date.date_format' => 'Tenggat tidak valid.',
            'due_date.after_or_equal' => 'Tenggat tidak boleh sebelum tanggal mulai.',
            'estimate_hours.numeric' => 'Estimasi harus berupa angka jam.',
            'estimate_hours.max' => 'Estimasi terlalu besar.',
            'assignee_ids.*.exists' => 'Penanggung jawab harus anggota workspace.',
            'label_ids.*.exists' => 'Label tidak ada di workspace ini.',
            'parent_id.exists' => 'Tugas induk tidak ditemukan.',
        ];
    }

    /**
     * Validated attributes in the shape expected by CreateTask / UpdateTask.
     *
     * @return array{title?: string, description?: array<mixed>|null, description_text?: string|null, status_id?: string, priority?: int, start_date?: string|null, due_date?: string|null, estimate_hours?: string|null, assignee_ids?: list<string>, label_ids?: list<string>, parent_id?: string|null}
     */
    public function payload(): array
    {
        $data = [];

        foreach (['title', 'description_text', 'start_date', 'due_date', 'parent_id'] as $field) {
            if ($this->has($field)) {
                $value = $this->input($field);
                $data[$field] = is_string($value) && $value !== '' ? $value : null;
            }
        }

        if (array_key_exists('title', $data)) {
            $data['title'] = (string) $data['title'];
        }

        if ($this->has('description')) {
            $document = $this->input('description');
            $data['description'] = is_array($document) ? $document : null;
        }

        if ($this->filled('status_id')) {
            $data['status_id'] = $this->string('status_id')->toString();
        }

        if ($this->has('priority')) {
            $data['priority'] = $this->integer('priority');
        }

        if ($this->has('estimate_hours')) {
            $data['estimate_hours'] = $this->filled('estimate_hours') ? (string) $this->input('estimate_hours') : null;
        }

        foreach (['assignee_ids', 'label_ids'] as $field) {
            if ($this->has($field)) {
                $data[$field] = array_values(array_filter(
                    (array) $this->input($field, []),
                    fn (mixed $id): bool => is_string($id),
                ));
            }
        }

        return $data;
    }
}

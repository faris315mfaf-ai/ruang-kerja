<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\TaskExtraFields;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/tugas — create a task from the mobile app. The payload is the
 * mobile subset of the web TaskRequest: plain-text `description` (the app has
 * no rich editor), members of the target workspace as assignees and a date
 * or priority. The workspace is resolved from `workspace_id` by the
 * controller behind WorkspacePolicy::editTasks (404 invisible / 403 viewer),
 * exactly like the web create dialog.
 */
class TaskStoreRequest extends FormRequest
{
    use TaskExtraFields;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        // ULIDs are stored lowercase; the app may send the uppercase form.
        $workspaceId = strtolower($this->string('workspace_id')->toString());

        return [
            'workspace_id' => ['required', 'string', 'size:26'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'assignee_ids' => ['sometimes', 'array', 'max:20'],
            'assignee_ids.*' => ['string', 'distinct', Rule::exists('workspace_members', 'user_id')->where('workspace_id', $workspaceId)],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'priority' => ['sometimes', 'integer', 'between:0,4'],
            ...$this->extraRules($workspaceId, true),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'workspace_id.required' => 'Pilih workspace tugas.',
            'workspace_id.size' => 'Workspace tidak ditemukan.',
            'title.required' => 'Judul tugas wajib diisi.',
            'title.max' => 'Judul tugas maksimal 255 karakter.',
            'assignee_ids.*.exists' => 'Penanggung jawab harus anggota workspace.',
            'due_date.date_format' => 'Tenggat tidak valid.',
            'priority.between' => 'Prioritas tidak valid.',
            ...$this->extraMessages(),
        ];
    }

    /**
     * Validated attributes in the shape expected by CreateTask (`description`
     * from the app is the web `description_text`).
     *
     * @return array{title: string, description_text?: string|null, due_date?: string|null, priority?: int, assignee_ids?: list<string>, start_date?: string|null, estimate_hours?: string|null, label_ids?: list<string>, status_id?: string, parent_id?: string|null}
     */
    public function payload(): array
    {
        $data = ['title' => $this->string('title')->toString()];

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

        return [...$data, ...$this->extraPayload(true)];
    }
}

<?php

namespace App\Http\Requests\Api\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * The task fields the mobile detail edits beyond the Tahap 2 subset (title,
 * plain description, assignees, due date, priority): start date, estimate,
 * labels and — on create only — the column and the parent task. Shared by
 * TaskStoreRequest, TaskUpdateRequest and SubtaskStoreRequest; ids are checked
 * against the task's workspace, the rest is the web TaskRequest rule set.
 */
trait TaskExtraFields
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function extraRules(string $workspaceId, bool $creating): array
    {
        $rules = [
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'estimate_hours' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999'],
            'label_ids' => ['sometimes', 'array', 'max:20'],
            'label_ids.*' => ['string', 'distinct', Rule::exists('labels', 'id')->where('workspace_id', $workspaceId)],
        ];

        if ($this->filled('start_date')) {
            $rules['due_date'] = ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'];
        }

        if ($creating) {
            $rules['status_id'] = ['sometimes', 'nullable', 'string', 'size:26', Rule::exists('task_statuses', 'id')->where('workspace_id', $workspaceId)];
            $rules['parent_id'] = ['sometimes', 'nullable', 'string', 'size:26', Rule::exists('tasks', 'id')->where('workspace_id', $workspaceId)->whereNull('deleted_at')];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    protected function extraMessages(): array
    {
        return [
            'start_date.date_format' => 'Tanggal mulai tidak valid.',
            'due_date.after_or_equal' => 'Tenggat tidak boleh sebelum tanggal mulai.',
            'estimate_hours.numeric' => 'Estimasi harus berupa angka jam.',
            'estimate_hours.max' => 'Estimasi terlalu besar.',
            'label_ids.*.exists' => 'Label tidak ada di workspace ini.',
            'status_id.exists' => 'Kolom status tidak ada di workspace ini.',
            'parent_id.exists' => 'Tugas induk tidak ditemukan.',
        ];
    }

    /**
     * Only the keys the client sent.
     *
     * @return array{start_date?: string|null, estimate_hours?: string|null, label_ids?: list<string>, status_id?: string, parent_id?: string|null}
     */
    protected function extraPayload(bool $creating): array
    {
        $data = [];

        if ($this->has('start_date')) {
            $value = $this->input('start_date');
            $data['start_date'] = is_string($value) && $value !== '' ? $value : null;
        }

        if ($this->has('estimate_hours')) {
            $data['estimate_hours'] = $this->filled('estimate_hours') ? (string) $this->input('estimate_hours') : null;
        }

        if ($this->has('label_ids')) {
            $data['label_ids'] = array_values(array_filter(
                (array) $this->input('label_ids', []),
                fn (mixed $id): bool => is_string($id),
            ));
        }

        if ($creating) {
            if ($this->filled('status_id')) {
                $data['status_id'] = $this->string('status_id')->toString();
            }

            if ($this->has('parent_id')) {
                $value = $this->input('parent_id');
                $data['parent_id'] = is_string($value) && $value !== '' ? $value : null;
            }
        }

        return $data;
    }
}

<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use App\Models\Task;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * PATCH /api/v1/tugas/{task}/status — move a task to another column of its
 * workspace (`status_id`, same as the web board) or quick-toggle it
 * (`done: true|false`, like "centang selesai" in Ruang saya). Exactly one of
 * the two. Someone who may not see the task gets 404 before validation runs
 * (HidesInvisibleWorkspaces); the controller still checks `move`.
 */
class TaskStatusRequest extends FormRequest
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
            'status_id' => ['required_without:done', 'nullable', 'string', 'size:26', Rule::exists('task_statuses', 'id')->where('workspace_id', $workspaceId)],
            'done' => ['required_without:status_id', 'nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status_id.required_without' => 'Kirim status_id atau done.',
            'status_id.exists' => 'Kolom tujuan tidak ada di workspace ini.',
            'done.required_without' => 'Kirim status_id atau done.',
        ];
    }

    /**
     * Sending both would be ambiguous — the client must pick one.
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('status_id') && $this->filled('done')) {
                    $validator->errors()->add('status_id', 'Kirim status_id atau done, jangan keduanya.');
                }
            },
        ];
    }

    public function wantsDone(): ?bool
    {
        return $this->filled('done') ? $this->boolean('done') : null;
    }
}

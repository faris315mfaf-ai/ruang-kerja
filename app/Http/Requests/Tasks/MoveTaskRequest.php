<?php

namespace App\Http\Requests\Tasks;

use App\Models\Task;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PATCH /tugas/{task}/move — final API (board drag & drop, mobile "Pindahkan",
 * Shift+←/→, realtime clients):
 *   status_id  target column (same workspace)
 *   after_id   card directly above the new place (optional)
 *   before_id  card directly below the new place (optional)
 * Neither neighbour → top of the column.
 */
class MoveTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $task = $this->route('task');
        $workspaceId = $task instanceof Task ? $task->workspace_id : '';

        return [
            'status_id' => ['required', 'string', Rule::exists('task_statuses', 'id')->where('workspace_id', $workspaceId)],
            'after_id' => ['nullable', 'string', 'size:26'],
            'before_id' => ['nullable', 'string', 'size:26'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status_id.required' => 'Pilih kolom tujuan.',
            'status_id.exists' => 'Kolom tujuan tidak ada di workspace ini.',
        ];
    }
}

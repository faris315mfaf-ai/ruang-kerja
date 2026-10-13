<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use App\Models\Workspace;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PATCH /api/v1/workspace/{workspace}/papan/kartu/{task} — the "Pindahkan"
 * sheet of the board: `status_id` is the target column of this workspace,
 * `after_id` / `before_id` the cards right above / below the new place
 * (optional; neither = top of the column), as the web MoveTaskRequest.
 */
class WorkspaceCardMoveRequest extends FormRequest
{
    use HidesInvisibleWorkspaces;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $workspace = $this->route('workspace');
        $workspaceId = $workspace instanceof Workspace ? $workspace->id : '';

        return [
            'status_id' => ['required', 'string', 'size:26', Rule::exists('task_statuses', 'id')->where('workspace_id', $workspaceId)],
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
            'status_id.size' => 'Kolom tujuan tidak valid.',
        ];
    }
}

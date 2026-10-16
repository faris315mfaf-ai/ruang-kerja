<?php

namespace App\Http\Requests\Api;

use App\Domain\Tasks\Enums\SavedViewLayout;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST/PATCH /api/v1/tugas/tampilan — a saved view of "Tugas saya". Without
 * `workspace_id` it is a personal cross-workspace view (the filters below);
 * with one it is a workspace view under the web rules (SavedViewPolicy:
 * sharing needs task edit rights). Authorization is the controller's; the
 * filters keep the saved_views shape of the web (`SaveView::normalizeFilters`)
 * plus `workspaces`, `statuses`, `due_from`, `due_to`.
 */
class TaskViewRequest extends FormRequest
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
        $presence = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$presence, 'string', 'max:60', 'not_regex:/^\s*$/'],
            'layout' => ['sometimes', Rule::enum(SavedViewLayout::class)],
            'workspace_id' => ['sometimes', 'nullable', 'string', 'size:26'],
            'filters' => ['sometimes', 'array'],
            'filters.assignees' => ['sometimes', 'array', 'max:50'],
            'filters.assignees.*' => ['string', 'max:26'],
            'filters.priorities' => ['sometimes', 'array', 'max:5'],
            'filters.priorities.*' => ['integer', 'between:0,4'],
            'filters.labels' => ['sometimes', 'array', 'max:50'],
            'filters.labels.*' => ['string', 'max:26'],
            'filters.workspaces' => ['sometimes', 'array', 'max:20'],
            'filters.workspaces.*' => ['string', 'max:26'],
            'filters.statuses' => ['sometimes', 'array', 'max:6'],
            'filters.statuses.*' => [Rule::enum(TaskStatusCategory::class)],
            'filters.due' => ['sometimes', 'nullable', Rule::in(['overdue', 'today', 'week', 'none'])],
            'filters.due_from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'filters.due_to' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'filters.q' => ['sometimes', 'nullable', 'string', 'max:200'],
            'is_shared' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama tampilan wajib diisi.',
            'name.max' => 'Nama tampilan maksimal 60 karakter.',
            'name.not_regex' => 'Nama tampilan wajib diisi.',
            'layout.enum' => 'Tata letak tidak valid.',
            'filters.statuses.*' => 'Status tidak valid.',
            'filters.due.in' => 'Filter tenggat tidak valid.',
            'filters.due_from.date_format' => 'Tanggal awal tenggat tidak valid.',
            'filters.due_to.date_format' => 'Tanggal akhir tenggat tidak valid.',
        ];
    }

    public function shared(): bool
    {
        return $this->boolean('is_shared');
    }

    /**
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        $filters = $this->input('filters', []);

        return is_array($filters) ? array_filter($filters, fn (mixed $key): bool => is_string($key), ARRAY_FILTER_USE_KEY) : [];
    }
}

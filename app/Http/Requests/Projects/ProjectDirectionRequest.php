<?php

namespace App\Http\Requests\Projects;

use App\Models\Workspace;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Beri arahan" (optionally on one update of the same project).
 */
class ProjectDirectionRequest extends FormRequest
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
        $workspace = $this->route('workspace');

        return [
            'body' => ['required', 'string', 'max:2000'],
            'project_update_id' => ['nullable', 'string', Rule::exists('project_updates', 'id')->where('workspace_id', $workspace instanceof Workspace ? $workspace->id : '')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Tulis arahan untuk PIC.',
            'body.max' => 'Arahan maksimal 2.000 karakter.',
            'project_update_id.exists' => 'Update proyek tidak ditemukan.',
        ];
    }

    public function body(): string
    {
        return $this->string('body')->trim()->toString();
    }

    public function updateId(): ?string
    {
        $id = $this->input('project_update_id');

        return is_string($id) && $id !== '' ? $id : null;
    }
}

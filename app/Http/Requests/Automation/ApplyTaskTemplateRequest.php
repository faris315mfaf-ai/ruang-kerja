<?php

namespace App\Http\Requests\Automation;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/** "Pakai template" (task): target workspace, title and optional due date. */
class ApplyTaskTemplateRequest extends FormRequest
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
        return [
            'workspace_id' => ['required', 'string', 'ulid'],
            'title' => ['required', 'string', 'max:255'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'workspace_id.required' => 'Pilih workspace.',
            'title.required' => 'Isi judul tugas.',
            'title.max' => 'Judul maksimal 255 karakter.',
            'due_date.date_format' => 'Tanggal tenggat tidak valid.',
        ];
    }

    public function workspace(): Workspace
    {
        /** @var User $user */
        $user = $this->user();

        return Workspace::query()->where('company_id', $user->company_id)->findOrFail($this->string('workspace_id')->toString());
    }

    /**
     * @return array{title: string, due_date: string|null}
     */
    public function payload(): array
    {
        $due = $this->input('due_date');

        return [
            'title' => $this->string('title')->trim()->toString(),
            'due_date' => is_string($due) && $due !== '' ? $due : null,
        ];
    }
}

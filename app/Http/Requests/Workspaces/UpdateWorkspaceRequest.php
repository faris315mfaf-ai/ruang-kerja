<?php

namespace App\Http\Requests\Workspaces;

use App\Domain\Tasks\Enums\PaletteColor;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Models\Workspace;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Pengaturan › Umum. Authorization: WorkspacePolicy::update.
 */
class UpdateWorkspaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('key'))) {
            $this->merge(['key' => WorkspaceKeyGenerator::normalize($this->input('key'))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $workspace = $this->route('workspace');
        $workspace = $workspace instanceof Workspace ? $workspace : null;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'key' => ['sometimes', 'required', 'string', 'regex:'.WorkspaceKeyGenerator::PATTERN, function (string $attribute, mixed $value, Closure $fail) use ($workspace): void {
                if ($workspace !== null && is_string($value) && $value !== $workspace->key
                    && app(WorkspaceKeyGenerator::class)->taken($workspace->company_id, $value, $workspace->id)) {
                    $fail("Key {$value} sudah dipakai workspace lain.");
                }
            }],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'visibility' => ['sometimes', 'required', Rule::enum(WorkspaceVisibility::class)],
            'color' => ['sometimes', 'required', Rule::enum(PaletteColor::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama workspace wajib diisi.',
            'name.max' => 'Nama workspace maksimal 120 karakter.',
            'key.required' => 'Key wajib diisi.',
            'key.regex' => 'Key 2–10 huruf kapital/angka dan diawali huruf, mis. PLQ.',
            'description.max' => 'Deskripsi maksimal 2.000 karakter.',
        ];
    }

    /**
     * @return array{name?: string, key?: string, description?: string|null, visibility?: WorkspaceVisibility, color?: string}
     */
    public function changes(): array
    {
        $changes = [];

        if ($this->has('name')) {
            $changes['name'] = $this->string('name')->trim()->toString();
        }

        if ($this->has('key')) {
            $changes['key'] = $this->string('key')->toString();
        }

        if ($this->has('description')) {
            $description = $this->string('description')->trim()->toString();
            $changes['description'] = $description === '' ? null : $description;
        }

        if ($this->has('visibility')) {
            $changes['visibility'] = WorkspaceVisibility::from($this->string('visibility')->toString());
        }

        if ($this->has('color')) {
            $changes['color'] = $this->string('color')->toString();
        }

        return $changes;
    }
}

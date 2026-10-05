<?php

namespace App\Http\Requests\Workspaces;

use App\Domain\Tasks\Enums\PaletteColor;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create (all fields) or update (any field) a board column.
 * Authorization: WorkspacePolicy::update / TaskStatusPolicy::update.
 */
class TaskStatusRequest extends FormRequest
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
            'name' => [$presence, 'string', 'max:60'],
            'category' => [$presence, Rule::enum(TaskStatusCategory::class)],
            'color' => [$this->isMethod('post') ? 'nullable' : 'sometimes', Rule::enum(PaletteColor::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama kolom wajib diisi.',
            'name.max' => 'Nama kolom maksimal 60 karakter.',
            'category.required' => 'Pilih kategori kolom.',
            'category.enum' => 'Kategori tidak valid.',
            'color.enum' => 'Warna tidak valid.',
        ];
    }

    /**
     * @return array{name?: string, category?: TaskStatusCategory, color?: string}
     */
    public function changes(): array
    {
        $changes = [];

        if ($this->filled('name')) {
            $changes['name'] = $this->string('name')->trim()->toString();
        }

        if ($this->filled('category')) {
            $changes['category'] = TaskStatusCategory::from($this->string('category')->toString());
        }

        if ($this->filled('color')) {
            $changes['color'] = $this->string('color')->toString();
        }

        return $changes;
    }
}

<?php

namespace App\Http\Requests\Workspaces;

use App\Domain\Tasks\Enums\PaletteColor;
use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use App\Models\Label;
use App\Models\Workspace;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create or update a label (name unique inside the workspace).
 */
class LabelRequest extends FormRequest
{
    use HidesInvisibleWorkspaces;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $workspace = $this->route('workspace');
        $label = $this->route('label');

        return [
            'name' => [
                'required', 'string', 'max:50',
                Rule::unique('labels', 'name')
                    ->where('workspace_id', $workspace instanceof Workspace ? $workspace->id : '')
                    ->ignore($label instanceof Label ? $label->id : null),
            ],
            'color' => ['required', Rule::enum(PaletteColor::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama label wajib diisi.',
            'name.max' => 'Nama label maksimal 50 karakter.',
            'name.unique' => 'Label dengan nama ini sudah ada.',
            'color.required' => 'Pilih warna label.',
            'color.enum' => 'Warna tidak valid.',
        ];
    }
}

<?php

namespace App\Http\Requests\Settings;

use App\Domain\Organization\Enums\Theme;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ThemeUpdateRequest extends FormRequest
{
    /**
     * Authorization is handled in the controller via UserPolicy::updateTheme.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'theme' => ['required', 'string', Rule::enum(Theme::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'theme.required' => 'Pilih tema.',
            'theme.string' => 'Tema tidak valid.',
            'theme.enum' => 'Tema tidak valid.',
        ];
    }

    public function theme(): Theme
    {
        return Theme::from($this->string('theme')->toString());
    }
}

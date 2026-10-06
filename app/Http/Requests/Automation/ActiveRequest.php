<?php

namespace App\Http\Requests\Automation;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/** Pause / resume switch of a rule or a recurring task. */
class ActiveRequest extends FormRequest
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
        return ['is_active' => ['required', 'boolean']];
    }
}

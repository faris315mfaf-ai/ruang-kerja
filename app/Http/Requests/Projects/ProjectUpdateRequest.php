<?php

namespace App\Http\Requests\Projects;

use App\Domain\Projects\Enums\ProjectHealth;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Update proyek" form. Authorization: ProjectUpdatePolicy::create.
 */
class ProjectUpdateRequest extends FormRequest
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
            'health' => ['required', Rule::enum(ProjectHealth::class)],
            'summary' => ['required', 'string', 'max:2000'],
            'blockers' => ['nullable', 'string', 'max:2000'],
            'decision_needed' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'health.required' => 'Pilih status kesehatan proyek.',
            'summary.required' => 'Ringkasan wajib diisi.',
            'summary.max' => 'Ringkasan maksimal 2.000 karakter.',
            'blockers.max' => 'Hambatan maksimal 2.000 karakter.',
            'decision_needed.max' => 'Keputusan yang dibutuhkan maksimal 1.000 karakter.',
        ];
    }

    /**
     * @return array{health: ProjectHealth, summary: string, blockers: string|null, decision_needed: string|null}
     */
    public function payload(): array
    {
        return [
            'health' => ProjectHealth::from($this->string('health')->toString()),
            'summary' => $this->string('summary')->trim()->toString(),
            'blockers' => $this->optionalText('blockers'),
            'decision_needed' => $this->optionalText('decision_needed'),
        ];
    }

    private function optionalText(string $key): ?string
    {
        $value = $this->string($key)->trim()->toString();

        return $value === '' ? null : $value;
    }
}

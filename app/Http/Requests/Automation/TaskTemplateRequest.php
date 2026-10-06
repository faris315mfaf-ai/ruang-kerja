<?php

namespace App\Http\Requests\Automation;

use App\Domain\Tasks\Enums\PaletteColor;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Template tugas baru": name, default title, checklist lines, estimate and
 * labels; `workspace_id` null = for all workspaces of the company. The
 * estimate rule and its message agree (0,5–999 jam; the DB checks it too).
 */
class TaskTemplateRequest extends FormRequest
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
        $colors = array_map(fn (PaletteColor $color): string => $color->value, PaletteColor::cases());

        return [
            'workspace_id' => ['nullable', 'string', 'ulid'],
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'priority' => ['required', 'integer', 'between:0,4'],
            'estimate_hours' => ['nullable', 'numeric', 'between:0.5,999'],
            'checklist' => ['present', 'array', 'max:30'],
            'checklist.*' => ['nullable', 'string', 'max:255'],
            'labels' => ['present', 'array', 'max:10'],
            'labels.*.name' => ['required', 'string', 'max:50'],
            'labels.*.color' => ['required', Rule::in($colors)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Beri nama template.',
            'name.max' => 'Nama maksimal 80 karakter.',
            'title.required' => 'Isi judul tugas bawaan.',
            'title.max' => 'Judul maksimal 255 karakter.',
            'estimate_hours.numeric' => 'Estimasi 0,5–999 jam.',
            'estimate_hours.between' => 'Estimasi 0,5–999 jam.',
            'checklist.max' => 'Checklist maksimal 30 butir.',
            'checklist.*.max' => 'Satu butir checklist maksimal 255 karakter.',
        ];
    }

    /**
     * The target workspace in the user's company; null = company-wide (or unknown id → 404 in the controller).
     */
    public function workspace(): ?Workspace
    {
        $id = $this->input('workspace_id');

        if (! is_string($id) || $id === '') {
            return null;
        }

        /** @var User $user */
        $user = $this->user();

        return Workspace::query()->where('company_id', $user->company_id)->findOrFail($id);
    }

    /**
     * @return array{name: string, description: string|null, title: string, priority: int, estimate_hours: float|null, checklist: list<string>, labels: list<array{name: string, color: string}>}
     */
    public function payload(): array
    {
        $estimate = $this->input('estimate_hours');

        /** @var list<string> $checklist */
        $checklist = collect((array) $this->input('checklist', []))
            ->map(fn (mixed $line): string => trim((string) $line))
            ->filter(fn (string $line): bool => $line !== '')
            ->values()
            ->all();

        /** @var list<array{name: string, color: string}> $labels */
        $labels = collect((array) $this->input('labels', []))
            ->filter(fn (mixed $label): bool => is_array($label))
            ->map(fn (array $label): array => ['name' => trim((string) ($label['name'] ?? '')), 'color' => (string) ($label['color'] ?? 'gray')])
            ->filter(fn (array $label): bool => $label['name'] !== '')
            ->unique(fn (array $label): string => mb_strtolower($label['name']))
            ->values()
            ->all();

        $description = $this->input('description');

        return [
            'name' => $this->string('name')->trim()->toString(),
            'description' => is_string($description) ? $description : null,
            'title' => $this->string('title')->trim()->toString(),
            'priority' => $this->integer('priority'),
            'estimate_hours' => $estimate === null || $estimate === '' ? null : round((float) $estimate, 2),
            'checklist' => $checklist,
            'labels' => $labels,
        ];
    }
}

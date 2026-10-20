<?php

namespace App\Http\Requests\HrHub;

use App\Domain\HrHub\Actions\AssignHrTask;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /hr/penugasan ("Beri tugas"). Recipients are expanded and checked
 * against the actor's company by AssignHrTask; the controller authorizes
 * with Gate `viewHrHub`.
 */
class AssignHrTaskRequest extends FormRequest
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
            'user_ids' => ['sometimes', 'array', 'max:'.AssignHrTask::MAX_RECIPIENTS],
            'user_ids.*' => ['string', 'size:26'],
            'division_ids' => ['sometimes', 'array', 'max:100'],
            'division_ids.*' => ['string', 'size:26'],
            'team_ids' => ['sometimes', 'array', 'max:100'],
            'team_ids.*' => ['string', 'size:26'],
            'mode' => ['required', Rule::in(['per_person', 'shared'])],
            'title' => ['required', 'string', 'max:255', 'not_regex:/^\s*$/'],
            'description_text' => ['nullable', 'string', 'max:20000'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'priority' => ['nullable', 'integer', 'between:0,4'],
            'checklist' => ['sometimes', 'array', 'max:'.AssignHrTask::MAX_CHECKLIST],
            'checklist.*' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul tugas wajib diisi.',
            'title.not_regex' => 'Judul tugas wajib diisi.',
            'title.max' => 'Judul tugas maksimal 255 karakter.',
            'mode.required' => 'Pilih cara memberi tugas.',
            'mode.in' => 'Pilih "Satu tugas per orang" atau "Satu tugas bersama".',
            'checklist.max' => 'Checklist maksimal '.AssignHrTask::MAX_CHECKLIST.' butir.',
            'user_ids.max' => 'Penerima maksimal '.AssignHrTask::MAX_RECIPIENTS.' orang.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'description_text' => 'instruksi',
            'due_date' => 'tenggat',
            'priority' => 'prioritas',
            'checklist.*' => 'butir checklist',
        ];
    }

    /**
     * @return array{user_ids: list<string>, division_ids: list<string>, team_ids: list<string>, mode: 'per_person'|'shared', title: string, description_text: string|null, due_date: string|null, priority: int, checklist: list<string>}
     */
    public function payload(): array
    {
        $list = fn (string $key): array => array_values(array_map(
            fn (mixed $id): string => strtolower((string) $id),
            array_filter((array) $this->input($key, []), 'is_string'),
        ));

        /** @var 'per_person'|'shared' $mode */
        $mode = $this->string('mode')->toString();

        return [
            'user_ids' => $list('user_ids'),
            'division_ids' => $list('division_ids'),
            'team_ids' => $list('team_ids'),
            'mode' => $mode,
            'title' => $this->string('title')->trim()->toString(),
            'description_text' => $this->filled('description_text') ? $this->string('description_text')->toString() : null,
            'due_date' => $this->filled('due_date') ? $this->string('due_date')->toString() : null,
            'priority' => $this->integer('priority'),
            'checklist' => array_values(array_filter((array) $this->input('checklist', []), 'is_string')),
        ];
    }
}

<?php

namespace App\Http\Requests\Api;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * GET /api/v1/tugas — query of the mobile "Tugas saya" list. Every filter is
 * optional and a list can be sent as `prioritas[]=1&prioritas[]=2` or as
 * `prioritas=1,2`. Authorization is the controller's (TaskPolicy::viewAny);
 * the list itself is always scoped to what the viewer may see.
 *
 *   scope      ditugaskan | saya-amati | saya-buat   (saya=1 = ditugaskan)
 *   workspace  keys or ids       prioritas  0-4      status  status categories
 *   label      label ids         penanggung user ids ("saya" = me)
 *   tenggat    overdue | today | week | none         tenggat_dari / tenggat_sampai
 *   q          title or KEY-n    selesai    minggu-ini (default) | tidak
 *   urut       tenggat | prioritas | dibuat | diperbarui | judul | workspace
 *   arah       asc | desc        per_page   1-50 (default 20)     page
 */
class TaskIndexRequest extends FormRequest
{
    private const array LISTS = ['workspace', 'prioritas', 'status', 'label', 'penanggung'];

    private const array SCOPES = ['ditugaskan' => 'assigned', 'saya-amati' => 'watching', 'saya-buat' => 'created'];

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
            'saya' => ['sometimes', 'boolean'],
            'scope' => ['sometimes', 'nullable', Rule::in(array_keys(self::SCOPES))],
            'workspace' => ['sometimes', 'array', 'max:20'],
            'workspace.*' => ['string', 'max:26'],
            'prioritas' => ['sometimes', 'array', 'max:5'],
            'prioritas.*' => ['integer', 'between:0,4'],
            'status' => ['sometimes', 'array', 'max:6'],
            'status.*' => [Rule::enum(TaskStatusCategory::class)],
            'label' => ['sometimes', 'array', 'max:20'],
            'label.*' => ['string', 'max:26'],
            'penanggung' => ['sometimes', 'array', 'max:20'],
            'penanggung.*' => ['string', 'max:26'],
            'tenggat' => ['sometimes', 'nullable', Rule::in(['overdue', 'today', 'week', 'none'])],
            'tenggat_dari' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'tenggat_sampai' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'q' => ['sometimes', 'nullable', 'string', 'max:200'],
            'selesai' => ['sometimes', 'nullable', Rule::in(['minggu-ini', 'tidak'])],
            'urut' => ['sometimes', 'nullable', Rule::in(['tenggat', 'prioritas', 'dibuat', 'diperbarui', 'judul', 'workspace'])],
            'arah' => ['sometimes', 'nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'between:1,50'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'scope.in' => 'Pilih ditugaskan, saya-amati, atau saya-buat.',
            'prioritas.*.between' => 'Prioritas tidak valid.',
            'status.*' => 'Status tidak valid.',
            'tenggat.in' => 'Filter tenggat tidak valid.',
            'tenggat_dari.date_format' => 'Tanggal awal tenggat tidak valid.',
            'tenggat_sampai.date_format' => 'Tanggal akhir tenggat tidak valid.',
            'selesai.in' => 'Pilih minggu-ini atau tidak.',
            'urut.in' => 'Urutan tidak dikenal.',
            'arah.in' => 'Arah urutan harus asc atau desc.',
            'per_page.between' => 'per_page harus antara 1 dan 50.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $lists = [];

        foreach (self::LISTS as $key) {
            $value = $this->input($key);

            if (is_string($value)) {
                $lists[$key] = array_values(array_filter(array_map('trim', explode(',', $value)), fn (string $part): bool => $part !== ''));
            }
        }

        if ($lists !== []) {
            $this->merge($lists);
        }
    }

    /**
     * The query-builder criteria of MyTaskList.
     *
     * @return array{scope: string|null, workspaces: list<string>, priorities: list<int>, statuses: list<string>, labels: list<string>, assignees: list<string>, due: string|null, due_from: string|null, due_to: string|null, q: string, completed: string, sort: string, direction: string}
     */
    public function criteria(): array
    {
        $scope = $this->filled('scope')
            ? self::SCOPES[$this->string('scope')->toString()]
            : ($this->boolean('saya') ? 'assigned' : null);

        $strings = fn (string $key): array => array_values(array_filter(
            (array) $this->input($key, []),
            fn (mixed $value): bool => is_string($value) && $value !== '',
        ));

        return [
            'scope' => $scope,
            'workspaces' => $strings('workspace'),
            'priorities' => array_values(array_map(intval(...), (array) $this->input('prioritas', []))),
            'statuses' => $strings('status'),
            'labels' => $strings('label'),
            'assignees' => array_map(fn (string $id): string => $id === 'saya' ? 'me' : $id, $strings('penanggung')),
            'due' => $this->filled('tenggat') ? $this->string('tenggat')->toString() : null,
            'due_from' => $this->filled('tenggat_dari') ? $this->string('tenggat_dari')->toString() : null,
            'due_to' => $this->filled('tenggat_sampai') ? $this->string('tenggat_sampai')->toString() : null,
            'q' => $this->string('q')->toString(),
            'completed' => $this->input('selesai') === 'tidak' ? 'none' : 'week',
            'sort' => match ($this->input('urut')) {
                'prioritas' => 'priority',
                'dibuat' => 'created',
                'diperbarui' => 'updated',
                'judul' => 'title',
                'workspace' => 'workspace',
                default => 'due',
            },
            'direction' => $this->input('arah') === 'desc' ? 'desc' : 'asc',
        ];
    }

    public function perPage(): int
    {
        return $this->integer('per_page', 20);
    }
}

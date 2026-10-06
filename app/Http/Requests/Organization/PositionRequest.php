<?php

namespace App\Http\Requests\Organization;

use App\Domain\Organization\Enums\PositionLevel;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Models\Position;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class PositionRequest extends OrganizationRequest
{
    protected function modelClass(): string
    {
        return Position::class;
    }

    protected function routeKey(): string
    {
        return 'position';
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120', $this->uniqueName()],
            'level' => ['required', 'integer', Rule::enum(PositionLevel::class)],
            'dashboard_role' => ['nullable', 'string', Rule::enum(DashboardRole::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama jabatan wajib diisi.',
            'name.max' => 'Nama jabatan maksimal 120 karakter.',
            'level.required' => 'Pilih level jabatan.',
            'level.integer' => 'Level jabatan tidak valid.',
            'level.enum' => 'Level jabatan tidak valid.',
            'dashboard_role.enum' => 'Dashboard jabatan tidak valid.',
        ];
    }

    /**
     * @return array{name: string, level: int, dashboard_role?: DashboardRole|null}
     */
    public function payload(): array
    {
        $payload = [
            'name' => $this->string('name')->toString(),
            'level' => $this->integer('level'),
        ];

        // Only when sent: older clients (and the field hidden while the
        // role_dashboards flag is off) never clear an existing mapping.
        if ($this->exists('dashboard_role')) {
            $payload['dashboard_role'] = $this->enum('dashboard_role', DashboardRole::class);
        }

        return $payload;
    }

    /**
     * Case-insensitive unique name among the company's active positions.
     */
    private function uniqueName(): Closure
    {
        $position = $this->route('position');
        $ignoreId = $position instanceof Position ? $position->id : null;
        $companyId = $this->actor()->company_id;

        return function (string $attribute, mixed $value, Closure $fail) use ($ignoreId, $companyId): void {
            if (! is_string($value)) {
                return;
            }

            $exists = Position::query()
                ->where('company_id', $companyId)
                ->whereRaw('lower(name) = ?', [mb_strtolower($value)])
                ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
                ->exists();

            if ($exists) {
                $fail("Jabatan {$value} sudah ada.");
            }
        };
    }
}

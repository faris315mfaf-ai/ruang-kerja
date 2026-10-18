<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One date for one employee: another shift, a day off (no shift) or another
 * work mode. Authorization: ShiftAssignmentPolicy in the controller.
 */
class ShiftOverrideRequest extends FormRequest
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
        $companyId = $this->user()?->company_id;

        return [
            'user_id' => ['required', 'string', Rule::exists(User::class, 'id')->where('company_id', $companyId)],
            'date' => ['required', 'date_format:Y-m-d'],
            'shift_id' => ['nullable', 'string', Rule::exists(Shift::class, 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'work_mode_override' => ['nullable', Rule::enum(WorkMode::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'user_id' => 'karyawan',
            'date' => 'tanggal',
            'shift_id' => 'shift',
            'work_mode_override' => 'mode kerja',
        ];
    }

    public function employee(): User
    {
        return User::query()->findOrFail($this->string('user_id')->toString());
    }

    public function shift(): ?Shift
    {
        return $this->filled('shift_id') ? Shift::query()->findOrFail($this->string('shift_id')->toString()) : null;
    }

    public function overrideDate(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('date')->toString(), CurrentCompany::timezone());
    }

    public function workModeOverride(): ?WorkMode
    {
        return $this->filled('work_mode_override') ? WorkMode::from($this->string('work_mode_override')->toString()) : null;
    }
}

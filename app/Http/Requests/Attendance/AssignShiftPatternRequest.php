<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Division;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Weekly pattern for selected employees or a whole division (incl. sub-divisions).
 * Authorization: ShiftAssignmentPolicy in the controller.
 */
class AssignShiftPatternRequest extends FormRequest
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
            'target' => ['required', Rule::in(['employees', 'division'])],
            'user_ids' => ['required_if:target,employees', 'array', 'max:500'],
            'user_ids.*' => ['string', Rule::exists(User::class, 'id')->where('company_id', $companyId)],
            'division_id' => ['required_if:target,division', 'nullable', 'string', Rule::exists(Division::class, 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'shift_id' => ['required', 'string', Rule::exists(Shift::class, 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'weekdays' => ['required', 'array', 'min:1', 'max:7'],
            'weekdays.*' => ['integer', 'between:1,7', 'distinct'],
            'valid_from' => ['required', 'date_format:Y-m-d'],
            'valid_until' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:valid_from'],
            'work_mode_override' => ['nullable', Rule::enum(WorkMode::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'user_ids' => 'karyawan',
            'division_id' => 'divisi',
            'shift_id' => 'shift',
            'weekdays' => 'hari kerja',
            'valid_from' => 'berlaku mulai',
            'valid_until' => 'berlaku sampai',
            'work_mode_override' => 'mode kerja',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_ids.required_if' => 'Pilih minimal satu karyawan.',
            'division_id.required_if' => 'Pilih divisi.',
            'weekdays.required' => 'Pilih minimal satu hari kerja.',
            'weekdays.min' => 'Pilih minimal satu hari kerja.',
        ];
    }

    /**
     * Active employees targeted by the request, within the actor's company.
     *
     * @return Collection<int, User>
     */
    public function employees(User $actor): Collection
    {
        $query = User::query()->visibleTo($actor)->active()->orderBy('name');

        if ($this->input('target') === 'division') {
            return $query->whereIn('division_id', Division::withDescendantIds([$this->string('division_id')->toString()]))->get();
        }

        /** @var list<string> $ids */
        $ids = array_values(array_filter((array) $this->input('user_ids', []), is_string(...)));

        return $query->whereIn('id', $ids)->get();
    }

    public function shift(): Shift
    {
        return Shift::query()->findOrFail($this->string('shift_id')->toString());
    }

    /**
     * @return list<int>
     */
    public function weekdays(): array
    {
        return array_values(array_map(intval(...), (array) $this->input('weekdays', [])));
    }

    public function validFrom(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('valid_from')->toString(), config()->string('app.office_timezone'));
    }

    public function validUntil(): ?CarbonImmutable
    {
        return $this->filled('valid_until')
            ? CarbonImmutable::parse($this->string('valid_until')->toString(), config()->string('app.office_timezone'))
            : null;
    }

    public function workModeOverride(): ?WorkMode
    {
        return $this->filled('work_mode_override') ? WorkMode::from($this->string('work_mode_override')->toString()) : null;
    }
}

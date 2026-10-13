<?php

namespace App\Http\Requests\Admin;

use App\Domain\Requests\Enums\RequestCategory;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveLeaveTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => mb_strtoupper(trim($this->input('code')))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->user();
        $type = $this->route('leaveType');

        return [
            // Unique per company, including soft-deleted types (old numbers keep their meaning).
            'code' => ['required', 'string', 'regex:/^[A-Z0-9]{2,10}$/', Rule::unique('leave_types', 'code')
                ->where('company_id', $user instanceof User ? $user->company_id : null)
                ->ignore($type instanceof LeaveType ? $type->id : null)],
            'name' => ['required', 'string', 'max:120'],
            'category' => ['required', Rule::enum(RequestCategory::class)],
            'description' => ['nullable', 'string', 'max:255'],
            'annual_quota_days' => ['nullable', 'numeric', 'min:0', 'max:365', 'multiple_of:0.5'],
            'carry_over_max_days' => ['nullable', 'numeric', 'min:0', 'max:365', 'multiple_of:0.5'],
            'requires_attachment_after_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'max_backdate_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'submit_cutoff_time' => ['nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'min_service_months' => ['nullable', 'integer', 'min:0', 'max:600'],
            'allow_half_day' => ['sometimes', 'boolean'],
            'counts_calendar_days' => ['sometimes', 'boolean'],
            'max_days_per_request' => ['nullable', 'numeric', 'min:0.5', 'max:366', 'multiple_of:0.5'],
            'is_paid' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'is_locked' => ['sometimes', 'boolean'],
            'locked_reason' => ['nullable', 'string', 'max:200'],
            'approval_flow_id' => ['nullable', 'string', 'ulid'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.required' => 'Kode wajib diisi.',
            'code.regex' => 'Kode 2–10 huruf besar/angka, mis. CUT.',
            'code.unique' => 'Kode sudah dipakai jenis lain.',
            'name.required' => 'Nama wajib diisi.',
            'category.required' => 'Pilih kategori.',
            '*.numeric' => 'Harus berupa angka.',
            '*.integer' => 'Harus berupa bilangan bulat.',
            'max_days_per_request.min' => 'Minimal 0,5 hari.',
            'submit_cutoff_time.regex' => 'Isi jam dengan format JJ:MM, mis. 12:00.',
            'locked_reason.max' => 'Alasan kunci maksimal :max karakter.',
            '*.min' => 'Tidak boleh negatif.',
            '*.multiple_of' => 'Kelipatan 0,5 hari.',
        ];
    }
}

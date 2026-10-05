<?php

namespace App\Http\Requests\Requests;

use App\Domain\Requests\Data\RequestInput;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Request form (any category). Business rules (period, overlap, balance,
 * attachments by duration) are checked by the actions.
 */
class SaveEmployeeRequestRequest extends FormRequest
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
        $user = $this->user();
        $companyId = $user instanceof User ? $user->company_id : null;
        $attachments = config()->array('requests.attachments');

        return [
            'intent' => ['required', Rule::in(['submit', 'draft'])],
            'leave_type_id' => ['required', 'string', Rule::exists('leave_types', 'id')->where(
                fn (Builder $query) => $query->where('company_id', $companyId)->whereNull('deleted_at'),
            )],
            'reason' => ['required_if:intent,submit', 'nullable', 'string', 'max:'.config()->integer('requests.reason_max_length', 500)],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'check_in' => ['nullable', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i'],
            'half_day' => ['sometimes', 'boolean'],
            'destination' => ['nullable', 'string', 'max:160'],
            'substitute_id' => ['nullable', 'string', Rule::exists('users', 'id')->where('company_id', $companyId)],
            'attachments' => ['nullable', 'array', 'max:'.(int) ($attachments['max_files'] ?? 5)],
            'attachments.*' => ['file', 'mimes:'.implode(',', (array) ($attachments['mimes'] ?? ['pdf'])), 'max:'.(int) ($attachments['max_kilobytes'] ?? 5120)],
            'remove_attachments' => ['nullable', 'array'],
            'remove_attachments.*' => ['integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'leave_type_id.required' => 'Pilih jenis pengajuan.',
            'leave_type_id.exists' => 'Jenis pengajuan tidak tersedia.',
            'reason.required_if' => 'Alasan wajib diisi.',
            'reason.max' => 'Alasan maksimal :max karakter.',
            '*.date_format' => 'Format tidak valid.',
            'attachments.max' => 'Maksimal :max lampiran.',
            'attachments.*.mimes' => 'Lampiran harus PDF, JPG, atau PNG.',
            'attachments.*.max' => 'Ukuran lampiran maksimal 5 MB.',
            'substitute_id.exists' => 'Pengganti tidak valid.',
        ];
    }

    public function isDraft(): bool
    {
        return $this->input('intent') === 'draft';
    }

    public function toInput(): RequestInput
    {
        $type = LeaveType::query()->findOrFail($this->string('leave_type_id')->toString());

        /** @var array<string, mixed> $data */
        $data = [...$this->validated(), 'attachments' => $this->file('attachments', [])];

        return RequestInput::fromArray($type, $data);
    }
}

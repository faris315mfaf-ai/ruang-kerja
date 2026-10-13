<?php

namespace App\Http\Requests\Api\Pengajuan;

use App\Http\Requests\Requests\SaveEmployeeRequestRequest;
use App\Http\Resources\Api\RequestFormValues;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Draft save, draft/revision edit and (re)submit of the mobile app — the web
 * request form (rules, Indonesian messages, toInput) with three conveniences:
 *
 * - `type` is accepted for `leave_type_id` (like POST /pengajuan);
 * - the intent comes from the route (draf/ubah = draft, kirim/kirim-ulang =
 *   submit), never from the body;
 * - on an existing request the fields sent are merged over its stored form
 *   values (RequestFormValues), so the app may send only what changed;
 * - `mode` (izin: `days` | `hours`) clears the fields of the other mode.
 *
 * Business rules (period, overlap, locked type, backdate, attachment rule,
 * balance) stay in SaveRequestDraft / SubmitRequest.
 */
final class SaveRequestApiRequest extends SaveEmployeeRequestRequest
{
    private const array DRAFT_ROUTES = ['api.v1.requests.draft', 'api.v1.requests.update'];

    protected function prepareForValidation(): void
    {
        $existing = $this->route('employeeRequest');

        if ($existing instanceof EmployeeRequest) {
            $user = $this->user();

            // Someone else's request never resolves (no leak of its existence).
            if (! $user instanceof User || $existing->user_id !== $user->id) {
                abort(404);
            }

            if (! $existing->status->isEditable()) {
                throw ValidationException::withMessages(['status' => 'Pengajuan ini tidak bisa diubah lagi.']);
            }
        }

        $base = $existing instanceof EmployeeRequest ? RequestFormValues::of($existing) : [];

        /** @var array<string, mixed> $sent */
        $sent = $this->input();

        if (array_key_exists('type', $sent) && ! array_key_exists('leave_type_id', $sent)) {
            $sent['leave_type_id'] = $sent['type'];
        }

        unset($sent['type'], $sent['intent']);
        $values = [...$base, ...$sent];

        if (($values['mode'] ?? null) === 'days') {
            $values['start_time'] = null;
            $values['end_time'] = null;
        } elseif (($values['mode'] ?? null) === 'hours') {
            $values['start_date'] = null;
            $values['end_date'] = null;
            $values['half_day'] = false;
        }

        $values['intent'] = $this->routeIs(...self::DRAFT_ROUTES) ? 'draft' : 'submit';

        $this->replace($values);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'mode' => ['nullable', Rule::in(['days', 'hours'])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'mode.in' => 'Pilih izin per hari atau per jam.',
        ];
    }
}

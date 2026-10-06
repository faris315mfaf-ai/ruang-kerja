<?php

namespace App\Http\Requests\Monitoring;

use App\Models\ManagementNote;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Create (POST: body required) or change (PATCH: any of body, due_on, done)
 * a "catatan tindakan". Authorized before validation, so another person's
 * note answers 404 whatever the payload (ManagementNotePolicy).
 */
class ManagementNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        $note = $this->route('managementNote');

        if ($note instanceof ManagementNote) {
            Gate::authorize('update', $note);
        } else {
            Gate::authorize('create', ManagementNote::class);
        }

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $creating = $this->isMethod('post');

        return [
            'body' => [$creating ? 'required' : 'sometimes', 'string', 'max:500', 'not_regex:/^\s*$/'],
            'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'done' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Tulis catatan tindakan.',
            'body.not_regex' => 'Tulis catatan tindakan.',
            'body.max' => 'Catatan maksimal 500 karakter.',
            'due_on.date_format' => 'Tanggal tidak valid.',
        ];
    }

    /**
     * @return array{body?: string, due_on?: string|null, done?: bool}
     */
    public function changes(): array
    {
        $changes = [];

        if ($this->has('body')) {
            $changes['body'] = $this->string('body')->toString();
        }

        if ($this->exists('due_on')) {
            $due = $this->input('due_on');
            $changes['due_on'] = is_string($due) && $due !== '' ? $due : null;
        }

        if ($this->has('done')) {
            $changes['done'] = $this->boolean('done');
        }

        return $changes;
    }
}

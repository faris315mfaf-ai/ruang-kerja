<?php

namespace App\Http\Requests\Notes;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * State pushed by the collab server (secret checked by VerifyCollabSecret):
 * base64 Yjs update, the ProseMirror snapshot (`body`) and who edited since
 * the previous store.
 */
class CollabStateRequest extends FormRequest
{
    /** Base64 of ~6 MB of Yjs state. */
    public const int MAX_STATE_LENGTH = 8_000_000;

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
            'yjs_state' => ['required', 'string', 'max:'.self::MAX_STATE_LENGTH],
            'body' => ['present', 'nullable', 'array'],
            'editor_ids' => ['present', 'array', 'max:50'],
            'editor_ids.*' => ['string', 'ulid'],
        ];
    }
}

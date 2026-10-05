<?php

namespace App\Http\Requests\Tasks;

use App\Rules\RichTextDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Post or edit a comment: `body` is a Tiptap document. Authorization in the
 * controller (CommentPolicy).
 */
class CommentRequest extends FormRequest
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
            'body' => ['required', 'array', new RichTextDocument],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Komentar tidak boleh kosong.',
            'body.array' => 'Format komentar tidak valid.',
        ];
    }

    /**
     * @return array<mixed>
     */
    public function body(): array
    {
        $body = $this->input('body');

        return is_array($body) ? $body : [];
    }
}

<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/tugas/{task}/komentar — a plain-text comment from the mobile
 * app. The web body is a Tiptap document; the app sends a string, which the
 * controller wraps into the same minimal document (RichText::fromText), so
 * PostComment, its mentions and its notifications run unchanged. Someone who
 * may not see the task gets 404 before validation (HidesInvisibleWorkspaces);
 * the controller still checks TaskPolicy::comment.
 */
class TaskCommentRequest extends FormRequest
{
    use HidesInvisibleWorkspaces;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:20000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Komentar tidak boleh kosong.',
            'body.max' => 'Komentar maksimal 20.000 karakter.',
        ];
    }
}

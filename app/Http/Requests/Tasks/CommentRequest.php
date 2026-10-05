<?php

namespace App\Http\Requests\Tasks;

use App\Models\Comment;
use App\Models\Task;
use App\Rules\RichTextDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Post or edit a comment: `body` is a Tiptap document. Write authorization in
 * the controller (CommentPolicy); authorize() first answers 404 to people who
 * cannot see the task, before any validation message is returned.
 */
class CommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $task = $this->route('task');
        $comment = $this->route('comment');

        if ($task instanceof Task) {
            Gate::authorize('view', $task);
        }

        if ($comment instanceof Comment) {
            Gate::authorize('view', $comment);
        }

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

<?php

namespace App\Http\Requests\Api;

use App\Domain\Tasks\Services\CommentDocument;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * POST /api/v1/tugas/{task}/komentar and PATCH /api/v1/komentar/{comment} — a
 * comment from the mobile app. The web body is a Tiptap document; the app
 * sends `body` as plain text plus the people (`mentions`, user ids) and tasks
 * (`task_refs`, task ids) it picked with the "@" / "#" pickers, and the
 * server builds the same document the web editor produces
 * (CommentDocument): `@Nama` and `#KEY-n` in the text become mention and
 * #rujukan nodes. PostComment/UpdateComment then keep only mentions of
 * people who can see the workspace and references the author can see.
 * Someone who may not see the task gets 404 before validation; the
 * controller still checks CommentPolicy.
 */
class TaskCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $task = $this->route('task');
        $comment = $this->route('comment');

        $visible = $user instanceof User
            && (! $task instanceof Task || Gate::forUser($user)->allows('view', $task))
            && (! $comment instanceof Comment || Gate::forUser($user)->allows('view', $comment));

        abort_unless($visible, 404);

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:20000'],
            'mentions' => ['sometimes', 'nullable', 'array', 'max:20'],
            'mentions.*' => ['string', 'size:26', 'distinct'],
            'task_refs' => ['sometimes', 'nullable', 'array', 'max:20'],
            'task_refs.*' => ['string', 'size:26', 'distinct'],
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
            'mentions.max' => 'Maksimal 20 orang bisa disebut dalam satu komentar.',
            'mentions.*.size' => 'Pengguna yang disebut tidak valid.',
            'task_refs.max' => 'Maksimal 20 tugas bisa dirujuk dalam satu komentar.',
            'task_refs.*.size' => 'Tugas yang dirujuk tidak valid.',
        ];
    }

    /**
     * The Tiptap document of the request: the text with the picked people and
     * tasks turned into mention / taskReference nodes.
     *
     * @return array<mixed>
     */
    public function document(User $author): array
    {
        $ids = fn (string $key): array => array_values(array_unique(array_map(
            fn (mixed $id): string => strtolower((string) $id),
            array_filter((array) $this->input($key, []), 'is_string'),
        )));

        $people = $ids('mentions') === [] ? [] : User::query()
            ->where('company_id', $author->company_id)
            ->active()
            ->whereIn('id', $ids('mentions'))
            ->pluck('name', 'id')
            ->all();

        $tasks = $ids('task_refs') === [] ? [] : Task::query()
            ->visibleTo($author)
            ->whereIn('tasks.id', $ids('task_refs'))
            ->with('workspace:id,key')
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number'])
            ->mapWithKeys(fn (Task $task): array => [$task->id => $task->displayKey()])
            ->all();

        return CommentDocument::build($this->string('body')->toString(), $people, $tasks) ?? [];
    }
}

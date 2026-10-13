<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\ToggleReaction;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\TaskCommentPresenter;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Emoji reactions on a task comment (the fixed Reaction::EMOJI set). The web
 * endpoint toggles; the app sets (POST) or clears (DELETE) one explicitly, so
 * a retried request after a dropped connection never flips it back. Both run
 * the web ToggleReaction behind CommentPolicy::react and answer with the
 * fresh comment and whether the reaction is now there (`active`).
 */
class TaskCommentReactionController extends Controller
{
    public function __construct(
        private readonly ToggleReaction $toggle,
        private readonly TaskCommentPresenter $presenter,
    ) {}

    public function store(Request $request, Comment $comment, #[CurrentUser] User $user): JsonResponse
    {
        return $this->set($request, $comment, $user, true);
    }

    public function destroy(Request $request, Comment $comment, #[CurrentUser] User $user): JsonResponse
    {
        return $this->set($request, $comment, $user, false);
    }

    private function set(Request $request, Comment $comment, User $user, bool $wanted): JsonResponse
    {
        Gate::authorize('view', $comment);
        Gate::authorize('react', $comment);

        $emoji = (string) $request->validate(
            ['emoji' => ['required', 'string', Rule::in(Reaction::EMOJI)]],
            ['emoji.required' => 'Pilih reaksi.', 'emoji.in' => 'Reaksi tidak tersedia.'],
        )['emoji'];

        $has = $comment->reactions()->where('user_id', $user->id)->where('emoji', $emoji)->exists();

        if ($has !== $wanted) {
            $this->toggle->handle($comment, $user, $emoji);
        }

        $comment->unsetRelation('reactions');
        $task = $comment->commentable;
        abort_unless($task instanceof Task, 404);
        $task->loadMissing('workspace');

        return response()->json([
            'active' => $wanted,
            'comment' => $this->presenter->present($comment, $user, $this->presenter->rights($task, $user)),
        ]);
    }
}

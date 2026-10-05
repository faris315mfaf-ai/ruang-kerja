<?php

namespace App\Policies;

use App\Models\Comment;
use App\Models\Reaction;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Reactions are toggled through CommentPolicy::react; a reaction itself is
 * visible with its comment and removable only by its author.
 */
class ReactionPolicy
{
    public function __construct(private readonly CommentPolicy $comments) {}

    public function view(User $user, Reaction $reaction): Response
    {
        $comment = $reaction->reactable;

        return $comment instanceof Comment ? $this->comments->view($user, $comment) : Response::denyAsNotFound();
    }

    public function delete(User $user, Reaction $reaction): Response
    {
        $comment = $reaction->reactable;

        if (! $comment instanceof Comment) {
            return Response::denyAsNotFound();
        }

        $react = $this->comments->react($user, $comment);

        if ($react->denied()) {
            return $react;
        }

        return $reaction->user_id === $user->id ? Response::allow() : Response::deny('Hanya pemberi reaksi yang dapat menghapusnya.');
    }
}

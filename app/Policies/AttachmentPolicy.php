<?php

namespace App\Policies;

use App\Models\Attachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

/**
 * Attachments inherit the authorization of their parent (task, comment,
 * request, …): view needs `view` on the parent, adding and removing need
 * `update` (task: may edit the task; comment: its author). Uploading alone
 * gives no removal right — a member demoted to viewer cannot detach.
 * A soft-deleted parent (deleted comment) does not resolve: everything is denied.
 */
class AttachmentPolicy
{
    public function view(User $user, Attachment $attachment): bool
    {
        $parent = $attachment->attachable;

        return $parent !== null && Gate::forUser($user)->allows('view', $parent);
    }

    /**
     * Gate::authorize('create', [Attachment::class, $task]).
     */
    public function create(User $user, Model $attachable): bool
    {
        return Gate::forUser($user)->allows('update', $attachable);
    }

    public function delete(User $user, Attachment $attachment): bool
    {
        $parent = $attachment->attachable;

        if ($parent === null) {
            return false;
        }

        return Gate::forUser($user)->allows('update', $parent);
    }
}

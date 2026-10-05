<?php

namespace App\Policies;

use App\Models\Attachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

/**
 * Attachments inherit the authorization of their parent (task, comment,
 * request, …): view needs `view` on the parent, adding needs `update`.
 * The uploader may remove their own attachment while they can still see
 * the parent.
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

        $gate = Gate::forUser($user);

        return $gate->allows('update', $parent)
            || ($attachment->uploaded_by === $user->id && $gate->allows('view', $parent));
    }
}

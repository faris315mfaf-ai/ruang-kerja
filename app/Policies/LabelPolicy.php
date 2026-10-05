<?php

namespace App\Policies;

use App\Models\Label;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Labels are part of the workspace settings.
 */
class LabelPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function update(User $user, Label $label): Response
    {
        return $this->workspaces->update($user, $label->workspace);
    }

    public function delete(User $user, Label $label): Response
    {
        return $this->workspaces->update($user, $label->workspace);
    }
}

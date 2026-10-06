<?php

namespace App\Domain\Automation\Actions;

use App\Models\WorkspaceTemplate;

/**
 * Deletes a workspace template. Workspaces created from it stay.
 */
final class DeleteWorkspaceTemplate
{
    public function handle(WorkspaceTemplate $template): void
    {
        $template->delete();
    }
}

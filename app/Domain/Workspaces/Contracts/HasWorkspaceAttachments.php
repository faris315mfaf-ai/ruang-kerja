<?php

namespace App\Domain\Workspaces\Contracts;

use App\Models\Workspace;

/**
 * A model that can carry Drive attachments (task, comment): its files
 * go to the Drive folder of `attachmentWorkspace()`. Register the model in
 * AttachableTypes to expose it through /lampiran/{type}/{id}, and give it a
 * `attachments()` morphMany relation for its own pages.
 * Authorization comes from the model's own policy (`view` / `update`).
 */
interface HasWorkspaceAttachments
{
    public function attachmentWorkspace(): Workspace;
}

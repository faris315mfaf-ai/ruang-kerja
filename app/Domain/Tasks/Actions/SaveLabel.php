<?php

namespace App\Domain\Tasks\Actions;

use App\Models\Label;
use App\Models\Workspace;

/**
 * Creates a label, or updates it when $label is given.
 */
final class SaveLabel
{
    public function handle(Workspace $workspace, string $name, string $color, ?Label $label = null): Label
    {
        $label ??= new Label(['workspace_id' => $workspace->id]);
        $label->fill(['name' => $name, 'color' => $color]);
        $label->save();

        return $label;
    }
}

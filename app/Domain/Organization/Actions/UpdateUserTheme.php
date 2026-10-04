<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Enums\Theme;
use App\Models\User;

final class UpdateUserTheme
{
    public function handle(User $user, Theme $theme): void
    {
        $user->theme = $theme;
        $user->save();
    }
}

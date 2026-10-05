<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Notifications\TestNotification;
use App\Models\User;

final class SendTestNotification
{
    public function handle(User $user): void
    {
        $user->notify(new TestNotification);
    }
}

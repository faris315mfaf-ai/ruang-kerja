<?php

namespace App\Http\Controllers\Notifications;

use App\Domain\Notifications\Actions\SendTestNotification;
use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class TestNotificationController extends Controller
{
    public function store(#[CurrentUser] User $user, SendTestNotification $send): RedirectResponse
    {
        Gate::authorize('manage', [NotificationPreference::class, $user]);

        $send->handle($user);

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Notifikasi uji dikirim. Periksa lonceng dan Inbox.',
        ]);
    }
}

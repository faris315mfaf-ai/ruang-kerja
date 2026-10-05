<?php

namespace App\Http\Controllers\Notifications;

use App\Domain\Notifications\Enums\NotificationCategory;
use App\Domain\Notifications\Services\InboxQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\InboxIndexRequest;
use App\Http\Resources\InboxNotificationResource;
use App\Models\InboxNotification;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class InboxController extends Controller
{
    public function index(InboxIndexRequest $request, #[CurrentUser] User $user, InboxQuery $inbox): Response
    {
        Gate::authorize('viewAny', InboxNotification::class);

        $filters = $request->filters();

        return Inertia::render('inbox/index', [
            'items' => Inertia::scroll(fn () => InboxNotificationResource::collection($inbox->paginate($user, $filters))),
            'counts' => fn () => $inbox->counts($user),
            'filters' => $filters->toArray(),
            'kinds' => [
                ['value' => 'mention', 'label' => 'Disebut'],
                ...array_map(fn (NotificationCategory $category): array => [
                    'value' => $category->value,
                    'label' => $category->label(),
                ], NotificationCategory::cases()),
            ],
            'retentionDays' => config()->integer('notifications.retention_days', 30),
        ]);
    }
}

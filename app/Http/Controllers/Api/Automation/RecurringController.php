<?php

namespace App\Http\Controllers\Api\Automation;

use App\Domain\Automation\Queries\RecurringPage;
use App\Domain\Automation\Services\RecurrenceSchedule;
use App\Http\Controllers\Controller;
use App\Models\RecurringTask;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/otomasi/berulang?workspace= — recurring tasks of the workspaces
 * the caller belongs to (behind features.automation). Read-only on the phone:
 * creating, pausing and running them stays on the desktop. The rows are the
 * web RecurringPage items (so `can_manage` mirrors RecurringTaskPolicy) plus
 * the workspace, the assignee name, the Indonesian pattern sentence and the
 * next three dates.
 */
class RecurringController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, RecurringPage $page): JsonResponse
    {
        Gate::authorize('viewAny', RecurringTask::class);

        $request->validate(['workspace' => ['nullable', 'string', 'max:30']]);

        $data = $page->for($user, CarbonImmutable::now());
        $workspaces = array_column($data['workspaces'], null, 'id');
        $people = array_column($data['people'], null, 'id');
        $filter = $request->filled('workspace') ? strtolower($request->string('workspace')->toString()) : null;
        $today = (string) $data['today'];

        $items = [];

        foreach ($data['recurring'] as $item) {
            $workspace = $workspaces[$item['workspace_id']] ?? null;

            if ($filter !== null && $item['workspace_id'] !== $filter && ($workspace === null || strtolower((string) $workspace['key']) !== $filter)) {
                continue;
            }

            $items[] = [
                ...$item,
                'workspace' => $workspace === null ? null : ['id' => $workspace['id'], 'key' => $workspace['key'], 'name' => $workspace['name']],
                'assignee_name' => $item['assignee_id'] === null ? null : ($people[$item['assignee_id']]['name'] ?? null),
                'pattern_label' => RecurrenceSchedule::describe($item['pattern']),
                'next_dates' => $item['is_active']
                    ? RecurrenceSchedule::nextOccurrences($item['pattern'], $item['starts_on'], $item['ends_on'], $today, 3)
                    : [],
            ];
        }

        return response()->json([
            'berulang' => $items,
            'today' => $today,
            'create_on_desktop' => true,
        ]);
    }
}

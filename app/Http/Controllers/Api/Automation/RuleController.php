<?php

namespace App\Http\Controllers\Api\Automation;

use App\Domain\Automation\Actions\SetAutomationRuleActive;
use App\Domain\Automation\Enums\RunResult;
use App\Domain\Automation\Services\AutomationAccess;
use App\Domain\Automation\Services\RuleSentence;
use App\Http\Controllers\Controller;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Label;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * Automation rules on the phone (behind features.automation, 404 while off).
 * Reading follows the web page: rules are seen by the members of their
 * workspace only (AutomationRule::visibleTo / AutomationRulePolicy). The app
 * can pause and resume a rule — owner/admin of the workspace only, the web
 * `update` policy; creating, editing, duplicating and deleting rules stays
 * on the desktop (docs/PLATFORM.md §3). Rows carry the "Jika … maka …"
 * sentence so the app does not rebuild it from ids.
 */
class RuleController extends Controller
{
    public const int RUN_LIMIT = 30;

    /**
     * GET /otomasi/aturan?workspace={id|key} — the rules of the workspaces
     * the caller belongs to, newest first, with the 7-day counters.
     */
    public function index(Request $request, #[CurrentUser] User $user, AutomationAccess $access): JsonResponse
    {
        Gate::authorize('viewAny', AutomationRule::class);

        $request->validate(['workspace' => ['nullable', 'string', 'max:30']]);

        $query = AutomationRule::query()
            ->visibleTo($user)
            ->with('workspace:id,company_id,key,name,type,owner_id,archived_at')
            ->latest('created_at')
            ->orderByDesc('id');

        if ($request->filled('workspace')) {
            $ref = $request->string('workspace')->toString();
            $workspaceId = strlen($ref) === 26 ? strtolower($ref) : Workspace::findByKey($ref, $user->company_id)?->id;

            // An unknown (or other people's) workspace simply has no rules.
            $query->where('automation_rules.workspace_id', $workspaceId ?? '');
        }

        $rules = $query->get();
        $since = CarbonImmutable::now()->subDays(7);

        /** @var array<string, array{success: int, failed: int, total: int}> $stats */
        $stats = [];
        if ($rules->isNotEmpty()) {
            foreach (AutomationRun::query()
                ->whereIn('rule_id', $rules->pluck('id')->all())
                ->where('ran_at', '>=', $since)
                ->selectRaw('rule_id, count(*) as total')
                ->selectRaw('count(*) filter (where result = ?) as success', [RunResult::Success->value])
                ->selectRaw('count(*) filter (where result = ?) as failed', [RunResult::Failed->value])
                ->groupBy('rule_id')
                ->toBase()
                ->get() as $row) {
                $stats[$row->rule_id] = ['total' => (int) $row->total, 'success' => (int) $row->success, 'failed' => (int) $row->failed];
            }
        }

        $sentence = $this->sentence($rules);
        $manage = $this->manageMap($rules, $user, $access);

        return response()->json([
            'aturan' => $rules->map(fn (AutomationRule $rule): array => $this->present($rule, $sentence, $manage[$rule->workspace_id] ?? false)
                + ['runs_7d' => $stats[$rule->id]['total'] ?? 0, 'failed_7d' => $stats[$rule->id]['failed'] ?? 0])->values()->all(),
            'stats' => [
                'rules' => $rules->count(),
                'active' => $rules->where('is_active', true)->count(),
                'runs_7d' => array_sum(array_column($stats, 'total')),
                'success_7d' => array_sum(array_column($stats, 'success')),
                'failed_7d' => array_sum(array_column($stats, 'failed')),
            ],
            'create_on_desktop' => true,
        ]);
    }

    /**
     * GET /otomasi/aturan/{rule} — one rule with its last executions.
     */
    public function show(AutomationRule $rule, #[CurrentUser] User $user, AutomationAccess $access): JsonResponse
    {
        Gate::authorize('view', $rule);

        $rules = new Collection([$rule->loadMissing('workspace:id,company_id,key,name,type,owner_id,archived_at')]);

        $runs = AutomationRun::query()
            ->where('rule_id', $rule->id)
            ->latest('ran_at')
            ->orderByDesc('id')
            ->limit(self::RUN_LIMIT)
            ->get()
            ->map(fn (AutomationRun $run): array => [
                'id' => $run->id,
                'task_id' => $run->task_id,
                'task_key' => $run->task_key,
                'task_title' => $run->task_title,
                'result' => $run->result->value,
                'result_label' => $run->result->label(),
                'detail' => $run->detail,
                'ran_at' => $run->ran_at->toIso8601String(),
            ])
            ->values()
            ->all();

        return response()->json([
            'aturan' => $this->present($rule, $this->sentence($rules), $this->manageMap($rules, $user, $access)[$rule->workspace_id] ?? false),
            'runs' => $runs,
        ]);
    }

    /**
     * PATCH /otomasi/aturan/{rule}/jeda {paused: bool} — pause or resume.
     */
    public function pause(Request $request, AutomationRule $rule, #[CurrentUser] User $user, AutomationAccess $access, SetAutomationRuleActive $setActive): JsonResponse
    {
        Gate::authorize('update', $rule);

        $request->validate(['paused' => ['required', 'boolean']], [
            'paused.required' => 'Tentukan apakah aturan dijeda atau dilanjutkan.',
            'paused.boolean' => 'Nilai paused harus true atau false.',
        ]);

        $paused = $request->boolean('paused');
        $setActive->handle($rule, ! $paused);

        $rules = new Collection([$rule->loadMissing('workspace:id,company_id,key,name,type,owner_id,archived_at')]);

        return response()->json([
            'aturan' => $this->present($rule, $this->sentence($rules), true),
            'message' => $paused ? "\"{$rule->name}\" dijeda." : "\"{$rule->name}\" aktif.",
        ]);
    }

    /**
     * @param  Collection<int, AutomationRule>  $rules
     */
    private function sentence(Collection $rules): RuleSentence
    {
        $labelIds = [];
        $personIds = [];

        foreach ($rules as $rule) {
            $refs = RuleSentence::references($rule->trigger, $rule->condition, $rule->actions);
            array_push($labelIds, ...$refs['labels']);
            array_push($personIds, ...$refs['people']);
        }

        /** @var array<string, string> $labels */
        $labels = $labelIds === [] ? [] : Label::query()->whereIn('id', array_values(array_unique($labelIds)))->pluck('name', 'id')->all();
        /** @var array<string, string> $people */
        $people = $personIds === [] ? [] : User::query()->whereIn('id', array_values(array_unique($personIds)))->pluck('name', 'id')->all();

        return new RuleSentence($labels, $people);
    }

    /**
     * @param  Collection<int, AutomationRule>  $rules
     * @return array<string, bool> workspace id => may manage its rules
     */
    private function manageMap(Collection $rules, User $user, AutomationAccess $access): array
    {
        $map = [];

        foreach ($rules as $rule) {
            $map[$rule->workspace_id] ??= $access->canManage($user, $rule->workspace);
        }

        return $map;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(AutomationRule $rule, RuleSentence $sentence, bool $canManage): array
    {
        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'workspace' => ['id' => $rule->workspace->id, 'key' => $rule->workspace->key, 'name' => $rule->workspace->name],
            'is_active' => $rule->is_active,
            'paused' => ! $rule->is_active,
            'trigger_type' => $rule->trigger_type->value,
            'trigger_label' => $rule->trigger_type->label(),
            'trigger' => $rule->trigger,
            'condition' => $rule->condition,
            'actions' => $rule->actions,
            'jika' => $sentence->trigger($rule->trigger).($rule->condition ? ' dan '.$sentence->condition($rule->condition) : ''),
            'maka' => array_map(fn (array $action): string => $sentence->action($action), $rule->actions),
            'sentence' => $sentence->describe($rule->workspace->name, $rule->trigger, $rule->condition, $rule->actions),
            'run_count' => $rule->run_count,
            'last_run_at' => $rule->last_run_at?->toIso8601String(),
            'created_by' => $rule->created_by,
            'can_manage' => $canManage,
        ];
    }
}

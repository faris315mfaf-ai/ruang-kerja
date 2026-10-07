<?php

namespace App\Models;

use App\Domain\Automation\Enums\RuleTriggerType;
use Carbon\CarbonImmutable;
use Database\Factories\AutomationRuleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Automation rule "jika … maka …" of one workspace (docs/DATABASE.md §4
 * Otomasi). Shapes follow resources/js/features/automation/types.ts:
 *
 * - trigger: {type: task_moved, category} | {type: task_overdue} |
 *   {type: task_created_with_label, label_id}
 * - condition: {type: priority, priority 1–4} | {type: assignee, user_id} | null
 * - actions (1–3): {type: notify, target: {kind: user, id} | {kind: role, role}
 *   | {kind: assignees} | {kind: watchers}} | {type: assign, user_id} |
 *   {type: add_label, label_id} | {type: move_status, category}
 *
 * @property string $id
 * @property string $company_id
 * @property string $workspace_id
 * @property string $name
 * @property RuleTriggerType $trigger_type
 * @property array<string, mixed> $trigger
 * @property array<string, mixed>|null $condition
 * @property list<array<string, mixed>> $actions
 * @property bool $is_active
 * @property int $run_count
 * @property CarbonImmutable|null $last_run_at
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 * @property-read User|null $creator
 */
#[Fillable([
    'company_id', 'workspace_id', 'name', 'trigger_type', 'trigger', 'condition', 'actions',
    'is_active', 'run_count', 'last_run_at', 'created_by',
])]
class AutomationRule extends Model
{
    /** @use HasFactory<AutomationRuleFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
        'run_count' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'trigger_type' => RuleTriggerType::class,
            'trigger' => 'array',
            'condition' => 'array',
            'actions' => 'array',
            'is_active' => 'boolean',
            'run_count' => 'integer',
            'last_run_at' => 'datetime',
        ];
    }

    /**
     * Rules of the workspaces $user belongs to (member, or owner of their
     * personal workspace) — the only people who see a workspace's rules.
     *
     * @param  Builder<AutomationRule>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where($this->qualifyColumn('company_id'), $user->company_id)
            ->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()
                ->where('company_id', $user->company_id)
                ->joinedBy($user)
                ->select('workspaces.id'));
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<AutomationRun, $this>
     */
    public function runs(): HasMany
    {
        return $this->hasMany(AutomationRun::class, 'rule_id');
    }
}

<?php

namespace App\Http\Requests\Automation;

use App\Domain\Automation\Enums\NotifyRole;
use App\Domain\Automation\Enums\RuleActionType;
use App\Domain\Automation\Enums\RuleTriggerType;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Label;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * "Aturan baru" / "Ubah aturan": Jika (trigger) · Dan (optional condition) ·
 * Maka (1–3 actions). Mirrors validateRule() of features/automation/rules.ts,
 * including the loop guard (an action that moves the task into the column
 * category the rule reacts to is rejected). Referenced labels must belong to
 * the workspace and people must be its members.
 */
class AutomationRuleRequest extends FormRequest
{
    private ?Workspace $workspace = null;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $categories = array_map(fn (TaskStatusCategory $category): string => $category->value, TaskStatusCategory::cases());

        return [
            'workspace_id' => ['required', 'string', 'ulid'],
            'name' => ['required', 'string', 'max:80'],
            'trigger' => ['required', 'array'],
            'trigger.type' => ['required', Rule::in(RuleTriggerType::values())],
            'trigger.category' => ['nullable', 'required_if:trigger.type,task_moved', Rule::in($categories)],
            'trigger.label_id' => ['nullable', 'required_if:trigger.type,task_created_with_label', 'string', 'ulid'],
            'condition' => ['nullable', 'array'],
            'condition.type' => ['required_with:condition', Rule::in(['priority', 'assignee'])],
            'condition.priority' => ['nullable', 'required_if:condition.type,priority', 'integer', 'between:1,4'],
            'condition.user_id' => ['nullable', 'required_if:condition.type,assignee', 'string', 'ulid'],
            'actions' => ['required', 'array', 'min:1', 'max:3'],
            'actions.*' => ['required', 'array'],
            'actions.*.type' => ['required', Rule::in(RuleActionType::values())],
            'actions.*.target' => ['nullable', 'array'],
            'actions.*.target.kind' => ['nullable', Rule::in(['user', 'role', 'assignees', 'watchers'])],
            'actions.*.target.id' => ['nullable', 'string', 'ulid'],
            'actions.*.target.role' => ['nullable', Rule::in(NotifyRole::values())],
            'actions.*.user_id' => ['nullable', 'string', 'ulid'],
            'actions.*.label_id' => ['nullable', 'string', 'ulid'],
            'actions.*.category' => ['nullable', Rule::in($categories)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'workspace_id.required' => 'Pilih workspace.',
            'name.required' => 'Beri nama aturan.',
            'name.max' => 'Nama maksimal 80 karakter.',
            'trigger.category.required_if' => 'Pilih kategori kolom.',
            'trigger.label_id.required_if' => 'Pilih label.',
            'condition.priority.required_if' => 'Lengkapi kondisi atau hapus.',
            'condition.user_id.required_if' => 'Lengkapi kondisi atau hapus.',
            'actions.required' => 'Tambahkan minimal satu aksi.',
            'actions.min' => 'Tambahkan minimal satu aksi.',
            'actions.max' => 'Maksimal 3 aksi per aturan.',
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $workspace = $this->workspace();

            if ($workspace === null) {
                $validator->errors()->add('workspace_id', 'Pilih workspace.');

                return;
            }

            $trigger = $this->trigger();

            if (isset($trigger['label_id']) && ! $this->labelInWorkspace($workspace, $trigger['label_id'])) {
                $validator->errors()->add('trigger.label_id', 'Label tidak ada di workspace ini.');
            }

            $condition = $this->condition();

            if (($condition['type'] ?? null) === 'assignee' && ! $this->isMember($workspace, (string) $condition['user_id'])) {
                $validator->errors()->add('condition.user_id', 'Pilih anggota workspace ini.');
            }

            foreach ($this->actions() as $index => $action) {
                $error = $this->actionError($workspace, $action, $trigger);

                if ($error !== null) {
                    $validator->errors()->add("actions.{$index}", $error);
                }
            }
        }];
    }

    /**
     * The workspace of the rule (same company as the user), null when unknown.
     */
    public function workspace(): ?Workspace
    {
        /** @var User $user */
        $user = $this->user();

        return $this->workspace ??= Workspace::query()
            ->where('company_id', $user->company_id)
            ->find($this->string('workspace_id')->toString());
    }

    /**
     * @return array{name: string, trigger: array<string, mixed>, condition: array<string, mixed>|null, actions: list<array<string, mixed>>, is_active?: bool}
     */
    public function payload(): array
    {
        $payload = [
            'name' => $this->string('name')->trim()->toString(),
            'trigger' => $this->trigger(),
            'condition' => $this->condition(),
            'actions' => $this->actions(),
        ];

        if ($this->has('is_active')) {
            $payload['is_active'] = $this->boolean('is_active');
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function trigger(): array
    {
        $type = (string) $this->input('trigger.type');

        return match ($type) {
            'task_moved' => ['type' => $type, 'category' => (string) $this->input('trigger.category')],
            'task_created_with_label' => ['type' => $type, 'label_id' => (string) $this->input('trigger.label_id')],
            default => ['type' => 'task_overdue'],
        };
    }

    /**
     * @return array<string, mixed>|null
     */
    private function condition(): ?array
    {
        return match ($this->input('condition.type')) {
            'priority' => ['type' => 'priority', 'priority' => $this->integer('condition.priority')],
            'assignee' => ['type' => 'assignee', 'user_id' => (string) $this->input('condition.user_id')],
            default => null,
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function actions(): array
    {
        $actions = [];

        foreach (array_values((array) $this->input('actions', [])) as $action) {
            if (! is_array($action)) {
                continue;
            }

            $actions[] = match ($action['type'] ?? null) {
                'notify' => ['type' => 'notify', 'target' => $this->target(is_array($action['target'] ?? null) ? $action['target'] : [])],
                'assign' => ['type' => 'assign', 'user_id' => $action['user_id'] ?? null],
                'add_label' => ['type' => 'add_label', 'label_id' => $action['label_id'] ?? null],
                default => ['type' => 'move_status', 'category' => $action['category'] ?? null],
            };
        }

        return $actions;
    }

    /**
     * @param  array<string, mixed>  $target
     * @return array<string, mixed>|null
     */
    private function target(array $target): ?array
    {
        return match ($target['kind'] ?? null) {
            'user' => ['kind' => 'user', 'id' => $target['id'] ?? null],
            'role' => ['kind' => 'role', 'role' => $target['role'] ?? null],
            'assignees' => ['kind' => 'assignees'],
            'watchers' => ['kind' => 'watchers'],
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $action
     * @param  array<string, mixed>  $trigger
     */
    private function actionError(Workspace $workspace, array $action, array $trigger): ?string
    {
        switch ($action['type']) {
            case 'notify':
                $target = $action['target'];

                if ($target === null || ($target['kind'] === 'user' && ! is_string($target['id'])) || ($target['kind'] === 'role' && ! is_string($target['role']))) {
                    return 'Pilih tujuan aksi.';
                }

                return $target['kind'] === 'user' && ! $this->isMember($workspace, $target['id'])
                    ? 'Pilih anggota workspace ini.'
                    : null;
            case 'assign':
                if (! is_string($action['user_id'])) {
                    return 'Pilih tujuan aksi.';
                }

                return $this->isMember($workspace, $action['user_id']) ? null : 'Pilih anggota workspace ini.';
            case 'add_label':
                if (! is_string($action['label_id'])) {
                    return 'Pilih tujuan aksi.';
                }

                return $this->labelInWorkspace($workspace, $action['label_id']) ? null : 'Label tidak ada di workspace ini.';
            default:
                if (! is_string($action['category'])) {
                    return 'Pilih tujuan aksi.';
                }

                // A rule that moves the task into the column it reacts to would loop.
                return $trigger['type'] === 'task_moved' && $action['category'] === $trigger['category']
                    ? 'Aksi ini memicu aturan yang sama lagi. Pilih kolom lain.'
                    : null;
        }
    }

    private function labelInWorkspace(Workspace $workspace, string $labelId): bool
    {
        return Label::query()->where('workspace_id', $workspace->id)->whereKey($labelId)->exists();
    }

    private function isMember(Workspace $workspace, string $userId): bool
    {
        if ($workspace->isPersonal()) {
            return $workspace->owner_id === $userId;
        }

        return WorkspaceMember::query()->where('workspace_id', $workspace->id)->where('user_id', $userId)->exists();
    }
}

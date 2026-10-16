<?php

namespace App\Domain\Automation\Services;

use App\Domain\Automation\Enums\NotifyRole;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;

/**
 * Plain-language "Jika … maka …" sentence of an automation rule, a port of
 * describeRule() in resources/js/features/automation/rules.ts for the mobile
 * API ("Jika tugas di Operasional pindah ke kolom Selesai dan prioritasnya
 * Urgent, maka beri tahu Dimas Pratama dan tambah label "Ditinjau"."). Names
 * come from lookup maps so a list renders in a fixed number of queries; a
 * missing piece renders as "…" like on the web.
 */
final class RuleSentence
{
    private const string BLANK = '…';

    /**
     * @param  array<string, string>  $labels  label id => name
     * @param  array<string, string>  $people  user id => name
     */
    public function __construct(
        private readonly array $labels = [],
        private readonly array $people = [],
    ) {}

    /**
     * Label and user ids a rule refers to, to pre-load their names.
     *
     * @param  array<string, mixed>  $trigger
     * @param  array<string, mixed>|null  $condition
     * @param  list<array<string, mixed>>  $actions
     * @return array{labels: list<string>, people: list<string>}
     */
    public static function references(array $trigger, ?array $condition, array $actions): array
    {
        $labels = [];
        $people = [];

        if (is_string($trigger['label_id'] ?? null)) {
            $labels[] = $trigger['label_id'];
        }

        if (is_string($condition['user_id'] ?? null)) {
            $people[] = $condition['user_id'];
        }

        foreach ($actions as $action) {
            if (is_string($action['label_id'] ?? null)) {
                $labels[] = $action['label_id'];
            }

            if (is_string($action['user_id'] ?? null)) {
                $people[] = $action['user_id'];
            }

            $target = $action['target'] ?? null;

            if (is_array($target) && ($target['kind'] ?? null) === 'user' && is_string($target['id'] ?? null)) {
                $people[] = $target['id'];
            }
        }

        return ['labels' => $labels, 'people' => $people];
    }

    /**
     * @param  array<string, mixed>  $trigger
     * @param  array<string, mixed>|null  $condition
     * @param  list<array<string, mixed>>  $actions
     */
    public function describe(?string $workspaceName, array $trigger, ?array $condition, array $actions): string
    {
        $where = $workspaceName === null ? '' : " di {$workspaceName}";
        $when = $condition === null || $condition === [] ? '' : ' dan '.$this->condition($condition);
        $then = $actions === [] ? self::BLANK : $this->join(array_map(fn (array $action): string => $this->action($action), $actions));

        return "Jika tugas{$where} {$this->trigger($trigger)}{$when}, maka {$then}.";
    }

    /**
     * @param  array<string, mixed>  $trigger
     */
    public function trigger(array $trigger): string
    {
        return match ($trigger['type'] ?? null) {
            'task_moved' => 'pindah ke kolom '.$this->category($trigger['category'] ?? null),
            'task_overdue' => 'lewat tenggat',
            'task_created_with_label' => 'dibuat dengan label '.$this->label($trigger['label_id'] ?? null),
            default => self::BLANK,
        };
    }

    /**
     * @param  array<string, mixed>  $condition
     */
    public function condition(array $condition): string
    {
        return match ($condition['type'] ?? null) {
            'priority' => 'prioritasnya '.(TaskPriority::tryFrom((int) ($condition['priority'] ?? 0))?->label() ?? self::BLANK),
            'assignee' => 'penanggung jawabnya '.$this->person($condition['user_id'] ?? null),
            default => self::BLANK,
        };
    }

    /**
     * @param  array<string, mixed>  $action
     */
    public function action(array $action): string
    {
        return match ($action['type'] ?? null) {
            'notify' => 'beri tahu '.$this->target($action['target'] ?? null),
            'assign' => 'tugaskan ke '.$this->person($action['user_id'] ?? null),
            'add_label' => 'tambah label '.$this->label($action['label_id'] ?? null),
            'move_status' => 'pindahkan ke kolom '.$this->category($action['category'] ?? null),
            default => self::BLANK,
        };
    }

    private function target(mixed $target): string
    {
        if (! is_array($target)) {
            return self::BLANK;
        }

        return match ($target['kind'] ?? null) {
            'user' => $this->person($target['id'] ?? null),
            'role' => NotifyRole::tryFrom(is_string($target['role'] ?? null) ? $target['role'] : '')?->label() ?? self::BLANK,
            'assignees' => 'penanggung jawab tugas',
            'watchers' => 'pengamat tugas',
            default => self::BLANK,
        };
    }

    private function person(mixed $id): string
    {
        return is_string($id) ? ($this->people[$id] ?? self::BLANK) : self::BLANK;
    }

    private function label(mixed $id): string
    {
        return is_string($id) && isset($this->labels[$id]) ? '"'.$this->labels[$id].'"' : self::BLANK;
    }

    private function category(mixed $category): string
    {
        return TaskStatusCategory::tryFrom(is_string($category) ? $category : '')?->label() ?? self::BLANK;
    }

    /**
     * @param  list<string>  $parts
     */
    private function join(array $parts): string
    {
        if (count($parts) <= 1) {
            return implode('', $parts);
        }

        return implode(', ', array_slice($parts, 0, -1)).' dan '.$parts[count($parts) - 1];
    }
}

<?php

namespace App\Domain\Automation\Services;

use Closure;

/**
 * The automation chain the current code runs in (loop guard). While a rule's
 * actions execute, `depth` is the rule's depth + 1 and `chain` lists the
 * rules already run; task events fired by those actions carry both into the
 * next RunTaskAutomations job, which skips a rule that is already in the
 * chain or would exceed MAX_DEPTH. Registered as a scoped singleton (reset
 * per request / queued job).
 */
final class AutomationContext
{
    /** Rules in one chain: a person's change + at most 3 rules reacting to each other. */
    public const int MAX_DEPTH = 3;

    private int $depth = 0;

    /** @var list<string> */
    private array $chain = [];

    public function depth(): int
    {
        return $this->depth;
    }

    /**
     * @return list<string>
     */
    public function chain(): array
    {
        return $this->chain;
    }

    /**
     * Runs $callback as the actions of $ruleId at $depth.
     *
     * @template T
     *
     * @param  list<string>  $chain  rules before this one
     * @param  Closure(): T  $callback
     * @return T
     */
    public function within(string $ruleId, int $depth, array $chain, Closure $callback): mixed
    {
        [$previousDepth, $previousChain] = [$this->depth, $this->chain];
        $this->depth = $depth + 1;
        $this->chain = [...$chain, $ruleId];

        try {
            return $callback();
        } finally {
            [$this->depth, $this->chain] = [$previousDepth, $previousChain];
        }
    }
}

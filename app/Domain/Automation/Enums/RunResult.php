<?php

namespace App\Domain\Automation\Enums;

/**
 * Outcome of one rule run (automation_runs.result).
 */
enum RunResult: string
{
    case Success = 'success';
    case Failed = 'failed';
    case Skipped = 'skipped';

    public function label(): string
    {
        return match ($this) {
            self::Success => 'Berhasil',
            self::Failed => 'Gagal',
            self::Skipped => 'Dilewati',
        };
    }
}

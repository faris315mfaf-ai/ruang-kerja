<?php

/*
 * PHPUnit/Pest bootstrap. Parallel agent worktrees (scripts/agen-mulai.sh,
 * AGENTS.md › Kerja paralel) each get their own test database, named in the
 * git-ignored file .testing-db, so two agents running `composer test` at the
 * same time never drop each other's tables. Without that file the database
 * from phpunit.xml (ruangkerja_testing) is used, as in CI.
 */

require __DIR__.'/../vendor/autoload.php';

$testingDatabaseFile = dirname(__DIR__).'/.testing-db';

if (is_file($testingDatabaseFile)) {
    $testingDatabase = trim((string) file_get_contents($testingDatabaseFile));

    if (preg_match('/^ruangkerja_testing_[a-z0-9_]+$/', $testingDatabase) !== 1) {
        fwrite(STDERR, ".testing-db must contain a name like ruangkerja_testing_codex, got \"{$testingDatabase}\".\n");
        exit(1);
    }

    putenv("DB_DATABASE={$testingDatabase}");
    $_ENV['DB_DATABASE'] = $testingDatabase;
    $_SERVER['DB_DATABASE'] = $testingDatabase;
}

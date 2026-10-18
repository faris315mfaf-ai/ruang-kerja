<?php

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 1 multi-perusahaan (docs/sesi/fase1-celah.md C1): every audit entry
 * belongs to one company, so system entries (no actor) of company B no longer
 * show up on company A's audit page.
 *
 * Backfill: the actor's company; else the subject's (its company_id, or
 * through its user_id / workspace_id / division_id); with a single company in the database
 * every remaining row belongs to it. Rows still without a company are
 * platform entries, shown to no company's auditor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignUlid('company_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->index(['company_id', 'created_at']);
        });

        DB::statement(<<<'SQL'
            UPDATE audit_logs AS a
               SET company_id = u.company_id
              FROM users AS u
             WHERE a.user_id = u.id
               AND a.company_id IS NULL
            SQL);

        $types = DB::table('audit_logs')
            ->whereNull('company_id')
            ->whereNotNull('auditable_type')
            ->distinct()
            ->pluck('auditable_type');

        foreach ($types as $type) {
            $this->backfillSubjects((string) $type);
        }

        $companies = DB::table('companies')->pluck('id');

        if ($companies->count() === 1) {
            DB::table('audit_logs')->whereNull('company_id')->update(['company_id' => $companies->first()]);
        }
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'created_at']);
            $table->dropConstrainedForeignId('company_id');
        });
    }

    private function backfillSubjects(string $type): void
    {
        if (! class_exists($type) || ! is_subclass_of($type, Model::class)) {
            return;
        }

        /** @var Model $model */
        $model = new $type;
        $table = $model->getTable();
        $key = $model->getKeyName();

        if ($table === 'companies') {
            DB::update(
                'UPDATE audit_logs AS a SET company_id = c.id FROM companies AS c
                  WHERE a.auditable_type = ? AND a.auditable_id = c.id AND a.company_id IS NULL',
                [$type],
            );

            return;
        }

        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $key)) {
            return;
        }

        $via = match (true) {
            Schema::hasColumn($table, 'company_id') => ['s.company_id', ''],
            Schema::hasColumn($table, 'user_id') => ['p.company_id', 'JOIN users AS p ON p.id = s.user_id'],
            Schema::hasColumn($table, 'workspace_id') => ['p.company_id', 'JOIN workspaces AS p ON p.id = s.workspace_id'],
            Schema::hasColumn($table, 'division_id') => ['p.company_id', 'JOIN divisions AS p ON p.id = s.division_id'],
            default => null,
        };

        if ($via === null) {
            return;
        }

        [$column, $join] = $via;

        DB::update(
            "UPDATE audit_logs AS a SET company_id = sub.company_id
               FROM (SELECT s.{$key}::text AS subject_id, {$column} AS company_id FROM {$table} AS s {$join}) AS sub
              WHERE a.auditable_type = ? AND a.auditable_id = sub.subject_id AND a.company_id IS NULL
                AND sub.company_id IS NOT NULL",
            [$type],
        );
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Fase 1 multi-perusahaan: request numbers per company (plan item #2).
 *
 * - requests.company_id (denormalised from the requester), unique
 *   (company_id, number) instead of a global unique number.
 * - request_sequences.company_id, unique (company_id, key): every company
 *   counts CUT-2026-10 from 0001.
 *
 * Existing counters belong to the only company; with several companies they
 * are rebuilt per company from the highest number each one already used.
 *
 * Rollback keeps the highest counter per key; it fails when two companies
 * already hold the same request number (the old schema cannot store that).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->foreignUlid('company_id')->nullable()->after('id')->constrained()->restrictOnDelete();
        });

        DB::statement('UPDATE requests AS r SET company_id = u.company_id FROM users AS u WHERE r.user_id = u.id');
        DB::statement('ALTER TABLE requests ALTER COLUMN company_id SET NOT NULL');

        Schema::table('requests', function (Blueprint $table) {
            $table->dropUnique(['number']);
            $table->unique(['company_id', 'number']);
        });

        Schema::table('request_sequences', function (Blueprint $table) {
            $table->foreignUlid('company_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        $companies = DB::table('companies')->pluck('id');

        if ($companies->count() === 1) {
            DB::table('request_sequences')->update(['company_id' => $companies->first()]);
        } else {
            $this->rebuildSequences();
        }

        DB::statement('ALTER TABLE request_sequences ALTER COLUMN company_id SET NOT NULL');

        Schema::table('request_sequences', function (Blueprint $table) {
            $table->dropUnique(['key']);
            $table->unique(['company_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::table('request_sequences', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'key']);
        });

        // One counter per key again: keep the highest.
        DB::statement(<<<'SQL'
            DELETE FROM request_sequences AS a
             USING request_sequences AS b
             WHERE a.key = b.key
               AND (a.last_number < b.last_number OR (a.last_number = b.last_number AND a.id > b.id))
            SQL);

        Schema::table('request_sequences', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
            $table->unique('key');
        });

        Schema::table('requests', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'number']);
            $table->unique('number');
            $table->dropConstrainedForeignId('company_id');
        });
    }

    /**
     * One counter per company and key: the highest number the company used
     * (numbers look like CUT-2026-10-0012; key = CUT-2026-10).
     */
    private function rebuildSequences(): void
    {
        $rows = DB::select(<<<'SQL'
            SELECT company_id,
                   regexp_replace(number, '-[0-9]+$', '') AS key,
                   max(substring(number from '([0-9]+)$')::int) AS last_number
              FROM requests
             WHERE number ~ '-[0-9]+$'
             GROUP BY company_id, regexp_replace(number, '-[0-9]+$', '')
            SQL);

        DB::table('request_sequences')->delete();

        foreach ($rows as $row) {
            DB::table('request_sequences')->insert([
                'id' => (string) Str::ulid(),
                'company_id' => $row->company_id,
                'key' => $row->key,
                'last_number' => $row->last_number,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};

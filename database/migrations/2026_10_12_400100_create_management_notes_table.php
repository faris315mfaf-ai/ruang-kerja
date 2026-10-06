<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * "Catatan tindakan" of Direksi / management (keputusan pemilik 6 Okt 2026):
 * a private to-do list per person on the Direksi dashboard and /manajemen
 * (docs/DATABASE.md §4 management_notes). Only the owner reads or writes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('management_notes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 500);
            // Office date the action is due (optional).
            $table->date('due_on')->nullable();
            $table->timestampTz('done_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'done_at']);
        });

        // Lexorank key: byte order = sort order (same as tasks / task_plans).
        DB::statement('ALTER TABLE management_notes ADD COLUMN position varchar(100) COLLATE "C" NOT NULL');
        DB::statement('CREATE INDEX management_notes_user_position_index ON management_notes (user_id, position)');
        DB::statement("ALTER TABLE management_notes ADD CONSTRAINT management_notes_body_not_blank CHECK (btrim(body) <> '')");
    }

    public function down(): void
    {
        Schema::dropIfExists('management_notes');
    }
};

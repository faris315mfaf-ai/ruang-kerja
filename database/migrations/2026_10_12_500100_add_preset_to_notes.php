<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Notulensi cepat (keputusan pemilik 6 Okt 2026, docs/fitur/catatan.md):
 * `preset` marks notes started from a template so the dashboard can list
 * the latest minutes ("Notulensi terakhir") and show their icon. Null = an
 * ordinary note.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->string('preset', 20)->nullable()->after('kind');
        });

        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_preset_check CHECK (preset IS NULL OR preset IN ('minutes'))");
        DB::statement('CREATE INDEX notes_preset_created_by_index ON notes (created_by, created_at) WHERE preset IS NOT NULL AND deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS notes_preset_created_by_index');
        DB::statement('ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_preset_check');

        Schema::table('notes', function (Blueprint $table) {
            $table->dropColumn('preset');
        });
    }
};

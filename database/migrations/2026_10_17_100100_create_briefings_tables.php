<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Briefing pagi & sore (keputusan pemilik 9 Okt 2026): HR / Super Admin
 * records the minutes of the morning (08.00–11.00) and afternoon
 * (16.00–18.00) briefing per office date; while away they may delegate the
 * note-taking to one employee for that date + period (briefing_delegations).
 * Saving notifies the whole company (docs/DATABASE.md §6 briefings).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('briefings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            // pagi · sore
            $table->string('period', 5);
            $table->date('briefing_date');
            $table->text('content');
            // Who saved the note (HR / Super Admin, or the delegate).
            $table->foreignUlid('created_by')->constrained('users')->restrictOnDelete();
            // Set when a delegate saved it: the HR / Super Admin who delegated.
            $table->foreignUlid('delegated_from')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            // Upsert key: one note per company, date and period.
            $table->unique(['company_id', 'briefing_date', 'period']);
            // "Latest per period" lookups.
            $table->index(['company_id', 'period', 'briefing_date']);
        });

        DB::statement("ALTER TABLE briefings ADD CONSTRAINT briefings_period_check CHECK (period IN ('pagi', 'sore'))");
        DB::statement("ALTER TABLE briefings ADD CONSTRAINT briefings_content_not_blank CHECK (btrim(content) <> '')");

        Schema::create('briefing_delegations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->date('briefing_date');
            $table->string('period', 5);
            // The employee who may take the note as if they were the recorder.
            $table->foreignUlid('delegated_to')->constrained('users')->restrictOnDelete();
            // The HR / Super Admin who appointed them.
            $table->foreignUlid('delegated_by')->constrained('users')->restrictOnDelete();
            $table->timestampsTz();

            // Re-delegating the same date + period replaces the target.
            $table->unique(['company_id', 'briefing_date', 'period']);
            // "Is this user a delegate today?" (dashboard card).
            $table->index(['delegated_to', 'briefing_date']);
        });

        DB::statement("ALTER TABLE briefing_delegations ADD CONSTRAINT briefing_delegations_period_check CHECK (period IN ('pagi', 'sore'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('briefing_delegations');
        Schema::dropIfExists('briefings');
    }
};

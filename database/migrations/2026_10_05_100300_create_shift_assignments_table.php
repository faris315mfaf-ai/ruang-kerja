<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_assignments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            // Null only for a date override that makes the day off.
            $table->foreignUlid('shift_id')->nullable()->index()->constrained()->restrictOnDelete();
            $table->date('valid_from');
            $table->date('valid_until')->nullable();
            $table->date('override_date')->nullable();
            $table->string('work_mode_override', 10)->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'valid_from']);
            $table->index(['user_id', 'override_date']);
        });

        // ISO weekdays (1 = Monday … 7 = Sunday); empty for date overrides.
        DB::statement("ALTER TABLE shift_assignments ADD COLUMN weekdays smallint[] NOT NULL DEFAULT '{}'");
        DB::statement('ALTER TABLE shift_assignments ADD CONSTRAINT shift_assignments_weekdays_check CHECK (weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[])');
        DB::statement('ALTER TABLE shift_assignments ADD CONSTRAINT shift_assignments_kind_check CHECK ((override_date IS NOT NULL) OR (shift_id IS NOT NULL AND cardinality(weekdays) > 0))');
        DB::statement('ALTER TABLE shift_assignments ADD CONSTRAINT shift_assignments_period_check CHECK (valid_until IS NULL OR valid_until >= valid_from)');
        // One override per user per date.
        DB::statement('CREATE UNIQUE INDEX shift_assignments_user_override_unique ON shift_assignments (user_id, override_date) WHERE override_date IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_assignments');
    }
};

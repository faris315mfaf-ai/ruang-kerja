<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 1 multi-perusahaan (plan item #3): employee numbers are unique per
 * company, not across every company. employee_profiles.company_id is
 * denormalised from users (backfilled here, kept by the model).
 *
 * Rollback fails when two companies already use the same employee number.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_profiles', function (Blueprint $table) {
            $table->foreignUlid('company_id')->nullable()->after('user_id')->constrained()->cascadeOnDelete();
        });

        DB::statement('UPDATE employee_profiles AS p SET company_id = u.company_id FROM users AS u WHERE p.user_id = u.id');
        DB::statement('ALTER TABLE employee_profiles ALTER COLUMN company_id SET NOT NULL');

        Schema::table('employee_profiles', function (Blueprint $table) {
            $table->dropUnique(['employee_number']);
            $table->unique(['company_id', 'employee_number']);
        });
    }

    public function down(): void
    {
        Schema::table('employee_profiles', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'employee_number']);
            $table->unique('employee_number');
            $table->dropConstrainedForeignId('company_id');
        });
    }
};

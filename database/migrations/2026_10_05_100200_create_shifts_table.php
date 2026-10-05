<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 100);
            $table->time('start_time');
            $table->time('end_time');
            $table->smallInteger('break_minutes')->default(60);
            $table->boolean('crosses_midnight')->default(false);
            $table->smallInteger('late_tolerance_min')->default(10);
            $table->smallInteger('early_leave_tolerance_min')->default(0);
            $table->smallInteger('check_in_window_before_min')->default(120);
            // Extension: optional home location. When set, check-in for this shift is
            // only accepted inside this location's geofence (e.g. warehouse shifts).
            $table->foreignUlid('office_location_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};

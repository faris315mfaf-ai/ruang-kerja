<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('office_locations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            $table->string('address', 255)->nullable();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->integer('radius_m')->default(100);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['company_id', 'is_active']);
        });

        DB::statement('ALTER TABLE office_locations ADD CONSTRAINT office_locations_coordinates_check CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)');
        DB::statement('ALTER TABLE office_locations ADD CONSTRAINT office_locations_radius_check CHECK (radius_m > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('office_locations');
    }
};

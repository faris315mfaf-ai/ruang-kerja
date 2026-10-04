<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('division_id')->index()->constrained()->restrictOnDelete();
            $table->string('name', 120);
            // Optional short label shown on the org chart (e.g. GDG).
            $table->string('code', 10)->nullable();
            $table->foreignUlid('lead_user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teams');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            // 1 = Direksi … 5 = Staf.
            $table->smallInteger('level')->default(5);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['company_id', 'level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('positions');
    }
};

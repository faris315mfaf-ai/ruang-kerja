<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_statuses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('category', 20);
            $table->string('color', 20);
            // Lexorank key; "C" collation = byte order, matching Lexorank::between().
            $table->string('position', 100)->collation('C');
            $table->timestampsTz();

            $table->index(['workspace_id', 'position']);
        });

        Schema::create('labels', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->string('color', 20);
            $table->timestampsTz();

            $table->unique(['workspace_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('labels');
        Schema::dropIfExists('task_statuses');
    }
};

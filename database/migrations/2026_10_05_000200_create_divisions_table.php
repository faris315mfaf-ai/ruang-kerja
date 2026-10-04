<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('divisions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->ulid('parent_id')->nullable()->index();
            $table->string('name', 120);
            // Upper-case prefix (e.g. KEU), unique per company — also among soft-deleted rows.
            $table->string('code', 10);
            $table->foreignUlid('head_user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->boolean('is_board')->default(false);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['company_id', 'code']);
        });

        // Self-reference needs the primary key to exist first.
        Schema::table('divisions', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('divisions')->nullOnDelete();
        });

        DB::statement('ALTER TABLE divisions ADD CONSTRAINT divisions_code_upper_check CHECK (code = upper(code))');
    }

    public function down(): void
    {
        Schema::dropIfExists('divisions');
    }
};

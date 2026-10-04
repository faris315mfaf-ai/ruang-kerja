<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 150);
            // Google Workspace domain allowed to sign in (lower-case, e.g. perusahaan.co.id).
            $table->string('google_domain', 150)->unique();
            $table->string('timezone', 50)->default('Asia/Jakarta');
            $table->jsonb('settings')->default('{}');
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};

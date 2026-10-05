<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sprint 3: lobby device account (own `kiosk` auth guard, not a users row).
        Schema::create('kiosks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('office_location_id')->constrained()->restrictOnDelete();
            $table->string('name', 80);
            $table->string('code', 20);
            $table->boolean('is_active')->default(true);
            $table->char('activation_token_hash', 64)->nullable()->unique();
            $table->timestampTz('activation_expires_at')->nullable();
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('last_seen_at')->nullable();
            $table->rememberToken();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['company_id', 'code']);
            $table->index(['office_location_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kiosks');
    }
};

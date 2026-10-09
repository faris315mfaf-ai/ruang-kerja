<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Perangkat yang pernah masuk (Fase 3, F3-1/F3-2; docs/DATABASE.md §8): satu
 * baris per instalasi aplikasi, identitas perangkat hanya disimpan sebagai
 * hash (SHA-256), token push unik untuk FCM, hasil Play Integrity disimpan
 * apa adanya (jsonb) untuk penandaan, bukan pemblokiran.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->string('platform', 10);
            $table->string('device_id_hash', 64);
            $table->string('name', 120)->nullable();
            $table->string('os_version', 40)->nullable();
            $table->string('app_version', 40)->nullable();
            $table->string('push_token', 255)->nullable()->unique();
            $table->jsonb('integrity_verdict')->nullable();
            $table->timestampTz('last_seen_at')->nullable();
            $table->boolean('biometric_login')->default(false);
            $table->boolean('is_trusted')->default(false);
            $table->timestampsTz();

            $table->unique(['user_id', 'device_id_hash']);
            $table->index(['user_id', 'last_seen_at']);
        });

        DB::statement("ALTER TABLE devices ADD CONSTRAINT devices_platform_check CHECK (platform IN ('android', 'ios', 'web'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};

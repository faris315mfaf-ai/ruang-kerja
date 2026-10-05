<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sprint 3: one row per QR code a kiosk displayed (audit + "was it really shown?").
        Schema::create('qr_tokens', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('office_location_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('kiosk_id')->nullable()->index()->constrained()->nullOnDelete();
            // SHA-256 of the HMAC shown in the QR (the code itself is never stored).
            $table->char('token_hash', 64)->unique();
            $table->bigInteger('window');
            $table->timestampTz('valid_from');
            $table->timestampTz('valid_until');
            $table->timestampsTz();

            $table->index(['office_location_id', 'valid_from']);
        });

        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->foreign('qr_token_id')->references('id')->on('qr_tokens')->restrictOnDelete();
            $table->index('qr_token_id');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropForeign(['qr_token_id']);
            $table->dropIndex(['qr_token_id']);
        });

        Schema::dropIfExists('qr_tokens');
    }
};

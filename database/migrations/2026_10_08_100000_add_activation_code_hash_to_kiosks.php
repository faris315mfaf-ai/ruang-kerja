<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * kiosks.activation_code_hash: HMAC of the short single-use pairing code
     * HR can read out and type on the kiosk (alternative to the activation
     * link; shares activation_expires_at, and redeeming either clears both).
     */
    public function up(): void
    {
        Schema::table('kiosks', function (Blueprint $table) {
            $table->char('activation_code_hash', 64)->nullable()->unique()->after('activation_token_hash');
        });
    }

    public function down(): void
    {
        Schema::table('kiosks', function (Blueprint $table) {
            $table->dropUnique(['activation_code_hash']);
            $table->dropColumn('activation_code_hash');
        });
    }
};

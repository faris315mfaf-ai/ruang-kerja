<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-user Google OAuth tokens (Picker, actions on behalf of the user).
     * Tokens are encrypted by the model cast; scopes is a Postgres text[].
     */
    public function up(): void
    {
        Schema::create('google_accounts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('google_id')->index();
            $table->string('email', 190);
            $table->text('access_token');
            $table->text('refresh_token')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE google_accounts ADD COLUMN scopes text[] NOT NULL DEFAULT '{}'");
    }

    public function down(): void
    {
        Schema::dropIfExists('google_accounts');
    }
};

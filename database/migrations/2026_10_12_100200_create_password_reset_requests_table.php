<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * "Lupa kata sandi" with HR approval (owner decision 6 Oct 2026, docs/DATABASE.md §1).
 * A row exists only for active employees; unknown addresses get the same waiting
 * page backed by the session alone. Tokens are stored as SHA-256 hashes: the
 * request token lives in the requesting browser's session, the setup token is
 * issued to that same session once HR approves (valid 30 minutes).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email', 190);
            $table->char('request_token_hash', 64)->unique();
            $table->char('setup_token_hash', 64)->nullable()->unique();
            $table->string('status', 10)->default('pending');
            $table->foreignUlid('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('decided_at')->nullable();
            $table->string('reject_reason', 500)->nullable();
            $table->timestampTz('expires_at');
            $table->ipAddress('ip')->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestampsTz();

            $table->index(['company_id', 'status']);
            $table->index(['user_id', 'status']);
        });

        DB::statement("ALTER TABLE password_reset_requests ADD CONSTRAINT password_reset_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'used', 'expired', 'canceled'))");
        DB::statement("ALTER TABLE password_reset_requests ADD CONSTRAINT password_reset_requests_reason_check CHECK (status <> 'rejected' OR reject_reason IS NOT NULL)");
        // At most one open request per employee (a new one cancels the previous).
        DB::statement("CREATE UNIQUE INDEX password_reset_requests_one_pending ON password_reset_requests (user_id) WHERE status = 'pending'");
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_requests');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_types', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->index()->constrained()->restrictOnDelete();
            // Short upper-case code, also the request number prefix (CUT-2026-10-0001).
            $table->string('code', 10);
            $table->string('name', 120);
            $table->string('category', 20);
            $table->string('description', 255)->nullable();
            $table->decimal('annual_quota_days', 5, 1)->nullable();
            // 0 = always required; null = never required.
            $table->unsignedSmallInteger('requires_attachment_after_days')->nullable();
            $table->boolean('is_paid')->default(true);
            $table->boolean('allow_half_day')->default(false);
            $table->decimal('carry_over_max_days', 5, 1)->nullable();
            // Corrections: how far back a date may be ("Maks. 7 hari lalu").
            $table->unsignedSmallInteger('max_backdate_days')->nullable();
            // Eligibility by length of service (e.g. Cuti besar).
            $table->unsignedSmallInteger('min_service_months')->nullable();
            $table->foreignUlid('approval_flow_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestampsTz();
            $table->softDeletesTz();

            // Unique including soft-deleted rows: old request numbers keep their meaning.
            $table->unique(['company_id', 'code']);
        });

        DB::statement("ALTER TABLE leave_types ADD CONSTRAINT leave_types_code_upper CHECK (code = upper(code) AND code ~ '^[A-Z0-9]{2,10}$')");

        Schema::create('leave_balances', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('leave_type_id')->index()->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('year');
            $table->decimal('entitled_days', 5, 1)->default(0);
            $table->decimal('carried_over_days', 5, 1)->default(0);
            $table->decimal('used_days', 5, 1)->default(0);
            // Reserved by requests still in progress, so a balance is never spent twice.
            $table->decimal('pending_days', 5, 1)->default(0);
            $table->timestampsTz();

            $table->unique(['user_id', 'leave_type_id', 'year']);
        });

        // A balance can never go negative, even under concurrent writes.
        DB::statement('ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_non_negative CHECK (
            entitled_days >= 0 AND carried_over_days >= 0 AND used_days >= 0 AND pending_days >= 0
            AND entitled_days + carried_over_days - used_days - pending_days >= 0
        )');
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_balances');
        Schema::dropIfExists('leave_types');
    }
};

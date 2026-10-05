<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_flows', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->index()->constrained()->restrictOnDelete();
            $table->string('name', 120);
            // "Lewati langkah bila penyetuju = pemohon" (off: escalate to the requester's manager).
            $table->boolean('skip_self_approval')->default(true);
            // "Izinkan delegasi saat penyetuju cuti".
            $table->boolean('allow_delegation')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        Schema::create('approval_flow_steps', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('approval_flow_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('step_order');
            $table->string('approver_type', 20);
            $table->string('approver_role', 40)->nullable();
            $table->foreignUlid('approver_user_id')->nullable()->index()->constrained('users')->restrictOnDelete();
            // e.g. {"overtime_month_minutes_gt": 2400}: the step only applies when every key holds.
            $table->jsonb('condition')->nullable();
            $table->timestampsTz();

            $table->unique(['approval_flow_id', 'step_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_flow_steps');
        Schema::dropIfExists('approval_flows');
    }
};

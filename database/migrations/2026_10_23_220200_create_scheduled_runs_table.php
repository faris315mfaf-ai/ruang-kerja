<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fase 1 multi-perusahaan (Langkah 2b): scheduled work at a local office
     * time runs per company. The scheduler checks every five minutes whether a
     * company's clock has reached the task's time and claims (task, company,
     * local date) here first, so a task runs once per company and office date
     * however often — and on however many servers — the scheduler fires.
     */
    public function up(): void
    {
        Schema::create('scheduled_runs', function (Blueprint $table) {
            $table->string('task', 80);
            $table->foreignUlid('company_id')->constrained()->cascadeOnDelete();
            $table->date('local_date');
            $table->timestampTz('ran_at');

            $table->primary(['task', 'company_id', 'local_date']);
            $table->index('local_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_runs');
    }
};

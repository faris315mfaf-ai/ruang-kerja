<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Non-boolean / global notification settings per user (1:1 with users):
 * daily digest time, quiet hours, hold while on leave.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_settings', function (Blueprint $table) {
            $table->foreignUlid('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->time('digest_time')->default('07:30:00');
            $table->boolean('quiet_hours')->default(true);
            $table->boolean('pause_while_on_leave')->default(false);
            $table->date('digest_last_run_on')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_settings');
    }
};

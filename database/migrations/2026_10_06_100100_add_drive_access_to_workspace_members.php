<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Akses Drive" per member (Pengaturan › Anggota): the Drive role the last
     * permission sync confirmed for this member, or why it was skipped.
     */
    public function up(): void
    {
        Schema::table('workspace_members', function (Blueprint $table) {
            $table->string('drive_access', 10)->nullable();
            $table->string('drive_error', 100)->nullable();
            $table->timestampTz('drive_synced_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('workspace_members', function (Blueprint $table) {
            $table->dropColumn(['drive_access', 'drive_error', 'drive_synced_at']);
        });
    }
};

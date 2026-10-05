<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sprint 7 part B: drive_files.workspace_id becomes a real (nullable)
     * foreign key — workspaces are soft-deleted, so null only happens when a
     * workspace row is purged (e.g. a personal workspace of a deleted user).
     */
    public function up(): void
    {
        // Rows of workspaces that no longer exist would break the constraint.
        DB::table('drive_files')
            ->whereNotIn('workspace_id', DB::table('workspaces')->select('id'))
            ->delete();

        Schema::table('drive_files', function (Blueprint $table) {
            $table->ulid('workspace_id')->nullable()->change();
            $table->foreign('workspace_id')->references('id')->on('workspaces')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('drive_files', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
        });

        DB::table('drive_files')->whereNull('workspace_id')->delete();

        Schema::table('drive_files', function (Blueprint $table) {
            $table->ulid('workspace_id')->nullable(false)->change();
        });
    }
};

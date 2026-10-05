<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Metadata cache of Drive files per workspace. The foreign key to
     * workspaces is added by Sprint 7 part B once the workspaces table exists.
     */
    public function up(): void
    {
        Schema::create('drive_files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('workspace_id')->index();
            $table->string('google_file_id')->unique();
            $table->string('parent_google_id')->nullable();
            $table->string('name', 500);
            $table->string('mime_type', 255);
            $table->string('kind', 20);
            $table->string('web_view_link', 1000);
            $table->string('icon_link', 1000)->nullable();
            $table->text('thumbnail_link')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('owner_email', 190)->nullable();
            $table->timestampTz('modified_at')->nullable();
            $table->foreignUlid('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('last_synced_at');
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['workspace_id', 'parent_google_id']);
            $table->index(['workspace_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drive_files');
    }
};

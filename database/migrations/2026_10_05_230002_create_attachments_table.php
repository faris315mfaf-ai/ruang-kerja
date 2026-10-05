<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Polymorphic attachments (task, comment, request, message) pointing to a
     * Drive file or to a file in app storage.
     */
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulidMorphs('attachable');
            $table->string('source', 20);
            $table->foreignUlid('drive_file_id')->nullable()->constrained('drive_files')->nullOnDelete();
            $table->string('storage_path', 500)->nullable();
            $table->string('filename', 500);
            $table->string('mime_type', 255);
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->foreignUlid('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};

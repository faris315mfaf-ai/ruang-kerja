<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rebuilt on every save of the mentionable (comment, task description).
        Schema::create('mentions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulidMorphs('mentionable');
            $table->foreignUlid('mentioned_user_id')->index()->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['mentionable_type', 'mentionable_id', 'mentioned_user_id']);
        });

        Schema::create('reactions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulidMorphs('reactable');
            $table->foreignUlid('user_id')->index()->constrained()->cascadeOnDelete();
            $table->string('emoji', 16);
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['reactable_type', 'reactable_id', 'user_id', 'emoji']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reactions');
        Schema::dropIfExists('mentions');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Personal data kept apart from `users` so it is never loaded by default.
        Schema::create('employee_profiles', function (Blueprint $table) {
            $table->foreignUlid('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('employee_number', 30)->nullable()->unique();
            $table->text('nik')->nullable(); // encrypted cast
            $table->string('phone', 30)->nullable();
            $table->date('birth_date')->nullable();
            $table->text('address')->nullable();
            $table->jsonb('emergency_contact')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_profiles');
    }
};

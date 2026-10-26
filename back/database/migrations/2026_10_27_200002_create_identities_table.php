<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->boolean('is_default')->default(false);
            $table->string('brand_name', 60);
            $table->foreignId('logo_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('favicon_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('og_image_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->json('colors');
            $table->string('font_heading', 30)->default('cairo');
            $table->string('font_body', 30)->default('cairo');
            $table->string('button_radius', 10)->default('md');
            $table->string('seo_title', 70)->nullable();
            $table->string('seo_title_suffix', 40)->nullable();
            $table->string('seo_description', 170)->nullable();
            $table->json('contact')->nullable();
            $table->json('socials')->nullable();
            $table->json('tracking')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('identities');
    }
};

<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            // Soft-deleted pages are renamed {slug}--deleted-{id} to free the slug.
            $table->string('slug', 120);
            $table->string('status', 20)->default('draft');
            $table->string('theme_key', 40);
            $table->foreign('theme_key')->references('key')->on('themes');
            $table->foreignId('identity_id')->constrained('identities')->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->restrictOnDelete();
            $table->json('draft_content');
            $table->json('published_content')->nullable();
            // Optimistic locking for the Builder.
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('published_at')->nullable();
            $table->boolean('is_home')->default(false);
            // 1 for the home page, null otherwise (unique per tenant → one home page).
            $table->unsignedTinyInteger('home_key')->nullable();
            $table->json('seo_override')->nullable();
            $table->json('tracking_override')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'home_key']);
            $table->index(['tenant_id', 'slug']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('landing_page_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained('media')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['landing_page_id', 'media_id']);
            $table->index(['tenant_id', 'media_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_media');
        Schema::dropIfExists('landing_pages');
    }
};

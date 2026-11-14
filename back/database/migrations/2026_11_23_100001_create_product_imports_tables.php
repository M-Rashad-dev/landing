<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Product imports from a sheet (.xlsx / .csv): the upload, the column mapping the merchant
 * confirmed, live counters while the queue works through it, and every product that failed
 * with its reasons and its original cells (to download, fix and upload again).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('uploaded');
            $table->string('source', 20)->default('generic');
            $table->string('file_name', 200);
            $table->string('file_path', 300)->nullable();
            $table->string('extension', 5);
            $table->unsignedInteger('file_size');
            $table->json('headers');
            $table->unsignedInteger('header_line')->default(1);
            $table->json('mapping')->nullable();
            $table->json('options')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('total_products')->default(0);
            $table->unsignedInteger('processed')->default(0);
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('images_total')->default(0);
            $table->unsignedInteger('images_done')->default(0);
            $table->unsignedInteger('images_failed')->default(0);
            $table->json('warnings')->nullable();
            $table->string('error', 300)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'id']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('product_import_failures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_import_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->string('identifier', 150)->nullable();
            $table->string('name', 200)->nullable();
            $table->json('reasons');
            $table->json('cells');
            $table->timestamps();

            $table->index(['product_import_id', 'row_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_import_failures');
        Schema::dropIfExists('product_imports');
    }
};

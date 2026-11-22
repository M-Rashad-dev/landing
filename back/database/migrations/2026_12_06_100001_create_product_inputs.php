<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «حسب الطلب» (docs/plans/digital-products.md, stage 2): fields the customer fills on the product (a text, a long
 * text, an image or a file), next to the options; they make no variants. Uploaded files wait in customer_uploads
 * (private disk) until an order claims them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_inputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);
            $table->string('label', 60);
            $table->string('placeholder', 120)->nullable();
            $table->boolean('is_required')->default(false);
            $table->decimal('price_delta', 12, 2)->default(0);
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'product_id']);
        });

        Schema::create('customer_uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('token', 40)->unique();
            $table->foreignId('product_input_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path', 255);
            $table->string('name', 200);
            $table->string('mime', 100);
            $table->unsignedInteger('size');
            $table->timestamps();

            $table->index(['order_item_id']);
            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_uploads');
        Schema::dropIfExists('product_inputs');
    }
};

<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A vector per store product (its name and description), so the AI quiz picks the products nearest to a
 * customer's answers out of a big catalog before asking the model. Rebuilt when the text or the model changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_vectors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // sha1 of the text the vector was made from: a changed product gets a new one.
            $table->char('hash', 40);
            $table->string('model', 120);
            $table->json('vector');
            $table->timestamps();

            $table->unique(['tenant_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_vectors');
    }
};

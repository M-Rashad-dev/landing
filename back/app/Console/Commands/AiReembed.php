<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Ai\Ai;
use App\Ai\Knowledge;
use App\Models\AiArticleChunk;
use Illuminate\Console\Command;

/**
 * After the embedding model changes (config ai.tasks.embedding), gives every knowledge-base piece a
 * vector of the new model now (vectors of different models can't be compared). Pieces of the old
 * model are not searched meanwhile. Needs the assistant's feature on and the provider configured.
 */
final class AiReembed extends Command
{
    protected $signature = 'ai:reembed';

    protected $description = 'Re-embed the support knowledge base with the current embedding model';

    public function handle(Knowledge $knowledge): int
    {
        $model = Ai::model('embedding');
        $this->info("Embedding model: {$model}");

        $done = 0;
        // Each run embeds what it can (batches); stop when nothing moves (the AI is off or failing).
        while (true) {
            $count = $knowledge->embedPending();
            $done += $count;
            if ($count === 0) {
                break;
            }
        }

        $left = AiArticleChunk::query()->where(fn ($q) => $q->whereNull('embedding')->orWhere('model', '!=', $model)->orWhereNull('model'))->count();
        $this->info("Embedded {$done} piece(s); {$left} still waiting.");
        Knowledge::forget();

        return $left === 0 ? self::SUCCESS : self::FAILURE;
    }
}

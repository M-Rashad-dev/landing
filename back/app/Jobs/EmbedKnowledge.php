<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\Knowledge;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Gives vectors to the knowledge-base pieces still without one (one run at a time). */
final class EmbedKnowledge implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $uniqueFor = 120;

    public function handle(Knowledge $knowledge): void
    {
        $knowledge->embedPending();
    }
}

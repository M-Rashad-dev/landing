<?php

declare(strict_types=1);

namespace App\Ai;

/**
 * Our interface over the AI provider (Qwen now; another provider = another class). Features never
 * use it directly: they go through App\Ai\Ai, which checks the switches and limits and records the
 * cost of every call. Every method throws AiError when the provider refuses or can't be reached.
 */
interface AiClient
{
    /** False when the keys are missing here (then nothing can be asked). */
    public function configured(): bool;

    /**
     * A conversation turn. A message's content is a text, or a list of parts:
     * ['type' => 'text', 'text' => '…'] and ['type' => 'image', 'url' => 'https://…'].
     *
     * @param  list<array{role: 'system'|'user'|'assistant', content: string|list<array<string, string>>}>  $messages
     * @param  array{max_tokens?: int, temperature?: float, json?: bool}  $options
     */
    public function chat(string $model, array $messages, array $options = []): AiReply;

    /**
     * One vector per text (same order).
     *
     * @param  list<string>  $texts
     */
    public function embed(string $model, array $texts): AiEmbeddings;
}

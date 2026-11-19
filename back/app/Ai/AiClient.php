<?php

declare(strict_types=1);

namespace App\Ai;

/**
 * Our interface over the AI provider (OpenRouter now; another provider = another class). Features never
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
     * @param  array{max_tokens?: int, temperature?: float, json?: bool, thinking?: bool, effort?: string}  $options
     */
    public function chat(string $model, array $messages, array $options = []): AiReply;

    /**
     * One vector per text (same order).
     *
     * @param  list<string>  $texts
     */
    public function embed(string $model, array $texts): AiEmbeddings;

    /**
     * A new image from a description (English works best). $aspect is a ratio like «1:1», «16:9».
     */
    public function generateImage(string $model, string $prompt, string $aspect = '1:1'): AiImage;

    /**
     * An edited copy of an image (a data URL: our files can't be reached from outside) following
     * the instruction: remove the background, studio background, better light…
     */
    public function editImage(string $model, string $imageDataUrl, string $instruction, string $aspect = '1:1'): AiImage;
}

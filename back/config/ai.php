<?php

declare(strict_types=1);

/*
 * AI (owner-approved provider: Qwen on Alibaba Cloud Model Studio, international / Singapore; keys in
 * .env only). Features ask App\Ai\Ai for a task; the task picks the model here, so changing a model
 * (or the provider) never touches the features. See docs/PROJECT.md «AI».
 */
return [
    // qwen = the real provider; fake = canned answers, nothing sent (tests and local e2e).
    'driver' => env('AI_DRIVER', 'qwen'),

    'qwen' => [
        'api_key' => env('QWEN_API_KEY'),
        // The workspace's OpenAI-compatible address (Model Studio → API Key → "openAiCompatible").
        'base_url' => env('QWEN_BASE_URL'),
        'timeout' => (int) env('QWEN_TIMEOUT', 60),
    ],

    // The model of each task (the strongest for now: owner, 2026-11-17).
    'tasks' => [
        'support' => env('AI_MODEL_SUPPORT', 'qwen4-max'),
        // The knowledge base and the questions searched in it (multilingual, Arabic included).
        'embedding' => env('AI_MODEL_EMBEDDING', 'qwen3.7-text-embedding'),
    ],

    // USD per 1M tokens (input, input served from the provider's cache, output), from the Model
    // Studio console (Singapore). A model missing here costs 0 and is flagged in the admin page.
    'prices' => [
        'qwen4-max' => ['input' => 1.5, 'cached' => 0.075, 'output' => 4.5],
        'qwen3.7-text-embedding' => ['input' => 0.07, 'output' => 0],
    ],

    // The support assistant: how many knowledge pieces it reads per question, and the least
    // likeness (cosine) a piece needs to count.
    'knowledge' => ['top' => 5, 'min_score' => 0.35, 'chunk_chars' => 900, 'batch' => 10],

    // Consecutive failures that pause the AI for a while (and tell the owner), and for how long.
    'breaker' => ['failures' => 3, 'pause_minutes' => 5],
];

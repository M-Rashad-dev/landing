<?php

declare(strict_types=1);

/*
 * AI (owner-approved provider: OpenRouter, 2026-11-18: one account for every model; keys in .env
 * only). Model ids carry their vendor («qwen/qwen4-max»); «:free» ids cost nothing (local trials).
 * The defaults here are the production models; a local .env may point a task at a free model. Features ask App\Ai\Ai for a task; the task picks the model here, so changing a model
 * (or the provider) never touches the features. See docs/PROJECT.md «AI».
 */
return [
    // openrouter = the real provider; fake = canned answers, nothing sent (tests and local e2e).
    'driver' => env('AI_DRIVER', 'openrouter'),

    'openrouter' => [
        'api_key' => env('OPENROUTER_API_KEY'),
        'base_url' => env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
        // A whole section or page design can take minutes.
        'timeout' => (int) env('AI_TIMEOUT', 180),
    ],

    // The model of each task (the strongest for production: owner, 2026-11-17).
    'tasks' => [
        'support' => env('AI_MODEL_SUPPORT', 'qwen/qwen4-max'),
        'designer' => env('AI_MODEL_DESIGNER', 'anthropic/claude-sonnet-5.5'),
        // The store copilot (tool calling), and the bulk texts it writes (descriptions, SEO).
        'copilot' => env('AI_MODEL_COPILOT', 'anthropic/claude-sonnet-5.5'),
        'copilot_content' => env('AI_MODEL_COPILOT_CONTENT', 'anthropic/claude-sonnet-5.5'),
        // The knowledge base and the questions searched in it (multilingual, Arabic included).
        // Changing it re-embeds every piece (php artisan ai:reembed).
        'embedding' => env('AI_MODEL_EMBEDDING', 'qwen/qwen3-embedding-8b'),
        // Images (the AI designer): new images, and edits of the merchant's photos.
        'image_generate' => env('AI_MODEL_IMAGE_GENERATE', 'google/gemini-nano-banana-2.1'),
        'image_edit' => env('AI_MODEL_IMAGE_EDIT', 'google/gemini-nano-banana-2.1'),
    ],

    // Reasoning effort per chat task (low | medium | high | xhigh | max | none), or null for the
    // client's light thinking budget (512 tokens).
    'effort' => [
        'support' => env('AI_EFFORT_SUPPORT'),
        'designer' => env('AI_EFFORT_DESIGNER', 'medium'),
        // Low: the copilot's hard work (math, validation) is done by PHP, so rounds stay fast and cheap.
        'copilot' => env('AI_EFFORT_COPILOT', 'low'),
        'copilot_content' => env('AI_EFFORT_COPILOT_CONTENT', 'none'),
    ],

    // The store copilot's tool loop (docs/plans/ai-copilot.md §3.5): the most model rounds per merchant
    // message, and the most one message may spend (USD) before it must answer with what it has.
    'copilot' => [
        'max_rounds' => (int) env('AI_COPILOT_MAX_ROUNDS', 8),
        'max_message_usd' => (float) env('AI_COPILOT_MAX_MESSAGE_USD', 0.50),
        'max_output' => 4000,
    ],

    // Models whose prompt cache needs explicit cache_control marks (OpenRouter → Anthropic).
    'cache_control_prefixes' => ['anthropic/'],

    // USD per image (an estimate for checking the balance before; the real cost OpenRouter reports
    // is what gets charged). «:free» models cost nothing.
    'image_prices' => [
        'google/gemini-nano-banana-2.1' => 0.04,
        'recraft/recraft-v4.1-flash-v2' => 0.007,
    ],

    // Image models that answer with an image only (no text alongside).
    'image_only_models' => ['recraft/recraft-v4.1-flash-v2:free', 'recraft/recraft-v4.1-flash-v2'],

    // Models on OpenRouter that reject `temperature` (e.g. adaptive-reasoning Claude models).
    'without_temperature' => [
        'anthropic/claude-opus-5.5',
        'anthropic/claude-sonnet-5.5',
        'anthropic/claude-opus-5',
        'anthropic/claude-sonnet-5',
        'anthropic/claude-opus-4.8',
        'anthropic/claude-opus-4.7',
    ],

    // USD per 1M tokens (input, input served from the provider's cache, output), from OpenRouter's
    // model pages. «:free» models cost 0; any other model missing here costs 0 and is flagged in
    // the admin page.
    'prices' => [
        'anthropic/claude-opus-5.5' => ['input' => 4.0, 'cached' => 0.2, 'output' => 20.0],
        'anthropic/claude-sonnet-5.5' => ['input' => 2.0, 'cached' => 0.1, 'output' => 10.0],
        'qwen/qwen4-max' => ['input' => 1.425, 'cached' => 0.075, 'output' => 4.275],
        'qwen/qwen3-embedding-8b' => ['input' => 0.01, 'output' => 0],
    ],

    // The support assistant: how many knowledge pieces it reads per question, and the least
    // likeness (cosine) a piece needs to count.
    'knowledge' => ['top' => 5, 'min_score' => 0.35, 'chunk_chars' => 900, 'batch' => 10, 'cache_store' => env('AI_VECTORS_CACHE', 'file')],

    // Consecutive failures that pause the AI for a while (and tell the owner), and for how long.
    'breaker' => ['failures' => 3, 'pause_minutes' => 5],
];

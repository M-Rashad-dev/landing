<?php

declare(strict_types=1);

use App\Messaging\WhatsApp\WhatsAppTemplates;

/*
| Meta refuses some templates outright; these rules catch them before they are ever submitted.
*/

it('never starts or ends a template body with a variable (Meta refuses it)', function () {
    foreach (WhatsAppTemplates::definitions() as $definition) {
        foreach ($definition['components'] as $component) {
            if ($component['type'] !== 'BODY' || ! isset($component['text'])) {
                continue;
            }
            // Punctuation and spaces around don't count as text for Meta.
            $text = trim((string) preg_replace('/[\s.,،:!؟?]+/u', ' ', $component['text']));
            expect($text)->not->toMatch('/^\{\{\d+\}\}/', $definition['name'].' starts with a variable')
                ->and($text)->not->toMatch('/\{\{\d+\}\}$/', $definition['name'].' ends with a variable');
        }
    }
});

it('numbers the variables 1, 2, 3… with one example each, and versions every name', function () {
    foreach (WhatsAppTemplates::definitions() as $definition) {
        expect($definition['name'])->toMatch('/_v\d+$/');
        foreach ($definition['components'] as $component) {
            if ($component['type'] !== 'BODY' || ! isset($component['text'])) {
                continue;
            }
            preg_match_all('/\{\{(\d+)\}\}/', $component['text'], $m);
            $numbers = array_map('intval', $m[1]);
            expect($numbers)->toBe(range(1, count($numbers)), $definition['name'])
                ->and($component['example']['body_text'][0])->toHaveCount(count($numbers));
        }
    }
});

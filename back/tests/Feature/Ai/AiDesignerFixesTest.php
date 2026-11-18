<?php

declare(strict_types=1);

use App\Ai\Designer\AiDesigner;
use App\Ai\Designer\AiSectionCss;

it('turns width media queries into container queries and keeps the others', function () {
    $result = AiSectionCss::scope(
        '.grid{display:grid}'
        .'@media (min-width: 640px){.grid{grid-template-columns:repeat(3,1fr)}}'
        .'@media screen and (max-width: 40rem) and (min-width: 20rem){.card{padding:8px}}'
        .'@media (prefers-reduced-motion: reduce){.card{transition:none}}',
        '7',
    );

    expect($result['errors'])->toBe([])
        ->and($result['css'])->toContain('@container aisec (min-width: 640px)')
        ->and($result['css'])->toContain('@container aisec (max-width: 40rem) and (min-width: 20rem)')
        ->and($result['css'])->toContain('@media (prefers-reduced-motion: reduce)')
        ->and($result['css'])->not->toContain('@media (min-width')
        ->and($result['css'])->toContain('[data-ai-v="7"] .grid');
});

it('reads only width conditions as container queries', function () {
    expect(AiSectionCss::containerArgs('(min-width: 1024px)'))->toBe('aisec (min-width: 1024px)')
        ->and(AiSectionCss::containerArgs('only screen and (max-width: 600px)'))->toBe('aisec (max-width: 600px)')
        ->and(AiSectionCss::containerArgs('(hover: hover)'))->toBeNull()
        ->and(AiSectionCss::containerArgs('print'))->toBeNull();
});

it('reads an AI answer wrapped in a list, in fences or with words around it', function () {
    expect(AiDesigner::decodeJson('[{"reply": "تمام"}]'))->toBe(['reply' => 'تمام'])
        ->and(AiDesigner::decodeJson("```json\n{\"reply\": \"أهلا\"}\n```"))->toBe(['reply' => 'أهلا'])
        ->and(AiDesigner::decodeJson('خد ده: {"reply": "تم"} تمام؟'))->toBe(['reply' => 'تم'])
        ->and(AiDesigner::decodeJson('[1, 2]'))->toBeNull()
        ->and(AiDesigner::decodeJson('مفيش'))->toBeNull();
});

<?php

declare(strict_types=1);

use App\Ai\Designer\AiSectionCss;
use App\Ai\Designer\AiSectionSanitizer;
use App\Ai\Designer\AiTemplate;

/** The cleaned HTML of an AI template. */
function cleanHtml(string $html): string
{
    return AiSectionSanitizer::clean($html)['html'];
}

it('removes every script vector and keeps the safe template', function (string $attack, string $mustNotContain) {
    $html = cleanHtml('<section class="wrap"><h2>{{title}}</h2>'.$attack.'<p>آمن</p></section>');

    expect(mb_strtolower($html))->not->toContain(mb_strtolower($mustNotContain))
        ->and($html)->toContain('{{title}}')
        ->and($html)->toContain('آمن');
})->with([
    'script tag' => ['<script>alert(1)</script>', '<script'],
    'img onerror' => ['<img src="{{img a}}" onerror="alert(1)">', 'onerror'],
    'javascript href' => ['<a href="javascript:alert(1)">x</a>', 'javascript:'],
    'mixed case javascript' => ['<a href="JaVaScRiPt:alert(1)">x</a>', 'javascript:'],
    'entity encoded javascript' => ['<a href="java&#x73;cript:alert(1)">x</a>', 'cript:alert'],
    'data href' => ['<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', 'data:text'],
    'protocol relative href' => ['<a href="//evil.com">x</a>', 'evil.com'],
    'svg script' => ['<svg><script>alert(1)</script></svg>', '<script'],
    'svg onload' => ['<svg onload="alert(1)"><path d="M0 0"/></svg>', 'onload'],
    'iframe' => ['<iframe src="https://evil.com"></iframe>', '<iframe'],
    'form and input' => ['<form action="https://evil.com"><input name="card"></form>', '<form'],
    'style tag' => ['<style>body{display:none}</style>', '<style'],
    'style attribute' => ['<div style="position:fixed;inset:0">x</div>', 'style='],
    'srcset' => ['<img src="{{img a}}" srcset="https://evil.com/a.jpg 1x">', 'srcset'],
    'svg use href' => ['<svg><use href="https://evil.com/x.svg#a"></use></svg>', '<use'],
    'math' => ['<math><mi>x</mi></math>', '<math'],
    'template' => ['<template><img src=x onerror=alert(1)></template>', 'onerror'],
    'noscript' => ['<noscript><img src=x onerror=alert(1)></noscript>', 'onerror'],
    'uppercase handler' => ['<div ONCLICK="alert(1)">x</div>', 'onclick'],
    'object embed' => ['<object data="x.swf"></object><embed src="x.swf"></embed>', '<object'],
    'meta refresh' => ['<meta http-equiv="refresh" content="0;url=https://evil.com">', '<meta'],
]);

it('keeps allowed behaviours and drops unknown ones, and makes buttons plain buttons', function () {
    $html = cleanHtml('<div data-ai-behavior="slider" data-ai-autoplay="3000"><div data-ai-track></div></div><div data-ai-behavior="evil">x</div><button type="submit">ok</button><marquee>m</marquee>');

    expect($html)->toContain('data-ai-behavior="slider"')
        ->and($html)->not->toContain('evil')
        ->and($html)->toContain('type="button"')
        ->and($html)->not->toContain('type="submit"')
        ->and($html)->not->toContain('<marquee')
        ->and($html)->toContain('m');
});

it('keeps image sources only as our image tokens', function () {
    $html = cleanHtml('<img src="https://evil.com/track.gif"><img src="{{img banner}}" alt="بنر">');

    expect($html)->not->toContain('evil.com')
        ->and($html)->toContain('{{img banner}}');
});

it('refuses templates that use unknown fields or tokens in the wrong place', function () {
    $fields = [['key' => 'title', 'type' => 'text', 'label' => 'العنوان'], ['key' => 'banner', 'type' => 'image', 'label' => 'البنر']];

    expect(AiTemplate::validate('<h2>{{title}}</h2><img src="{{img banner}}">', $fields, 'store'))->toBe([])
        ->and(AiTemplate::validate('<h2>{{nope}}</h2>', $fields, 'store'))->not->toBe([])
        ->and(AiTemplate::validate('<a href="{{img banner}}">x</a>', $fields, 'store'))->not->toBe([])
        ->and(AiTemplate::validate('{{#each banner}}x{{/each}}', $fields, 'store'))->not->toBe([])
        ->and(AiTemplate::validate('<a href="{{order_link}}">x</a>', $fields, 'store'))->not->toBe([])
        ->and(AiTemplate::validate('{{#if title}}x', $fields, 'store'))->not->toBe([]);
});

it('scopes every selector and drops dangerous CSS', function () {
    $result = AiSectionCss::scope(
        '@import url(https://evil.com/a.css);'
        .'@font-face{font-family:x;src:url(https://evil.com/f.woff)}'
        .':root{--x:1}body{color:red}.card{background:url(https://evil.com/t.gif);position:fixed;z-index:99999;font-family:Comic Sans MS}'
        .'.x{width:expression(alert(1))}'
        .'@keyframes spin{to{transform:rotate(360deg)}}.s{animation:spin 1s linear infinite}',
        '42',
    );
    $css = $result['css'];

    expect($css)->not->toContain('@import')
        ->and($css)->not->toContain('@font-face')
        ->and($css)->not->toContain('url(')
        ->and($css)->not->toContain('expression(')
        ->and($css)->not->toContain('position: fixed')
        ->and($css)->not->toContain('position:fixed')
        ->and($css)->not->toContain('99999')
        ->and($css)->toContain('[data-ai-v="42"] .card')
        ->and($css)->toContain('var(--ai-font-body)')
        ->and($css)->toContain('ai42-spin')
        ->and($css)->not->toMatch('/(^|\})\s*body\s*\{/');
});

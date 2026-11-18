<?php

declare(strict_types=1);

namespace App\Ai;

/**
 * The AI for tests and local e2e (AI_DRIVER=fake): nothing leaves the server and nothing is paid.
 * Answers what was queued (texts or AiError), else a fixed reply; vectors are a stable hash of
 * the text, so the same text always lands on the same vector.
 */
final class FakeAiClient implements AiClient
{
    /** @var list<string|AiError> */
    private array $queue = [];

    /** @var list<array{model: string, messages: array<int, mixed>, options: array<string, mixed>}> */
    public array $chats = [];

    /** @var list<list<string>> */
    public array $embedded = [];

    public function __construct(private bool $configured = true) {}

    public function configured(): bool
    {
        return $this->configured;
    }

    /** The next answers, in order (an AiError is thrown instead of answered). */
    public function answer(string|AiError ...$replies): self
    {
        array_push($this->queue, ...$replies);

        return $this;
    }

    public function chat(string $model, array $messages, array $options = []): AiReply
    {
        $this->chats[] = ['model' => $model, 'messages' => $messages, 'options' => $options];
        $next = array_shift($this->queue) ?? 'تمام.';
        if ($next instanceof AiError) {
            throw $next;
        }

        return new AiReply($next, $model, inputTokens: 1000, outputTokens: 200, cachedTokens: 400);
    }

    /** @var list<array{model: string, prompt: string, edit: bool}> */
    public array $images = [];

    public function generateImage(string $model, string $prompt, string $aspect = '1:1'): AiImage
    {
        $this->images[] = ['model' => $model, 'prompt' => $prompt, 'edit' => false];

        return new AiImage(self::png(hexdec(substr(hash('sha256', $prompt), 0, 6))), 'image/png', $model, 0.0);
    }

    public function editImage(string $model, string $imageDataUrl, string $instruction, string $aspect = '1:1'): AiImage
    {
        $this->images[] = ['model' => $model, 'prompt' => $instruction, 'edit' => true];

        return new AiImage(self::png(hexdec(substr(hash('sha256', $instruction), 0, 6))), 'image/png', $model, 0.0);
    }

    /** A real 512×512 PNG of one soft colour (GD), so saving and showing it works like a real image. */
    private static function png(int $rgb): string
    {
        $image = imagecreatetruecolor(512, 512);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 128 + (($rgb >> 16) & 127), 128 + (($rgb >> 8) & 127), 128 + ($rgb & 127)));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    public function embed(string $model, array $texts): AiEmbeddings
    {
        $this->embedded[] = array_values($texts);

        return new AiEmbeddings(array_map(fn (string $t) => self::vector($t), array_values($texts)), $model, inputTokens: 10 * count($texts));
    }

    /** @return list<float> */
    public static function vector(string $text, int $size = 16): array
    {
        $hash = hash('sha256', mb_strtolower(trim($text)));

        return array_map(fn (int $i) => (hexdec(substr($hash, $i * 2, 2)) - 127.5) / 127.5, range(0, $size - 1));
    }
}

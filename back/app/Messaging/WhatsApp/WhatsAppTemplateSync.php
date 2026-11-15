<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

/**
 * The platform's templates (WhatsAppTemplates) next to what Meta has: status of each, and
 * submitting the missing ones. An existing name is never re-sent (a wording change = a new name).
 */
final class WhatsAppTemplateSync
{
    public function __construct(private readonly WhatsAppGateway $gateway) {}

    /**
     * Each template the platform needs, with Meta's status (MISSING = not submitted yet).
     *
     * @return list<array{name: string, category: string, status: string, rejected_reason: string|null}>
     */
    public function status(): array
    {
        return $this->rows($this->onMeta());
    }

    /**
     * Submits the missing templates; one refusal doesn't stop the others.
     *
     * @return array{templates: list<array{name: string, category: string, status: string, rejected_reason: string|null}>, submitted: list<string>, errors: array<string, string>}
     */
    public function push(): array
    {
        $onMeta = $this->onMeta();
        $submitted = [];
        $errors = [];

        foreach (WhatsAppTemplates::definitions() as $definition) {
            $name = (string) $definition['name'];
            if (isset($onMeta[$name])) {
                continue;
            }
            try {
                $status = $this->gateway->createTemplate($definition);
                $onMeta[$name] = ['category' => (string) $definition['category'], 'status' => $status, 'rejected_reason' => null];
                $submitted[] = $name;
            } catch (WhatsAppError $e) {
                $errors[$name] = $e->title;
            }
        }

        return ['templates' => $this->rows($onMeta), 'submitted' => $submitted, 'errors' => $errors];
    }

    /** @return array<string, array{category: string, status: string, rejected_reason: string|null}> */
    private function onMeta(): array
    {
        $byName = [];
        foreach ($this->gateway->templates() as $row) {
            if ($row['language'] === WhatsAppTemplates::LANGUAGE) {
                $byName[$row['name']] = ['category' => $row['category'], 'status' => $row['status'], 'rejected_reason' => $row['rejected_reason']];
            }
        }

        return $byName;
    }

    /**
     * @param  array<string, array{category: string, status: string, rejected_reason: string|null}>  $onMeta
     * @return list<array{name: string, category: string, status: string, rejected_reason: string|null}>
     */
    private function rows(array $onMeta): array
    {
        $categories = array_column(WhatsAppTemplates::definitions(), 'category', 'name');

        return array_map(fn (string $name): array => [
            'name' => $name,
            'category' => $onMeta[$name]['category'] ?? (string) ($categories[$name] ?? ''),
            'status' => $onMeta[$name]['status'] ?? 'MISSING',
            'rejected_reason' => $onMeta[$name]['rejected_reason'] ?? null,
        ], WhatsAppTemplates::names());
    }
}

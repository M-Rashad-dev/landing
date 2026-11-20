<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;

/**
 * «نزّل إكسيل» under a copilot table: the same source the table came from (a resource with its filters, or a report
 * with its params). The catalog checks every key again, like a tool call.
 */
final class CopilotExportRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'source' => ['required', 'array'],
            'source.resource' => ['required_without:source.report', 'nullable', 'string', 'max:40'],
            'source.filters' => ['nullable', 'array'],
            'source.sort' => ['nullable', 'string', 'max:40'],
            'source.report' => ['required_without:source.resource', 'nullable', 'string', 'max:40'],
            'source.params' => ['nullable', 'array'],
            'filename' => ['nullable', 'string', 'max:80'],
        ];
    }

    /** @return array<string, mixed> */
    public function source(): array
    {
        $source = (array) $this->validated('source');

        return isset($source['resource'])
            ? ['resource' => (string) $source['resource'], 'filters' => (array) ($source['filters'] ?? []), 'sort' => $source['sort'] ?? null]
            : ['report' => (string) $source['report'], 'params' => (array) ($source['params'] ?? [])];
    }
}

<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

use App\Support\CairoTime;
use Carbon\CarbonImmutable;
use Throwable;

/**
 * A period of Cairo days for reports and date filters: a preset (today, last_7_days, this_month…) or from / to
 * (YYYY-MM-DD, both included). Default: the last 30 days. At most 366 days, like the dashboard.
 */
final class Period
{
    public const PRESETS = ['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'this_week', 'this_month', 'last_month', 'this_year'];

    public const MAX_DAYS = 366;

    private function __construct(public readonly CarbonImmutable $from, public readonly CarbonImmutable $to) {}

    /** JSON Schema properties for a period, to put in a report's params. */
    public static function schema(): array
    {
        return [
            'period' => ['type' => 'string', 'enum' => self::PRESETS, 'description' => 'A preset in Cairo time (default last_30_days).'],
            'from' => ['type' => 'string', 'description' => 'YYYY-MM-DD (instead of period).'],
            'to' => ['type' => 'string', 'description' => 'YYYY-MM-DD, included (instead of period).'],
        ];
    }

    /** @param array<string, mixed> $params */
    public static function from(array $params, string $default = 'last_30_days'): self
    {
        if (isset($params['from']) || isset($params['to'])) {
            $today = self::today();
            $to = isset($params['to']) ? self::day((string) $params['to']) : $today;
            $from = isset($params['from']) ? self::day((string) $params['from']) : $to->subDays(29);
            if ($from->greaterThan($to)) {
                throw new CopilotToolError('from must be on or before to.');
            }
            if ($from->diffInDays($to) + 1 > self::MAX_DAYS) {
                throw new CopilotToolError('A period is at most '.self::MAX_DAYS.' days.');
            }

            return new self($from, $to);
        }

        return self::preset(isset($params['period']) ? (string) $params['period'] : $default);
    }

    public static function preset(string $name): self
    {
        $today = self::today();

        return match ($name) {
            'today' => new self($today, $today),
            'yesterday' => new self($today->subDay(), $today->subDay()),
            'last_7_days' => new self($today->subDays(6), $today),
            'last_30_days' => new self($today->subDays(29), $today),
            'last_90_days' => new self($today->subDays(89), $today),
            // The Egyptian week starts on Saturday.
            'this_week' => new self($today->subDays(($today->dayOfWeek + 1) % 7), $today),
            'this_month' => new self($today->startOfMonth(), $today),
            'last_month' => new self($today->subMonthNoOverflow()->startOfMonth(), $today->subMonthNoOverflow()->endOfMonth()->startOfDay()),
            'this_year' => new self($today->startOfYear(), $today),
            default => throw new CopilotToolError('Unknown period «'.$name.'». Use one of: '.implode(', ', self::PRESETS).', or from / to.'),
        };
    }

    public function days(): int
    {
        return (int) $this->from->diffInDays($this->to) + 1;
    }

    /** @return array{from: string, to: string, days: int} */
    public function toArray(): array
    {
        return ['from' => $this->from->toDateString(), 'to' => $this->to->toDateString(), 'days' => $this->days()];
    }

    /** Start (UTC) of the first day and the start (UTC) of the day after the last, for created_at >= / <. */
    public function utcBounds(): array
    {
        return [$this->from->utc(), $this->to->addDay()->utc()];
    }

    private static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(CairoTime::ZONE)->startOfDay();
    }

    private static function day(string $value): CarbonImmutable
    {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            throw new CopilotToolError("Dates are YYYY-MM-DD, got «{$value}».");
        }
        try {
            return CarbonImmutable::createFromFormat('Y-m-d', $value, CairoTime::ZONE)->startOfDay();
        } catch (Throwable) {
            throw new CopilotToolError("Not a real date: «{$value}».");
        }
    }
}

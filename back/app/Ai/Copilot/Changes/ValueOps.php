<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Support\CairoTime;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Throwable;

/**
 * The change math (docs/plans/ai-copilot.md §3.4): the model sends an operation, PHP computes every value. Money is
 * computed in integer piastres: percent = round_half_up(old × (100 + p) / 100), then an optional rounding to the
 * nearest / next / previous 1, 5, 10, 50 or 100 pounds. The result is never negative.
 */
final class ValueOps
{
    public const ROUND_TO = [1, 5, 10, 50, 100];

    public const ROUND_MODES = ['nearest', 'up', 'down'];

    /**
     * Checks an operation before any row is read: one known op for the field type (money may add `round`).
     *
     * @param  array<string, mixed>  $op
     */
    public static function check(Field $field, mixed $op): void
    {
        if (! is_array($op) || $op === [] || array_is_list($op)) {
            throw new CopilotToolError("Change for {$field->key} must be an object like {\"set\": …} (ops: ".implode(', ', $field->ops()).').');
        }
        $main = array_values(array_diff(array_keys($op), ['round']));
        if (count($main) !== 1 || ! in_array($main[0], $field->ops(), true)) {
            throw new CopilotToolError("{$field->key} takes exactly one of: ".implode(', ', $field->ops()).'.');
        }
        if (isset($op['round'])) {
            if ($field->type !== 'money' || ! is_array($op['round']) || ! in_array((int) ($op['round']['to'] ?? 0), self::ROUND_TO, true)
                || ! in_array((string) ($op['round']['mode'] ?? 'nearest'), self::ROUND_MODES, true)) {
                throw new CopilotToolError('round is {to: 1|5|10|50|100, mode: nearest|up|down}, for money only.');
            }
        }
        $value = $op[$main[0]];
        $numeric = $field->type === 'ids' ? false : (in_array($main[0], ['add', 'percent', 'shift_days'], true) || ($main[0] === 'set' && in_array($field->type, ['money', 'int'], true)));
        if ($numeric && ! is_numeric($value)) {
            throw new CopilotToolError("{$field->key}.{$main[0]} needs a number.");
        }
        if ($field->type === 'ids' && (! is_array($value) || array_filter($value, fn ($id) => ! is_numeric($id)) !== [])) {
            throw new CopilotToolError("{$field->key}.{$main[0]} needs a list of ids.");
        }
        if ($main[0] === 'percent' && ((float) $value <= -100 || (float) $value > 1000)) {
            throw new CopilotToolError('percent must be above -100 and at most 1000.');
        }
    }

    /**
     * The new value of one field from its current value.
     *
     * @param  array<string, mixed>  $op
     */
    public static function apply(Field $field, mixed $current, array $op): mixed
    {
        $name = array_values(array_diff(array_keys($op), ['round']))[0];
        $value = $op[$name];

        return match ($field->type) {
            'money' => self::money($current, $name, $value, $op['round'] ?? null),
            'int' => match ($name) {
                'set' => max(0, (int) $value),
                'add' => max(0, (int) $current + (int) $value),
            },
            'bool' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'enum' => in_array((string) $value, $field->values, true) ? (string) $value : throw new CopilotToolError("{$field->key} is one of: ".implode(', ', $field->values).'.'),
            'text', 'textarea' => self::text((string) ($current ?? ''), $name, $value),
            'date' => self::date($current, $name, $value),
            'ids' => self::ids((array) ($current ?? []), $name, $value),
            'media' => $value === null || $value === '' ? null : (is_numeric($value) ? (int) $value : throw new CopilotToolError("{$field->key} needs a media id.")),
            default => throw new CopilotToolError("{$field->key} can't be changed."),
        };
    }

    /** Values compared for «did it change» and for the stale check (money as cents, ids sorted). */
    public static function same(Field $field, mixed $a, mixed $b): bool
    {
        return match ($field->type) {
            'money' => ($a === null || $a === '') === ($b === null || $b === '') && ($a === null || $a === '' || Money::toCents((string) $a) === Money::toCents((string) $b)),
            'int' => (int) $a === (int) $b && ($a === null) === ($b === null),
            'bool' => (bool) $a === (bool) $b,
            'ids' => self::sortedIds((array) ($a ?? [])) === self::sortedIds((array) ($b ?? [])),
            default => (string) ($a ?? '') === (string) ($b ?? ''),
        };
    }

    /**
     * The operation in Arabic for the merchant («زيادة 30% وتقريب لأقرب 5 جنيه»).
     *
     * @param  array<string, mixed>  $op
     */
    public static function describe(Field $field, array $op): string
    {
        $name = array_values(array_diff(array_keys($op), ['round']))[0];
        $value = $op[$name];
        $text = match ($name) {
            'set' => match ($field->type) {
                'bool' => $value ? 'تفعيل' : 'إيقاف',
                'money' => 'تغيير إلى '.Money::toDecimal(Money::toCents((string) $value)).' ج.م',
                default => 'تغيير إلى '.(is_scalar($value) ? (string) $value : implode('، ', (array) $value)),
            },
            'add' => ((float) $value >= 0 ? 'زيادة ' : 'تقليل ').abs((float) $value).($field->type === 'money' ? ' ج.م' : ''),
            'percent' => ((float) $value >= 0 ? 'زيادة ' : 'خصم ').abs((float) $value).'%',
            'clear' => 'مسح القيمة',
            'replace' => 'استبدال «'.mb_substr((string) ($value['find'] ?? ''), 0, 30).'» بـ «'.mb_substr((string) ($value['with'] ?? ''), 0, 30).'»',
            'prepend' => 'إضافة في الأول',
            'append' => 'إضافة في الآخر',
            'shift_days' => 'تأجيل '.(int) $value.' يوم',
            'remove' => 'إزالة',
            default => $name,
        };
        if (isset($op['round'])) {
            $mode = ['nearest' => 'لأقرب', 'up' => 'لأعلى', 'down' => 'لأقل'][$op['round']['mode'] ?? 'nearest'];
            $text .= " وتقريب {$mode} ".(int) $op['round']['to'].' ج.م';
        }

        return "{$field->label}: {$text}";
    }

    private static function money(mixed $current, string $name, mixed $value, ?array $round): ?string
    {
        if ($name === 'clear') {
            return null;
        }
        $cents = Money::toCents((string) ($current ?? '0'));
        $cents = match ($name) {
            'set' => Money::toCents((string) $value),
            'add' => $cents + Money::toCents((string) $value),
            'percent' => (int) round($cents * (100 + (float) $value) / 100, 0, PHP_ROUND_HALF_UP),
        };
        if ($round !== null) {
            $unit = (int) $round['to'] * 100;
            $cents = (int) match ($round['mode'] ?? 'nearest') {
                'up' => ceil($cents / $unit) * $unit,
                'down' => floor($cents / $unit) * $unit,
                default => round($cents / $unit, 0, PHP_ROUND_HALF_UP) * $unit,
            };
        }

        return Money::toDecimal(max(0, $cents));
    }

    private static function text(string $current, string $name, mixed $value): string
    {
        return match ($name) {
            'set' => (string) $value,
            'replace' => is_array($value) && isset($value['find']) && (string) $value['find'] !== ''
                ? str_replace((string) $value['find'], (string) ($value['with'] ?? ''), $current)
                : throw new CopilotToolError('replace is {find, with}.'),
            'prepend' => (string) $value.$current,
            'append' => $current.(string) $value,
        };
    }

    private static function date(mixed $current, string $name, mixed $value): ?string
    {
        if ($name === 'set') {
            if ($value === null || $value === '') {
                return null;
            }
            try {
                // Cairo wall time from the model («2026-11-30» or «2026-11-30 23:59»).
                $at = strlen((string) $value) === 10
                    ? CarbonImmutable::createFromFormat('Y-m-d H:i', $value.' 23:59', CairoTime::ZONE)
                    : CarbonImmutable::createFromFormat('Y-m-d H:i', (string) $value, CairoTime::ZONE);
            } catch (Throwable) {
                throw new CopilotToolError('Dates are «YYYY-MM-DD» or «YYYY-MM-DD HH:MM» (Cairo).');
            }

            return $at->utc()->format('Y-m-d H:i:s');
        }
        if ($current === null || $current === '') {
            return null;
        }

        return CarbonImmutable::parse((string) $current, 'UTC')->addDays((int) $value)->format('Y-m-d H:i:s');
    }

    /** @return list<int> */
    private static function ids(array $current, string $name, mixed $value): array
    {
        $given = array_values(array_unique(array_map('intval', (array) $value)));
        $current = array_map('intval', $current);

        return self::sortedIds(match ($name) {
            'set' => $given,
            'add' => array_merge($current, $given),
            'remove' => array_diff($current, $given),
        });
    }

    /** @return list<int> */
    private static function sortedIds(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        sort($ids);

        return $ids;
    }
}

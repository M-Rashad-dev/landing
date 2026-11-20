<?php

declare(strict_types=1);

namespace App\Ai\Copilot;

use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\Contracts\CopilotCapability;
use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Models\AdminAuditLog;
use App\Models\AiUsage;
use App\Models\AiWallet;
use App\Models\AiWalletEntry;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Plan;
use App\Models\PlanFeatureValue;
use App\Models\PlanPrice;
use App\Models\PlatformSetting;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use ReflectionClass;
use Symfony\Component\Finder\Finder;

/**
 * Every resource, report and action the copilot knows, found on their own in app/Ai/Copilot/{Resources,Reports,
 * Actions} (docs/plans/ai-copilot.md §3.3): a new platform feature joins the copilot with one file, nothing else
 * to register. A class that breaks the contract (a forbidden model, a duplicate key…) is refused here and fails
 * the contract test.
 */
final class CopilotCatalog
{
    /** Folder → the base class its files extend. */
    public const FOLDERS = ['Resources' => CopilotResource::class, 'Reports' => CopilotReport::class, 'Actions' => CopilotAction::class];

    /** Models the copilot may never touch: money, plans, accounts, the platform itself. */
    public const FORBIDDEN_MODELS = [
        Invoice::class, Payment::class, PaymentMethod::class, Subscription::class, Plan::class, PlanPrice::class,
        PlanFeatureValue::class, AiWallet::class, AiWalletEntry::class, AiUsage::class, User::class, Tenant::class,
        AdminAuditLog::class, PlatformSetting::class,
    ];

    /** @var list<class-string<CopilotCapability>>|null found once per process */
    private static ?array $discovered = null;

    /** @var array<string, CopilotCapability>|null */
    private ?array $items = null;

    /** @param list<class-string<CopilotCapability>>|null $classes the classes to use (tests); null = discover */
    public function __construct(private readonly ?array $classes = null) {}

    /** @return list<class-string<CopilotCapability>> */
    public static function discover(): array
    {
        if (self::$discovered !== null) {
            return self::$discovered;
        }
        $found = [];
        foreach (self::FOLDERS as $folder => $base) {
            $dir = app_path("Ai/Copilot/{$folder}");
            if (! is_dir($dir)) {
                continue;
            }
            foreach ((new Finder)->files()->in($dir)->name('*.php')->sortByName() as $file) {
                $relative = str_replace(['/', '.php'], ['\\', ''], $file->getRelativePathname());
                $class = "App\\Ai\\Copilot\\{$folder}\\{$relative}";
                if (class_exists($class) && is_subclass_of($class, $base) && ! (new ReflectionClass($class))->isAbstract()) {
                    $found[] = $class;
                }
            }
        }

        return self::$discovered = $found;
    }

    /** @return array<string, CopilotCapability> key → instance (every one, available or not) */
    public function all(): array
    {
        if ($this->items !== null) {
            return $this->items;
        }
        $items = [];
        foreach ($this->classes ?? self::discover() as $class) {
            $item = app($class);
            if (self::problems($item) === [] && ! isset($items[$item->key()])) {
                $items[$item->key()] = $item;
            } else {
                report(new \LogicException("Copilot refused {$class}: ".implode('; ', self::problems($item) ?: ['duplicate key'])));
            }
        }

        return $this->items = $items;
    }

    /** @return array<string, CopilotCapability> what this store may use now */
    public function available(CopilotContext $ctx): array
    {
        return array_filter($this->all(), fn (CopilotCapability $c) => $c->available($ctx));
    }

    public function find(string $key, CopilotContext $ctx): ?CopilotCapability
    {
        $item = $this->all()[$key] ?? null;

        return $item !== null && $item->available($ctx) ? $item : null;
    }

    public function resource(string $key, CopilotContext $ctx): ?CopilotResource
    {
        $item = $this->find($key, $ctx);

        return $item instanceof CopilotResource ? $item : null;
    }

    public function report(string $key, CopilotContext $ctx): ?CopilotReport
    {
        $item = $this->find($key, $ctx);

        return $item instanceof CopilotReport ? $item : null;
    }

    public function action(string $key, CopilotContext $ctx): ?CopilotAction
    {
        $item = $this->find($key, $ctx);

        return $item instanceof CopilotAction ? $item : null;
    }

    /** @return array<string, CopilotResource> */
    public function resources(CopilotContext $ctx): array
    {
        return array_filter($this->available($ctx), fn ($c) => $c instanceof CopilotResource);
    }

    /** @return array<string, CopilotReport> */
    public function reports(CopilotContext $ctx): array
    {
        return array_filter($this->available($ctx), fn ($c) => $c instanceof CopilotReport);
    }

    /** @return array<string, CopilotAction> */
    public function actions(CopilotContext $ctx): array
    {
        return array_filter($this->available($ctx), fn ($c) => $c instanceof CopilotAction);
    }

    /** The catalog part of the system prompt: one line per capability this store can use. */
    public function catalogText(CopilotContext $ctx): string
    {
        $sections = [
            'RESOURCES (records: find_records, create_records, update_records)' => $this->resources($ctx),
            'REPORTS (run_report)' => $this->reports($ctx),
            'ACTIONS (run_action)' => $this->actions($ctx),
        ];
        $lines = ['# CATALOG (what you can work with in this store; call `describe` for the details of one)'];
        foreach ($sections as $title => $items) {
            if ($items === []) {
                continue;
            }
            $lines[] = '';
            $lines[] = "## {$title}";
            foreach ($items as $item) {
                $lines[] = '- '.$item->catalogLine();
            }
        }
        if (count($lines) === 1) {
            $lines[] = '(Nothing yet: you can explain the platform, show the store overview and open pages.)';
        }

        return implode("\n", $lines);
    }

    /**
     * What breaks the contract in one capability (empty = fine). The contract test runs this over every
     * discovered class.
     *
     * @return list<string>
     */
    public static function problems(CopilotCapability $item): array
    {
        $problems = [];
        $key = $item->key();
        $pattern = $item instanceof CopilotAction ? '/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/' : '/^[a-z][a-z0-9_]{1,39}$/';
        if (! preg_match($pattern, $key)) {
            $problems[] = "bad key «{$key}»";
        }
        if (trim($item->label()) === '' || trim($item->summary()) === '') {
            $problems[] = 'label and summary are required';
        }
        if ($item instanceof CopilotResource) {
            if (in_array($item->model(), self::FORBIDDEN_MODELS, true)) {
                $problems[] = 'forbidden model '.$item->model();
            }
            $keys = array_map(fn (Field $f) => $f->key, $item->fields());
            if ($keys === [] || count($keys) !== count(array_unique($keys))) {
                $problems[] = 'fields must be unique and not empty';
            }
            foreach ($item->fields() as $field) {
                if ($field->editable && $field->hidden) {
                    $problems[] = "field {$field->key} cannot be hidden and editable";
                }
                if ($field->type === 'enum' && $field->values === []) {
                    $problems[] = "enum field {$field->key} has no values";
                }
            }
            if ($item->writable() && ! class_exists((string) $item->request())) {
                $problems[] = 'request class missing';
            }
        }
        if ($item instanceof CopilotReport && ($item->params()['type'] ?? null) !== 'object') {
            $problems[] = 'params must be an object schema';
        }
        if ($item instanceof CopilotAction && ($item->schema()['type'] ?? null) !== 'object') {
            $problems[] = 'schema must be an object schema';
        }

        return $problems;
    }
}

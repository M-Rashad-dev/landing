<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppGateway;
use App\Messaging\WhatsApp\WhatsAppTemplateSync;
use Illuminate\Console\Command;

/**
 * The platform's WhatsApp templates on Meta: `status` lists them, `push` submits the missing ones
 * for review (the admin's Messages page does the same with a button).
 */
final class WhatsAppTemplatesCommand extends Command
{
    protected $signature = 'whatsapp:templates {action=status : status | push}';

    protected $description = 'Show the WhatsApp templates on Meta, or submit the missing ones for review';

    public function handle(WhatsAppGateway $gateway, WhatsAppTemplateSync $sync): int
    {
        if (! $gateway->configured()) {
            $this->error('WhatsApp is not configured: set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_WABA_ID.');

            return self::FAILURE;
        }

        $action = (string) $this->argument('action');
        if (! in_array($action, ['status', 'push'], true)) {
            $this->error('Unknown action: use status or push.');

            return self::INVALID;
        }

        try {
            $result = $action === 'push' ? $sync->push() : ['templates' => $sync->status(), 'submitted' => [], 'errors' => []];
        } catch (WhatsAppError $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        foreach ($result['submitted'] as $name) {
            $this->info("Submitted {$name}");
        }
        foreach ($result['errors'] as $name => $error) {
            $this->error("{$name}: {$error}");
        }

        $this->table(['Template', 'Category', 'Status', 'Rejected because'], array_map(
            fn (array $row): array => [$row['name'], $row['category'], $row['status'], $row['rejected_reason'] ?? ''],
            $result['templates'],
        ));

        return $result['errors'] === [] ? self::SUCCESS : self::FAILURE;
    }
}

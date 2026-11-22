<?php

declare(strict_types=1);

namespace App\Enums;

/** Which mailbox a store's customer emails leave from. */
enum StoreMailMode: string
{
    /** The platform's address, the store's name as sender, replies to the merchant. */
    case Platform = 'platform';
    /** The merchant's own mailbox over SMTP (an app password), his own limits. */
    case Smtp = 'smtp';
}

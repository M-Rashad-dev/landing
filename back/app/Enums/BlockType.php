<?php

declare(strict_types=1);

namespace App\Enums;

enum BlockType: string
{
    case Phone = 'phone';
    case Ip = 'ip';
}

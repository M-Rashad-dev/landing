<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\PhoneNormalizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/** Interactive: creates a super admin (no tenant). The password is read without echo. */
final class CreateSuperAdmin extends Command
{
    protected $signature = 'platform:create-admin';

    protected $description = 'Create a super admin user for /admin';

    public function handle(PhoneNormalizer $phones): int
    {
        $name = trim((string) $this->ask('Name'));
        $email = mb_strtolower(trim((string) $this->ask('Email')));
        $phoneInput = trim((string) $this->ask('Mobile (Egyptian)'));
        $password = (string) $this->secret('Password (min 8 characters)');
        $confirmation = (string) $this->secret('Repeat the password');

        $phone = $phones->normalize($phoneInput);
        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'phone' => $phone, 'password' => $password, 'password_confirmation' => $confirmation],
            [
                'name' => ['required', 'string', 'min:2', 'max:100'],
                'email' => ['required', 'email', 'max:190', 'unique:users,email'],
                'phone' => ['required', 'string', 'unique:users,phone'],
                'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed'],
            ],
            ['phone.required' => 'The mobile number is not a valid Egyptian number.'],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::query()->create([
            'tenant_id' => null,
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => $password,
            'role' => UserRole::SuperAdmin,
            'is_active' => true,
        ]);

        $this->info("Super admin #{$user->id} created. Sign in at the dashboard host; you will land on /admin.");

        return self::SUCCESS;
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Models\LandingPage;
use App\Rules\OwnedTheme;
use Illuminate\Validation\Rule;

final class SavePageContentRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var LandingPage|null $page */
        $page = $this->route('page');
        $current = $page?->theme_key;

        return [
            'version' => ['required', 'integer', 'min:1'],
            // Switching needs an active theme; a page already on a disabled theme keeps saving.
            'theme_key' => $this->input('theme_key') !== null && $this->input('theme_key') === $current
                ? ['string']
                : ['nullable', 'string', 'bail', Rule::exists('themes', 'key')->where('is_active', true), new OwnedTheme],
            'content' => ['required', 'array'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['theme_key.exists' => __('pages.theme_inactive')];
    }
}

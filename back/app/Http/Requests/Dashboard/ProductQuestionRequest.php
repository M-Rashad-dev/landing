<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Models\ProductQuestion;
use App\Store\Questions\ProductQuestions;
use Illuminate\Validation\Validator;

/** The merchant's answer to a customer question and whether it shows on the product page (dashboard and copilot). */
final class ProductQuestionRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('answer'))) {
            $this->merge(['answer' => trim(strip_tags($this->input('answer')))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'answer' => ['sometimes', 'nullable', 'string', 'max:'.ProductQuestions::ANSWER_MAX],
            'is_published' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->boolean('is_published')) {
                return;
            }
            /** @var ProductQuestion|null $question */
            $question = $this->route('question');
            $answer = $this->has('answer') ? (string) $this->input('answer') : (string) $question?->answer;
            // Only an answered question shows on the product page.
            if (trim($answer) === '') {
                $validator->errors()->add('is_published', __('questions.publish_needs_answer'));
            }
        }];
    }
}

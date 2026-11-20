<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Redirector;
use Illuminate\Routing\Route;
use Illuminate\Validation\ValidationException;

/**
 * Runs a dashboard FormRequest on data the copilot prepared (docs/plans/ai-copilot.md §3.6), exactly as the
 * dashboard would: prepareForValidation, rules, withValidator / after hooks, with the acting user and the route model
 * (so `$this->route('product')` and unique-ignoring-itself rules work). The copilot never copies a validation rule.
 */
final class FormRequestRunner
{
    /**
     * @template T of FormRequest
     *
     * @param  class-string<T>  $class
     * @param  array<string, mixed>  $data  the request body
     * @return T validated (use ->validated() and its helpers like codeData())
     *
     * @throws ValidationException
     */
    public static function run(string $class, array $data, ?User $user, ?string $routeParameter = null, ?Model $routeModel = null): FormRequest
    {
        $uri = $routeModel !== null ? '/copilot/'.$routeModel->getKey() : '/copilot';
        /** @var T $request */
        $request = $class::create($uri, $routeModel !== null ? 'PUT' : 'POST', $data, [], [], ['HTTP_ACCEPT' => 'application/json']);
        $request->setContainer(app())->setRedirector(app(Redirector::class));
        $request->setUserResolver(fn () => $user);

        $route = null;
        if ($routeModel !== null && $routeParameter !== null) {
            $route = (new Route(['PUT'], 'copilot/{'.$routeParameter.'}', fn () => null))->bind($request);
            $route->setParameter($routeParameter, $routeModel);
        }
        $request->setRouteResolver(fn () => $route);

        $request->validateResolved();

        return $request;
    }

    /**
     * The first message of each field, for the model.
     *
     * @return array<string, string>
     */
    public static function errors(ValidationException $e): array
    {
        return array_map(fn (array $messages) => (string) ($messages[0] ?? ''), $e->errors());
    }
}

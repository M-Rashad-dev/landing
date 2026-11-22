<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\ProductInput;
use App\Services\PublicSite;
use App\Store\CustomerUploads;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * A customer uploads an image / file on a «حسب الطلب» field (store product page or landing page form) before
 * ordering. Answers a token the order sends back; the file itself is never served to visitors.
 */
final class UploadController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site, private readonly CustomerUploads $uploads) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'input_id' => ['required', 'integer', 'min:1'],
            'file' => ['required', 'file', 'max:'.CustomerUploads::MAX_KB],
            'ip' => ['nullable', 'ip'],
        ]);
        $domain = $this->site->activeDomainOrFail((string) $data['host']);

        return Tenancy::runAs($domain->tenant_id, function () use ($request, $data): JsonResponse {
            $input = ProductInput::query()->with('product')->find((int) $data['input_id']);
            $product = $input?->product;
            if ($input === null || $product === null || $product->trashed() || ! $product->is_active || $product->isLockedByPlan()) {
                throw new ApiException(404, 'not_found', __('landing.not_found'));
            }
            if (! $input->kind->isUpload()) {
                throw ValidationException::withMessages(['input_id' => [__('store.upload.not_upload')]]);
            }
            $file = $request->file('file');
            $problem = CustomerUploads::problem($file, $input);
            if ($problem !== null) {
                throw ValidationException::withMessages(['file' => [$problem]]);
            }
            $upload = $this->uploads->store($file, $input);

            return $this->created(['token' => $upload->token, 'name' => $upload->name, 'size' => $upload->size])->header('Cache-Control', 'no-store, private');
        });
    }
}

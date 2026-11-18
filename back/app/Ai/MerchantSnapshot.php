<?php

declare(strict_types=1);

namespace App\Ai;

use App\Enums\InvoiceStatus;
use App\Models\Domain;
use App\Models\Invoice;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Product;
use App\Models\StorePage;
use App\Models\Tenant;
use App\Support\CairoTime;

/**
 * What the support assistant may know about the store it talks to: its own plan, domains,
 * products, landing pages, store pages and orders, read only, inside its tenant (the queries run
 * under the store's tenant scope: never another store). Short, so every question stays cheap.
 * Customers' names and phones are left out: the assistant has no need for them.
 */
final class MerchantSnapshot
{
    private const LIST = 15;

    public function text(Tenant $tenant): string
    {
        $lines = ['# بيانات المتجر (للقراية بس)', 'اسم المتجر: '.$tenant->name, 'حالة الحساب: '.($tenant->status->value === 'active' ? 'شغال' : 'موقوف')];

        $plan = $tenant->plan_key ? (string) Plan::query()->whereKey($tenant->plan_key)->value('name') : '';
        $lines[] = 'الباقة: '.($plan !== '' ? $plan : 'مفيش باقة شغالة')
            .($tenant->plan_ends_at ? ' — بتخلص '.$tenant->plan_ends_at->setTimezone(CairoTime::ZONE)->format('Y-m-d') : '');
        $invoice = Invoice::query()->whereIn('status', [InvoiceStatus::Open->value, InvoiceStatus::PendingReview->value])->latest('id')->first();
        if ($invoice !== null) {
            $lines[] = 'فاتورة مستنية: رقم '.($invoice->number ?? $invoice->id).' بمبلغ '.$invoice->total.' جنيه، حالتها '.($invoice->status === InvoiceStatus::PendingReview ? 'الإيصال بيتراجع' : 'مستنية الدفع');
        }

        $domains = Domain::query()->orderByDesc('is_primary')->get(['host', 'status', 'is_primary']);
        $lines[] = 'الدومينات: '.($domains->isEmpty() ? 'مفيش' : $domains->map(fn (Domain $d) => $d->host.' ('.$d->status->value.($d->is_primary ? '، الأساسي' : '').')')->implode('، '));

        $products = Product::query()->count();
        $active = Product::query()->where('is_active', true)->count();
        $out = Product::query()->where('stock_mode', 'product')->where('stock', '<=', 0)->count();
        $lines[] = "المنتجات: {$products} (شغالة {$active}، خلصت من المخزون {$out})";
        foreach (Product::query()->latest('id')->limit(self::LIST)->get(['name', 'price', 'is_active', 'stock_mode', 'stock']) as $p) {
            $stock = $p->stock_mode === 'product' ? ' مخزون '.$p->stock : '';
            $lines[] = '- '.$p->name.' — '.$p->price.' جنيه'.($p->is_active ? '' : ' (مقفول)').$stock;
        }

        $pages = LandingPage::query()->latest('id')->limit(self::LIST)->get(['title', 'slug', 'status']);
        $lines[] = 'صفحات الهبوط: '.LandingPage::query()->count();
        foreach ($pages as $page) {
            $lines[] = '- '.$page->title.' (/'.$page->slug.') — '.($page->status->value === 'published' ? 'منشورة' : 'مسودة');
        }

        $storePages = StorePage::query()->orderBy('position')->limit(self::LIST)->get(['title', 'slug', 'is_published']);
        if ($storePages->isNotEmpty()) {
            $lines[] = 'الصفحات التعريفية: '.$storePages->map(fn (StorePage $s) => $s->title.($s->is_published ? '' : ' (مخفية)'))->implode('، ');
        }

        $since = now()->subDays(30);
        $counts = Order::query()->where('created_at', '>=', $since)->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $lines[] = 'الطلبات آخر 30 يوم: '.($counts->isEmpty() ? 'مفيش' : $counts->map(fn ($n, $status) => $status.' '.$n)->implode('، '));
        foreach (Order::query()->latest('id')->limit(8)->get(['order_number', 'status', 'total', 'created_at']) as $o) {
            $lines[] = '- طلب #'.$o->order_number.' — '.$o->status->value.' — '.$o->total.' جنيه — '.$o->created_at->setTimezone(CairoTime::ZONE)->format('Y-m-d');
        }

        return implode("\n", $lines);
    }
}

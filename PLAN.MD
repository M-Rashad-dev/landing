خطة مشروع منصة اللاندنج بيدج (Multi-tenant) — Laravel + Next.js
Oct 26, 2026 · @m.rashad.dev
1) نظرة عامة ونطاق المشروع
المشروع منصة SaaS شبيهة بسلة وزد، لكن الصفحات فيها لاندنج بيدج لمنتج واحد مش متجر: العميل يعمل حساب، يبني صفحات من ثيمات جاهزة، يستقبل طلبات كاش عند الاستلام، ويديرها من داشبورد، ويربط دومينه الخاص.
الفولدرات: back/ فيه Laravel (API فقط). front/ فيه Next.js (الداشبورد + الـ Builder + العرض العام للصفحات). ملفات النشر في deploy/ عند الجذر.
القرارات الثابتة (لا تتغير ولا تُناقش)
البند	القرار
Back	Laravel (أحدث نسخة stable) + PHP 8.3 + MySQL 8 + Redis (كاش وطوابير وrate limit)
Front	Next.js (أحدث stable) App Router + TypeScript strict + Tailwind + pnpm
Multi-tenancy	قاعدة بيانات واحدة، عمود tenant_id في كل جدول بيانات عميل، Global Scope يعمل fail-closed
Auth	Sanctum Bearer tokens. Next يخزّن التوكن في httpOnly cookie (نمط BFF). مفيش CORS لأن المتصفح بيكلّم Next بس
لا تكامل خارجي	مفيش SMTP ولا SMS ولا دفع ولا شحن ولا S3 ولا CDN ولا أي API key. كل حاجة على الـ VPS
نتيجة ذلك	لا تأكيد إيميل، لا OTP، لا استرجاع باسورد بالإيميل (الـ Super Admin يعمل reset)
اللغة	عربي RTL فقط. كل نصوص الواجهة في ملف messages واحد جاهز للترجمة
العملة والوقت	جنيه مصري فقط (ج.م). التخزين UTC والعرض Africa/Cairo
الدفع والشحن	كاش عند الاستلام. لا شحن ولا رسوم توصيل
الصفحة	منتج واحد لكل صفحة. المنتجات مكتبة في الحساب
المستخدمين	مستخدم واحد (owner) لكل حساب. الجداول جاهزة لإضافة موظفين لاحقًا بدون تعديل كبير
الثيمات	ثيمين: ملاك malak وسيليا celia. كل ثيم 10 كومبوننت بنفس الأنواع في الاتنين
الدومينات	subdomain عشوائي مجاني على دومين المنصة + دومين خاص بـ CNAME أو A record
النشر	VPS + Docker Compose + Caddy (شهادات SSL تلقائية لأي دومين)
الباقات	مفيش. فقط حدود أمان داخلية في config/landing.php بدون واجهة
خارج النطاق (لا تبنيه نهائيًا في الإصدار ده)
•	باقات واشتراكات وفوترة، دفع أونلاين، شركات شحن ومناطق شحن.
•	مخزون وكميات.
•	لغة إنجليزية أو أي لغة تانية.
•	موظفين وصلاحيات.
•	سكريبتات أو HTML مخصص داخل الصفحة (مخاطرة XSS وphishing).
•	Conversions API من السيرفر، إيميلات، SMS، WhatsApp API.
•	أكتر من منتج في الصفحة، A/B testing، تحليلات زيارات داخلية، سجل نسخ الصفحة (revisions).
مصطلحات
•	Tenant: حساب العميل (البائع). Visitor: زائر الصفحة العامة.
•	Identity (الهوية): لوجو + ألوان + خطوط + SEO افتراضي + تواصل + تتبع. تُربط بأكتر من صفحة.
•	Section: كومبوننت واحد داخل الصفحة. Theme: مجموعة 10 كومبوننت بشكل موحد.
•	Page: لاندنج بيدج = ثيم + هوية + منتج + قائمة sections مرتبة (JSON).
2) قواعد التنفيذ لـ Claude Code
الهدف: كود كامل 100% يقف جاهز للرفع، بدون أي ربط خارجي، ومن غير ثغرات عزل بين العملاء.
طريقة الشغل
1.	اقرأ الخطة كلها قبل أي كود. في جذر المشروع أنشئ: CLAUDE.md (ملخص قصير للقواعد دي + إشارة لـ PLAN.md)، PLAN.md (نسخة من الخطة)، PROGRESS.md (قائمة المراحل وحالة كل واحدة)، DECISIONS.md (أي قرار صغير اتخذته ولم تذكره الخطة).
2.	نفّذ مرحلة واحدة فقط في كل مرة وبالترتيب. لا تبدأ مرحلة قبل ما تحقق تعريف الانتهاء للي قبلها.
3.	في آخر كل مرحلة: شغّل الاختبارات والـ lint والـ build، حدّث PROGRESS.md، اعمل git commit برسالة phase N: <ملخص>، واكتب تقرير قصير: اللي اتعمل، طريقة التشغيل، خطوات تحقق يدوي، أي انحراف عن الخطة. بعدها توقف لحد ما المستخدم يقول كمّل.
4.	لا تسأل المستخدم إلا لو في تعارض حقيقي بين بندين في الخطة. غير كده خد أبسط قرار وأوضحه وسجّله في DECISIONS.md.
5.	لو في تفصيلة ناقصة: اختار الأقرب لروح الخطة (بساطة، أمان، fail-closed).
6.	ممنوع تسيب TODO أو mock أو بيانات وهمية في الكود النهائي، إلا اللي مكتوب صراحة إنه مؤجل.
7.	ممنوع أي package أو خدمة تحتاج حساب أو API key أو اتصال خارجي من السيرفر وقت التشغيل.
معايير الجودة — back
•	declare(strict_types=1) في كل ملف. Laravel Pint بدون أخطاء.
•	Controllers رفيعة: Controller → FormRequest → Action أو Service → Eloquent → API Resource.
•	Backed Enums بدل الـ strings الحرة (حالات الطلب، أنواع العروض...).
•	كل Endpoint له Feature test يغطي: نجاح، validation، 401 بدون توكن، وعزل الـ tenant (حساب تاني يحصل على 404).
•	لا N+1: فعّل Model::preventLazyLoading() في local وtesting.
•	الفلوس decimal(12,2) في الداتابيز، والحسابات بالقروش كأعداد صحيحة (integers) داخل الكود. ممنوع float.
•	كل رسائل الـ validation والأخطاء بالعربي (laravel-lang/lang + ملف رسائل خاص).
•	Migrations بها down() صحيحة، والـ foreign keys والـ indexes كما في قسم قاعدة البيانات.
•	ممنوع generated columns أو ميزات MySQL-only في الـ migrations عشان الاختبارات تشتغل على SQLite لو MySQL مش متاح. الأفضل تشغيل الاختبارات على MySQL.
معايير الجودة — front
•	TypeScript strict، ESLint نظيف، tsc --noEmit وnext build ينجحوا.
•	Server Components افتراضيًا. Client Components فقط عند الحاجة لتفاعل.
•	RTL: استخدم logical properties في Tailwind (ms- me- ps- pe- start- end- text-start) ولا تستخدم left/right.
•	كل نص عربي معروض في src/messages/ar.ts وليس مبعثر في الكومبوننتس.
•	الفورمز: react-hook-form + zod، ورسائل الخطأ عربي، وأخطاء السيرفر 422 تتحول لأخطاء على الحقول.
•	لكل شاشة 4 حالات: تحميل (skeleton)، فاضي (empty state)، خطأ (مع زر إعادة المحاولة)، نجاح (toast).
•	موبايل أولًا: كل الشاشات تشتغل من عرض 360px.
•	إتاحة أساسية: labels، focus ظاهر، والقوائم القابلة للسحب تدعم لوحة المفاتيح (dnd-kit KeyboardSensor).
•	الأرقام تُعرض بأرقام لاتينية (0-9)، والسعر بصيغة 1,250 ج.م.
تعريف الانتهاء لأي مرحلة (كله لازم يتحقق)
•	☐ كل البنود المكتوبة في المرحلة اتنفذت (back وfront).
•	☐ composer lint وcomposer test نجحوا.
•	☐ pnpm lint وpnpm typecheck وpnpm test وpnpm build نجحوا.
•	☐ اختبارات عزل الـ tenant لكل Endpoint جديد.
•	☐ جربت المسار الكامل يدويًا (أو بسكريبت) من الواجهة للـ API للداتابيز.
•	☐ PROGRESS.md اتحدّث وفي commit نظيف.
أوامر ثابتة (عرّفها في composer.json وpackage.json)
# back
composer test      # pest
composer lint      # pint --test
# front
pnpm lint && pnpm typecheck && pnpm test && pnpm build
3) بنية المشروع والفولدرات
الجذر فيه فولدرين للكود (back وfront) + deploy لملفات النشر. لو المستخدم عايز فولدرين بس بالظبط، انقل deploy/ جوه back/deploy/ وعدّل مسارات docker-compose.
project-root/
├─ CLAUDE.md  PLAN.md  PROGRESS.md  DECISIONS.md  README.md
├─ .env.example                 # متغيرات النشر (الجذر)
├─ docker-compose.yml           # إنتاج
├─ docker-compose.dev.yml       # تطوير: mysql + redis (+ mysql_test)
├─ deploy/
│  ├─ Caddyfile
│  ├─ deploy.sh  backup.sh  restore.sh
│  └─ DEPLOY.md                 # دليل الرفع خطوة بخطوة بالعربي
├─ back/                        # Laravel (API فقط)
│  ├─ Dockerfile  docker/nginx.conf  docker/php.ini
│  ├─ app/
│  │  ├─ Actions/               # Auth, Domains, Pages, Orders, Pricing, Media ...
│  │  ├─ Console/Commands/      # CreateSuperAdmin, VerifyPendingDomains, ...
│  │  ├─ Enums/                 # OrderStatus, PageStatus, OfferType, DiscountType, DomainType, DomainStatus ...
│  │  ├─ Http/
│  │  │  ├─ Controllers/Api/V1/{Auth,Dashboard,Public,Admin}/
│  │  │  ├─ Middleware/         # ResolveTenantFromUser, EnsureTenantActive, EnsureInternalKey, EnsureSuperAdmin
│  │  │  ├─ Requests/  Resources/
│  │  ├─ Jobs/                  # VerifyDomain, RevalidateTenantHosts, WarmSsl ...
│  │  ├─ Models/  (+ Concerns/BelongsToTenant.php)
│  │  ├─ Rules/                 # TenantExists, TenantUnique, SafeUrl, EgyptPhone ...
│  │  ├─ Services/              # PriceCalculator, DomainVerifier, MediaProcessor,
│  │  │                         # PageContentSanitizer, FrontendRevalidator, PhoneNormalizer, SubdomainGenerator
│  │  └─ Tenancy/               # TenantContext, TenantScope, Tenancy (facade/helper)
│  ├─ config/landing.php        # reserved slugs, limits, component types, fonts, governorates
│  ├─ database/{migrations,seeders,factories}
│  ├─ lang/ar/
│  ├─ routes/{api.php, internal.php, console.php}
│  └─ tests/{Feature,Unit}
└─ front/                       # Next.js
   ├─ Dockerfile  next.config.ts  tailwind.config.ts
   └─ src/
      ├─ middleware.ts          # تصنيف الـ Host وإعادة الكتابة
      ├─ app/
      │  ├─ (marketing)/page.tsx            # صفحة المنصة الرئيسية البسيطة
      │  ├─ (auth)/{login,register}/
      │  ├─ (dashboard)/dashboard/...       # الداشبورد
      │  ├─ admin/...                       # Super Admin
      │  ├─ preview/[pageId]/               # iframe المعاينة داخل الـ Builder
      │  ├─ _sites/[host]/[[...slug]]/      # العرض العام (+ sitemap.xml وrobots.txt)
      │  └─ api/{auth,bff/[...path],public/{quote,orders,form-token},revalidate,health}/
      ├─ components/{ui,dashboard,builder,forms,shared}/
      ├─ themes/
      │  ├─ registry.ts  types.ts
      │  ├─ shared/{schemas,fields,hooks,order-form}/
      │  ├─ _fallback/                      # placeholders بسيطة (المرحلة 5)
      │  ├─ malak/{theme.config.ts,components/<type>/index.tsx}
      │  └─ celia/{theme.config.ts,components/<type>/index.tsx}
      ├─ lib/{api,auth,host,price,tracking,seo,format,dates}/
      ├─ messages/ar.ts
      └─ styles/
قواعد البنية
•	لا تكرار منطق بين الفولدرين غير اللي مكتوب صراحة (حساب السعر المعروض في الـ front نسخة عرض فقط، والمرجع الوحيد للسعر النهائي هو الـ back).
•	كل Controller يعيش تحت Http/Controllers/Api/V1/<Group>/ حسب المجموعة: Auth عام، Dashboard للعميل، Public لصفحات الزوار (بمفتاح داخلي)، Admin للـ Super Admin.
•	Migrations بالترتيب الزمني ومقسمة حسب المرحلة، وكل مرحلة تضيف migrations جديدة ولا تعدّل القديمة (إلا لو لم تُنشر أبدًا).
•	متغيرات البيئة: أي متغير جديد يُضاف لـ .env.example المناسب (back أو الجذر أو front) في نفس الـ commit.
4) معمارية الـ Multi-tenancy والدومينات
القاعدة الذهبية: أي استعلام على جدول فيه tenant_id لازم يتفلتر بالـ tenant الحالي، وإذا الـ tenant الحالي مش معروف الاستعلام يرجّع صفر نتائج (fail-closed) مش كل البيانات.
أنواع الـ Hosts في Next (تصنيف في middleware.ts)
الـ Host	المعنى	التصرف
PLATFORM_DOMAIN (مثلًا platform.com)	صفحة المنصة	تعرض (marketing) وزر ينقل لـ app
APP_HOST (مثلًا app.platform.com)	الداشبورد والـ Super Admin	مسارات /login /register /dashboard/* /admin/* /preview/* /api/* فقط. أي مسار تاني 404
أي host تاني (subdomain أو دومين خاص)	صفحة عميل	rewrite إلى /_sites/{host}{path}. ويُمنع /dashboard و/admin و/preview و/api/bff و/api/auth عليه (404)
مسار الزائر على صفحة عامة
1.	الزائر يفتح https://store-4821.platform.com/offer (أو https://mystore.com/offer).
2.	DNS يوصله لـ IP السيرفر. Caddy يستقبل 443 ويطلب شهادة عند أول مرة (on-demand TLS) بعد سؤال Laravel عبر ask (قسم 20).
3.	Caddy يمرر الطلب لـ Next. الـ middleware يقرأ Host ويعمل rewrite إلى /_sites/store-4821.platform.com/offer.
4.	Server Component يستدعي Laravel داخليًا GET /api/v1/public/resolve-host?host=... ثم GET /api/v1/public/pages/offer?host=... بالهيدر X-Internal-Key. النتيجة تتخزن بـ fetch مع revalidate: 60 وtag host:{host}.
5.	Next يعرض الصفحة SSR/ISR بالثيم والهوية المحددين. الزائر يستقبل HTML جاهز + جافاسكريبت قليل (فورم، عدّاد، سلايدر).
6.	عند إرسال الطلب: المتصفح → POST /api/public/orders (Route Handler في Next على نفس الـ host) → Laravel POST /api/v1/public/orders (بالـ host والمفتاح الداخلي). لا CORS ولا Laravel مكشوف للإنترنت.
مسار الداشبورد
1.	العميل على app.platform.com يسجل دخول عبر POST /api/auth/login (Next Route Handler) فيكلم Laravel ويخزن التوكن في cookie اسمها lp_token (httpOnly + Secure + SameSite=Lax).
2.	كل طلب من واجهة الداشبورد يروح لـ /api/bff/... فيقرأ Next الكوكي ويضيف Authorization: Bearer ويمرر لـ Laravel ويرجّع النتيجة. لو رد 401 يمسح الكوكي ويحوّل لـ /login.
3.	الـ Server Components في الداشبورد تكلم Laravel مباشرة بنفس التوكن من الكوكي.
4.	حماية CSRF في BFF: أي طلب غير GET لازم Origin يساوي الـ host الحالي وإلا 403.
تحديد الـ tenant داخل Laravel
•	مسارات /dashboard/*: الـ tenant = auth()->user()->tenant. الـ middleware ResolveTenantFromUser يضبط TenantContext ويرفض (403 + code tenant_suspended) لو الحساب موقوف.
•	مسارات /public/*: الـ tenant = من جدول domains بالـ host (status=active فقط) ولازم الـ tenant active. المفتاح الداخلي مطلوب.
•	مسارات /admin/*: لا tenant. الاستعلامات بتستخدم Tenancy::withoutTenant(fn) بشكل صريح.
•	Console والـ Jobs: لا tenant افتراضيًا. أي job يخص tenant يستقبل tenant_id ويشغّل شغله داخل Tenancy::runAs($tenantId, fn).
مواصفات الكود الأساسي
•	TenantContext: singleton فيه id() وset() وclear() وcheck().
•	TenantScope (Global Scope): لو check() تمام يضيف where {table}.tenant_id = ?. لو لا يضيف whereRaw('1 = 0'). فقط داخل Tenancy::withoutTenant() يتجاوز الفلتر.
•	BelongsToTenant (Trait): يسجل الـ scope، وفي حدث creating يملأ tenant_id من السياق. لو الـ tenant غير معروف وtenant_id فاضي يرمي Exception (ممنوع صف يتيم).
•	Rules جاهزة: TenantExists::table('products') وTenantUnique تضيف شرط tenant_id تلقائيًا. ممنوع exists: وunique: العادية على جداول العميل.
•	بحث Route Model Binding: لأن الـ scope شغال، أي id من tenant تاني يرجّع 404 مش 403 (ما نكشفش وجوده).
•	أي استخدام لـ withoutGlobalScopes() أو withoutTenant() لازم يكون في المواضع المصرح بها فقط (Admin، resolve-host، TLS ask، jobs بعد تحديد الـ tenant) وكل موضع يتوثق بتعليق وتغطيه اختبارات.
•	الـ Cache keys التي تخص tenant تبدأ بـ t:{tenant_id}:.
الكاش وإعادة التوليد (ISR)
•	كل استدعاءات Next لبيانات الصفحة العامة: fetch(url, { next: { revalidate: 60, tags: ['host:' + host] } }).
•	عند أي تغيير يؤثر على صفحة عامة (نشر/إلغاء نشر، تعديل هوية، منتج، عرض، كود، دومين، تغيير ثيم) Laravel يشغّل Job RevalidateTenantHosts($tenantId) يستدعي POST http://front:3000/api/revalidate بالهيدر X-Revalidate-Secret وbody فيه كل tags الـ hosts الفعالة للـ tenant.
•	لو فشل الـ job يسجل warning ويعيد المحاولة 3 مرات (backoff). التأخير الأقصى بدون revalidate = 60 ثانية بفضل revalidate: 60.
اختبارات العزل الإلزامية
•	Unit: TenantScope يرجّع صفر لما السياق فاضي، وBelongsToTenant يرمي Exception لو لا tenant.
•	Feature تلقائي: لكل resource في /dashboard/* أنشئ سجل لـ tenant A وجرب GET/PUT/DELETE بتوكن tenant B → 404، والقائمة لا تحتوي سجلات A.
•	في كل مرحلة جديدة أضف الـ resource الجديد لقائمة اختبار العزل.
5) قاعدة البيانات (كل الجداول)
اتفاقيات عامة: PK = id bigIncrements. كل جداول بيانات العميل فيها tenant_id (FK → tenants، cascadeOnDelete، مفهرس) وtimestamps. الفلوس decimal(12,2). الحالات كـ string مربوطة بـ Backed Enum. الحذف الناعم (softDeletes) على: products, offers, discount_codes, landing_pages, identities. أي unique على جدول عميل يتضمن tenant_id. التواريخ UTC.
جداول النظام والحسابات
tenants: name (اسم المتجر), status (active|suspended), suspended_at null, suspended_reason null, settings json null.
users: tenant_id null (null = super_admin), name, email (unique، lowercase), phone (unique، E.164 مثل +201012345678), password, role (owner|super_admin), is_active default true, last_login_at null. إضافة موظفين لاحقًا = إضافة قيمة role وعمود permissions، بدون تغيير باقي الجداول.
personal_access_tokens: جدول Sanctum الافتراضي. expires_at = بعد 30 يوم.
domains: tenant_id, host varchar(253) مفهرس (lowercase), type (subdomain|custom), status (pending|active|failed), is_primary default false, active_host varchar(253) null unique (= host فقط لما status=active وإلا null. يُدار بالكود مش generated column)، verified_at null, check_attempts default 0, last_checked_at null, last_check_error null, ssl_status (pending|issued|unknown) default pending, ssl_checked_at null. قيود بالكود: صف subdomain واحد بالظبط لكل tenant، ودومين primary واحد على الأكتر.
themes: key (PK string: malak,celia), name, is_active default true, sort_order.
order_counters: tenant_id (PK), last_number unsigned int default 0. لتوليد رقم طلب متسلسل لكل tenant بـ lockForUpdate.
admin_audit_logs: admin_user_id, action, target_type, target_id, meta json, ip, created_at.
failed_jobs (والطوابير على Redis).
الهوية والميديا
media: tenant_id, disk default public, path (المسار النسبي للنسخة large), variants json ({thumb, medium, large, icon32?, icon180?} كمسارات نسبية)، original_name, mime, size_bytes, width, height, alt null.
identities: tenant_id, name, is_default, brand_name, logo_media_id null, favicon_media_id null, og_image_media_id null (FKs → media nullOnDelete)، colors json (primary, primary_foreground?, secondary, accent, background, foreground, muted, border)، font_heading, font_body (مفاتيح من قائمة ثابتة)، button_radius (none|sm|md|lg|full)، seo_title null, seo_title_suffix null, seo_description null، contact json (phone, whatsapp, email, address)، socials json (facebook, instagram, tiktok, youtube, x, snapchat)، tracking json (meta_pixel_id, tiktok_pixel_id, ga4_id, gtm_id, snapchat_pixel_id, google_site_verification, facebook_domain_verification, conversion_event) حيث conversion_event = Lead|Purchase والافتراضي Lead.
المنتجات
products: tenant_id, name, description text null (Markdown مبسط)، price, compare_at_price null (أكبر من price)، sku null, is_active default true.
product_media: tenant_id, product_id, media_id, position. unique(product_id, media_id). الصورة الأولى = الرئيسية.
product_options: tenant_id, product_id, name (مثل «المقاس»)، display_type (buttons|dropdown|swatch)، is_required default true, position.
product_option_values: tenant_id, option_id, label, color_hex null (لـ swatch)، price_delta default 0 (≥ 0)، is_active default true, position.
العروض والأكواد
offers: tenant_id, name, type (percentage|fixed|bundle)، value null (نسبة 1–95 أو مبلغ خصم على الوحدة)، bundle_quantity null (≥ 2)، bundle_price null (سعر المجموعة كلها)، starts_at null, ends_at null, is_active, badge_text null, priority int default 0. فهرس مركب (tenant_id, is_active, starts_at, ends_at).
offer_products: tenant_id, offer_id, product_id. unique(offer_id, product_id).
discount_codes: tenant_id, code (مخزّن UPPERCASE)، type (percentage|fixed)، value, max_discount null, min_order_total null, starts_at null, ends_at null, usage_limit null, usage_limit_per_phone null, used_count default 0, stackable_with_offers default true, is_active. unique(tenant_id, code).
discount_code_products: tenant_id, discount_code_id, product_id (لو لا صفوف = الكود على كل المنتجات).
discount_code_redemptions: tenant_id, discount_code_id, order_id (unique), phone, amount, released_at null.
الصفحات
landing_pages: tenant_id, title (اسم داخلي)، slug, status (draft|published)، theme_key (FK → themes.key)، identity_id (FK → identities، restrict)، product_id null (FK → products، restrict)، draft_content json, published_content json null, version unsigned int default 1 (للـ optimistic locking)، published_at null، is_home default false, home_key tinyint null (= 1 للصفحة الرئيسية وإلا null)، seo_override json null (title, description, og_media_id, noindex)، tracking_override json null (نفس مفاتيح tracking في الهوية، وأي مفتاح موجود هنا يطغى)، created_by null. unique(tenant_id, home_key). فهرس (tenant_id, slug) والـ slug المحذوف يُعاد تسميته slug--deleted-{id}.
landing_page_media: tenant_id, landing_page_id, media_id. تتزامن عند كل حفظ لمعرفة استخدامات الميديا قبل الحذف.
الطلبات
orders: tenant_id, order_number (unsigned int)، landing_page_id null, product_id null (nullOnDelete)، status (new|confirmed|delivered|returned|damaged|fake|cancelled)، status_changed_at, customer_name, customer_phone (E.164)، customer_phone2 null, governorate null, city null, address text null, notes text null (من العميل)، internal_note text null (من البائع)، answers json (إجابات الحقول المخصصة كـ snapshot: [{key,label,type,value}])، quantity, unit_price, subtotal (قبل العروض)، offer_id null, offer_name null, offer_discount default 0, discount_code_id null, discount_code null, code_discount default 0, total, currency default EGP, is_duplicate_suspect default false, ip_address, user_agent (500)، utm json null (source, medium, campaign, content, term, referrer). unique(tenant_id, order_number). فهارس: (tenant_id, status, created_at)، (tenant_id, customer_phone)، (tenant_id, landing_page_id).
order_items: tenant_id, order_id, product_id null, product_name, unit_price (شامل فروق الخيارات)، quantity, options json ([{option, value, price_delta}] snapshot)، line_total.
order_status_logs: tenant_id, order_id, from_status null, to_status, note null, changed_by null (user)، created_at.
blocked_customers: tenant_id, type (phone|ip)، value, reason null, created_at. unique(tenant_id, type, value).
شكل draft_content وpublished_content
{
  "version": 1,
  "sections": [
    { "id": "uuid-v4", "type": "hero", "variant": "split", "visible": true,
      "props": { "title": "...", "image_media_id": 12, "cta_url": "#order" } }
  ]
}
Seeders
•	ThemeSeeder: يضيف malak وcelia (فعّالين). يُشغّل في كل نشر بأمان (updateOrCreate).
•	DemoSeeder (للتطوير فقط، ممنوع تشغيله في production): tenant تجريبي + منتج + هوية + صفحة منشورة.
6) نظام الثيمات والكومبوننتس
الثيم = شكل بصري فقط. الأنواع والحقول (props) واحدة في الثيمين، والفرق في التصميم والـ variants. النتيجة: العميل يبدّل الثيم بدون ما يفقد أي محتوى.
المبادئ
1.	الصفحة = JSON مرتب sections[]. كل section: id (uuid)، type، variant، visible، props.
2.	كل نوع كومبوننت له schema واحد في front/src/themes/shared/schemas/<type>.ts يعرّف الحقول والقيم الافتراضية. الـ Builder يولّد فورم التعديل من الـ schema تلقائيًا، فإضافة حقل أو كومبوننت جديد لا تلمس كود الـ Builder.
3.	كل ثيم يطبّق نفس الأنواع العشرة بتصميمه، ولكل نوع 2 variant على الأقل (أشكال تخطيط مختلفة).
4.	الكومبوننتس عرض فقط: تستقبل props وctx ولا تجلب بيانات بنفسها.
5.	الألوان والخطوط والـ radius تأتي من الهوية عبر CSS variables. ممنوع ألوان hardcoded في الثيمات إلا درجات الرمادي والأبيض والأسود.
أنواع الحقول
النوع	عنصر الواجهة في الـ Builder	شكل التخزين	قاعدة التسمية (يعتمد عليها الـ back)
text	input (حد أقصى للطول في الـ schema)	string	أي اسم
textarea	textarea	string (أسطر)	أي اسم
number / range	رقم / slider	number	أي اسم
toggle	switch	boolean	أي اسم
select	dropdown بقيم من الـ schema	string	أي اسم
color	color picker + hex	#RRGGBB	اسم ينتهي بـ _color
image	MediaPicker (صورة واحدة)	media id (int)	ينتهي بـ _media_id
images	MediaPicker متعدد + ترتيب	مصفوفة ids	ينتهي بـ _media_ids
link	اختيار: قسم في الصفحة، رابط خارجي، اتصال، واتساب	string	ينتهي بـ _url
icon	اختيار من مجموعة ثابتة (~40 أيقونة lucide)	string key	ينتهي بـ _icon
repeater	قائمة عناصر قابلة للسحب (إضافة/حذف/ترتيب) بحد أقصى max	مصفوفة كائنات	أي اسم
قيم link المسموحة: #section-id أو #order، مسار نسبي /slug، https://...، tel:، mailto:، https://wa.me/.... أي شيء غير كده (مثل javascript: وdata:) مرفوض في الـ back.
عقد الكومبوننت (TypeScript)
// themes/types.ts
export type ComponentType = 'header'|'hero'|'gallery'|'product_showcase'|'features'
  |'offers'|'testimonials'|'faq'|'order_form'|'footer';

export interface PageContext {
  host: string; isPreview: boolean;
  identity: Identity;            // ألوان، لوجو، تواصل، سوشيال
  product: PublicProduct | null; // الاسم، السعر، الصور، الخيارات
  offers: PublicOffer[];         // الفعّالة والمجدولة القادمة
  page: { id: number; slug: string; title: string };
}

export interface SectionProps<P> {
  sectionId: string; props: P; variant: string; ctx: PageContext;
}

export interface ThemeComponentDef {
  component: React.ComponentType<SectionProps<any>>; // Server Component افتراضيًا
  variants: { key: string; label: string }[];
  defaultVariant: string;
  Thumbnail: React.ComponentType;                    // wireframe SVG صغير لمكتبة الـ Builder
}

export interface ThemeDef {
  key: string; name: string; description: string;
  components: Record<ComponentType, ThemeComponentDef>;
  starterSections: { type: ComponentType; variant: string }[]; // ترتيب افتراضي للصفحة الجديدة
}
الـ 10 كومبوننت وحقولها (مشتركة بين الثيمين)
التنسيق: المفتاح (النوع، افتراضي) — ملاحظة. كل المحتوى الافتراضي بالعربي وجاهز للتجربة.
1) header — الهيدر (مثبت أعلى الصفحة، واحد فقط)
•	show_logo (toggle، true)، logo_media_id (image، فاضي = لوجو الهوية)، brand_text (text، افتراضي اسم الهوية)
•	links (repeater حتى 5: label text + link_url link)
•	cta_enabled (toggle، true)، cta_label (text، «اطلب الآن»)، cta_url (link، #order)
•	sticky (toggle، true)، announcement_enabled (toggle، false)، announcement_text (text)، announcement_color (color)
2) hero — البانر الرئيسي
•	eyebrow (text)، title (text ≤120)، subtitle (textarea ≤300)
•	image_media_id (image)، mobile_image_media_id (image، اختياري)
•	cta_label (text)، cta_url (link، #order)، secondary_cta_label (text)، secondary_cta_url (link)
•	show_price (toggle، true) يعرض سعر المنتج والسعر القديم والعرض الفعّال
•	badges (repeater حتى 4: text)
•	text_align (select: start|center)، overlay_opacity (range 0–80)، min_height (select: sm|md|lg|screen)
3) gallery — معرض الصور
•	title (text)، source (select: product|custom، افتراضي product يعني صور المنتج)، image_media_ids (images حتى 12 لما source=custom)
•	autoplay (toggle، false)، show_thumbnails (toggle، true)، lightbox (toggle، true)
4) product_showcase — تفاصيل المنتج
•	title_override (text، فاضي = اسم المنتج)، show_description (toggle، true)، description_override (textarea)
•	show_price (toggle، true)، show_compare_price (toggle، true)، show_discount_badge (toggle، true)
•	highlights (repeater حتى 6: icon icon + text)
•	cta_label (text)، cta_url (link، #order)
5) features — المميزات
•	title (text)، subtitle (textarea)، columns (select: 2|3|4)
•	items (repeater 2–8: icon icon، title text، description textarea، image_media_id image اختياري)
6) offers — العروض (بيانات العروض من الـ API، مش بتتكتب يدويًا)
•	title (text)، subtitle (textarea)
•	show_countdown (toggle، true) عدّاد لحد ends_at، show_savings (toggle، true)
•	empty_behavior (select: hide|message، افتراضي hide)، empty_message (text)
•	cta_label (text)
•	السلوك: الضغط على عرض bundle يضبط الكمية في الفورم ويعمل scroll للفورم (عبر store صغير مشترك).
7) testimonials — آراء العملاء
•	title (text)، show_rating (toggle، true)
•	items (repeater حتى 12: name text، subtitle text مثل المدينة، text textarea، rating number 1–5، avatar_media_id image، proof_media_id image لسكرين شوت)
8) faq — الأسئلة الشائعة
•	title (text)، subtitle (textarea)، first_open (toggle، true)، allow_multiple (toggle، false)
•	items (repeater حتى 15: question text، answer textarea)
9) order_form — فورم الطلب (إلزامي مرة واحدة ظاهر للنشر)
•	title (text)، subtitle (textarea)، submit_label (text، «تأكيد الطلب»)
•	fields كائن لحقول مدمجة، كل واحد {enabled, required, label, placeholder}: name وphone دايمًا enabled+required (غير قابلين للإلغاء)، وphone2 وgovernorate (قائمة المحافظات الـ 27) وcity وaddress وnotes.
•	custom_fields (repeater حتى 8: key يتولد تلقائيًا من الاسم وغير قابل للتعديل بعد الحفظ، label، type select: text|textarea|number|select|radio|checkbox|date، required، placeholder، choices قائمة نصوص لـ select وradio)
•	show_quantity (toggle، true)، show_summary (toggle، true)، show_code_field (toggle، true)
•	success_title (text)، success_message (textarea)، privacy_note (text)
•	trust_badges (repeater حتى 4: icon + text)
•	خيارات المنتج (المقاس واللون...) تظهر تلقائيًا من المنتج داخل الفورم، مش من الـ props.
10) footer — الفوتر (مثبت آخر الصفحة، واحد فقط)
•	brand_text (text)، about (textarea)، links (repeater حتى 8: label + link_url)
•	show_socials (toggle، true) من الهوية، show_contact (toggle، true) من الهوية
•	copyright_text (text)، show_platform_credit (toggle، false)
الـ variants لكل ثيم
الكومبوننت	ملاك malak	سيليا celia
header	centered-logo، logo-start	bar، minimal
hero	split، full-cover، centered-card	big-type، split-reverse، full-cover
gallery	slider، grid	thumbs-side، masonry
product_showcase	card، side-by-side	split-image، stacked
features	icon-cards، alternating	numbered-grid، icon-list
offers	cards، ribbon-banner	bundle-tiles، countdown-strip
testimonials	cards-slider، grid	quote-wall، screenshots-grid
faq	accordion-soft، two-columns	accordion-lines، numbered
order_form	card، split-summary	bordered، sticky-summary
footer	simple-center، columns	dark-columns، minimal-line
لو variant مش موجود في الثيم الجديد بعد التبديل، يُستبدل بـ defaultVariant (أول واحد).
الهوية البصرية لكل ثيم
•	ملاك: ناعم وهادي. زوايا دائرية كبيرة (rounded-2xl)، ظلال خفيفة، مسافات واسعة، أزرار pill، خلفيات فاتحة وتدرجات بسيطة من لون الهوية. مناسب للتجميل والهدايا والأطفال والمنزل.
•	سيليا: جريء وعصري. زوايا حادة أو صغيرة، حدود واضحة border-2، تباين عالي، عناوين كبيرة وتقيلة، شرائط وأقسام داكنة، أرقام كبيرة. مناسب للموضة والإلكترونيات والمنتجات الرجالي.
•	الاتنين: Mobile-first، خطوط من الهوية (Cairo وغيره)، حركات CSS خفيفة تحترم prefers-reduced-motion، بدون مكتبات slider أو animation تقيلة.
الـ Registry وإضافة ثيم أو كومبوننت لاحقًا
•	themes/registry.ts يسجل الثيمات. getTheme(key) وgetComponent(themeKey, type) مع fallback آمن لو النوع غير معروف (يتجاهله ولا يكسر الصفحة).
•	كومبوننت جديد: schema جديد في shared/schemas + إضافته لـ COMPONENT_TYPES في الـ front وفي config/landing.php في الـ back + تطبيقه في كل ثيم.
•	ثيم جديد: فولدر جديد + سطر في الـ registry + صف في ThemeSeeder.
التحقق من المحتوى في الـ back (PageContentSanitizer)
الـ back لا يعرف schemas الـ front، فيطبق قواعد عامة تعتمد على أسماء المفاتيح:
•	أقصى 30 section في الصفحة، وحجم JSON أقصى 256KB، وعمق أقصى 5 مستويات، وأقصى 50 عنصر في أي مصفوفة.
•	type لازم من القائمة المعتمدة. id لازم uuid. visible boolean. variant حروف وأرقام وشرطة بحد 40.
•	أي string: يُزال منه HTML tags ويُقص بحد 5000 حرف (العناوين بحد 200).
•	مفاتيح *_media_id و*_media_ids: لازم الميديا تتبع نفس الـ tenant وإلا 422.
•	مفاتيح *_url: تمر على قاعدة SafeUrl. مفاتيح *_color: hex فقط.
•	header وfooter مسموح بواحد من كل منهما كحد أقصى.
Starter sections
كل ثيم يعرّف starterSections: header, hero, gallery, product_showcase, features, offers, testimonials, faq, order_form, footer. الصفحة الجديدة تتولد بها ومحتواها الافتراضي من defaults في الـ schemas.
7) منطق الأعمال
المرجع الوحيد لأي سعر هو PriceCalculator في الـ back. الـ front يعرض فقط، وأي سعر يُحفظ في طلب يتحسب من جديد وقت الطلب.
7.1 حساب السعر (PriceCalculator)
مدخلات: المنتج، الكمية (1 إلى 20)، الخيارات المختارة، وقت الحساب now، كود الخصم (اختياري)، رقم الموبايل (اختياري). كل الحسابات بالقروش (integers) والتقريب half-up.
1.	سعر الوحدة = price + مجموع price_delta للقيم المختارة. لازم كل option مطلوب يكون له قيمة مختارة، والقيمة تتبع نفس الـ option وتكون is_active، وإلا خطأ validation.
2.	الإجمالي الأساسي base_subtotal = سعر الوحدة × الكمية.
3.	العروض: العرض فعّال لو is_active وstarts_at <= now (أو null) وnow <= ends_at (أو null) والمنتج في offer_products. لكل عرض فعّال احسب الإجمالي بعده:
o	percentage: base_subtotal − round(base_subtotal × value / 100).
o	fixed: base_subtotal − min(value × quantity, base_subtotal) (المبلغ على الوحدة).
o	bundle: يُطبّق فقط لو quantity >= bundle_quantity. groups = floor(quantity / bundle_quantity) والباقي rem. الإجمالي = groups × bundle_price + rem × price + (مجموع price_delta × quantity).
4.	اختر أفضل عرض واحد (أقل إجمالي بعد العرض). التعادل: أعلى priority ثم الأقدم id. لا يوجد جمع بين عرضين. offer_discount = base_subtotal − الإجمالي بعد العرض.
5.	كود الخصم (لو موجود): يتحقق بالترتيب ويرجع أول سبب فشل برسالة عربي:
a.	الكود موجود (بحث غير حساس لحالة الحروف) وis_active.
b.	داخل فترته (starts_at/ends_at).
c.	ينطبق على المنتج (لا صفوف في discount_code_products = كل المنتجات).
d.	used_count < usage_limit لو الحد موجود.
e.	عدد استخدامات نفس الرقم غير المُفرج عنها < usage_limit_per_phone (لو الرقم معروف).
f.	الإجمالي بعد العرض >= min_order_total.
g.	لو في عرض مطبّق والكود stackable_with_offers = false → «الكود لا يعمل مع العروض الحالية».
o	الخصم: percentage = round(بعد_العرض × value/100) ومحدود بـ max_discount. fixed = min(value, بعد_العرض).
6.	الإجمالي النهائي = بعد_العرض − code_discount (لا يقل عن 0).
مخرجات Quote:
{
  "currency": "EGP", "unit_price": 350.00, "quantity": 2,
  "base_subtotal": 700.00,
  "offer": { "id": 5, "name": "...", "type": "bundle", "discount": 100.00 },
  "subtotal_after_offer": 600.00,
  "code": { "code": "EID25", "discount": 60.00 },
  "code_error": null,
  "total": 540.00
}
•	في quote (معاينة) خطأ الكود لا يفشّل الطلب: يرجع 200 مع code_error ونص الرسالة.
•	في إنشاء الطلب خطأ الكود يرجع 422 على الحقل code.
•	اختبارات Unit إلزامية بجدول حالات: كل نوع عرض، bundle مع باقي، bundle مع خيارات بفروق سعر، اختيار أفضل عرض، حدود الوقت (البداية والنهاية شاملتين)، سقف الخصم، الحد الأدنى، الحد الكلي والحد لكل رقم، عدم التجميع، التقريب، الإجمالي لا ينزل عن صفر.
7.2 العروض والأكواد (قواعد الإدخال)
•	العرض: percentage من 1 إلى 95. fixed أكبر من 0 وأقل من سعر أقل منتج مرتبط. bundle: bundle_quantity >= 2 وbundle_price < price × bundle_quantity لكل منتج مرتبط. ends_at > starts_at. لازم منتج واحد على الأقل.
•	الكود: حروف وأرقام و_ و- بطول 3 إلى 30، يتخزن UPPERCASE، فريد داخل الـ tenant. لا يجوز تعديل type بعد أول استخدام.
•	حالة العرض/الكود المعروضة في الداشبورد تُحسب من الوقت: متوقف، مجدول (لم يبدأ)، نشط، منتهي.
•	الاستخدام used_count = عدد الـ redemptions غير المُفرج عنها (released_at null). يزيد وينقص داخل transaction مع lockForUpdate على صف الكود.
7.3 إنشاء الطلب (Public)
كل الخطوات داخل transaction واحدة (ما عدا الفحوص الأولية):
1.	الصفحة منشورة، الـ tenant active، المنتج is_active، وفيها order_form ظاهر (من published_content).
2.	فخاخ الـ bots: حقل honeypot اسمه website لازم فاضي، وform_token (HMAC على page_id|timestamp بمفتاح التطبيق) صالح: أقدم من 3 ثواني وأحدث من ساعتين. الرفض برد عام «تعذر إتمام الطلب» (422، code=rejected) بدون كشف السبب.
3.	Rate limit: 5 طلبات/10 دقائق لكل IP و3 طلبات/10 دقائق لكل رقم موبايل (Redis).
4.	المحظورين: لو الرقم أو الـ IP في blocked_customers → نفس الرد العام (rejected).
5.	توليد validation ديناميكي من إعدادات order_form المنشورة (الحقول المفعّلة والمطلوبة والمخصصة وخياراتها). حقل غير مفعّل لا يُقبل.
6.	تطبيع الرقم (7.5). حساب Quote من جديد. أي كود غير صالح → 422.
7.	قفل صف الكود (lockForUpdate) وإعادة فحص حدود الاستخدام.
8.	توليد order_number: قفل order_counters للـ tenant وزيادة الرقم (يبدأ من 1001).
9.	إنشاء orders + order_items (snapshot كامل للأسماء والأسعار والخيارات) + order_status_logs (من null إلى new) + discount_code_redemptions.
10.	كشف التكرار: نفس customer_phone ونفس product_id في آخر 24 ساعة (قابلة للضبط في config) بحالة غير fake/cancelled → is_duplicate_suspect = true. الطلب يُقبل ولا يُرفض.
11.	تسجيل ip_address وuser_agent وutm (من الـ query string والـ referrer اللي يرسلها الـ front).
12.	الرد: order_number وtotal فقط.
7.4 حالات الطلب والانتقالات
من	إلى (المسموح)
new جديد	confirmed cancelled fake
confirmed مؤكد	delivered cancelled damaged fake
delivered تم التسليم	returned
cancelled ملغي	new (إعادة فتح)
fake زائف	new (إعادة فتح)
returned مسترجع، damaged هالك	نهائيتان
•	كل انتقال يسجل صف في order_status_logs مع ملاحظة اختيارية، ويحدّث status_changed_at. انتقال غير مسموح = 422.
•	الانتقال إلى fake: خياران في نفس الطلب block_phone وblock_ip لإضافتهم لـ blocked_customers.
•	الانتقال إلى fake أو cancelled: يُفرج عن الـ redemption (released_at = now) وينقص used_count. إعادة الفتح لا تعيد استهلاك الكود (قيد معروف، يُوثّق في DECISIONS).
•	تعديل بيانات العميل (الاسم، الموبايل، العنوان، الملاحظات) مسموح فقط في new وconfirmed. المبالغ لا تُعدّل أبدًا بعد الإنشاء.
•	أرقام الداشبورد: لكل حالة عدّاد. «الإيراد» = مجموع total للطلبات delivered فقط.
7.5 تطبيع الموبايل (PhoneNormalizer)
•	يحوّل الأرقام العربية-الهندية إلى لاتينية، ويشيل المسافات والشرطات والأقواس.
•	يقبل: 01XXXXXXXXX (11 رقم يبدأ بـ 010/011/012/015)، +201XXXXXXXXX، 00201XXXXXXXXX، 201XXXXXXXXX.
•	يخزن بصيغة +20 + 10 أرقام. غير ذلك → «رقم الموبايل غير صحيح». الخطوط الأرضية غير مدعومة في الإصدار ده.
•	نفس منطق التطبيع يتكرر في الـ front (دالة نقية مع اختبارات) للتحقق الفوري، والمرجع هو الـ back.
7.6 الدومينات
•	subdomain يتولد عند التسجيل: slug(ascii(اسم المتجر)) مقصوص على 20 حرف + - + 4 أرقام عشوائية، مثل rashad-4821. لو الاسم لا ينتج حروف يستخدم store. يتكرر التوليد لحد ما يبقى فريد وغير محجوز.
•	أسماء محجوزة لا تُعطى لأي عميل: www app api admin mail ftp static media cdn platform support billing dashboard cname ns1 ns2 test staging dev.
•	العميل يقدر يغيّر الـ label (3–30 حرف a-z0-9- لا يبدأ ولا ينتهي بشرطة).
•	تفاصيل الدومين الخاص في المرحلة 10.
7.7 الحدود الداخلية (config/landing.php)
صفحات لكل tenant: 200. منتجات: 500. ميديا: 2000 ملف. أكواد: 500. عروض: 200. دومينات خاصة: 10. أقصى حجم رفع صورة: 5MB. كلها قابلة للتعديل من الملف، وبدون واجهة. تجاوز الحد = 422 برسالة عربي.
8) مرجع الـ API
الـ Base: /api/v1. الإصدار الأول فقط. كل الردود JSON.
اتفاقيات عامة
•	نجاح: { "data": ..., "meta": {...}? }. القوائم فيها meta: { current_page, last_page, per_page, total } ومعاملات ?page=&per_page= (الافتراضي 20، الأقصى 100).
•	خطأ: { "message": "نص عربي", "code": "snake_case_code", "errors": { "field": ["..."] }? }.
•	الأكواد: 401 unauthenticated، 403 forbidden أو tenant_suspended، 404 not_found، 409 conflict (مع تفاصيل الاستخدامات عند الحذف)، 422 validation_failed أو rejected، 429 too_many_requests، 500 server_error.
•	المبالغ أرقام عشرية بمنزلتين. التواريخ ISO 8601 بـ UTC (2026-11-01T10:00:00Z).
•	مجموعات الـ middleware: auth عامة، dashboard = auth:sanctum + ResolveTenantFromUser + EnsureTenantActive، public = EnsureInternalKey + throttle، admin = auth:sanctum + EnsureSuperAdmin.
Auth (عام)
Method	Path	الطلب	الرد
POST	/auth/register	name, email, phone, store_name, password, password_confirmation	user, tenant, token, domain
POST	/auth/login	login (إيميل أو موبايل), password	user, tenant, token
POST	/auth/logout	— (auth)	204
GET	/auth/me	— (auth)	user, tenant, primary_host
Dashboard (كلها تحت /dashboard)
Method	Path	الوصف
GET	/overview	أرقام الرئيسية: طلبات اليوم والأسبوع، عدّاد كل حالة، إيراد المسلّم، آخر 5 طلبات
PATCH	/profile	name, email, phone
PUT	/profile/password	current_password, password, password_confirmation
PATCH	/store	name (اسم المتجر)
GET	/themes	الثيمات الفعّالة
GET/POST	/identities	قائمة / إنشاء هوية
GET/PUT/DELETE	/identities/{id}	عرض / تعديل / حذف (409 لو مستخدمة أو افتراضية)
POST	/identities/{id}/make-default	تعيين افتراضية
GET	/media	?q= بحث بالاسم
POST	/media	multipart: files[] (حتى 10)، purpose = general أو favicon
PATCH/DELETE	/media/{id}	alt / حذف (409 + قائمة الاستخدامات)
GET/POST	/products	?q=&active= / إنشاء (مع options وmedia_ids متداخلة)
GET/PUT/DELETE	/products/{id}	عرض / تعديل متداخل (sync) / حذف (409 لو مستخدم في صفحة)
POST	/products/{id}/toggle	تفعيل/إيقاف
POST	/products/{id}/duplicate	نسخ بالخيارات والصور
GET/POST	/offers	قائمة (مع status محسوب) / إنشاء
GET/PUT/DELETE	/offers/{id}	
POST	/offers/{id}/toggle	
GET/POST	/discount-codes	
GET/PUT/DELETE	/discount-codes/{id}	
POST	/discount-codes/{id}/toggle	
GET	/discount-codes/{id}/redemptions	سجل الاستخدام
POST	/pricing/preview	product_id, quantity, options, code?, at? (وقت افتراضي للمحاكاة) → Quote
GET/POST	/pages	قائمة / إنشاء: title, slug, theme_key, identity_id, product_id?, content?
GET	/pages/{id}	يرجع draft_content وversion والبيانات كاملة
PUT	/pages/{id}	بيانات: title, slug, identity_id, product_id, seo_override, tracking_override
PUT	/pages/{id}/content	version, theme_key?, content → محتوى المسودة. 409 version_conflict لو الـ version قديم
POST	/pages/{id}/publish	يتحقق ثم ينشر. 422 بقائمة blockers لو في موانع
POST	/pages/{id}/unpublish	
POST	/pages/{id}/duplicate	
POST	/pages/{id}/set-home	
DELETE	/pages/{id}	حذف ناعم
GET	/orders	?status=&q=&page_id=&product_id=&from=&to=&duplicate=1&sort=
GET	/orders/stats	عدّاد كل حالة + new_since لو أُرسل ?since=
GET	/orders/export	CSV بنفس فلاتر القائمة (UTF-8 مع BOM)
GET	/orders/{id}	تفاصيل + items + logs + عدد طلبات نفس الرقم وحالاتها
PATCH	/orders/{id}	تعديل بيانات العميل وinternal_note (new/confirmed فقط)
POST	/orders/{id}/status	status, note?, block_phone?, block_ip?
POST	/orders/bulk-status	ids[] (حتى 100)، status, note?
GET/POST	/blocked-customers	?type= / type, value, reason?
DELETE	/blocked-customers/{id}	
GET	/domains	كل الدومينات مع تعليمات الربط والحالة
PUT	/domains/subdomain	label
POST	/domains/custom	host
POST	/domains/{id}/verify	إعادة تحقق الآن
POST	/domains/{id}/make-primary	
DELETE	/domains/{id}	للدومين الخاص فقط
Public (مفتاح داخلي X-Internal-Key + الـ host كمعامل)
Method	Path	الوصف
GET	/public/resolve-host?host=	{ status, tenant_active, primary_host, is_primary, home_slug } أو 404
GET	/public/pages?host=&slug=	(slug فاضي = الرئيسية) صفحة منشورة: page, theme_key, content, identity, product (+options+media urls), offers (فعّالة ومجدولة), seo, tracking
GET	/public/sitemap?host=	الصفحات المنشورة: slug, updated_at
GET	/public/form-token?host=&slug=	{ token } موقّع بزمن
POST	/public/quote	host, slug, quantity, options, code?, phone? → Quote
POST	/public/orders	host, slug, quantity, options, code?, customer{name,phone,phone2?,governorate?,city?,address?,notes?}, answers{key:value}, form_token, website (honeypot), utm?, ip, user_agent → { order_number, total }
ملاحظة: ip وuser_agent يرسلهم Next (من هيدرات الطلب الأصلي x-forwarded-for)، والـ back يثق فيهم لأن المفتاح الداخلي مطلوب.
Internal (شبكة Docker فقط، غير معروضة من Caddy، ومساراتها بدون بادئة /api/v1)
Method	Path	الوصف
GET	/internal/tls/ask?domain=	Caddy on-demand TLS. 200 لو مسموح، 404 لو لا
GET	/health	فحص صحة (DB + Redis)
Admin (تحت /admin)
Method	Path	الوصف
GET	/overview	عدد العملاء والصفحات والطلبات
GET	/tenants	?q=&status= مع عدد الصفحات والطلبات
GET	/tenants/{id}	تفاصيل + دومينات
POST	/tenants/{id}/suspend	reason
POST	/tenants/{id}/activate	
POST	/tenants/{id}/reset-password	يرجع temporary_password مرة واحدة
GET	/themes	
PATCH	/themes/{key}	is_active
مسارات Next (Route Handlers)
Path	الوظيفة
POST /api/auth/register /login /logout	يكلم Laravel ويضبط/يمسح الكوكي
ALL /api/bff/[...path]	بروكسي للداشبورد بالتوكن + فحص Origin
GET /api/public/form-token POST /api/public/quote /orders	بروكسي للزوار على الـ host الحالي
POST /api/revalidate	يستدعيه Laravel بسر مشترك لـ revalidateTag
GET /api/health	فحص صحة لـ Docker
المرحلة 1 — الأساس والتسجيل والدخول
الهدف: مشروعين شغالين (back وfront)، الـ tenancy بعزل محكم، التسجيل والدخول، وقالب الداشبورد. في نهاية المرحلة العميل يسجل ويدخل ويشوف داشبورد فاضي.
Back
1.	التهيئة: composer create-project laravel/laravel back. PHP 8.3. ثبّت: laravel/sanctum، pestphp/pest + pest-plugin-laravel، laravel/pint، laravel-lang/lang (الـ ar)، وlarastan (اختياري لو اشتغل). اضبط: APP_LOCALE=ar، APP_TIMEZONE=UTC، QUEUE_CONNECTION=redis، CACHE_STORE=redis، SESSION_DRIVER=array. حوّل التطبيق لـ API فقط: احذف مسارات web وviews، وسجّل routes/api.php بالبادئة api/v1 وroutes/internal.php بدون بادئة.
2.	docker-compose.dev.yml في الجذر: mysql:8 وredis:7 وmysql_test (لقاعدة الاختبارات). وثّق الأوامر في README.md.
3.	الـ Tenancy Core حسب قسم 4: TenantContext، TenantScope، BelongsToTenant، Tenancy::runAs/withoutTenant، Rules (TenantExists، TenantUnique).
4.	Migrations + Models + Factories + Enums: tenants، users، personal_access_tokens، domains، themes، failed_jobs. Enums: TenantStatus، UserRole، DomainType، DomainStatus، SslStatus. config/landing.php بالقيم المبدئية (الأسماء المحجوزة، الحدود، المحافظات الـ 27 بالعربي، الخطوط، قائمة أنواع الكومبوننتس).
5.	Services: PhoneNormalizer (7.5)، SubdomainGenerator (7.6) مع اختبارات Unit كاملة (أسماء عربية، فارغة، محجوزة، تكرار).
6.	Action RegisterTenant داخل transaction: ينشئ tenant (name = store_name) + user (role=owner) + صف domains (type=subdomain، status=active، is_primary=true، active_host) ثم يصدر التوكن. (الهوية الافتراضية تُضاف في المرحلة 2.)
7.	Auth endpoints (قسم 8): تسجيل، دخول (بإيميل أو موبايل)، خروج (يحذف التوكن الحالي)، me. التوكن صلاحيته 30 يوم. رسالة خطأ الدخول موحدة «بيانات الدخول غير صحيحة» (لا تكشف هل الإيميل موجود). حساب is_active=false أو tenant موقوف → 403.
8.	Rate limiters (Redis): تسجيل 5/ساعة/IP، دخول 5/دقيقة لكل IP+login.
9.	معالجة الأخطاء في bootstrap/app.php: أي طلب api/* أو internal/* يرجع JSON بشكل قسم 8 (بما فيها 404 لـ ModelNotFound، 401، 422، 429، 500 بدون تسريب تفاصيل في production).
10.	Middleware: ResolveTenantFromUser، EnsureTenantActive، EnsureInternalKey (يقارن بـ hash_equals مع INTERNAL_API_KEY)، EnsureSuperAdmin. سجّلهم كـ aliases.
11.	Health: GET /health (يفحص DB وRedis).
12.	API Resources أساسية: UserResource، TenantResource، وtrait لتوحيد شكل الرد والـ pagination meta.
Front
1.	التهيئة: pnpm create next-app front (TypeScript، App Router، Tailwind، ESLint، src/، alias @/*). ثبّت: shadcn/ui، lucide-react، react-hook-form، zod، @hookform/resolvers، @tanstack/react-query، sonner، zustand، date-fns، clsx، tailwind-merge، @fontsource/cairo، وvitest + Testing Library.
2.	الأساس: <html lang="ar" dir="rtl">، خط Cairo من @fontsource (بدون طلبات خارجية)، tokens للداشبورد (محايد + لون أساسي)، src/messages/ar.ts.
3.	طبقة الـ API: lib/api/server.ts (fetch من Server Components بالتوكن من الكوكي) وlib/api/client.ts (يكلم /api/bff) مع ApiError يحمل message/code/errors، ودالة تحول 422 لأخطاء حقول react-hook-form.
4.	الـ BFF: Route Handlers /api/auth/register|login|logout (يضبطوا الكوكي lp_token httpOnly + Secure في production + SameSite=Lax + 30 يوم) و/api/bff/[...path] (يمرر method وheaders ومحتوى JSON وmultipart بدون تحميله في الذاكرة، يضيف Bearer، يفحص Origin لغير GET، ويمسح الكوكي عند 401).
5.	middleware.ts حسب قسم 4: تصنيف الـ Host (مع قراءة PLATFORM_DOMAIN وAPP_HOST من env)، وفي host الـ app: لا كوكي + مسار محمي → /login، وكوكي + /login أو /register → /dashboard. (إعادة كتابة _sites تُفعَّل في المرحلة 8 لكن الـ middleware يجهّز الفرع.)
6.	الصفحات: /login، /register (الحقول: الاسم، الإيميل، الموبايل، اسم المتجر، الباسورد، تأكيد الباسورد. تحقق zod فوري بما فيه تحقق الموبايل المصري)، (dashboard)/layout (Sidebar يمين RTL على الديسكتوب وDrawer على الموبايل، Topbar فيه اسم المتجر وقائمة المستخدم وخروج)، /dashboard (صفحة رئيسية مؤقتة بـ EmptyState)، /dashboard/settings (تعديل الاسم والإيميل والموبايل واسم المتجر + تغيير الباسورد).
7.	عناصر الواجهة المشتركة (components/ui وcomponents/dashboard): Button، Input، Label، Textarea، Select، Switch، Checkbox، Card، Dialog، Sheet، DropdownMenu، Table، Tabs، Badge، Skeleton، Toaster، PageHeader، EmptyState، ConfirmDialog، FormField (label + خطأ + hint)، DataTable بسيط مع pagination.
8.	عناصر القائمة الجانبية (روابطها تظهر من الآن وتعطي صفحة «قريبًا» لحد ما تتبني): الرئيسية، الصفحات، الطلبات، المنتجات، العروض، أكواد الخصم، الهويات، مكتبة الوسائط، النطاقات، الإعدادات.
9.	Vitest: اختبارات لدالة تطبيع الموبايل ودالة تنسيق السعر formatPrice ومحوّل أخطاء 422.
الاختبارات (Back)
•	تسجيل ناجح ينشئ tenant + user + subdomain فعّال وprimary، ويرجع توكن.
•	تسجيل بإيميل أو موبايل مكرر → 422. موبايل غير مصري → 422.
•	دخول بإيميل وبموبايل، وباسورد غلط، وحساب موقوف، وrate limit.
•	me وlogout (التوكن بعد الخروج يرجع 401).
•	اختبارات Tenancy (قسم 4) كاملة، وفحص أن EnsureInternalKey يرفض غياب المفتاح أو خطأه.
معيار القبول
•	أنشئ حساب من الواجهة → تدخل الداشبورد → تخرج → تدخل تاني.
•	في الداتابيز: tenant + user + domain بالشكل الصحيح.
•	أي طلب بتوكن tenant تاني على بيانات مش بتاعته يرجع 404 (جاهز للمراحل الجاية).
•	التطبيقين يشتغلوا محليًا بالأوامر الموثقة في README، وكل أوامر الجودة خضراء.
المرحلة 2 — الهويات ومكتبة الميديا
الهدف: العميل يرفع صوره مرة واحدة في مكتبة، ويعرّف هويته (لوجو، ألوان، خطوط، SEO، تواصل، تتبع) مرة واحدة ويربطها بأي صفحة. في نهاية المرحلة MediaPicker جاهز لاستخدامه في كل المراحل الجاية.
Back
1.	Migrations + Models: media وidentities حسب قسم 5. فهارس tenant_id. Identity فيه accessors للألوان بقيم افتراضية آمنة لو ناقصة.
2.	ثبّت intervention/image (v3, GD) وتأكد أن GD مثبت في صورة Docker.
3.	MediaProcessor:
o	يتحقق من نوع الملف بـ finfo (jpeg وpng وwebp فقط، لا svg ولا gif)، وأقصى 5MB، وأقصى 6000px، وأدنى عرض 16px.
o	يعيد ترميز الصورة (يزيل EXIF وأي بيانات مدفونة)، ويصحح الـ orientation.
o	ينتج 3 نسخ WebP: thumb (عرض 320)، medium (800)، large (1600) مع الحفاظ على النسبة ودون تكبير الصور الأصغر.
o	لو purpose=favicon: ينتج كمان icon32.png وicon180.png (مربع بقص من المنتصف).
o	المسار: tenants/{tenant_id}/{Y}/{m}/{ulid}-{variant}.{ext} على disk public. الأسماء عشوائية، ولا يُستخدم اسم الملف الأصلي في المسار.
o	يسجل width/height للأصل بعد المعالجة. أي فشل → حذف أي ملف اتكتب (cleanup) ورد 422.
4.	Media model: attribute urls يرجّع {thumb, medium, large} بصيغة /media/{path} (نسبية، Caddy بيخدمها). MediaResource يرجّع id, name, alt, width, height, urls, size.
5.	Endpoints الميديا (قسم 8): قائمة مع بحث وpagination (الأحدث أولًا)، رفع متعدد (حتى 10 ملفات في الطلب، والحد الكلي 2000 ملف للـ tenant)، تعديل alt، حذف. الحذف يفحص الاستخدامات في: identities (logo/favicon/og)، product_media، landing_page_media، landing_pages.seo_override.og_media_id. لو مستخدمة → 409 مع قائمة usages: [{type, id, name}]. لو مش مستخدمة يحذف الملفات من القرص ثم الصف.
6.	Endpoints الهويات (قسم 8):
o	name إلزامي (حتى 60)، brand_name إلزامي (حتى 60).
o	الألوان: hex صالح #RRGGBB. الخطوط: من القائمة (cairo, tajawal, almarai, ibm_plex_arabic, noto_kufi, readex_pro). button_radius من القيم المحددة.
o	الميديا (logo_media_id...) تتحقق بـ TenantExists.
o	contact.whatsapp وcontact.phone يمروا على PhoneNormalizer، وcontact.email إيميل صالح. socials.* روابط https فقط وتنتمي لدومين الشبكة المعنية (facebook.com وfb.com، instagram.com، tiktok.com، youtube.com وyoutu.be، x.com وtwitter.com، snapchat.com).
o	التتبع (مهم أمنيًا لأنه يُحقن في سكريبتات): meta_pixel_id أرقام 10–20، tiktok_pixel_id حروف كبيرة وأرقام 10–30، ga4_id بنمط G-[A-Z0-9]{6,14}، gtm_id بنمط GTM-[A-Z0-9]{4,10}، snapchat_pixel_id UUID، google_site_verification وfacebook_domain_verification حروف وأرقام و_ و- فقط بطول 10–100. conversion_event = Lead أو Purchase.
o	هوية واحدة افتراضية دايمًا: أول هوية تُنشأ تكون افتراضية. حذف الهوية الافتراضية مرفوض (409) قبل تعيين غيرها. حذف هوية مستخدمة في صفحات (حتى غير منشورة) مرفوض (409 مع أسماء الصفحات).
7.	تحديث RegisterTenant: ينشئ هوية افتراضية (brand_name = اسم المتجر، ألوان افتراضية جميلة، font_heading=font_body=cairo، button_radius=md).
8.	FrontendRevalidator service + Job RevalidateTenantHosts: ينادي POST {FRONT_INTERNAL_URL}/api/revalidate بالسر REVALIDATE_SECRET. يُشغَّل بعد تعديل الهوية. لو FRONT_INTERNAL_URL فاضي أو الطلب فشل يسجل warning ولا يكسر العملية. (الـ endpoint نفسه في Next يتبني في المرحلة 8.)
9.	تقديم الصور محليًا: في التطوير Laravel يخدم /media/* عبر route مؤقت يقرأ من disk (أو php artisan storage:link ويعدل المسار). في الإنتاج Caddy يخدمها مباشرة من الـ volume (قسم 20).
Front
1.	مكتبة الوسائط /dashboard/media: شبكة صور مع lazy loading، سحب وإفلات للرفع، رفع متعدد مع progress لكل ملف ورسائل خطأ لكل ملف، بحث، تعديل alt، حذف مع ConfirmDialog ويعرض أماكن الاستخدام لو 409. حالة فاضية جذابة.
2.	MediaPicker (components/shared/media-picker): Dialog فيه تبويبين «المكتبة» و«رفع جديد»، يدعم mode='single'|'multiple' وmax، يرجع ids، ويدعم الترتيب بالسحب (dnd-kit) في وضع multiple عبر مكون MediaListField. مستخدم لاحقًا في الهويات والمنتجات والـ Builder.
3.	الهويات /dashboard/identities: قائمة بطاقات (اسم، لوجو، لوحة ألوان، شارة «افتراضية»)، إنشاء/تعديل، تعيين افتراضية، حذف.
4.	فورم الهوية مقسّم أقسام قابلة للطي: (أ) البراند: الاسم، اسم البراند، اللوجو، الفافيكون، صورة المشاركة OG. (ب) الألوان: color picker لكل لون مع معاينة حية وتنبيه لو التباين بين primary ونص الزر ضعيف (WCAG AA). (ج) الخطوط: اختيار الخط للعناوين والنص مع معاينة نص عربي، وشكل الأزرار. (د) SEO الافتراضي: العنوان والوصف مع عدّاد حروف ومعاينة بشكل نتيجة جوجل. (هـ) التواصل والسوشيال. (و) التتبع والتحقق: حقل لكل ID مع تلميح قصير بالعربي عن مكان الحصول عليه، ومثال على الشكل الصحيح، وتحقق فوري بنفس regex الـ back، واختيار حدث التحويل (Lead أو Purchase) مع شرح الفرق.
5.	IdentityPreview: بطاقة معاينة حية على جنب (لوجو + عنوان + نص + زر بألوان وخطوط الهوية). تُعاد استخدامها في اختيار الهوية داخل الصفحات.
6.	الخطوط: ثبّت حزم @fontsource/* للخطوط الستة. دالة getFontCss(key) تحمّل ما يلزم فقط (التحميل الفعلي في العرض العام ضمن المرحلة 8).
7.	شاشات الـ loading/empty/error لكل ما سبق.
الاختبارات
•	Back: رفع صورة سليمة (3 نسخ)، رفض ملف PHP بامتداد صورة، رفض svg وgif، رفض أكبر من 5MB، favicon، حذف مستخدمة (409) وغير مستخدمة، عزل الـ tenant للميديا والهويات، كل قواعد validation للهوية بما فيها كل أنماط التتبع الصالحة وغير الصالحة وحقن ("><script>) مرفوض، قواعد الهوية الافتراضية.
•	Front: اختبار دالة التباين، ودالة مطابقة regex التتبع.
معيار القبول
•	أرفع 5 صور، أعدّل alt، أحاول أحذف صورة مستخدمة فيرفض بوضوح.
•	أعمل هويتين بألوان مختلفة وأعيّن الثانية افتراضية.
•	معاينة الهوية تتغير فورًا مع تغيير اللون والخط.
المرحلة 3 — المنتجات والخيارات
الهدف: مكتبة منتجات بصور وخيارات (مقاس، لون، أي خاصية) وفروق سعر. المنتج يُربط لاحقًا بصفحة.
Back
1.	Migrations + Models: products، product_media، product_options، product_option_values حسب قسم 5. العلاقات: Product hasMany options (ordered by position)، Option hasMany values (ordered)، Product belongsToMany media (pivot position).
2.	قواعد التحقق:
o	name إلزامي حتى 150. price أكبر من 0 وحتى 9,999,999.99. compare_at_price اختياري ولازم أكبر من price. sku اختياري حتى 60. description حتى 10,000 حرف (Markdown مبسط يُخزَّن كنص خام).
o	الخيارات: حتى 5 لكل منتج. اسم الخيار حتى 40 وفريد داخل المنتج. القيم: من 1 إلى 30 لكل خيار، label حتى 40 وفريد داخل الخيار، price_delta ≥ 0، وcolor_hex إلزامي لو display_type = swatch وإلا يُتجاهل.
o	الصور: حتى 10 media_ids تتبع الـ tenant (TenantExists)، الترتيب المرسل هو الترتيب المحفوظ، والأولى هي الرئيسية.
3.	SaveProduct Action: إنشاء وتعديل متداخل داخل transaction. المزامنة بالـ id: العناصر اللي لها id تُحدّث، اللي بدون id تُنشأ، واللي اتشالت من الطلب تُحذف. أي id لا يتبع المنتج أو الـ tenant → 422. الحذف آمن لأن الطلبات القديمة تخزن snapshot.
4.	Endpoints (قسم 8): قائمة (بحث بالاسم والـ sku، فلتر active، مع الصورة الرئيسية وعدد الخيارات)، عرض، إنشاء، تعديل، حذف، toggle، duplicate (الاسم + « (نسخة)»، ويُنسخ كل شيء، والنسخة is_active=false).
5.	الحذف: 409 لو المنتج مربوط بأي صفحة غير محذوفة (مع أسماء الصفحات). غير كده soft delete ويفك ارتباط العروض والأكواد (offer_products وdiscount_code_products).
6.	ProductResource وPublicProductResource (الأخير للمرحلة 8: بدون حقول داخلية، مع images كـ urls، وoptions[].values[] النشطة فقط).
7.	إضافة Product لاختبار عزل الـ tenant.
Front
1.	قائمة المنتجات /dashboard/products: جدول (صورة، الاسم، السعر، شارة الحالة، عدد الخيارات)، بحث، فلتر الحالة، Switch للتفعيل، قائمة إجراءات (تعديل، نسخ، حذف)، وEmptyState بزر «أضف أول منتج».
2.	فورم المنتج (صفحة كاملة /dashboard/products/new و/[id]) بأقسام:
o	الأساسيات: الاسم، الوصف (textarea مع تلميح Markdown وزر معاينة)، SKU.
o	التسعير: السعر والسعر قبل الخصم، ويعرض نسبة الخصم المحسوبة تلقائيًا.
o	الصور: MediaPicker متعدد مع سحب لإعادة الترتيب، وعلامة «رئيسية» على الأولى.
o	الخيارات: Builder لإضافة خيار (الاسم، نوع العرض: أزرار / قائمة / ألوان، إلزامي أو لا) وقيمه (الاسم، لون لو ألوان، فرق السعر) مع سحب لإعادة الترتيب وحذف وتكرار قيمة.
o	معاينة حية لشكل الخيارات للزائر داخل بطاقة صغيرة.
3.	تحذير «تغييرات غير محفوظة» عند الخروج. حفظ يعرض toast ويعيد التوجيه. أخطاء 422 تظهر على الحقول المتداخلة الصحيحة (مثلًا options.0.values.2.label).
4.	نافذة ConfirmDialog للحذف، وإذا رد 409 تعرض الصفحات المرتبطة بروابطها.
5.	دوال مساعدة في lib/price.ts: formatPrice، discountPercent، مع Vitest.
الاختبارات
•	Back: إنشاء منتج كامل بالخيارات والصور، تعديل متداخل (إضافة/تعديل/حذف خيار وقيمة)، رفض id خيار من منتج آخر، رفض compare_at_price أقل من السعر، swatch بدون لون، حذف منتج مربوط بصفحة (409)، duplicate، عزل الـ tenant، رفض media من tenant آخر.
•	Front: اختبار discountPercent وتحويل بيانات الفورم المتداخلة.
معيار القبول
•	أنشئ منتج «تيشيرت» بخيار «المقاس» (S, M, L, XL) وخيار «اللون» (swatch) و4 صور مرتبة.
•	أعدّل وأعيد الترتيب وأحذف قيمة ويظهر ذلك صح بعد إعادة التحميل.
المرحلة 4 — العروض وأكواد الخصم ومحرك الأسعار
الهدف: عروض وأكواد لكل منها فترة تشغيل، ومحرك أسعار واحد موثوق (PriceCalculator) هو المرجع لكل الأسعار. من غير cron: الفترة تُفحص وقت الحساب.
Back
1.	Migrations + Models: offers، offer_products، discount_codes، discount_code_products، discount_code_redemptions حسب قسم 5. Offer::scopeActiveAt($now) يطبق شرط الفعالية بالظبط كما في 7.1 (البداية والنهاية شاملتين). DiscountCode فيه mutator يحوّل الكود لـ UPPERCASE ويشيل المسافات.
2.	Enums: OfferType (percentage|fixed|bundle) وDiscountType (percentage|fixed).
3.	PriceCalculator (Service نقي بدون أي اعتماد على request) حسب 7.1 حرفيًا:
o	quote(Product $product, int $quantity, array $selectedOptions, CarbonInterface $now, ?string $code = null, ?string $phone = null): Quote.
o	Quote كائن قيمة (DTO) بـ toArray() بنفس شكل قسم 7.1.
o	أخطاء الخيارات ترمي ValidationException على مفاتيح options.{option_id}.
o	داخليًا كل شيء بالقروش، والتحويل لـ decimal في toArray() فقط.
4.	قواعد التحقق (7.2) في FormRequests. ends_at > starts_at. لا يُسمح بـ bundle_price أكبر أو يساوي price × bundle_quantity لأي منتج مرتبط. تعديل أسعار المنتجات لاحقًا لا يمسح عرض لكن الحساب وقت الطلب يتجاهل أي عرض bundle أصبح غير مربح (لو bundle_price >= price × bundle_quantity فلا يطبّق).
5.	Endpoints (قسم 8): CRUD للعروض والأكواد، toggle، سجل استخدام الكود (صفحات)، وPOST /dashboard/pricing/preview (يقبل at اختياري لمحاكاة وقت معين، ويستخدم نفس PriceCalculator). الوقت المرسل من الواجهة يكون ISO بتوقيت القاهرة ويتحول لـ UTC.
6.	Resources: OfferResource فيه status محسوب (inactive|scheduled|active|expired) وproducts مختصرة، وDiscountCodeResource فيه status وused_count وremaining.
7.	حدود: 200 عرض و500 كود لكل tenant (7.7).
8.	تعديل type لكود له redemptions مرفوض.
Front
1.	العروض /dashboard/offers: جدول (الاسم، النوع، القيمة، المنتجات، الفترة، شارة الحالة بألوان)، فلتر الحالة، toggle، حذف. حالات الشارة: متوقف / مجدول / نشط / منتهي.
2.	فورم العرض: اختيار النوع يبدّل الحقول (نسبة، مبلغ على الوحدة، أو كمية المجموعة + سعرها)، اختيار منتجات متعدد مع بحث، تاريخ ووقت البداية والنهاية (datetime-local) مع عرض صريح «بتوقيت القاهرة» وخيار «بدون نهاية»، ونص الشارة (مثال «وفّر 30%»)، وتلميح لو العرض bundle يعرض «سعر القطعة الفعلي بعد العرض».
3.	أكواد الخصم /dashboard/discount-codes: جدول (الكود مع زر نسخ، النوع والقيمة، الفترة، الاستخدام used/limit، الحالة)، زر «توليد كود عشوائي» (8 حروف وأرقام)، نافذة سجل الاستخدام.
4.	فورم الكود: الكود، النوع والقيمة، السقف الأقصى (للنسبة)، الحد الأدنى للطلب، الفترة، حد الاستخدام الكلي وحد كل رقم، خيار «يعمل مع العروض»، المنتجات المسموحة (فاضي = الكل).
5.	PricePreview (محاكي الأسعار): لوحة تظهر في صفحتي العروض والأكواد: اختيار منتج وكمية وخيارات وكود ووقت افتراضي (اختياري) → تعرض Quote كامل خطوة بخطوة (الأساسي، العرض المطبق، الكود، الإجمالي). تفيد العميل يتأكد إن عرضه شغال قبل النشر.
6.	أدوات التواريخ lib/dates.ts: toCairoInputValue(utcIso) وfromCairoInputValue(local) وformatCairo(utcIso) مع Vitest يغطي التحويل الصيفي والشتوي لمصر.
الاختبارات
•	Unit لـ PriceCalculator بجدول حالات كامل (كل بنود الاختبارات المذكورة في 7.1) — هذا أهم اختبار في المشروع.
•	Feature: CRUD، قواعد الإدخال (bundle غير مربح، نسبة 100، نهاية قبل البداية، كود مكرر بحروف مختلفة)، عزل الـ tenant، preview بوقت at داخل وخارج الفترة.
معيار القبول
•	أعمل عرض «اشتري 2 بـ 350» من الغد لبكرة، والمحاكي يظهر عدم تطبيقه الآن وتطبيقه بعد وقت البداية.
•	كود EID25 بنسبة 25% بحد أقصى 100 جنيه، وحد استخدام 3، ويثبت المحاكي كل الحالات.
المرحلة 5 — محرك الصفحات والـ Builder
الهدف: العميل ينشئ صفحة، يختار ثيم وهوية ومنتج، ويضيف ويرتب ويعدّل ويخفي الكومبوننتس بمعاينة حية، ويحفظ مسودة وينشر. الثيمات الحقيقية تتبني في 6 و7، لكن في هذه المرحلة كل البنية والـ schemas للـ 10 أنواع تكتمل ومعاها placeholders بسيطة عشان الـ Builder يتجرب كامل.
Back
1.	Migrations + Models: landing_pages وlanding_page_media حسب قسم 5. Enum PageStatus. LandingPage فيه home_key يُدار بالكود.
2.	config/landing.php: أنواع الكومبوننتس المعتمدة، مع القيود: singleton: [header, footer]، pinned: {header: top, footer: bottom}، الحد الأقصى لكل نوع، والحد الأقصى للـ sections (30).
3.	PageContentSanitizer وPageContentValidator حسب قسم 6 (قواعد التسمية، الأحجام، الأنواع). يرجّع محتوى نظيف أو ValidationException بمسار الخطأ (content.sections.3.props.cta_url). Rule SafeUrl منفصلة وقابلة لإعادة الاستخدام. اختبارات كثيفة بمحاولات حقن (javascript:، data:، <script>، مسارات مشبوهة، أعماق كبيرة، حجم كبير).
4.	Slugs: regex ^[a-z0-9\p{Arabic}]+(-[a-z0-9\p{Arabic}]+)*$، طول 2–60، محجوزة (api _next admin dashboard login register preview media sitemap robots favicon thank-you)، فريد داخل الـ tenant بين الصفحات غير المحذوفة. عند الحذف الناعم يتغير لـ slug--deleted-{id}.
5.	Actions:
o	CreatePage: ينشئ بهوية الـ tenant الافتراضية لو لم تُحدد. content اختياري (الـ front يرسل starter sections). الصفحة لا تصبح رئيسية تلقائيًا، فقط لو العميل استخدم set-home.
o	SavePageContent: يفحص version (لو لا يطابق → 409 version_conflict مع النسخة الحالية)، يعقّم المحتوى، يحفظه في draft_content، يزيد version، يزامن landing_page_media، ويحدّث theme_key لو أُرسل ومفعّل.
o	PublishPage: يجمع الموانع (blockers) ويرجعها كلها مرة واحدة في 422: (1) لا منتج، (2) المنتج غير نشط، (3) لا يوجد section order_form ظاهر أو أكتر من واحد، (4) المحتوى غير صالح، (5) الثيم غير مفعّل، (6) لا يوجد أي section ظاهر. لو نظيفة: ينسخ draft_content إلى published_content ويضبط status=published وpublished_at، ثم يشغّل RevalidateTenantHosts.
o	UnpublishPage، DuplicatePage (slug جديد {slug}-copy، المسودة فقط، status=draft)، SetHomePage (transaction: يشيل الرئيسية القديمة ثم يضبط الجديدة، ويُشترط أن تكون منشورة)، DeletePage (soft delete، لو كانت الرئيسية تُفك).
6.	Endpoints (قسم 8) + GET /dashboard/themes. PageResource (قائمة بدون المحتوى) وPageDetailResource (مع draft_content, version).
7.	حد 200 صفحة (7.7). تعديل product_id أو identity_id على صفحة منشورة يؤثر فورًا بعد revalidate (لأن الصفحة تقرأهم وقت العرض) وهذا مقصود.
Front — البنية
1.	themes/shared/schemas/*.ts: ملف لكل نوع من الـ 10 يصدّر { type, label, description, icon, fields: FieldDef[], defaults, limits } حسب قسم 6 حرفيًا. FieldDef يدعم كل أنواع الحقول، وshowIf بسيط (مثل إظهار image_media_ids فقط لو source=custom).
2.	themes/registry.ts وtypes.ts حسب عقد قسم 6، و**themes/_fallback/** فيها placeholder لكل نوع: بطاقة بسيطة تعرض اسم النوع وأهم props كنص بتنسيق Tailwind نظيف. الثيمين malak وcelia يسجّلوا نفسهم مؤقتًا بالـ fallback (يتبدل في 6 و7).
3.	themes/shared/fields/: FieldRenderer + مكون لكل نوع حقل (text، textarea، number، range، toggle، select، color، image، images، link، icon، repeater). الـ repeater يدعم السحب والإضافة والحذف وmax وعنوان مطوي لكل عنصر. حقل link يعرض قائمة أقسام الصفحة الحالية كأهداف #anchor (الأنكر = section-{أول 8 حروف من id} و#order للـ order_form) بالإضافة للرابط الخارجي واتصال وواتساب.
4.	themes/shared/hooks/useOrderForm.ts: يُعرَّف فقط عقد الواجهة (types) في هذه المرحلة: fields, values, setValue, errors, quote, status, submit. التنفيذ الحقيقي في المرحلة 9. وضع المعاينة يرجّع قيم تجريبية.
5.	Store الصفحة (zustand، builder/store.ts): { page, content, selectedId, history[], future[], dirty, saveState } مع actions: addSection(type, index?)، moveSection، duplicateSection، removeSection، toggleVisible، updateProps(id, patch)، setVariant، setTheme، undo، redo. قواعد: header مثبت أعلى وfooter أسفل، لا تكرار للـ singleton، حد 30 section. Vitest كثيف على الـ reducers.
Front — الشاشات
1.	قائمة الصفحات /dashboard/pages: بطاقات (اسم، ثيم، شارة الحالة، الرابط الكامل مع نسخ، نجمة الرئيسية، آخر تعديل) وإجراءات: تعديل في الـ Builder، الإعدادات، نشر/إلغاء نشر، نسخ، تعيين رئيسية، حذف.
2.	إنشاء صفحة (Wizard): (أ) اختيار الثيم ببطاقات كبيرة بصور معاينة. (ب) الاسم والـ slug (يتولد تلقائيًا من الاسم ويقبل العربي) + اختيار الهوية (مع IdentityPreview) + اختيار المنتج (أو «إنشاء منتج جديد» يفتح نافذة سريعة). ثم يحوّل للـ Builder بالـ starter sections.
3.	إعدادات الصفحة /dashboard/pages/[id]: الاسم، slug، الهوية، المنتج، SEO الخاص بالصفحة (العنوان، الوصف، صورة OG، noindex) بعدّاد حروف ومعاينة نتيجة جوجل، وTracking override (نفس حقول الهوية بنفس التحقق). يظهر الرابط الفعلي (https://{primary_host}/{slug}).
4.	الـ Builder /dashboard/pages/[id]/builder (شاشة كاملة، على الموبايل يتحول لتبويبات «الأقسام / المعاينة / الإعدادات»):
o	الشريط العلوي: اسم الصفحة، حالة الحفظ (محفوظ / جاري الحفظ / غير محفوظ)، تراجع وإعادة، تبديل الجهاز (موبايل 390 / تابلت 768 / ديسكتوب 1280)، تبديل الثيم، حفظ، معاينة في تبويب جديد، نشر / إلغاء نشر.
o	اللوحة اليمنى (الأقسام): قائمة الـ sections قابلة للسحب (dnd-kit مع دعم الكيبورد) وكل عنصر فيه اسم النوع وأيقونة إخفاء/إظهار ونسخ وحذف (مع تأكيد). زر «إضافة قسم» يفتح مكتبة الكومبوننتس (10 بطاقات مع Thumbnail وشرح، ما هو موجود كـ singleton يظهر معطل).
o	المنتصف (المعاينة): <iframe src="/preview/{pageId}"> يستقبل المحتوى عبر postMessage (نفس الـ origin). الضغط على أي section في المعاينة يحدده في الـ Builder، والنقر على أحد الأقسام في اللائحة يعمل scroll له في المعاينة.
o	اللوحة اليسرى (الإعدادات): لما يتحدد section تظهر فورم مولّدة من الـ schema (FieldRenderer) + اختيار الـ variant بمعاينة مصغرة. لو لا شيء مُحدد تظهر إعدادات الصفحة العامة (الثيم والهوية والمنتج).
o	الحفظ: حفظ تلقائي بعد 1.5 ثانية من آخر تعديل (debounce) + زر يدوي + Ctrl/Cmd+S، وحماية عند إغلاق التبويب مع تغييرات غير محفوظة. عند 409 تظهر نافذة «الصفحة اتعدلت من مكان تاني» بخيارين: إعادة تحميل (يخسر تعديلاتك) أو استبدال (يحفظ على النسخة الأحدث).
o	النشر: زر «نشر» يحفظ أولًا ثم يستدعي publish. لو رجعت blockers تظهر في نافذة بقائمة واضحة وزر يوصل لمكان إصلاح كل مانع. بعد النجاح يظهر الرابط مع زر نسخ.
o	تبديل الثيم: نافذة تأكيد تشرح أن المحتوى يبقى كما هو وأن الـ variants غير الموجودة ترجع للافتراضي.
5.	مسار المعاينة /preview/[pageId] (على APP_HOST فقط، يحتاج الكوكي): يجلب بيانات الصفحة والهوية والمنتج والعروض، ويرسم الـ sections بالـ registry بوضع isPreview=true (التتبع معطل وإرسال الفورم معطل). بروتوكول postMessage بأنواع: builder:init، builder:update (content وthemeKey)، builder:select، preview:ready، preview:select، preview:viewport. يتحقق من event.origin.
6.	دعم ?device= لتحجيم الـ iframe، ورسالة واضحة لو الصفحة بلا منتج («اختر منتجًا لتظهر الأسعار»).
الاختبارات
•	Back: كل قواعد الـ Sanitizer، الـ slug، 409 version_conflict، كل موانع النشر منفصلة ومجمعة، نشر ثم تعديل المسودة لا يغيّر published_content، الرئيسية الوحيدة، حذف الصفحة وإعادة استخدام الـ slug، مزامنة landing_page_media، عزل الـ tenant، رفض ثيم غير مفعّل، رفض هوية أو منتج من tenant آخر.
•	Front: Vitest للـ store (إضافة/نقل/حذف/تراجع/حدود/singleton/pinned)، ومولّد الـ anchors، وفحص أن كل schema فيه defaults يمر على قواعد التسمية.
معيار القبول
•	أنشئ صفحة بثيم ملاك، أضيف كل الـ 10 أنواع، أرتبهم بالسحب، أعدّل نصوص وصور، أخفي قسم، أبدّل الثيم لسيليا وأرجع.
•	أحاول أنشر بدون order_form فتظهر الموانع. أنشر بعد الإصلاح وتتحول الحالة لمنشورة.
•	أعدّل صفحة من تبويبين فيظهر تعارض النسخة.
المرحلة 6 — الثيم الأول «ملاك» (malak) بـ 10 كومبوننت
الهدف: تطبيق بصري كامل للأنواع العشرة بثيم ناعم، كل نوع بـ variants حسب جدول قسم 6، مع استبدال الـ placeholders. الـ Schemas لا تتغير (لو احتجت حقل جديد عدّل الـ schema المشترك وانتبه إن ثيم سيليا هيستخدمه).
قواعد مشتركة لكل كومبوننت في الثيم
•	ملفات: themes/malak/components/<type>/index.tsx (الاختيار حسب variant)، وملف لكل variant، وThumbnail.tsx (wireframe SVG بسيط).
•	Server Component افتراضيًا. التفاعل (سلايدر، عدّاد، أكورديون، الفورم) في ملف Client صغير منفصل.
•	الألوان من متغيرات CSS: --c-primary --c-primary-fg --c-secondary --c-accent --c-bg --c-fg --c-muted --c-border، والخطوط --font-heading --font-body، والـ radius --btn-radius. تُحقن من <IdentityStyle identity> (تتبني في هذه المرحلة، وتحسب --c-primary-fg تلقائيًا للتباين).
•	RTL كامل بـ logical properties. الصور بـ <img> مع srcset من (thumb, medium, large) وsizes مناسبة وwidth/height لمنع CLS وloading="lazy" (إلا صورة الـ hero: fetchpriority="high").
•	لو props اختيارية ناقصة (صورة، نص) المكون يتدهور بشكل جميل: لا صناديق فاضية ولا أخطاء.
•	الحركات CSS فقط، وتحترم prefers-reduced-motion. السلايدر = scroll-snap + أزرار تالي/سابق + مؤشرات، بدون مكتبات.
•	النصوص التي يكتبها العميل تُعرض كنص (React يهرّبها). الوصف Markdown يُرسم بـ react-markdown بدون HTML خام.
•	كل أزرار الـ CTA تحترم link_url (anchor داخلي مع smooth scroll أو رابط خارجي بـ rel="noopener noreferrer").
•	الأحجام: Mobile أولًا من 360px، نقاط التحويل md=768 وlg=1024.
الهوية البصرية لملاك
راديوس كبير (rounded-2xl وrounded-3xl)، أزرار pill، ظلال ناعمة shadow-[0_8px_30px_rgba(0,0,0,.06)]، مسافات رأسية واسعة (py-16 إلى py-24)، خلفيات متبادلة بين --c-bg ودرجة فاتحة جدًا من --c-primary (10% شفافية)، عناوين متوسطة الوزن، وزخارف دائرية ناعمة في الخلفية.
المواصفات لكل كومبوننت
header
•	centered-logo: اللوجو في المنتصف، الروابط على الجانبين (على الموبايل: لوجو + زر قائمة).
•	logo-start: اللوجو في البداية، الروابط في الوسط، زر الـ CTA pill في النهاية.
•	الـ announcement bar شريط رفيع أعلى الهيدر. sticky يثبّت الهيدر مع خلفية blur خفيفة. قائمة الموبايل Sheet من الجانب.
hero
•	split: نص ومعلومات (عنوان كبير، وصف، السعر مع القديم وشارة العرض، زرين، badges) بجانب صورة داخل إطار دائري كبير.
•	full-cover: صورة كاملة بطبقة overlay_opacity والنص فوقها بمحاذاة text_align.
•	centered-card: بطاقة بيضاء عائمة في المنتصف فوق خلفية متدرجة/صورة.
•	min_height يتحكم في الارتفاع. على الموبايل تظهر mobile_image_media_id لو موجودة.
gallery
•	slider: صورة كبيرة مع scroll-snap ونقاط، وthumbnails تحتها لو show_thumbnails.
•	grid: شبكة 2×N بزوايا دائرية، والضغط يفتح lightbox لو مفعّل (Client صغير مع إغلاق Esc وسهم يمين/يسار).
•	المصدر: صور المنتج أو القائمة المخصصة.
product_showcase
•	card: بطاقة واحدة في المنتصف فيها الاسم والسعر والوصف (Markdown) والـ highlights كقائمة أيقونات والـ CTA.
•	side-by-side: الصورة الرئيسية للمنتج بجانب المعلومات.
•	السعر: الحالي كبير، compare_at_price مشطوب، وشارة نسبة الخصم، ولو في عرض فعّال تظهر شارته.
features
•	icon-cards: بطاقات بأيقونة داخل دائرة بلون الهوية الفاتح، 2/3/4 أعمدة حسب columns (عمود واحد على الموبايل).
•	alternating: صفوف متبادلة صورة/نص (تتحول لعمود على الموبايل).
offers
•	يعرض عروض المنتج الفعّالة من ctx.offers. يخفي المكون كله لو لا عروض وكان empty_behavior=hide (بدون أي مسافة).
•	cards: بطاقة لكل عرض (الاسم، الشارة، السعر بعد العرض، التوفير لو show_savings)، والضغط على bundle يضبط الكمية في الفورم ويعمل scroll للـ #order.
•	ribbon-banner: شريط عريض بتدرج لوني للعرض الأقوى مع العدّاد.
•	العدّاد (Client): أيام/ساعات/دقائق/ثواني بأرقام لاتينية، يعتمد على ends_at، وعند انتهاء الوقت يخفي العرض ويعيد جلب بيانات الصفحة بشكل خفيف. العروض المجدولة (لم تبدأ) لا تُعرض كفعّالة.
testimonials
•	cards-slider: بطاقات بنجوم وصورة شخصية بدائرة داخل سلايدر.
•	grid: شبكة بطاقات 1/2/3 أعمدة. صورة الإثبات proof_media_id تظهر كصورة مصغرة قابلة للتكبير.
faq
•	accordion-soft: أكورديون بخلفيات ناعمة وأيقونة +/−. استخدم <details> أو Radix مع دعم الكيبورد وARIA. يحترم first_open وallow_multiple.
•	two-columns: عنوان وشرح في عمود وقائمة الأسئلة في عمود.
order_form (بدون إرسال حقيقي في هذه المرحلة: يبني على useOrderForm بوضع المعاينة)
•	card: بطاقة واحدة: العنوان، حقول العميل (من fields وcustom_fields)، خيارات المنتج (أزرار / قائمة / swatch حسب display_type)، الكمية (+/−)، حقل الكود مع زر «تطبيق»، ملخص السعر (الأساسي، العرض، الكود، الإجمالي)، زر الإرسال كبير، شارات الثقة.
•	split-summary: عمودين على الديسكتوب: الحقول، وبجانبها بطاقة ملخص (صورة المنتج والتفاصيل والإجمالي). على الموبايل الملخص قبل الزر.
•	الأخطاء تحت كل حقل، والحقول inputMode وautoComplete مناسبة (tel، name، street-address) وحجم الخط ≥ 16px على الموبايل لمنع الـ zoom.
•	شاشة النجاح (success_title/message) تعرض مكان الفورم بدون إعادة تحميل (تفعيل حقيقي في المرحلة 9).
•	الـ id للأنكر ثابت = order.
footer
•	simple-center: اللوجو والنص والروابط والسوشيال في المنتصف وسطر الحقوق.
•	columns: 3 أعمدة (عن المتجر، روابط، تواصل).
•	أيقونات السوشيال والتواصل من الهوية، وتُخفى المفاتيح الفاضية.
مكوّنات مساعدة تُبنى هنا (وتُستخدم في سيليا)
IdentityStyle، SafeLink (يحوّل link_url لعنصر آمن)، Price (يعرض السعر والقديم)، Countdown، Lightbox، Slider، RatingStars، OptionSelector (headless + props لـ className)، QuantityStepper، useOfferStore (store صغير يربط الـ offers بالفورم).
أداة مراجعة بصرية
مسار /dev/themes يعمل فقط لما NODE_ENV !== 'production': يعرض كل component بكل variant في ثيم مختار مع بيانات تجريبية (منتج بخيارات، عروض فعّالة وغير فعّالة، صور placeholder مولّدة بـ CSS)، وبتبديل هوية (3 ألوان وخطوط مختلفة) لاختبار قابلية الثيم للتلوين.
الاختبارات
•	Vitest/Testing Library: كل component × variant يترسم بدون أخطاء مع props افتراضية ومع props فاضية تمامًا. لا أخطاء hydration. SafeLink يرفض javascript:.
•	اختبار أن الـ Registry يعيد defaultVariant عند variant غير معروف.
•	(اختياري لو Playwright مثبت) لقطات شاشة لـ /dev/themes بعرض 390 و1280.
معيار القبول
•	في الـ Builder كل الأنواع والـ variants تعمل بهوية بألوان وخطوط مختلفة بدون كسر تخطيط.
•	مراجعة بصرية على 390 و768 و1280، RTL سليم، لا scroll أفقي، لا CLS ملحوظ.
•	الكومبوننتس تتحمل نصوص عربية طويلة جدًا وعناوين من كلمة واحدة.
المرحلة 7 — الثيم الثاني «سيليا» (celia) بـ 10 كومبوننت
الهدف: ثيم جريء بنفس الأنواع والـ props، وبشخصية بصرية مختلفة تمامًا. القواعد المشتركة في المرحلة 6 (Server Components، متغيرات CSS، RTL، الصور، التدهور الجميل، الأداء) تنطبق حرفيًا. استخدم المكونات المساعدة اللي اتبنت في المرحلة 6 ولا تكررها.
الهوية البصرية لسيليا
زوايا حادة أو rounded-sm، حدود واضحة border-2 بلون --c-fg، تباين عالي، عناوين كبيرة وتقيلة (font-extrabold وtracking-tight) بمقاسات text-4xl إلى text-7xl، أزرار مستطيلة بظل صلب shadow-[4px_4px_0_var(--c-fg)] يتحرك عند الضغط، أقسام داكنة بالتبادل (خلفية --c-fg ونص --c-bg)، أرقام كبيرة، شرائط marquee (CSS فقط) وزخارف هندسية. مسافات أضيق من ملاك (py-12 إلى py-16).
المواصفات لكل كومبوننت
header
•	bar: شريط بحد سفلي سميك، اللوجو في البداية والروابط بحروف كبيرة والـ CTA مستطيل بظل صلب.
•	minimal: لوجو وزر قائمة فقط حتى على الديسكتوب (القائمة Overlay كامل الشاشة بخط كبير).
•	شريط الإعلان: Marquee متحرك بنص announcement_text يتكرر.
hero
•	big-type: عنوان ضخم يملأ العرض، والصورة في إطار مستطيل بحد سميك وظل صلب، والسعر في وسم مائل.
•	split-reverse: الصورة في البداية والنص في النهاية مع شريط badges أسفلها.
•	full-cover: صورة كاملة بتباين عالي ونص أبيض ضخم، وزر كبير في الأسفل.
gallery
•	thumbs-side: الصورة الكبيرة والـ thumbnails عمودية بجانبها على الديسكتوب (أفقية على الموبايل).
•	masonry: عمودين/ثلاثة بأحجام متفاوتة (CSS columns) وحدود سميكة، مع lightbox.
product_showcase
•	split-image: صورة المنتج كبيرة بحد سميك وبجانبها لوحة معلومات (الاسم بخط ضخم، السعر كرقم كبير، highlights كصفوف بأيقونات).
•	stacked: كل شيء في عمود واحد مع شريط سعر داكن عريض.
features
•	numbered-grid: شبكة بطاقات بحدود، وفي كل بطاقة رقم ضخم (01 02 03) باللاتيني.
•	icon-list: قائمة رأسية بصفوف مفصولة بخطوط سميكة، أيقونة يمين وعنوان ووصف.
offers
•	bundle-tiles: بلاطات كبيرة (الكمية، السعر، التوفير) بحدود سميكة، البلاطة الأفضل توفيرًا مميزة بشارة «الأكثر طلبًا» (تُحسب تلقائيًا أعلى نسبة توفير)، والضغط على بلاطة يضبط الكمية ويعمل scroll للفورم.
•	countdown-strip: شريط داكن عريض بالعدّاد بأرقام ضخمة وسطر اسم العرض.
•	نفس سلوك الإخفاء والعدّاد وانتهاء الوقت كما في ملاك.
testimonials
•	quote-wall: جدار اقتباسات بأحجام متفاوتة مع علامة اقتباس كبيرة.
•	screenshots-grid: شبكة صور الإثبات (proof_media_id) بحدود سميكة، ولو غير موجودة تعود لبطاقة نصية.
faq
•	accordion-lines: أكورديون بخطوط سميكة بين العناصر وعلامة +/× كبيرة.
•	numbered: كل سؤال يسبقه رقم ضخم، والإجابة تفتح أسفله.
order_form
•	bordered: فورم داخل إطار بحد سميك وظل صلب، العناوين بحروف ضخمة، حقول بحدود واضحة، زر الإرسال عريض داكن.
•	sticky-summary: على الديسكتوب ملخص الطلب لاصق (sticky) بجانب الحقول، وعلى الموبايل شريط سعر ثابت أسفل الشاشة فيه الإجمالي وزر «اطلب الآن» يرجع لأعلى الفورم (يظهر فقط عند الخروج من نطاق الفورم).
•	نفس السلوك الوظيفي والـ id="order" وشاشة النجاح.
footer
•	dark-columns: خلفية --c-fg وأعمدة (عن المتجر، روابط، تواصل) ونص كبير للبراند.
•	minimal-line: سطر واحد: اللوجو والروابط والسوشيال وحقوق النشر، بحد علوي سميك.
التحقق من تكافؤ الثيمين (إلزامي)
1.	اختبار آلي themes/parity.test.ts يمر على كل ComponentType ويتأكد أن الثيمين يعرّفوا component + variants.length >= 2 + defaultVariant ضمن variants + Thumbnail.
2.	اختبار تبديل الثيم: يأخذ محتوى بكل الـ 10 أنواع بأعلى قدر من الـ props، يرسمه بملاك ثم بسيليا بدون أخطاء، ويتحقق من عدم ضياع أي نص أو صورة (نفس النصوص تظهر في الاتنين).
3.	مراجعة /dev/themes للثيمين بهويتين مختلفتين جدًا (فاتحة وداكنة).
بعد إنهاء الثيمين
•	احذف الـ placeholders في _fallback من التسجيل الفعلي، وأبقِ _fallback كـ safety net فقط لأي نوع غير معروف.
•	حدّث Thumbnail لكل نوع ليُظهر الفرق بين الثيمين.
•	حدّث قسم الثيمات في README.md بتعليمات «كيف أضيف ثيم أو كومبوننت جديد».
الاختبارات
•	نفس اختبارات المرحلة 6 للثيم الجديد + اختبارات التكافؤ.
•	تأكد أن /dev/themes غير متاح في production (404).
معيار القبول
•	أي صفحة تتبدل بين ملاك وسيليا بضغطة واحدة بدون فقدان محتوى، وكل variant في الاتنين يعمل.
•	الثيمين مختلفين بصريًا بوضوح، وكل واحد يقبل أي هوية (ألوان/خطوط) بدون كسر.
المرحلة 8 — العرض العام وSEO والتتبع
الهدف: الصفحة المنشورة تظهر للزوار على الـ subdomain بسرعة عالية وSEO سليم وتتبع جاهز. (الطلبات الحقيقية في المرحلة 9، والدومين الخاص في المرحلة 10).
Back — Public API
1.	GET /public/resolve-host: يبحث في domains بـ active_host. يرجّع status (active/suspended)، primary_host، is_primary، وhome_slug. غير موجود → 404. الـ tenant الموقوف يرجع suspended.
2.	GET /public/pages: يجد الدومين ثم الصفحة (slug فاضي = is_home) بحالة published، ويرجع من published_content فقط (لا مسودة أبدًا):
o	page (id, slug, title, theme_key, published_at)، content.
o	identity (بدون أي حقول داخلية): الألوان والخطوط والـ radius واللوجو والفافيكون والـ OG كـ urls ونصوص SEO الافتراضية والتواصل والسوشيال.
o	product (PublicProductResource): الاسم والوصف والسعر والسعر القديم والصور urls والخيارات النشطة وقيمها. لو غير نشط: product.available=false.
o	offers: العروض الفعّالة الآن + المجدولة القادمة (starts_at, ends_at, status) للمنتج.
o	seo: القيم النهائية المدمجة (override الصفحة ثم افتراضي الهوية ثم اسم المنتج) + canonical + noindex.
o	tracking: الدمج النهائي (override الصفحة فوق الهوية).
o	Cache-Control: no-store من Laravel (الكاش يتم في Next).
3.	GET /public/sitemap و**GET /public/form-token** (الأخير يُنفَّذ كاملًا في المرحلة 9).
4.	تعديل FrontendRevalidator من المرحلة 2 ليرسل tags كل hosts الفعّالة للـ tenant. تفعيل الاستدعاء بعد: نشر/إلغاء نشر، حذف صفحة، تعديل هوية أو منتج أو عرض أو كود، تغيير الدومينات، تغيير ثيم الصفحة، تعديل product_id/identity_id.
5.	اختبارات: صفحة مسودة 404، صفحة منشورة تُرجع المنشور لا المسودة بعد تعديل المسودة، tenant موقوف، host غير معروف، host لدومين pending غير مقبول، غياب المفتاح الداخلي 401، عدم تسريب حقول داخلية، عزل tenant بين نفس الـ slug.
Front — العرض العام
1.	middleware.ts: تفعيل فرع الـ tenant hosts: إعادة كتابة إلى /_sites/{host}{pathname} مع الحفاظ على الـ query. حظر المسارات الإدارية على هذه الـ hosts (404).
2.	app/_sites/[host]/[[...slug]]/page.tsx (Server Component):
o	يستدعي resolveHost(host) (fetch مع revalidate: 60 وtag host:{host}) ويتصرف: غير موجود → صفحة 404 عربية عامة، موقوف → صفحة «هذا المتجر متوقف مؤقتًا»، host غير primary → redirect 301 إلى https://{primary_host}{path}.
o	يجلب الصفحة (نفس إعدادات الكاش). لا صفحة → 404 عربية. slug أكتر من مستوى واحد → 404.
o	يرسم: <IdentityStyle> + الـ sections عبر الـ registry بحسب theme_key + سكريبتات التتبع + JSON-LD.
o	الخطوط: يحمّل CSS الخطين المستخدمين فقط من @fontsource (يُتضمن في الـ build)، بـ font-display: swap وpreload للخط الأساسي.
3.	generateMetadata: title وdescription وcanonical وrobots (noindex حسب الإعداد) وopenGraph (type=website، title، description، images من OG، locale ar_EG) وtwitter (summary_large_image) وicons (favicon من الهوية بمقاسات icon32 وicon180) وthemeColor = colors.primary، ووسوم التحقق (google-site-verification وfacebook-domain-verification) في other.
4.	JSON-LD من نوع Product: name، description (نص مجرد من Markdown)، image[]، offers (price = السعر بعد أفضل عرض فعّال، priceCurrency=EGP، availability، وpriceValidUntil من ends_at للعرض الفعّال). يُحقن بـ JSON.stringify مع استبدال < بـ \u003c.
5.	sitemap.xml و**robots.txt** لكل host (Route Handlers داخل _sites/[host]/): الأول يسرد الصفحات المنشورة مع lastmod (الرئيسية على /)، والثاني Allow: / وسطر Sitemap: بالـ host الأساسي. صفحات noindex تُستثنى من الـ sitemap.
6.	التتبع (lib/tracking/):
o	TrackingScripts (Client): يحقن فقط الـ IDs الصالحة (نفس regex الـ back) عبر next/script بـ afterInteractive: Meta Pixel، TikTok Pixel، GA4 (gtag)، GTM، Snapchat Pixel. كل واحد مرة واحدة، ولا شيء في وضع المعاينة.
o	track(event, payload) يوزّع الحدث على الأدوات المفعّلة حسب الجدول أدناه، ويتجاهل بصمت أي أداة غير محمّلة (مثلًا adblock).
o	أحداث تلقائية: ViewContent عند تحميل الصفحة، وInitiateCheckout عند أول تفاعل مع الفورم (مرة واحدة)، وحدث التحويل (Lead أو Purchase) يُستدعى في المرحلة 9 عند نجاح الطلب مع منع التكرار.
7.	الأداء: revalidate: 60، صورة الـ hero بأولوية، لا مكتبات تقيلة، تقسيم الـ Client islands، وفحص أن JS الصفحة العامة تحت ~120KB gzip (اشرح الرقم الفعلي في تقرير المرحلة). الهدف Lighthouse موبايل 90+ بصفحة بالثيم الافتراضي.
8.	/api/revalidate: يتحقق من X-Revalidate-Secret بـ timing-safe compare، ويستدعي revalidateTag لكل tag في الـ body (حد أقصى 50 tag)، ويرجع عدد ما تم.
9.	الصفحة الرئيسية للمنصة (marketing)/page.tsx على PLATFORM_DOMAIN: صفحة بسيطة بالعربي (عنوان، 3 مميزات، زر «ابدأ مجانًا» إلى https://{APP_HOST}/register، زر دخول) وسطر حقوق.
10.	هيدرات أمان من next.config.ts لكل الصفحات: X-Content-Type-Options: nosniff، Referrer-Policy: strict-origin-when-cross-origin، Permissions-Policy مقيدة. (CSP صارمة غير مناسبة للصفحات العامة بسبب سكريبتات التتبع، فتُترك).
خريطة أحداث التتبع
الحدث	Meta	TikTok	GA4	Snapchat
تحميل الصفحة	PageView	page()	page_view (تلقائي)	PAGE_VIEW
عرض المنتج	ViewContent	ViewContent	view_item	VIEW_CONTENT
أول تفاعل مع الفورم	InitiateCheckout	InitiateCheckout	begin_checkout	START_CHECKOUT
نجاح الطلب (Lead)	Lead	SubmitForm	generate_lead	SIGN_UP
نجاح الطلب (Purchase)	Purchase	PlaceAnOrder	purchase	PURCHASE
الـ payload: content_ids=[product_id]، content_name، content_type=product، value، currency=EGP، num_items. في GTM: dataLayer.push بنفس أسماء أحداث GA4. معرّف المعاملة (transaction_id) = order_number.
الاختبارات
•	Back: كل بنود البند 5 أعلاه.
•	Front: Vitest لدمج الـ SEO، ولـ track() بتوزيع الأحداث (mock للـ window)، ولدالة تحقق الـ IDs، ولتحويل host → primary redirect، ولـ JSON-LD escaping.
•	Smoke script scripts/smoke-public.sh: يشغّل الاتنين محليًا، يسجل حساب، ينشر صفحة، ويعمل curl على http://{sub}.localhost:3000 للتأكد من 200 ومحتوى الـ title (يعتمد على أن *.localhost يشتغل تلقائيًا).
معيار القبول
•	أنشر صفحة من الـ Builder فتظهر على http://{subdomain}.localhost:3000 بالثيم والهوية الصحيحين، وتتحدّث خلال ثواني بعد النشر/التعديل.
•	View Source فيه metadata وJSON-LD وأكواد التتبع الخاصة بالـ IDs اللي حطيتها فقط.
•	host غير معروف يعرض 404 عربية، وtenant موقوف يعرض رسالة الإيقاف.
المرحلة 9 — الطلبات وإدارتها
الهدف: الزائر يطلب من الصفحة (كاش عند الاستلام) بأسعار صحيحة، والبائع يدير الطلبات بالكامل في الداشبورد بحالاتها المختلفة ومنع الزائف.
Back — استقبال الطلب
1.	Migrations + Models: orders، order_items، order_status_logs، blocked_customers، order_counters حسب قسم 5. OrderStatus Enum مع allowedTransitions() وlabel() بالعربي (جديد، مؤكد، تم التسليم، مسترجع، هالك، زائف، ملغي).
2.	GET /public/form-token: يرجّع { token } = HMAC-SHA256 على page_id|timestamp بمفتاح التطبيق، مع الـ timestamp داخل التوكن. يُجلب من المتصفح عند تحميل الفورم (مش من الـ SSR عشان ما يتخزنش في الكاش).
3.	POST /public/quote: يستخدم PriceCalculator من المرحلة 4 على المنتج المربوط بالصفحة (لا يقبل product_id من العميل، فقط الـ slug). rate limit 60/دقيقة/IP.
4.	POST /public/orders: تنفيذ حرفي لـ 7.3 كـ CreateOrder Action. OrderRequest يبني قواعده ديناميكيًا من order_form في published_content:
o	الحقول المدمجة المفعّلة فقط، بصيغة required حسب الإعداد. governorate يجب أن تكون من القائمة الثابتة.
o	الحقول المخصصة: text ≤ 200، textarea ≤ 1000، number رقم، select وradio قيمة ضمن choices، checkbox boolean، date تاريخ صالح. تُحفظ في answers بـ snapshot {key,label,type,value}.
o	حقول غير معرّفة تُتجاهل (لا تُحفظ).
o	أطوال: الاسم 2–80، العنوان ≤ 300، الملاحظات ≤ 500.
5.	Rate limits وhoneypot وform_token وblocked (بالرد العام rejected) حسب 7.3.
6.	ChangeOrderStatus Action: ينفذ جدول الانتقالات وتأثيراتها (release redemption، block phone/ip، سجل الحالة) داخل transaction. bulk-status يطبق نفس المنطق على كل id ويرجع نتيجة لكل واحد (نجح/فشل + السبب) بدل ما يفشل الكل.
7.	Endpoints الداشبورد (قسم 8):
o	GET /orders: فلاتر الحالة والبحث (q على الاسم والموبايل ورقم الطلب) والصفحة والمنتج والتاريخ (بتوقيت القاهرة) والمشتبه بتكراره، والترتيب (الأحدث افتراضيًا)، مع الـ eager loading.
o	GET /orders/stats: عدّاد لكل حالة + new_since (عدد الطلبات الجديدة بعد timestamp مُرسل) لإشعارات الداشبورد.
o	GET /orders/{id}: كل التفاصيل + logs + customer_history (عدد طلبات نفس الموبايل في الحالات المختلفة، وهل الرقم محظور).
o	PATCH /orders/{id}: تعديل بيانات العميل وinternal_note بالشروط في 7.4.
o	GET /orders/export: CSV streamed (UTF-8 + BOM) بأعمدة: رقم الطلب، التاريخ، الحالة، الاسم، الموبايل، المحافظة، المدينة، العنوان، المنتج، الخيارات، الكمية، الإجمالي قبل الخصم، خصم العرض، خصم الكود، الإجمالي، الكود، الملاحظات، الصفحة. حد 10,000 صف لكل تصدير.
o	blocked-customers: CRUD بسيط.
8.	GET /dashboard/overview: يُكمّل أرقام الرئيسية (طلبات اليوم والأسبوع والشهر، عدّاد الحالات، إيراد المسلّم، أعلى 5 صفحات بالطلبات، آخر 5 طلبات).
9.	أمان: ip_address يُقبل فقط من Next (المفتاح الداخلي)، ويُتحقق من صلاحية الصيغة. user_agent يُقص على 500.
Front — الزائر (تفعيل الفورم)
1.	useOrderForm الحقيقي (themes/shared/hooks): يبني الـ state من props.fields/custom_fields وخيارات المنتج، ويولّد zod schema من نفس الإعدادات (مطابق لـ 7.3.5)، ويحمّل form-token عند الـ mount، ويحسب Quote عبر /api/public/quote (debounce 300ms عند تغيير الكمية/الخيارات/الكود)، وحتى وصول الرد يعرض الحساب المحلي التقريبي من lib/price.ts بشكل مؤقت.
2.	الإرسال: submit() يمنع الضغط المزدوج (disabled + idempotency على مستوى الـ client بمفتاح يُولَّد مرة لكل محاولة)، يرسل لـ /api/public/orders، ويعرض الأخطاء على الحقول، وخطأ الكود على حقل الكود، ورسالة عامة عند rejected.
3.	Route Handlers العامة /api/public/quote|orders|form-token: يستنتجون الـ host من الطلب، ويضيفون X-Internal-Key وIP العميل (x-forwarded-for الأول) وuser agent، ويلتقطون UTM من الـ query string المخزن في sessionStorage عند أول زيارة (utm_source|medium|campaign|content|term + document.referrer).
4.	شاشة النجاح: بدل الفورم بعنوان ورسالة العميل ورقم الطلب (#1042) وملخص، وتستدعي track(conversion_event) مرة واحدة (flag في sessionStorage لمنع التكرار عند إعادة تحميل).
5.	دعم وضع المعاينة (بدون إرسال، وبقيم تجريبية).
6.	حالات خاصة: المنتج غير متاح → الفورم معطل برسالة «المنتج غير متاح حاليًا». فشل الشبكة → رسالة وزر إعادة المحاولة مع الحفاظ على المدخلات.
Front — داشبورد الطلبات
1.	/dashboard/orders: تبويبات الحالات (الكل، جديد، مؤكد، تم التسليم، مسترجع، هالك، زائف، ملغي) كل تبويب بعدّاد، شريط فلاتر (بحث، صفحة، منتج، نطاق تاريخ، «مشتبه تكراره»)، جدول (رقم، تاريخ، العميل، الموبايل، المنتج، الإجمالي، الحالة، شارة «مكرر؟»)، اختيار متعدد وإجراءات جماعية (تغيير الحالة)، تصدير CSV، pagination. على الموبايل يتحول الجدول لبطاقات.
2.	/dashboard/orders/[id]: بيانات العميل (مع زر اتصال وزر واتساب wa.me)، العنوان، المنتج والخيارات والكمية، تفصيل الأسعار (الأساسي، العرض، الكود، الإجمالي)، الإجابات المخصصة، الملاحظات، timeline للحالات بالمستخدم والوقت والملاحظة، وصندوق «سجل العميل» (طلباته الأخرى وحالاتها ونسبة الزائف/المرتجع)، وأزرار الانتقالات المسموحة فقط من الحالة الحالية، مع نافذة تطلب ملاحظة اختيارية، وعند «زائف» خيارات «حظر الرقم» و«حظر الـ IP». زر طباعة (CSS للطباعة).
3.	الحظر /dashboard/orders/blocked (أو تبويب فرعي): قائمة الأرقام والـ IPs المحظورة مع إضافة يدوية وحذف.
4.	الإشعارات داخل الداشبورد فقط: polling كل 30 ثانية على orders/stats. لو زاد عدد الجديد: toast «طلب جديد» وعدّاد على أيقونة «الطلبات» في القائمة وعنوان التبويب (3) ...، مع صوت تنبيه اختياري (إعداد في الـ topbar يُحفظ في localStorage، وصوت مولّد بـ Web Audio بدون ملفات خارجية). التوقف عند إخفاء التبويب.
5.	الرئيسية /dashboard: بطاقات الأرقام، رسم بياني بسيط للطلبات آخر 14 يوم (SVG/CSS، بدون مكتبة تقيلة)، آخر الطلبات، وأعلى الصفحات.
الاختبارات
•	Back: كل حالة في 7.3 (نجاح كامل، كل أنواع الرفض، سباق الكود: 5 طلبات متزامنة على كود limit=2 لا يزيد عن 2، أرقام طلب متسلسلة بدون تكرار تحت التزامن، كشف التكرار، حقل مخصص غير معرّف يُتجاهل، حقل غير مفعّل مرفوض)، كل انتقالات الحالات (المسموح والممنوع) وتأثيراتها، الحظر، bulk، الـ export (الأعمدة والترميز)، عزل الـ tenant لكل endpoint.
•	Front: Vitest لتوليد zod من الإعدادات، ومنطق منع الازدواج، واستخراج UTM.
معيار القبول
•	أطلب من صفحة منشورة بخيارات وكمية 2 وكود فتظهر أسعار الـ quote صحيحة، وأرى الطلب في الداشبورد بنفس الأرقام.
•	أغيّر الحالات بالتسلسل (جديد → مؤكد → تم التسليم → مسترجع) ويظهر timeline كامل.
•	أعلّم طلب زائف وأحظر الرقم، فيرفض الطلب التالي من نفس الرقم برسالة عامة، ويتحرر استخدام الكود.
•	طلب جديد من تبويب تاني يطلع toast وعدّاد في الداشبورد خلال 30 ثانية.
المرحلة 10 — الدومين الخاص وSSL
الهدف: العميل يشتري دومين من أي مكان، يضيف سجل DNS واحد، فيشتغل موقعه على دومينه بـ HTTPS تلقائي، بنفس فكرة سلة. كله بدون أي API خارجي: التحقق بـ DNS، والشهادات من Caddy مباشرة.
Back
1.	DomainRules: تطبيع الـ host (lowercase، إزالة http(s):// والمسار والمنفذ والنقطة الأخيرة، idn_to_ascii لدعم الدومينات العربية). رفض: IP، localhost، أي host ينتهي بـ PLATFORM_DOMAIN (بما فيه الدومين نفسه)، أي host فيه أقل من نقطة، أطوال خاطئة (> 253 أو label > 63)، وأي دومين active لدى tenant آخر. حد 10 دومينات خاصة لكل tenant.
2.	تعليمات الربط (تُرجع مع كل دومين في GET /domains):
o	لو الدومين subdomain أو www (مثل shop.example.com): سجل CNAME → cname.{PLATFORM_DOMAIN}.
o	لو apex (مثل example.com): سجل A → SERVER_IP.
o	نص تحذيري ثابت: «لو بتستخدم Cloudflare اجعل السجل DNS only (سحابة رمادية) وليس Proxied».
3.	DomainVerifier (يعتمد على interface DnsResolver عشان يتعمله mock في الاختبارات؛ التنفيذ الحقيقي بـ dns_get_record):
o	ينجح لو: CNAME يشير إلى cname.{PLATFORM_DOMAIN}، أو أي سجل A يساوي SERVER_IP (يغطي CNAME flattening).
o	يسجل last_checked_at وcheck_attempts وlast_check_error (رسالة عربي مفهومة: «لم نجد السجل بعد» / «السجل يشير لعنوان آخر: x.x.x.x»).
4.	POST /domains/custom: يتحقق من القواعد، ينشئ الصف (status=pending، active_host=null)، ويشغّل التحقق فورًا. POST /domains/{id}/verify: إعادة تحقق يدوي (rate limit 10/دقيقة لكل tenant).
5.	عند نجاح التحقق داخل transaction: أعد فحص عدم وجود دومين active بنفس host (قفل)، ثم status=active، active_host=host، verified_at=now، ثم Job WarmSsl وRevalidateTenantHosts.
6.	Scheduler: أمر domains:verify-pending كل 5 دقايق: يفحص الدومينات pending الأحدث من 72 ساعة (بحد أقصى 100 في الدورة)، والأقدم تتحول failed (يقدر العميل يضغط «إعادة التحقق»).
7.	WarmSsl Job: بعد التفعيل يحاول GET https://{host}/api/health (أو /) بـ TLS verification شغّال، 6 محاولات بفاصل 20 ثانية. نجاح → ssl_status=issued. فشل → unknown (قد تكون المشكلة في hairpin NAT داخل السيرفر وليست في الشهادة). هذا الطلب نفسه هو اللي يحرّك إصدار الشهادة عند Caddy.
8.	GET /internal/tls/ask?domain= (routes/internal.php، بلا بادئة، غير معروض من Caddy للخارج، rate limit 60/دقيقة):
o	200 لو الـ domain = PLATFORM_DOMAIN أو APP_HOST أو cname.{PLATFORM_DOMAIN}.
o	200 لو active_host يساوي الـ domain وعلى tenant active.
o	404 غير كده. لا يكتب أي بيانات.
9.	تغيير الـ subdomain PUT /domains/subdomain {label}: قواعد 7.6، فريد، يُحدّث host وactive_host في نفس الـ transaction (الاسم القديم يتحرر فورًا)، ويشغّل revalidate للـ host القديم والجديد.
10.	make-primary: دومين واحد primary لكل tenant (transaction). حذف دومين خاص: مسموح دائمًا، ولو كان هو الـ primary يرجع الـ primary تلقائيًا للـ subdomain.
11.	التحويل للـ primary: resolve-host يرجع is_primary=false لأي host غير primary، فـ Next يعمل 301 للـ primary (كما في المرحلة 8).
12.	اختبارات: تطبيع الـ host (عربي وحروف كبيرة ومسار)، الرفض (IP، دومين المنصة، دومين active عند غيره)، verifier بـ mock لكل حالة (CNAME صحيح، A صحيح، A خطأ، لا سجل)، سباق تفعيل نفس الدومين من حسابين (واحد يفوز بس)، ask لكل حالة (platform، active، pending، موقوف tenant، مجهول)، scheduler، تغيير subdomain، make-primary، حذف primary، عزل الـ tenant.
Front — /dashboard/domains
1.	بطاقة الدومين المجاني (subdomain): الرابط الكامل مع نسخ وفتح، وزر «تغيير الاسم» (نافذة بحقل label ومعاينة label.platform.com وفحص توفر فوري debounce).
2.	بطاقة الدومينات الخاصة: زر «ربط دومين» يفتح Wizard من 3 خطوات: (1) إدخال الدومين مع تطبيع فوري وعرض الأخطاء، (2) تعليمات DNS واضحة بجدول جاهز للنسخ (النوع، الاسم، القيمة) حسب نوع الدومين، مع صور/أمثلة نصية لأشهر المزودين (GoDaddy، Namecheap، Hostinger، Cloudflare، دومينات مصرية) كنص بدون صور خارجية، وتحذير Cloudflare، (3) حالة التحقق مع زر «تحقق الآن» وpolling كل 15 ثانية (لحد 5 دقايق) وعرض آخر خطأ ووقت آخر فحص.
3.	قائمة الدومينات: شارات الحالة (قيد التحقق / نشط / فشل) وSSL (قيد الإصدار / مفعّل / غير مؤكد مع زر «فحص SSL»)، زر «جعله الأساسي»، حذف بتأكيد.
4.	تنبيه واضح: «الصفحات على الدومين غير الأساسي بتتحول تلقائيًا للأساسي».
5.	بعد تفعيل دومين تظهر روابط الصفحات في كل مكان (قائمة الصفحات، الـ Builder) بالدومين الأساسي الجديد.
Caddy (يُنفَّذ هنا ويُختبر، التفاصيل في قسم 20)
•	اكتب deploy/Caddyfile النهائي بـ on_demand_tls { ask http://back-web/internal/tls/ask }، وبلوك catch-all https:// مع tls { on_demand }، وservice لـ /media/* من الـ volume، والباقي reverse_proxy front:3000.
•	وثّق في DEPLOY.md خطوات اختبار الدومين الخاص على السيرفر الحقيقي، وخطوات اختبار محلي بديل (ملف hosts ودومين وهمي مع tls internal).
معيار القبول
•	على بيئة اختبار (mock للـ DNS): ربط دومين → pending → نجاح التحقق → active → الصفحات تشتغل عليه، والـ subdomain القديم يحوّل 301 للدومين الجديد.
•	ask يرفض أي دومين غير مسجل (لا يمكن لأحد إجبار Caddy على طلب شهادات عشوائية).
•	على السيرفر الحقيقي (ضمن دليل النشر): دومين حقيقي يتفعّل ويفتح بـ HTTPS.
المرحلة 11 — Super Admin والتشطيب النهائي
الهدف: لوحة سريعة للمالك (أنت)، ثم تقوية الأمان والأداء، وتجهيز كل ملفات النشر والتوثيق بحيث المشروع يقف جاهز للرفع.
أ) Super Admin (سريع ومختصر)
Back
1.	أمر php artisan platform:create-admin تفاعلي (الاسم، الإيميل، الموبايل، الباسورد بدون echo) ينشئ مستخدم super_admin بدون tenant، ويرفض التكرار. يعمل بدون أي خدمة خارجية.
2.	Endpoints قسم 8 (Admin): overview، قائمة العملاء بالبحث والفلتر، تفاصيل العميل، إيقاف (بسبب) وتفعيل، reset password (يولّد باسورد مؤقت قوي 12 حرف يُعرض مرة واحدة ويلغي كل توكنات المستخدم)، قائمة الثيمات وتفعيل/تعطيل (تعطيل ثيم لا يكسر الصفحات الموجودة، فقط يمنع اختياره لصفحات جديدة).
3.	إيقاف عميل: status=suspended، يلغي كل التوكنات، ويشغّل revalidate لكل hosts. كل فعل إداري يُسجَّل في admin_audit_logs (من، ماذا، على من، IP).
4.	حماية: EnsureSuperAdmin على كل المجموعة، واختبارات أن owner عادي يأخذ 403 والمجموعة غير متاحة بدون توكن. الـ Super Admin لا يستطيع استخدام endpoints الـ dashboard (لا tenant).
Front (/admin/* على APP_HOST، نفس تسجيل الدخول، وتحويل تلقائي حسب role)
1.	Layout بسيط بقائمة: نظرة عامة، العملاء، الثيمات.
2.	نظرة عامة: بطاقات (عدد العملاء، النشطين، الصفحات المنشورة، طلبات اليوم والإجمالي).
3.	العملاء: جدول (المتجر، المالك، الموبايل، تاريخ التسجيل، الحالة، عدد الصفحات والطلبات، الـ subdomain) مع بحث وفلتر، وصفحة تفاصيل فيها الدومينات وأزرار إيقاف/تفعيل وreset password (نافذة تعرض الباسورد المؤقت مع زر نسخ وتحذير).
4.	الثيمات: قائمة بـ Switch للتفعيل.
ب) التقوية والأداء
1.	مراجعة Rate limits لكل endpoint عام (قسم 21) مع اختبارات.
2.	مراجعة أمنية شاملة (قائمة قسم 21): grep لكل withoutGlobalScopes وwithoutTenant وتوثيق كل واحد، وفحص كل exists:/unique: العادية (المفروض صفر على جداول العميل)، وفحص كل ما يُحقن في <script> أو dangerouslySetInnerHTML.
3.	الفهارس: شغّل EXPLAIN على أهم الاستعلامات (قائمة الطلبات بالفلاتر، جلب الصفحة العامة، العروض الفعّالة، resolve-host) وأضف الفهارس الناقصة. وثّق النتيجة في DECISIONS.md.
4.	الأخطاء: صفحات error.tsx وnot-found.tsx وglobal-error.tsx عربية في الداشبورد والعرض العام.
5.	Logging: Laravel يكتب لـ stderr بصيغة JSON في production، ولا تُسجّل أي أسرار أو باسوردات أو توكنات.
6.	DemoSeeder للتطوير (محمي بـ APP_ENV != production) وأمر platform:demo لتجهيزه.
7.	تنظيف: حذف أي كود ميت أو placeholders (_fallback يبقى كـ safety net فقط)، وإزالة أي console.log وأي dd().
ج) الاختبارات الشاملة
1.	Back: تشغيل الـ suite كاملة على MySQL، وإضافة اختبار «تدفق كامل» (Feature): تسجيل → هوية → منتج بخيارات → عرض وكود → صفحة → نشر → resolve → quote → طلب → تغيير حالات → تصدير.
2.	E2E بـ Playwright (يُثبَّت في front/e2e): سيناريوهات: (1) تسجيل ودخول وخروج، (2) إنشاء منتج وهوية، (3) بناء صفحة ونشرها، (4) زيارة الصفحة المنشورة على {sub}.localhost وإرسال طلب، (5) ظهور الطلب وتغيير حالته، (6) تبديل الثيم. أمر pnpm e2e يشغّل كل شيء مع قاعدة بيانات اختبار.
3.	اختبار تحميل بسيط (سكريبت k6 أو autocannon اختياري): 50 زائر متزامن على صفحة عامة و10 طلبات/ثانية على orders للتأكد من عدم وجود أخطاء أو تكرار أرقام طلبات.
د) التوثيق والتسليم
•	README.md (تشغيل محلي بخطوات واضحة)، deploy/DEPLOY.md (قسم 20)، PROGRESS.md نهائي، DECISIONS.md كامل، docs/ARCHITECTURE.md (ملخص قصير للـ tenancy والـ BFF والثيمات وإضافة ثيم/كومبوننت).
•	نفّذ القائمة النهائية في قسم 22 وسجّل كل بند بنتيجته في PROGRESS.md.
معيار القبول
•	platform:create-admin ثم دخول /admin، وإيقاف عميل يوقف موقعه وداشبورده فورًا.
•	كل الاختبارات (Back + Front + E2E) خضراء، والبناء (next build وصور Docker) ينجح.
•	أي شخص يتبع DEPLOY.md على سيرفر جديد يوصل لموقع شغال بدون أي تدخل في الكود.
20) النشر على VPS (Docker + Caddy)
المطلوب: يقف كل شيء جاهز بحيث المستخدم يشتري VPS ودومين، يضيف سجلات DNS، يملأ .env، ويشغّل أمر واحد. ملفات النشر تُكتب وتُراجع في المرحلة 11 (والـ Caddyfile يبدأ في المرحلة 10).
الخدمات في docker-compose.yml
الخدمة	الصورة / البناء	الوظيفة
caddy	caddy:2	يستقبل 80 و443، شهادات تلقائية، يخدم /media/*، ويمرر الباقي لـ Next
front	build ./front (Next standalone)	الداشبورد والعرض العام والـ BFF. منفذ داخلي 3000
back-web	nginx	يستقبل طلبات Next وCaddy ask ويمررها لـ php-fpm. منفذ داخلي 80
back-app	build ./back (php-fpm 8.3)	تطبيق Laravel
queue	نفس صورة back	php artisan queue:work redis --tries=3 --max-time=3600
scheduler	نفس صورة back	php artisan schedule:work
mysql	mysql:8	البيانات (volume mysql_data)
redis	redis:7-alpine	كاش وطوابير وrate limit (volume redis_data)
Volumes: mysql_data، redis_data، caddy_data (الشهادات، لا يُحذف)، caddy_config، media (يُركّب على back-app وqueue كـ storage/app/public وعلى caddy للقراءة فقط في /srv/media).
قواعد: لا منفذ لـ mysql وredis وback خارج شبكة Docker. فقط 80 و443 على caddy. restart: unless-stopped للكل. healthcheck لكل خدمة (mysql: mysqladmin ping، redis: redis-cli ping، back: GET /health، front: GET /api/health). logging: json-file بحد max-size: 10m وmax-file: 3. depends_on بشرط service_healthy.
deploy/Caddyfile (هيكل مبدئي يُراجع ويُختبر)
{
	email {$ACME_EMAIL}
	# للتجارب: acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
	on_demand_tls {
		ask http://back-web/internal/tls/ask
	}
}

http:// {
	redir https://{host}{uri} permanent
}

https:// {
	tls {
		on_demand
	}
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		-Server
	}
	handle /media/* {
		uri strip_prefix /media
		root * /srv/media
		file_server
		header Cache-Control "public, max-age=2592000, immutable"
	}
	handle {
		reverse_proxy front:3000
	}
}
ملاحظات: Caddy يحافظ على Host الأصلي ويضيف X-Forwarded-For تلقائيًا (Next يعتمد عليهم). /internal/* غير مُمرَّر لأي حاجة خارجية. اختبر أن redirect الـ http لا يكسر تحدي ACME (HTTP-01) وعدّل الـ Caddyfile لو لزم.
Dockerfile الـ back
•	Multi-stage: مرحلة composer install --no-dev --optimize-autoloader، ثم php:8.3-fpm-alpine.
•	الإضافات: pdo_mysql، gd (مع webp وjpeg وpng)، bcmath، intl (لازم لـ idn_to_ascii)، opcache، pcntl، redis (pecl).
•	مستخدم غير root، opcache مفعّل (validate_timestamps=0)، php.ini فيه upload_max_filesize=12M وpost_max_size=60M (رفع حتى 10 صور).
•	nginx: client_max_body_size 60m، وتمرير /index.php فقط.
Dockerfile الـ front
•	Multi-stage: pnpm install --frozen-lockfile، next build بـ output: 'standalone'، ثم صورة node:22-alpine تشغّل node server.js بمستخدم غير root.
•	كل الإعدادات (PLATFORM_DOMAIN، APP_HOST، LARAVEL_INTERNAL_URL، المفاتيح) تُقرأ وقت التشغيل من env، ممنوع وضعها وقت الـ build أو في NEXT_PUBLIC_*.
متغيرات البيئة (.env.example في الجذر)
PLATFORM_DOMAIN=platform.com           # دومين المنصة
APP_HOST=app.platform.com              # الداشبورد
SERVER_IP=0.0.0.0                      # IP السيرفر (لتعليمات A record)
ACME_EMAIL=you@example.com             # اختياري: تنبيهات انتهاء الشهادات فقط
APP_KEY=                               # php artisan key:generate --show
DB_DATABASE=landing
DB_USERNAME=landing
DB_PASSWORD=change-me
DB_ROOT_PASSWORD=change-me-too
INTERNAL_API_KEY=                      # openssl rand -hex 32  (Next ↔ Laravel)
REVALIDATE_SECRET=                     # openssl rand -hex 32  (Laravel → Next)
المتغيرات الداخلية الثابتة تُكتب في compose: APP_ENV=production، APP_DEBUG=false، DB_HOST=mysql، REDIS_HOST=redis، FRONT_INTERNAL_URL=http://front:3000، LARAVEL_INTERNAL_URL=http://back-web، CNAME_TARGET=cname.${PLATFORM_DOMAIN}.
سكريبتات deploy/
•	deploy.sh (set -euo pipefail): يتحقق من وجود .env والمتغيرات المطلوبة غير فاضية، docker compose build، up -d، ينتظر mysql healthy، php artisan migrate --force، db:seed --class=ThemeSeeder --force، config:cache وroute:cache وevent:cache، queue:restart، ثم فحص الصحة وطباعة ملخص (الـ URLs وحالة الخدمات). آمن للتشغيل المتكرر (للتحديثات).
•	backup.sh: mysqldump --single-transaction مضغوط + أرشيف volume الميديا إلى /var/backups/landing/، مع حذف أقدم من 14 يوم. سطر cron جاهز في DEPLOY.md (يوميًا 3 فجرًا).
•	restore.sh <db.sql.gz> <media.tar.gz>: استرجاع بتأكيد صريح.
سجلات DNS المطلوبة من المستخدم (مرة واحدة)
النوع	الاسم	القيمة
A	@	IP السيرفر
A	* (wildcard)	IP السيرفر
الـ wildcard يغطي app وcname وكل subdomains العملاء. لو مزود الـ DNS لا يدعم wildcard، يُضاف app وcname يدويًا، وكل subdomain عميل جديد يحتاج سجل (غير عملي، فيُنصح بمزود يدعم wildcard).
ملف deploy/DEPLOY.md (بالعربي، خطوة بخطوة)
1.	المتطلبات: Ubuntu 22.04 أو 24.04، 2 vCPU و4GB RAM و40GB SSD كحد أدنى، ودومين.
2.	تجهيز السيرفر: تثبيت Docker + Compose، ufw allow 22,80,443/tcp، تعطيل الدخول بالباسورد لـ SSH (اختياري ويُنصح به).
3.	DNS: السجلين أعلاه، والتحقق بـ dig.
4.	رفع الكود (git clone أو scp)، نسخ .env.example إلى .env وملئه وتوليد المفاتيح.
5.	./deploy/deploy.sh.
6.	إنشاء الـ Super Admin: docker compose exec back-app php artisan platform:create-admin.
7.	فحص نهائي: فتح https://{APP_HOST}، تسجيل حساب تجريبي، إنشاء صفحة ونشرها، فتحها على الـ subdomain.
8.	ربط دومين خاص تجريبي (مع شرح DNS).
9.	التحديث: git pull && ./deploy/deploy.sh. الرجوع: git checkout <tag> && ./deploy/deploy.sh (مع تحذير من migrations غير القابلة للرجوع).
10.	النسخ الاحتياطي والاسترجاع، والمراقبة (docker compose ps، logs -f --tail=100 <service>، مساحة الـ volumes).
11.	حل المشاكل الشائعة: الشهادة لا تصدر (DNS، المنفذ 80 مقفول، ask يرجع 404)، 502 من Caddy (الخدمة لم تصحّ بعد)، الصور 404 (volume الميديا)، الطابور واقف (queue logs)، المساحة ممتلئة.
حدود Let's Encrypt (للعلم)
حوالي 50 شهادة جديدة أسبوعيًا لنفس الدومين المسجّل (platform.com). لو أكتر من 50 عميل جديد اتسجلوا في أسبوع واحد، شهادات الـ subdomains الجديدة تتأخر لحد الأسبوع التالي. الحل لاحقًا: wildcard certificate بتحدي DNS-01 (يحتاج API من مزود الـ DNS)، وده مؤجل لحد الحاجة. دومينات العملاء الخاصة غير متأثرة. للتجارب استخدم بيئة staging الخاصة بـ Let's Encrypt (السطر المعلّق في الـ Caddyfile).
21) الأمان والأداء والاختبارات
قسم مرجعي يُطبَّق على كل المراحل ويُراجَع كاملًا في المرحلة 11.
الأمان
المجال	القاعدة
عزل العملاء	Global Scope fail-closed، TenantExists/TenantUnique، اختبارات عزل لكل resource، 404 بدل 403 عند id من tenant آخر
المصادقة	Sanctum tokens بصلاحية 30 يوم، باسوردات Bcrypt (12 rounds) بحد أدنى 8 حروف، الخروج يلغي التوكن، reset من الـ Super Admin يلغي كل التوكنات
الكوكي	lp_token: httpOnly + Secure + SameSite=Lax، على APP_HOST فقط. لا يُقرأ من JS
CSRF	فحص Origin لكل طلب غير GET في الـ BFF والـ Route Handlers العامة
الشبكة	Laravel وMySQL وRedis غير مكشوفين. المسار /internal/* وLaravel كله لا يمر من Caddy
الأسرار	INTERNAL_API_KEY وREVALIDATE_SECRET بـ hash_equals/timing-safe. لا أسرار في الـ build ولا في الـ logs
الرفع	فحص finfo وإعادة ترميز، لا svg ولا gif، أسماء عشوائية، حجم ≤ 5MB، لا تنفيذ داخل storage (nginx لا يمرر php من هناك)
XSS	React يهرّب النصوص. لا dangerouslySetInnerHTML إلا JSON-LD بعد JSON.stringify مع استبدال <. الـ Markdown بدون HTML خام. الـ _url تمر على SafeUrl. IDs التتبع بـ regex صارم
الحقن	Eloquent/bindings فقط، ولا DB::raw بمدخلات مستخدم
Mass assignment	$fillable صريح، ولا $guarded = []
الطلبات الآلية (bots)	Rate limits (جدول أدناه)، honeypot وform_token على الطلبات، حظر أرقام وIPs
إظهار الأخطاء	APP_DEBUG=false، رسائل عامة للمستخدم، التفاصيل في الـ logs فقط
الـ Headers	HSTS من Caddy، nosniff، Referrer-Policy، Permissions-Policy
الـ Dependencies	فحص الـ dependencies: composer audit وpnpm audit في المرحلة 11، وإصلاح الثغرات العالية
Rate limits (Redis)
الـ Endpoint	الحد
POST /auth/register	5 / ساعة / IP
POST /auth/login	5 / دقيقة / (IP + login)
POST /public/orders	5 / 10 دقايق / IP و3 / 10 دقايق / رقم موبايل
POST /public/quote	60 / دقيقة / IP
GET /public/form-token	30 / دقيقة / IP
POST /domains/{id}/verify	10 / دقيقة / tenant
GET /internal/tls/ask	60 / دقيقة
رفع الميديا	30 طلب / دقيقة / tenant
باقي /dashboard/*	300 / دقيقة / مستخدم
الأداء
•	العرض العام: ISR بـ revalidate: 60 + إبطال بالـ tags، HTML جاهز، Client islands صغيرة، صور WebP بـ srcset، خطوط محلية بـ font-display: swap، لا مكتبات slider/animation. هدف Lighthouse موبايل 90+ وLCP أقل من 2.5 ثانية على 4G.
•	الـ back: eager loading دائمًا، pagination في كل قائمة، فهارس حسب قسم 5، opcache في الإنتاج، config:cache وroute:cache، وكاش Redis لـ resolve-host لمدة 60 ثانية (يُمسح عند تغيير الدومينات).
•	الميديا: Cache-Control: immutable لمدة 30 يوم (الأسماء فريدة فلا مشكلة في الكاش).
•	الداشبورد: TanStack Query بـ staleTime مناسب، تحميل كسول للـ Builder (dynamic import) ولمكتبة dnd-kit.
الاختبارات (ملخص التغطية المطلوبة)
الطبقة	الأداة	ماذا يُختبر
Back Unit	Pest	PriceCalculator، PhoneNormalizer، SubdomainGenerator، PageContentSanitizer، DomainRules، TenantScope
Back Feature	Pest + MySQL	كل endpoint: نجاح، validation، 401، عزل tenant، وسباقات التزامن (كود، رقم طلب، تفعيل دومين)
Front Unit	Vitest	الـ reducers والـ store، useOrderForm schemas، track()، التواريخ، الأسعار، SEO merge، الـ registry
Front Component	Testing Library	كل component × variant بـ props كاملة وفاضية
E2E	Playwright	السيناريوهات الستة في المرحلة 11
Smoke	bash/curl	scripts/smoke-public.sh وdeploy.sh health check
قاعدة: أي bug يتصلح يتضاف له اختبار يمنع رجوعه.
22) القائمة النهائية قبل التسليم والأشياء المؤجلة
Claude Code ينفّذ القائمة دي في آخر المرحلة 11 ويكتب نتيجة كل بند في PROGRESS.md. أي بند فاشل يُصلح قبل التسليم.
قائمة التسليم
الوظائف
•	☐ تسجيل حساب جديد → subdomain عشوائي فعّال + هوية افتراضية.
•	☐ رفع صور، إنشاء هويتين، منتج بخيارات، عرض، كود خصم.
•	☐ بناء صفحة بالثيمين وتبديل بينهم بدون فقدان محتوى، ونشرها.
•	☐ الصفحة المنشورة تعمل على الـ subdomain بـ SEO وJSON-LD وأكواد التتبع الصحيحة فقط.
•	☐ طلب من الصفحة بخيارات وكمية وكود، والأرقام مطابقة في الداشبورد.
•	☐ كل حالات الطلب وانتقالاتها، الحظر، الإفراج عن الكود، التصدير، الإشعار داخل الداشبورد.
•	☐ ربط دومين خاص (على بيئة اختبار بـ mock أو دومين حقيقي) والتحويل للـ primary.
•	☐ Super Admin: إنشاء، إيقاف/تفعيل عميل، reset password، تفعيل/تعطيل ثيم.
الجودة والأمان
•	☐ كل اختبارات Back وFront وE2E خضراء، وكل أوامر lint وtypecheck وbuild خضراء.
•	☐ اختبارات عزل الـ tenant تغطي كل resource.
•	☐ لا exists:/unique: عادية على جداول العميل، وكل withoutTenant موثق.
•	☐ لا TODO ولا mock ولا console.log ولا dd() في الكود.
•	☐ composer audit وpnpm audit بدون ثغرات عالية.
•	☐ لا أسرار في المستودع، و.env.example كامل.
•	☐ Lighthouse موبايل على صفحة عامة بالثيمين 90+ (سجّل الأرقام).
النشر
•	☐ docker compose build ينجح لكل الصور.
•	☐ deploy.sh يشتغل من الصفر على بيئة نظيفة (جرّبه محليًا بـ PLATFORM_DOMAIN=localhost على الأقل).
•	☐ backup.sh وrestore.sh متجربين.
•	☐ DEPLOY.md يغطي كل خطوة بدون افتراضات خفية.
مؤجل للإصدارات القادمة (لا يُبنى الآن، لكن البنية لا تمنعه)
•	الباقات والاشتراكات والحدود المرتبطة بها، والدفع الأونلاين.
•	الموظفين والصلاحيات (الجداول جاهزة: users.tenant_id وrole).
•	الإنجليزية (الـ messages مفصولة).
•	Conversions API من السيرفر وإشعارات واتساب/إيميل/SMS للطلبات.
•	خيارات لكل وحدة داخل الطلب (مقاس مختلف لكل قطعة). حاليًا الخيارات واحدة للطلب كله، والعميل يكتب التفاصيل في الملاحظات.
•	مخزون، أكتر من منتج في الصفحة، شحن.
•	Wildcard SSL (عند تجاوز 50 عميل جديد أسبوعيًا).
•	سجل نسخ الصفحة (revisions) والتراجع عن النشر.
•	سكريبتات مخصصة داخل الصفحة، ثيمات وكومبوننتس إضافية (الإضافة سهلة بحسب قسم 6).
•	استرجاع الباسورد الذاتي (يحتاج إيميل أو SMS).
قرارات اتخذتها بدلًا منك (غيّرها لو مش مناسبة قبل ما تبدأ)
1.	حدث التحويل الافتراضي في التتبع هو Lead، وقابل للتغيير إلى Purchase من الهوية.
2.	لا استرجاع باسورد ولا تأكيد إيميل لأن ده يحتاج إرسال إيميلات (خدمة خارجية).
3.	المحافظات: قائمة ثابتة بالـ 27 محافظة المصرية بدون مدن ثابتة (المدينة حقل نصي).
4.	الموبايل: أرقام الموبايل المصرية فقط في الإصدار ده.
5.	الصفحة الرئيسية للعميل (/) بتتحدد يدويًا، ولو مفيش صفحة رئيسية يعرض / 404.
6.	المنتج بخيارات للطلب كله، ومقاسات مختلفة لكل قطعة مؤجلة (الملاحظات تغطيها).
7.	الـ bundle (اشترِ 2 بـ X) مدعوم كنوع عرض لأنه الأكثر استخدامًا في صفحات الكاش عند الاستلام.

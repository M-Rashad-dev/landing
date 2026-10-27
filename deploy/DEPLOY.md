# دليل النشر

> ⚠️ ملفات النشر (Docker / Caddy) مكتوبة بدون تجربة فعلية على سيرفر، لأن بيئة التطوير مفيهاش Docker. جرّبها على سيرفر اختبار الأول.

## الدومين الخاص وSSL

### إزاي بيشتغل
1. العميل يضيف دومينه من «النطاقات» في الداشبورد، فيظهر له سجل DNS واحد:
   - دومين رئيسي (`example.com`) → سجل **A** باسم `@` يشير لـ `SERVER_IP`.
   - دومين فرعي (`shop.example.com` أو `www.example.com`) → سجل **CNAME** يشير لـ `cname.{PLATFORM_DOMAIN}`.
2. Laravel يفحص الـ DNS فورًا، وبعدها كل 5 دقايق لمدة 72 ساعة (`domains:verify-pending` في خدمة `scheduler`).
3. أول ما السجل يظهر يتفعّل الدومين، وLaravel يطلب `https://{domain}/api/health`. الطلب ده نفسه بيخلّي Caddy يصدر الشهادة من Let's Encrypt (on-demand TLS).
4. قبل إصدار أي شهادة، Caddy يسأل `http://back-web/internal/tls/ask?domain=...`، وLaravel يرد 200 فقط لدومينات المنصة وللدومينات النشطة لعملاء نشطين. أي دومين تاني ياخد 404، فمحدش يقدر يجبر Caddy يطلب شهادات لأسماء عشوائية.

### اختبار على السيرفر الحقيقي
1. تأكد إن `PLATFORM_DOMAIN` و`SERVER_IP` مضبوطين في `.env`، وإن سجل `*` (wildcard) بيشير للسيرفر (فيغطي `cname.{PLATFORM_DOMAIN}`).
2. تأكد إن `ask` شغال من داخل الشبكة:
   ```bash
   docker compose exec caddy wget -qO- -S "http://back-web/internal/tls/ask?domain=$PLATFORM_DOMAIN" 2>&1 | grep HTTP   # 200
   docker compose exec caddy wget -qO- -S "http://back-web/internal/tls/ask?domain=random.example" 2>&1 | grep HTTP  # 404
   ```
3. من حساب تجريبي: «النطاقات» ← «ربط دومين» ← اكتب دومين تملكه، وأضف السجل اللي ظاهر عند مزود الدومين.
4. تابع الفحص: `dig +short shop.example.com` لازم يرجع `cname.{PLATFORM_DOMAIN}.` أو `SERVER_IP`. لما يظهر اضغط «تحقق الآن» أو استنى الفحص التلقائي.
5. افتح `https://shop.example.com`. أول طلب ممكن ياخد ثواني لحد ما الشهادة تتصدر. للمتابعة: `docker compose logs -f caddy | grep -i -E "certificate|obtain"`.
6. اضغط «جعله الأساسي»، وافتح الدومين المجاني القديم: لازم يحوّل (308) للدومين الجديد.
7. لو حالة SSL «غير مؤكد» والموقع بيفتح بـ https عندك، غالبًا السيرفر مش قادر يوصل لنفسه بالـ IP العام (hairpin NAT)، والشهادة سليمة. «فحص SSL» يعيد المحاولة.

> للتجارب الكتير فعّل `acme_ca` الخاص بـ staging في `deploy/Caddyfile`، لأن Let's Encrypt عنده حدود لعدد الشهادات في الأسبوع.

### اختبار محلي بديل (بدون دومين حقيقي)
- **بدون Docker (اللي اتعمل في التطوير):** `scripts/smoke-domains.sh` بيستخدم `*.localtest.me`. ده دومين عام كل أسماءه بتشير لـ `127.0.0.1` في الـ DNS الحقيقي، و`SERVER_IP` محليًا `127.0.0.1`، فالتحقق بيعدّي بفحص DNS حقيقي من غير أي mock. السكريبت بيربط دومين، ويتأكد إنه اتفعّل وإن الصفحة بتفتح عليه، ويخليه أساسي، ويتأكد إن الدومين المجاني بيحوّل له، ويجرب سباق حسابين على نفس الدومين، وحالات `tls/ask`.
- **بـ Docker + HTTPS محليًا:** ضيف في ملف hosts (`/etc/hosts` أو `C:\Windows\System32\drivers\etc\hosts`):
  ```
  127.0.0.1 platform.test app.platform.test cname.platform.test shop.platform.test mybrand.test
  ```
  واعمل `PLATFORM_DOMAIN=platform.test` و`SERVER_IP=127.0.0.1`، وفي `deploy/Caddyfile` بدّل `on_demand` بـ `internal` داخل بلوك `tls` (شهادات من CA محلي بدل Let's Encrypt). المتصفح هيحذّرك من الشهادة إلا لو وثقت في CA بتاع Caddy (`docker compose exec caddy caddy trust`). الدومين `mybrand.test` مش هيعدّي فحص DNS الحقيقي، فعشان تجرب الربط استخدم `shop.localtest.me` أو فعّل الدومين يدويًا من `php artisan tinker` على بيئة الاختبار.

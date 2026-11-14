# دليل المشروع والرفع على VPS

الملف ده فيه كل اللي محتاجه عشان تفهم المشروع وترفعه على سيرفر من الصفر:
- **الجزء الأول:** المشروع مبني بإيه وبيشتغل إزاي.
- **الجزء التاني:** الرفع خطوة بخطوة.
- **الجزء التالت:** التشغيل اليومي، والتحديث، والنسخ الاحتياطي، وحل المشاكل.

> ⚠️ ملفات الـ Docker عمرها ما اتشغّلت على جهاز التطوير (مفيهوش Docker)، فأول رفعة هي أول تجربة ليها. لو حصل أي خطأ في خطوة، خُد الرسالة كاملة من `docker compose logs <الخدمة>` وابعتهالي.

---

# الجزء الأول: المشروع

## إيه هو
منصة SaaS متعددة المستأجرين (multi-tenant)، وكل تاجر بياخد:
- **متجر كامل** زي سلة وزد: منتجات، وتصنيفات، وسلة، وطلبات، وعملاء، وشحن، وكوبونات، وعروض، وتقييمات.
- **صفحات هبوط (Landing pages)**: بيبنيها بمحرر سحب وإفلات، ومعاها اختبارات A/B، وعروض بعد الطلب، وبيكسلات.
- **دومين مجاني** `{اسمه}.platform.com`، أو دومينه الخاص بشهادة SSL تلقائية.
- **شات دعم** لحظي مع إدارة المنصة.

وانت كـ Super Admin عندك لوحة `/admin`:
- المتاجر، والباقات والاشتراكات، والمدفوعات.
- الثيمات، وصفحات المنصة (عن المنصة، والشروط، والخصوصية...).
- الدعم، والإعدادات.

## التكنولوجي
| الجزء | المستخدم |
|---|---|
| **الباك إند** `back/` | Laravel 13 على PHP 8.3، API بس (مفيش واجهات). |
| | Laravel Sanctum (توكنات الدخول). |
| | Laravel Reverb: سيرفر WebSocket بتاعنا لشات الدعم، من غير أي خدمة خارجية. |
| | Pest للاختبارات وPint لتنسيق الكود. |
| **الفرونت** `front/` | Next.js 16 (App Router) وReact 19 وTypeScript (strict). |
| | Tailwind CSS 4 وRadix UI. |
| | TanStack Query وreact-hook-form وzod. |
| | Recharts للرسوم، وdnd-kit للسحب والإفلات، وlaravel-echo مع pusher-js للاتصال بـ Reverb. |
| | Vitest للاختبارات. |
| **قاعدة البيانات** | MySQL 8. |
| **الكاش والطابور** | Redis 7 (كاش + Queue). |
| **السيرفر** | Docker Compose. |
| | Caddy: HTTPS تلقائي من Let's Encrypt، بما فيه دومينات التجار الخاصة (on-demand TLS). |
| | nginx + php-fpm لـ Laravel. |

## الصورة الكبيرة (مين بيكلم مين)
```
المتصفح ──HTTPS──▶ Caddy (80/443 بس)
                     ├── /media/*      ← الصور مباشرة من volume (من غير PHP)
                     ├── /app/* على app.  ← Reverb (WebSocket للشات)
                     └── أي حاجة تانية ← Next (front:3000)
                                            │  (BFF: المتصفح عمره ما بيكلم Laravel مباشرة)
                                            ▼
                                       nginx (back-web) ← php-fpm (back-app)
                                            │
                                     MySQL + Redis
queue      ← بينفّذ الشغل في الخلفية (استيراد المنتجات، الصور، الإيميلات، تحديث الصفحات)
scheduler  ← المهام الدورية (الاشتراكات، فحص الدومينات، قفل محادثات الدعم بعد 12 ساعة...)
reverb     ← WebSocket لشات الدعم
```

**إزاي Next بيعرف هيعرض إيه** (`front/src/proxy.ts`):
- لو الطلب على `PLATFORM_DOMAIN` (مثلًا `platform.com`): بيعرض صفحة المنصة التسويقية وصفحاتها.
- لو على `APP_HOST` (مثلًا `app.platform.com`): الداشبورد، و`/admin`، والدخول والتسجيل.
- لو على أي دومين تاني (دومين مجاني أو خاص): ده متجر تاجر أو صفحته.

**قواعد أساسية في الكود** (تفاصيلها في `CLAUDE.md` و`DECISIONS.md`):
- كل جدول خاص بتاجر فيه `tenant_id`، ومتفلتر تلقائيًا. تاجر عمره ما يشوف بيانات تاجر تاني.
- الفلوس متخزنة `decimal(12,2)` في قاعدة البيانات، وبتتحسب بالقروش في الكود.
- المتصفح عمره ما بيكلم Laravel مباشرة. Next بيوصّل الطلبات (BFF)، والتوكن في cookie من نوع httpOnly.

## الخدمات (containers)
| الخدمة | الدور |
|---|---|
| `caddy` | البوابة الوحيدة المفتوحة للنت، والشهادات |
| `front` | Next.js |
| `back-web` | nginx قدام Laravel (داخلي) |
| `back-app` | Laravel (php-fpm) |
| `queue` | شغل الخلفية |
| `scheduler` | المهام الدورية |
| `reverb` | WebSocket لشات الدعم |
| `mysql` / `redis` | البيانات |

**الـ volumes** (البيانات اللي بتعيش بعد أي تحديث):
| الـ volume | فيه إيه |
|---|---|
| `mysql_data` | قاعدة البيانات |
| `redis_data` | Redis |
| `media` | الصور العامة |
| `private` | إيصالات الدفع، وملفات شات الدعم، وملفات الاستيراد المؤقتة |
| `caddy_data` | الشهادات |

---

# الجزء التاني: الرفع خطوة بخطوة

## 1) المتطلبات
- **السيرفر:** Ubuntu 22.04 أو 24.04.
- **الحجم:** **4GB RAM على الأقل** + 2 vCPU + 40GB SSD. بناء Next محتاج ذاكرة، وبـ 2GB هيفشل.
- **الدومين:** دومين للمنصة (مثال `platform.com`) عند مزود DNS بيدعم سجلات wildcard (Cloudflare، Namecheap...).
  - لو على Cloudflare: خلّي السجلات **DNS only** (السحابة رمادي) مش Proxied، عشان Caddy يطلع الشهادات بنفسه.

## 2) تجهيز السيرفر (مرة واحدة)
```bash
# تحديث + Docker و Compose v2
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # اخرج من SSH وادخل تاني

# Swap ‏2GB (أمان وقت بناء الصور)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# الجدار الناري: SSH وHTTP وHTTPS بس
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```
- **مستحسن:** ادخل SSH بالمفاتيح بس. في `/etc/ssh/sshd_config` خلّي `PasswordAuthentication no`، وبعدها `sudo systemctl restart ssh`.
- **مهم:** لو مزود الـ VPS عنده جدار ناري في لوحة التحكم، افتح فيه 80 و443 كمان.

## 3) DNS (مرة واحدة)
| النوع | الاسم | القيمة |
|---|---|---|
| A | `@` | IP السيرفر |
| A | `*` | IP السيرفر |

سجل الـ `*` بيغطي `app.` و`cname.` وكل الدومينات المجانية للتجار. اتأكد قبل ما تكمل (الأوامر التلاتة لازم يرجّعوا IP السيرفر):
```bash
dig +short platform.com
dig +short app.platform.com
dig +short anything.platform.com
```

## 4) رفع الكود وملء `.env`
```bash
sudo mkdir -p /opt/landing && sudo chown $USER /opt/landing
git clone <رابط المستودع> /opt/landing
cd /opt/landing
git checkout v4            # أو الفرع اللي فيه آخر شغل
cp .env.example .env
nano .env
```

**املأ القيم دي:**
| المتغير | القيمة |
|---|---|
| `PLATFORM_DOMAIN` | دومين المنصة، مثال `platform.com` |
| `APP_HOST` | دومين الداشبورد، مثال `app.platform.com` |
| `SERVER_IP` | IP السيرفر العام (بيظهر للتجار في تعليمات ربط الدومين) |
| `ACME_EMAIL` | إيميلك (تنبيهات الشهادات بس) |
| `APP_KEY` | ناتج `echo "base64:$(openssl rand -base64 32)"` |
| `DB_PASSWORD` و`DB_ROOT_PASSWORD` | باسوردات قوية ومختلفة |
| `INTERNAL_API_KEY` و`REVALIDATE_SECRET` | كل واحد ناتج `openssl rand -hex 32` (قيمتين مختلفتين) |
| `REVERB_APP_ID` | أي رقم، مثال `482913` |
| `REVERB_APP_KEY` | ناتج `openssl rand -hex 10` |
| `REVERB_APP_SECRET` | ناتج `openssl rand -hex 32` |
| `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` | حساب الأدمن بتاعك، ومكتوب جاهز: `m.rashad.dev@gmail.com` / `12345678` |
| `PLATFORM_ADMIN_PHONE` | **رقم موبايلك المصري** (مطلوب، ولازم ميكونش مستخدم في متجر) |
| `MAIL_*` | اختياري. سيبه `log` لحد ما يبقى عندك SMTP؛ ساعتها الإيميلات (زي تنبيهات الأدمن) بتتسجل في اللوج بس ومش بتتبعت |

**ملاحظات:**
- لو في قيمة فيها مسافة، حطها بين علامتي تنصيص، زي `PLATFORM_ADMIN_NAME="Mohamed Rashad"`.
- `.env` فيه أسرار: اعمل `chmod 600 .env`، ومتحطوش في git أبدًا.

## 5) التشغيل
```bash
./deploy/deploy.sh
```
**السكريبت بيعمل بالترتيب:**
1. يتأكد إن كل القيم المطلوبة في `.env` مليانة وسليمة.
2. يبني الصور. أول مرة بتاخد من 5 لـ 15 دقيقة.
3. يشغّل MySQL وRedis ويستنى لحد ما يبقوا جاهزين.
4. يشغّل Laravel ويعمل `migrate`. السيرفر الجديد بتبدأ قاعدة بياناته فاضية تمامًا، زي `migrate:fresh` بالظبط.
5. يضيف **البيانات الأساسية بس**:
   - الثيمات والباقات (المنصة محتاجاهم عشان التسجيل يشتغل).
   - وسائل الدفع، وتبدأ مقفولة لحد ما تفعّلها من الأدمن.
   - صفحات المنصة.
   - **حساب الأدمن بتاعك.**
6. يشغّل باقي الخدمات ويفحص صحتها، وفي الآخر يطبع الروابط.

مفيش أي بيانات تجريبية: لا متاجر، ولا منتجات، ولا طلبات.

**تشغيل السكريبت تاني آمن:**
- الـ seeders بتضيف الناقص بس، ومش بتلمس أي حاجة عدّلتها من الأدمن.
- حساب الأدمن مش بيتغيّر لو كان موجود، فلو غيرت الباسورد هيفضل متغير.

## 6) أول دخول
1. افتح `https://app.platform.com/login`. أول طلب على أي دومين ممكن ياخد ثواني لحد ما الشهادة تطلع.
2. ادخل بـ `m.rashad.dev@gmail.com` / `12345678`، وهتتحول لـ `/admin`.
3. **غيّر الباسورد فورًا** من حسابك.
4. من الأدمن:
   - فعّل وسائل الدفع (إنستاباي / محافظ) واكتب أرقامك.
   - راجع الباقات وأسعارها وصفحات المنصة.

## 7) جرّب الدورة كاملة
1. افتح `https://platform.com`، المفروض تلاقي الصفحة التسويقية.
2. سجّل حساب تاجر جديد، وجرّب الحاجات دي:
   - أضف منتجات (يدوي واستيراد Excel)، واختار ثيم وصمّم الرئيسية.
   - افتح متجرك على `https://{اسمك}.platform.com` واعمل طلب كعميل.
   - تابع الطلب من الداشبورد، والشحن، والكوبونات.
   - اعمل صفحة هبوط واعمل منها طلب.
   - افتح شات الدعم من الدايرة اللي تحت، ورد عليه من `/admin/support` في متصفح تاني. الرسايل لازم توصل الطرفين من غير refresh.
   - اشترك في باقة ورفع إيصال، وبعدها وافق عليه من الأدمن.
3. اربط دومين خاص تملكه (التفاصيل في آخر الملف).

---

# الجزء التالت: التشغيل اليومي

## التحديث
```bash
cd /opt/landing
./deploy/backup.sh          # نسخة احتياطية قبل أي تحديث
git pull
./deploy/deploy.sh
```
**الرجوع لنسخة أقدم:** `git checkout <commit>` وبعدها `./deploy/deploy.sh`.

> ⚠️ الـ migrations اللي اتنفذت مش بترجع لوحدها. لو التحديث فيه migrations وعايز ترجع قبلها، استرجع النسخة الاحتياطية.

## النسخ الاحتياطي
**نسخة يومية** بتتحفظ 14 يوم في `/var/backups/landing`، وفيها:
- قاعدة البيانات.
- الصور.
- الملفات الخاصة (الإيصالات وملفات الشات).

```bash
sudo mkdir -p /var/backups/landing && sudo chown $USER /var/backups/landing
crontab -e
# الساعة 3 الفجر كل يوم:
0 3 * * * cd /opt/landing && ./deploy/backup.sh >> /var/log/landing-backup.log 2>&1
```
انسخ `/var/backups/landing` لمكان برا السيرفر كمان (rsync أو تخزين خارجي).

**الاسترجاع:** بيستبدل قاعدة البيانات والصور، وبيطلب منك تكتب RESTORE:
```bash
./deploy/restore.sh /var/backups/landing/db-YYYYmmdd-HHMMSS.sql.gz /var/backups/landing/media-YYYYmmdd-HHMMSS.tar.gz
```
**الملفات الخاصة لو احتجتها:**
```bash
docker run --rm --volumes-from "$(docker compose ps -q back-app)" -v /var/backups/landing:/backup alpine:3.20 \
  tar xzf /backup/private-YYYYmmdd-HHMMSS.tar.gz -C /var/www/html/storage/app/private
```

## المراقبة
```bash
docker compose ps                           # الحالة والصحة
docker compose logs -f --tail=100 front     # أو back-app / queue / reverb / caddy / mysql
docker stats                                # الذاكرة والمعالج
df -h /                                     # المساحة
```

## أوامر مفيدة
```bash
docker compose exec back-app php artisan tinker              # كونسول Laravel
docker compose exec back-app php artisan platform:create-admin   # أدمن إضافي (لو نسيت الباسورد)
docker compose restart queue                                 # لو الطابور وقف
```

## حل المشاكل الشائعة
| المشكلة | السبب المحتمل والحل |
|---|---|
| البناء وقف بـ `Killed` أو `out of memory` | الذاكرة قليلة. اتأكد إن الـ swap شغال (`free -h`) أو كبّر السيرفر. |
| الشهادة مش بتطلع | السبب واحد من دول، وراجع `docker compose logs caddy`: (1) الـ DNS لسه مش بيشير للسيرفر (`dig`). (2) المنفذ 80 أو 443 مقفول (`ufw` أو جدار المزود). (3) Cloudflare مفعّل عليه Proxy. |
| 502 من Caddy | الخدمة لسه بتقوم أو مش صحية. شوف `docker compose ps`، وبعدها اللوج بتاعها. |
| شات الدعم مش لحظي (لازم refresh) | `docker compose logs reverb`. اتأكد إن `REVERB_*` مليانة، وإن الداشبورد مفتوح على `APP_HOST` نفسه. |
| الصور 404 | `docker compose exec caddy ls /srv/media` |
| الاستيراد واقف | `docker compose logs queue`، وبعدها `docker compose restart queue`. |
| المساحة خلصت | `docker system prune` (بيمسح الصور القديمة بس، مش البيانات)، وراجع حجم `/var/backups/landing`. |

**حدود Let's Encrypt:** حوالي 50 شهادة جديدة في الأسبوع لنفس الدومين.
- لو أكتر من 50 تاجر جديد سجّلوا في أسبوع، شهادات الـ subdomains الزيادة هتتأخر للأسبوع اللي بعده. الحل وقتها شهادة wildcard بتحدي DNS-01.
- دومينات التجار الخاصة مش متأثرة.
- للتجارب الكتير فعّل سطر staging المعلّق في `deploy/Caddyfile`.

## الدومين الخاص للتاجر وSSL
1. **التاجر يضيف دومينه** من «النطاقات»، فيظهرله سجل واحد يضيفه عند مزود الدومين:
   - دومين رئيسي (`example.com`): سجل **A** على `@` يشير لـ `SERVER_IP`.
   - دومين فرعي (`shop.example.com`): سجل **CNAME** يشير لـ `cname.{PLATFORM_DOMAIN}`.
2. **Laravel يفحص الـ DNS:** فورًا، وبعدها كل 5 دقايق لمدة 72 ساعة.
3. **التفعيل والشهادة:** أول ما السجل يظهر، الدومين يتفعّل، وCaddy يطلع الشهادة تلقائيًا مع أول زيارة.
4. **الحماية:** Caddy ما بيطلبش شهادة لأي دومين غير لما Laravel يوافق (`/internal/tls/ask`)، فمحدش يقدر يستغله لدومينات عشوائية.

**فحص سريع من السيرفر:**
```bash
docker compose exec caddy wget -qO- -S "http://back-web/internal/tls/ask?domain=$PLATFORM_DOMAIN" 2>&1 | grep HTTP   # 200
docker compose exec caddy wget -qO- -S "http://back-web/internal/tls/ask?domain=random.example" 2>&1 | grep HTTP  # 404
```
لو حالة SSL «غير مؤكد» والموقع بيفتح بـ https عادي، غالبًا السيرفر مش قادر يوصل لنفسه بالـ IP العام (hairpin NAT)، والشهادة سليمة.

---

# التطوير المحلي (للمرجع)
- **الأدوات:**
  - PHP 8.3 portable: `source tools/env.sh`.
  - MySQL من XAMPP (MariaDB)، بقاعدتين `landing` و`landing_test`.
  - Node 22 وpnpm.
- **تشغيل كل حاجة:** `bash tools/start-dev.sh`، وده بيشغّل Laravel على 8010، والطابور، والـ scheduler، وReverb على 8080، وNext.
- **الاختبارات:**
  - الباك: `cd back && composer test && composer lint`
  - الفرونت: `cd front && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- **بيانات تجريبية محلية فقط:** `php artisan platform:demo`. بترفض تشتغل على production.

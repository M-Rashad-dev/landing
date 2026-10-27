# دليل النشر على VPS

> ⚠️ ملفات النشر (`docker-compose.yml`، والـ Dockerfiles، و`deploy/*.sh`، و`deploy/Caddyfile`) اتكتبت ومتراجعة، لكن **ماتجربتش فعليًا** لأن جهاز التطوير مفيهوش Docker. جرّبها على سيرفر اختبار الأول، ويُفضّل بـ Let's Encrypt staging (السطر المعلّق في `deploy/Caddyfile`).

المطلوب: سيرفر + دومين، تضيف سجلين DNS، تملأ `.env`، وتشغّل أمر واحد.

## 1) المتطلبات
- Ubuntu 22.04 أو 24.04.
- كحد أدنى: 2 vCPU و4GB RAM و40GB SSD.
- دومين للمنصة (مثال `platform.com`) عند مزود DNS بيدعم سجلات wildcard.

## 2) تجهيز السيرفر
```bash
# Docker + Compose v2 (السكريبت الرسمي)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # اخرج وادخل تاني بعدها

# الجدار الناري: SSH وHTTP وHTTPS فقط
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```
يُنصح بتعطيل دخول SSH بالباسورد والاكتفاء بالمفاتيح: في `/etc/ssh/sshd_config` خلّي `PasswordAuthentication no`، وبعدها `sudo systemctl restart ssh`.

## 3) DNS (مرة واحدة)
| النوع | الاسم | القيمة |
|---|---|---|
| A | `@` | IP السيرفر |
| A | `*` (wildcard) | IP السيرفر |

الـ wildcard بيغطي `app` و`cname` وكل الدومينات المجانية للعملاء. لو المزود مش بيدعم wildcard، ضيف `app` و`cname` يدويًا، وهتحتاج سجل لكل عميل جديد (مش عملي، فاختار مزود بيدعمه).

اتأكد قبل ما تكمل:
```bash
dig +short platform.com
dig +short app.platform.com
dig +short anything.platform.com    # الثلاثة لازم يرجعوا IP السيرفر
```

## 4) رفع الكود وملء `.env`
```bash
sudo mkdir -p /opt/landing && sudo chown $USER /opt/landing
git clone <رابط المستودع> /opt/landing     # أو scp للملفات
cd /opt/landing
cp .env.example .env
```
املأ `.env`:
| المتغير | القيمة |
|---|---|
| `PLATFORM_DOMAIN` | دومين المنصة، مثال `platform.com` |
| `APP_HOST` | دومين الداشبورد، مثال `app.platform.com` |
| `SERVER_IP` | IP السيرفر العام (بيظهر للعملاء في تعليمات سجل A) |
| `ACME_EMAIL` | اختياري: إيميل لتنبيهات انتهاء الشهادات |
| `APP_KEY` | `echo "base64:$(openssl rand -base64 32)"` |
| `DB_PASSWORD` و`DB_ROOT_PASSWORD` | باسوردات قوية مختلفة |
| `INTERNAL_API_KEY` و`REVALIDATE_SECRET` | كل واحد `openssl rand -hex 32` (قيمتين مختلفتين) |

`.env` فيه أسرار: `chmod 600 .env`، وماتحطوش في git.

## 5) التشغيل
```bash
./deploy/deploy.sh
```
السكريبت بيتأكد إن كل المتغيرات المطلوبة مليانة، ويبني الصور، ويشغّل MySQL وRedis ويستنى صحتهم، ويعمل migrate ويضيف الثيمات، ويشغّل الباقي، ويفحص `/health` و`/api/health`، وفي الآخر يطبع الروابط. تقدر تشغّله أكتر من مرة بأمان.

الخدمات اللي بتشتغل: `caddy` (المنافذ 80 و443 بس)، و`front` (Next)، و`back-web` (nginx)، و`back-app` (php-fpm)، و`queue`، و`scheduler`، و`mysql`، و`redis`. MySQL وRedis وLaravel مش مكشوفين برا شبكة Docker.

## 6) إنشاء الـ Super Admin
```bash
docker compose exec back-app php artisan platform:create-admin
```
الأمر بيسألك عن الاسم والإيميل والموبايل والباسورد (مش بتظهر وانت بتكتبها). بعدها ادخل على `https://app.platform.com/login` وهتتحول لـ `/admin`.

## 7) فحص نهائي
1. افتح `https://app.platform.com` وسجّل حساب تجريبي.
2. أنشئ منتج وصفحة وانشرها.
3. افتح الصفحة على الدومين المجاني `https://{الاسم}.platform.com`. أول طلب على أي اسم جديد بياخد ثواني لحد ما الشهادة تتصدر.
4. ابعت طلب من الصفحة، واتأكد إنه ظهر في الداشبورد.

## 8) ربط دومين خاص تجريبي
تفاصيله في قسم «الدومين الخاص وSSL» تحت.

## 9) التحديث والرجوع
```bash
cd /opt/landing
git pull
./deploy/deploy.sh
```
الرجوع لنسخة سابقة: `git checkout <tag>` وبعدها `./deploy/deploy.sh`.
> ⚠️ الـ migrations اللي اتنفذت مش بترجع لوحدها. قبل أي تحديث فيه migrations خُد نسخة احتياطية (`./deploy/backup.sh`)، ولو عايز ترجع لنسخة أقدم من migration معينة، استرجع النسخة الاحتياطية بدل الـ rollback.

## 10) النسخ الاحتياطي والمراقبة
**نسخة يومية** (قاعدة البيانات مضغوطة + كل الصور، وبتتحفظ 14 يوم في `/var/backups/landing`):
```bash
sudo mkdir -p /var/backups/landing && sudo chown $USER /var/backups/landing
crontab -e
# الساعة 3 الفجر كل يوم:
0 3 * * * cd /opt/landing && ./deploy/backup.sh >> /var/log/landing-backup.log 2>&1
```
يُنصح تنسخ `/var/backups/landing` لمكان تاني برا السيرفر (rsync لسيرفر تاني أو تخزين خارجي).

**الاسترجاع** (بيستبدل قاعدة البيانات والصور الحالية، وبيطلب منك تكتب RESTORE للتأكيد):
```bash
./deploy/restore.sh /var/backups/landing/db-YYYYmmdd-HHMMSS.sql.gz /var/backups/landing/media-YYYYmmdd-HHMMSS.tar.gz
```

**المراقبة:**
```bash
docker compose ps                          # الحالة والصحة
docker compose logs -f --tail=100 front    # أو back-app / queue / caddy / mysql
docker system df -v                        # مساحة الـ volumes
df -h /
```
سجلات Laravel بصيغة JSON على stderr (`docker compose logs back-app`)، ومفيهاش باسوردات ولا توكنات.

## 11) حل المشاكل الشائعة
| المشكلة | السبب المحتمل والحل |
|---|---|
| الشهادة مش بتتصدر | DNS لسه مش بيشير للسيرفر (`dig`)، أو المنفذ 80 أو 443 مقفول (`ufw status`، وجدار مزود الـ VPS)، أو `ask` بيرجع 404 للاسم ده (الدومين مش نشط أو العميل موقوف). راجع `docker compose logs caddy`. |
| 502 من Caddy | الخدمة لسه بتقوم أو مش صحية: `docker compose ps`، وبعدها logs الخدمة (`front` أو `back-web`). |
| الصور 404 | الـ volume `media` مش متركّب على `caddy` و`back-app`، أو الملفات اتمسحت. راجع `docker compose exec caddy ls /srv/media`. |
| الطلبات مش بتحدّث الصفحات أو الطابور واقف | `docker compose logs queue`، وبعدها `docker compose restart queue`. |
| المساحة خلصت | `docker system prune` (بيمسح الصور القديمة بس، مش الـ volumes)، وراجع حجم `/var/backups/landing`. |
| حساب الأدمن اتقفل أو نسيت الباسورد | أنشئ أدمن جديد بـ `platform:create-admin`. |

### حدود Let's Encrypt (للعلم)
حوالي 50 شهادة جديدة أسبوعيًا لنفس الدومين المسجّل (`platform.com`). لو أكتر من 50 عميل جديد سجّلوا في أسبوع واحد، شهادات الـ subdomains الجديدة هتتأخر للأسبوع اللي بعده. الحل لاحقًا شهادة wildcard بتحدي DNS-01، ودي محتاجة API من مزود الـ DNS، فهي مؤجلة لحد ما نحتاجها. دومينات العملاء الخاصة مش متأثرة. للتجارب استخدم staging الخاص بـ Let's Encrypt (السطر المعلّق في `deploy/Caddyfile`).

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

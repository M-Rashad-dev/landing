# Theme Document: `rawaq_landing` («رواق» — Beauty & Care Landing Page Theme)

- **Kind:** `landing`
- **Theme Key:** `rawaq_landing`
- **Audience:** one skin care, hair care or make-up product (a serum, a cream, an oil, a set), mostly women customers; Egyptian Arabic copy addresses the customer in the feminine («اطلبيه»، «بشرتك»).
- **Look:** soft pastel plates mixed from the colors (blush from `primary`, mint from `secondary`), an elegant title font (El Messiri), the product in a big circle on a glowing hero, rounded cards. Its store pair is `rawaq_store` (sold apart).
- **`MAX_SECTIONS`:** `20`
- **Built-in Section Types (`SECTION_TYPES`):** `hero`, `trust`, `benefits`, `before_after`, `ingredients`, `how_to`, `suits`, `bundles`, `stats`, `gallery`, `video`, `testimonials`, `countdown`, `order_form`, `promises`, `faq` (plus `ai` for approved custom AI sections)
- **Mandatory Rule:** Every landing page **must contain exactly one `order_form` section** with `"visible": true`.
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`
- **Copy rules:** never claim to cure, treat or heal anything and never name a disease; benefits are «بيساعد»، «مناسب لـ». Ingredients are the product's real ones only.

## 1. Settings (`settings`)
- `colors`: `{ "primary": "#rrggbb", "secondary": "#rrggbb", "background": "#rrggbb", "text": "#rrggbb", "dark": "#rrggbb" }` (`dark` = the announcement strip, the countdown band and the footer)
- `font`: required string in the allowed fonts; `font_size`: `"small" | "medium" | "large"`; `button`: `"rounded" | "pill" | "square"`
- `display_font`: required boolean (the title font); `logo_media_id`: nullable integer
- `header`: `show` (required boolean), `announcement` (nullable `<= 200`), `button_label` (nullable `<= 40`, scrolls to the order form)
- `footer`: `text` (nullable `<= 300`), `phone`, `whatsapp` (nullable `<= 30`), `social` (`{ facebook, instagram, tiktok, x, youtube, snapchat }`, each null or url)
- `general`: `sticky_order_button`, `whatsapp_button`, `animations` (required booleans)

## 2. Section Types (`sections`)
Allowed icons: `["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone", "droplet", "sparkle", "leaf", "sun", "moon", "flask", "smile", "feather", "award", "gem", "hand", "flower"]`.
- **`hero`:** `kicker` (`<= 60`), `title` (required `<= 120`), `highlight` (`<= 60`, a word of the title in the main color), `subtitle` (`<= 300`), `image_media_id` (nullable: the product's first picture), `badge` (`<= 20`, a round tilted badge: «خصم 30%»), `show_price` (bool), `show_rating` (bool, from the product's reviews), `button_label` (required `<= 40`), `second_label` (`<= 40`, scrolls to the next section), `chips` (array `0..4` of strings `<= 30`).
- **`trust`:** the strip under the hero: `items` (array `2..4` of `{ icon, title <= 40, text <= 80 }`).
- **`benefits`:** «بيساعدك في إيه؟»: `kicker` (`<= 60`), `title` (`<= 80`), `items` (array `2..6` of `{ icon, title <= 40, text <= 160, color ("#rrggbb" or null = soft theme colors in turn) }`).
- **`before_after`:** two photos with a line the customer drags: `kicker` (`<= 60`), `title` (`<= 80`), `text` (`<= 300`), `before_media_id` and `after_media_id` (both required, real media ids only: leave this section out when there are no such photos), `before_label` / `after_label` (required `<= 20`), `facts` (array `0..3` of `{ value <= 12, label <= 40 }`).
- **`ingredients`:** `kicker` (`<= 60`), `title` (`<= 80`), `subtitle` (`<= 200`), `items` (array `2..8` of `{ symbol (required <= 4: "C", "B3", "HA"), name (required <= 40), text <= 120, color ("#rrggbb" or null) }`).
- **`how_to`:** `kicker` (`<= 60`), `title` (`<= 80`), `image_media_id` (nullable), `steps` (array `2..5` of `{ title (required <= 50), text <= 200, time <= 20 («الصبح»، «بالليل») }`), `note` (`<= 200`).
- **`suits`:** «مناسب لـ»: `title` (required `<= 80`), `items` (array `1..8` of strings `<= 30`), `note` (`<= 200`).
- **`bundles`:** `kicker` (`<= 60`), `title` (`<= 80`), `subtitle` (`<= 200`), `cards` (array `0..4` of `{ offer_id (nullable int), image_media_id (nullable), title <= 40, subtitle <= 60, points: string[] (<= 5), ribbon <= 24 }`; empty = one card per running offer of the product).
- **`stats`:** `kicker` (`<= 60`), `title` (`<= 80`), `items` (array `2..4` of `{ value <= 16, label <= 40 }`).
- **`gallery`:** `kicker` (`<= 60`), `title` (`<= 80`), `image_media_ids` (array `0..12` of ints; empty = the product's pictures).
- **`video`:** `title` (`<= 80`), `subtitle` (`<= 200`), `url` (required YouTube/Vimeo https URL), `cover_media_id` (nullable).
- **`testimonials`:** `kicker` (`<= 60`), `title` (`<= 80`), `source` (`"auto" | "manual"`), `items` (array `0..12` of `{ name <= 60, place <= 40, rating 1..5, text <= 400, image_media_id (nullable) }`), `show_score` (bool).
- **`countdown`:** `kicker` (`<= 60`), `title` (required `<= 80`), `text` (`<= 160`), `ends_at` (nullable ISO date), `show_stock` (bool).
- **`order_form` (Required: exactly 1, `visible: true`):** `kicker` (`<= 60`), `title` (required `<= 80`), `subtitle` (`<= 200`), `button_label` (required `<= 40`), `fields` (required object for `name`, `phone`, `phone2`, `email`, `governorate`, `city`, `address`, `notes`), `offer_picker` (bool), `show_quantity` (bool), `points` (array `0..5` of strings `<= 60`), `image_media_id` (nullable).
- **`promises`:** `items` (array `2..4` of `{ icon, title <= 40, text <= 120 }`).
- **`faq`:** `kicker` (`<= 60`), `title` (`<= 80`), `items` (array `1..12` of `{ question <= 150, answer <= 600 }`).
- **`ai`:** `ai_section_id` (required int), `values` (`{}`).

## 3. Full `defaults()` Example
```json
{
 "version": 1,
 "settings": {
 "colors": {
 "primary": "#b9507a",
 "secondary": "#3d9a6f",
 "background": "#fbf7f3",
 "text": "#2b2226",
 "dark": "#2b2226"
 },
 "font": "cairo",
 "font_size": "medium",
 "button": "pill",
 "display_font": true,
 "logo_media_id": null,
 "header": {
 "show": true,
 "announcement": "توصيل مجاني لكل المحافظات · الدفع عند الاستلام",
 "button_label": "اطلبيه دلوقتي"
 },
 "footer": {
 "text": null,
 "phone": null,
 "whatsapp": null,
 "social": {
 "facebook": null,
 "instagram": null,
 "tiktok": null,
 "x": null,
 "youtube": null,
 "snapchat": null
 }
 },
 "general": {
 "sticky_order_button": true,
 "whatsapp_button": false,
 "animations": true
 }
 },
 "sections": [
 {
 "id": "rawaq01f04af",
 "type": "hero",
 "visible": true,
 "props": {
 "kicker": "الأكثر مبيعًا عندنا",
 "title": "سر بشرة منوّرة من أول أسبوع",
 "highlight": null,
 "subtitle": "اكتبي هنا في سطرين بيعمل إيه المنتج ولمين، بكلام بسيط زي ما بتكلمي صاحبتك.",
 "image_media_id": null,
 "badge": "خصم 30%",
 "show_price": true,
 "show_rating": true,
 "button_label": "اطلبيه دلوقتي",
 "second_label": "اعرفي أكتر",
 "chips": [
 "أصلي 100%",
 "الدفع عند الاستلام",
 "توصيل سريع"
 ]
 }
 },
 {
 "id": "rawaq02ac05c",
 "type": "trust",
 "visible": true,
 "props": {
 "items": [
 {
 "icon": "shield",
 "title": "أصلي 100%",
 "text": "من الوكيل مباشرة"
 },
 {
 "icon": "cash",
 "title": "الدفع عند الاستلام",
 "text": "تشوفيه الأول"
 },
 {
 "icon": "truck",
 "title": "توصيل سريع",
 "text": "لكل المحافظات"
 }
 ]
 }
 },
 {
 "id": "rawaq0379da1",
 "type": "benefits",
 "visible": true,
 "props": {
 "kicker": "هتلاحظي الفرق",
 "title": "بيساعدك في إيه؟",
 "items": [
 {
 "icon": "sparkle",
 "title": "نضارة",
 "text": "اكتبي هنا الفايدة الأولى اللي العميلة هتلاحظها.",
 "color": "#f6e2df"
 },
 {
 "icon": "droplet",
 "title": "ترطيب",
 "text": "اكتبي هنا الفايدة التانية.",
 "color": "#e1e9f2"
 },
 {
 "icon": "sun",
 "title": "توحيد اللون",
 "text": "اكتبي هنا الفايدة التالتة.",
 "color": "#efe4d6"
 },
 {
 "icon": "smile",
 "title": "ملمس ناعم",
 "text": "اكتبي هنا الفايدة الرابعة.",
 "color": "#dcebe3"
 }
 ]
 }
 },
 {
 "id": "rawaq04e0490",
 "type": "ingredients",
 "visible": true,
 "props": {
 "kicker": "اعرفي اللي بتحطيه",
 "title": "المكوّنات",
 "subtitle": null,
 "items": [
 {
 "symbol": "C",
 "name": "فيتامين C",
 "text": "اكتبي هنا فايدة المكوّن في سطر.",
 "color": "#f6e2df"
 },
 {
 "symbol": "HA",
 "name": "هيالورونيك",
 "text": "اكتبي هنا فايدة المكوّن في سطر.",
 "color": "#e1e9f2"
 },
 {
 "symbol": "B3",
 "name": "نياسيناميد",
 "text": "اكتبي هنا فايدة المكوّن في سطر.",
 "color": "#dcebe3"
 }
 ]
 }
 },
 {
 "id": "rawaq05b0926",
 "type": "how_to",
 "visible": true,
 "props": {
 "kicker": "سهل جدًا",
 "title": "طريقة الاستخدام",
 "image_media_id": null,
 "steps": [
 {
 "title": "نضّفي بشرتك",
 "text": "اغسلي وشك بالغسول ونشّفيه بالراحة.",
 "time": "الصبح وبالليل"
 },
 {
 "title": "حطي كمية صغيرة",
 "text": "نقطتين أو تلاتة كفاية لكل الوش.",
 "time": null
 },
 {
 "title": "دلّكي بالراحة",
 "text": "بحركات دايرية لحد ما يتشرب، وبعده المرطب.",
 "time": null
 }
 ],
 "note": "الصبح ماتنسيش واقي الشمس آخر خطوة."
 }
 },
 {
 "id": "rawaq06ee876",
 "type": "suits",
 "visible": true,
 "props": {
 "title": "مناسب لـ",
 "items": [
 "كل أنواع البشرة",
 "البشرة الحساسة",
 "الرجالة والستات"
 ],
 "note": null
 }
 },
 {
 "id": "rawaq079e21e",
 "type": "bundles",
 "visible": true,
 "props": {
 "kicker": null,
 "title": "اختاري العرض اللي يناسبك",
 "subtitle": null,
 "cards": []
 }
 },
 {
 "id": "rawaq089c514",
 "type": "testimonials",
 "visible": true,
 "props": {
 "kicker": null,
 "title": "آراء عميلاتنا",
 "source": "auto",
 "items": [],
 "show_score": true
 }
 },
 {
 "id": "rawaq09f204f",
 "type": "order_form",
 "visible": true,
 "props": {
 "kicker": "الدفع عند الاستلام",
 "title": "اطلبيه دلوقتي",
 "subtitle": "اكتبي بياناتك وهنكلمك نأكد الطلب قبل الشحن.",
 "button_label": "أكّدي الطلب",
 "fields": {
 "name": {
 "enabled": true,
 "required": true
 },
 "phone": {
 "enabled": true,
 "required": true
 },
 "phone2": {
 "enabled": false,
 "required": false
 },
 "email": {
 "enabled": false,
 "required": false
 },
 "governorate": {
 "enabled": true,
 "required": true
 },
 "city": {
 "enabled": true,
 "required": false
 },
 "address": {
 "enabled": true,
 "required": true
 },
 "notes": {
 "enabled": true,
 "required": false
 }
 },
 "offer_picker": true,
 "show_quantity": true,
 "points": [
 "أصلي 100%",
 "بيوصلك مقفول",
 "استبدال خلال 14 يوم"
 ],
 "image_media_id": null
 }
 },
 {
 "id": "rawaq1050584",
 "type": "promises",
 "visible": true,
 "props": {
 "items": [
 {
 "icon": "truck",
 "title": "توصيل لكل المحافظات",
 "text": "بيوصلك من يومين لـ 4 أيام."
 },
 {
 "icon": "cash",
 "title": "الدفع عند الاستلام",
 "text": "تشوفيه الأول وبعدين تدفعي."
 },
 {
 "icon": "return",
 "title": "استبدال سهل",
 "text": "خلال 14 يوم طالما مقفول."
 }
 ]
 }
 },
 {
 "id": "rawaq11da75c",
 "type": "faq",
 "visible": true,
 "props": {
 "kicker": null,
 "title": "عندك سؤال؟",
 "items": [
 {
 "question": "المنتج أصلي؟",
 "answer": "أيوه، أصلي 100% ومن الوكيل مباشرة."
 },
 {
 "question": "هيبان النتيجة إمتى؟",
 "answer": "اكتبي هنا المدة الطبيعية اللي العميلة تشوف فيها فرق مع الاستخدام المنتظم."
 },
 {
 "question": "الدفع بيبقى إزاي؟",
 "answer": "كاش عند الاستلام، بعد ما تستلمي المنتج."
 }
 ]
 }
 }
 ]
}
```

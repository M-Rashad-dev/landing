# Theme Document: `rawaq_store` («رواق» — Beauty & Care Store Theme)

- **Kind:** `store`
- **Theme Key:** `rawaq_store`
- **Audience:** skin care, hair care, make-up and personal care stores (mostly women customers; Egyptian Arabic copy addresses the customer in the feminine: «تسوّقي»، «أضيفي»).
- **Look:** soft pastel plates mixed from the store colors (blush from `primary`, mint from `secondary`), an elegant title font (El Messiri), rounded cards, products on a tinted plate.
- **`MAX_SECTIONS`:** `30`
- **Built-in Section Types (`SECTION_TYPES`):** `glow_hero`, `features`, `shortcuts`, `categories`, `product_tabs`, `products`, `routine`, `banners`, `countdown`, `reels`, `video`, `ingredients`, `brands`, `testimonials`, `faq`, `cta`, `before_after`, `skin_quiz`, `articles` (plus `ai` for approved custom AI sections)
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`

## 1. Settings (`settings`)
- `colors`: `{ "primary": "#rrggbb", "secondary": "#rrggbb", "background": "#rrggbb", "text": "#rrggbb", "dark": "#rrggbb" }` (`dark` = the announcement strip, the countdown band and the dark footer)
- `font`: required string in the allowed fonts; `font_size`: `"small" | "medium" | "large"`
- `display_font`: required boolean (the title font); `button`: `"rounded" | "pill" | "square"`
- `logo_media_id`, `favicon_media_id`: nullable integer
- `header`: `sticky`, `search`, `categories_menu` (required booleans), `announcement` (nullable `<= 200`), `layout` (`"start" | "center"`)
- `footer`: `about` (nullable `<= 500`), `show_pages`, `dark`, `payments` (required booleans), `phone`, `whatsapp` (nullable `<= 30`), `email` (nullable email), `address` (nullable `<= 200`), `social` (`{ facebook, instagram, tiktok, x, youtube, snapchat }`, each null or url)
- `general`: `whatsapp_button`, `show_out_of_stock`, `floating_call`, `animations` (required booleans), `call_phone` (nullable phone `<= 30`), `products_per_page` (`[12, 16, 24, 32, 48]`)
- `product_card`: `{ "image": "square | tall", "tinted": bool, "show_description": bool, "show_rating": bool, "button": "icon | full", "radius": 0..40 }`
- `product_page`: `{ "gallery": "thumbs | slider", "zoom": bool, "description": bool, "reviews": bool, "whatsapp_ask": bool, "related_enabled": bool, "related": "category | similar", "sticky_bar": bool, "sticky_buttons": "cart | both | buy", "viewers": { "enabled": bool, "min": int, "max": int, "every": 3..300 }, "promises": string[] (0..4, each <= 40: «أصلي 100%»، «مرخّص من وزارة الصحة») }`
- `listing`: `{ "columns_desktop": 2..5, "columns_mobile": 1..2, "banner": bool, "subcategories": "circles | chips", "filters": "open | button | hidden" }`
- `cart`: `{ "free_shipping_bar": bool, "suggestions_enabled": bool, "suggestions": "offers | latest", "order_notes": bool }`

Store Link Shape (every `*_link` and item `link`): `{ "type": "none | all_products | offers | category | product | url | search", "target_id": int|null, "url": string|null }` (`target_id` required for `category` / `product`, `url` required https for `url`; for `search` the `url` holds the word to search for, `<= 60`, opening the products whose name or description has it: use it for ingredients, «نياسيناميد»).

## 2. Section Types (`sections`)
Icons for `features`: `["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone"]`.
- **`glow_hero`:** `kicker` (`<= 40`), `title` (required `<= 100`), `highlight` (`<= 40`, a word of the title drawn in the store color), `subtitle` (`<= 300`), `media_id` (nullable, shown in a big circle), `badge` (`<= 20`, a tilted round badge: «خصم 30%»), `rating` (`<= 40`, a small card: «4.9 من 2,300 عميلة»), `primary_label` (required `<= 30`), `primary_link`, `second_label` (`<= 30`), `second_link`, `chips` (array `0..4` of strings `<= 30`).
- **`features`:** the trust strip: `title` (`<= 80`), `items` (array `2..4` of `{ icon, title <= 40, text <= 120 }`).
- **`shortcuts`:** tiles by skin type, hair type or concern, each opening a link: `kicker` (`<= 40`), `title` (`<= 80`), `description` (`<= 200`), `style` (`"circles" | "cards"`), `items` (array `2..12` of `{ label (required <= 40), text <= 80, media_id (nullable), color ("#rrggbb" or null = soft theme colors in turn), link }`).
- **`categories`:** `title` (`<= 80`), `description` (`<= 200`), `category_ids` (array `<= 24` ints), `shape` (`"circle" | "square" | "card"`), `layout` (`"grid" | "slider"`), `columns_desktop` (`3..8`), `columns_mobile` (`2..4`).
- **`product_tabs`:** `title` (`<= 80`), `description` (`<= 200`), `limit` (`[4, 8, 12, 16, 24, 32]`), `tabs` (array `1..6` of `{ label <= 30, source: "latest | offers | category | manual", category_id: int|null, product_ids: int[] }`).
- **`products`:** `title` (required `<= 80`), `description` (`<= 200`), `source` (`"latest" | "offers" | "category"`), `category_id` (int|null), `limit` (`[4, 8, 12, 16, 24, 32]`), `layout` (`"grid" | "slider"`), `columns` (`[2, 3, 4, 5]`), `show_view_all` (bool).
- **`routine`:** 2–4 products added to the cart together (priced from the products themselves): `kicker` (`<= 40`), `title` (required `<= 80`), `text` (`<= 300`), `button_label` (`<= 30`), `steps` (array `2..4` of `{ product_id (required, distinct), label <= 30, hint <= 40 }`). Only with real product ids.
- **`banners`:** `items` (array `1..3` of `{ media_id (required), kicker <= 40, title <= 80, button_label <= 30, link }`).
- **`countdown`:** `media_id` (nullable), `kicker` (`<= 40`), `title` (required `<= 80`), `text` (`<= 200`), `button_label` (`<= 30`), `link`, `ends_at` (required ISO date), `on_end` (`"hide" | "ended"`).
- **`reels`:** short vertical videos: `kicker` (`<= 40`), `title` (`<= 80`), `items` (array `1..10` of `{ url (required YouTube/Vimeo https URL, shorts allowed), title <= 60, cover_media_id (nullable) }`).
- **`video`:** `url` (required YouTube/Vimeo https URL), `title` (`<= 80`), `text` (`<= 200`), `cover_media_id` (nullable).
- **`ingredients`:** `kicker` (`<= 40`), `title` (`<= 80`), `description` (`<= 200`), `items` (array `2..8` of `{ symbol (required <= 4: "C", "B3", "HA"), name (required <= 40), text <= 100, color ("#rrggbb" or null), link }`).
- **`brands`:** `title` (`<= 80`), `items` (array `2..16` of `{ media_id (required), name <= 40, link }`).
- **`testimonials`:** `title` (`<= 80`), `source` (`"auto" | "manual"`), `items` (array `0..12` of `{ name <= 60, rating 1..5, text <= 400 }`).
- **`faq`:** `title` (`<= 80`), `text` (`<= 300`), `whatsapp_button` (bool), `items` (array `1..20` of `{ question <= 160, answer <= 1000 }`).
- **`cta`:** a colored band with one button: `title` (required `<= 80`), `text` (`<= 200`), `button_label` (required `<= 30`), `action` (`"whatsapp" | "link"`; whatsapp opens the store's footer WhatsApp number), `message` (`<= 200`, the ready WhatsApp message), `link`.
- **`before_after`:** two photos with a line the customer drags: `kicker` (`<= 40`), `title` (`<= 80`), `text` (`<= 300`), `before_media_id` and `after_media_id` (both required, real media ids only: leave this section out when there are no such photos), `before_label` / `after_label` (required `<= 20`), `facts` (array `0..3` of `{ value (required <= 12: "92%"), label (required <= 40) }`).
- **`skin_quiz`:** a short quiz recommending products: `kicker` (`<= 40`), `title` (required `<= 80`), `text` (`<= 300`), `button_label` (`<= 30`), `results` (array `2..6` of `{ id (required, distinct, a-z0-9 <= 12), name (required <= 40), text <= 300, product_ids (<= 4 real product ids), category_id (int|null) }`), `questions` (array `2..6` of `{ text (required <= 120), answers (array 2..5 of { text (required <= 60), results (1..2 ids from this quiz's results) }) }`). Each answer votes for its results; the result with the most votes shows (a tie goes to the first listed). Keep the starter quiz below unless asked to change it; no medical claims.
- **`articles`:** care tips: `kicker` (`<= 40`), `title` (`<= 80`), `items` (array `1..6` of `{ media_id (nullable), tag <= 30, title (required <= 80), body (<= 3000 plain text, line breaks kept: opens in a reader), link }`); a tip with no `body` opens its `link`.
- **`ai`:** `ai_section_id` (required int), `values` (`{}`).

## 3. Full `defaults()` Example
```json
{
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
 "logo_media_id": null,
 "favicon_media_id": null,
 "header": {
 "sticky": true,
 "search": true,
 "announcement": "توصيل مجاني للطلبات فوق 500 ج",
 "layout": "start",
 "categories_menu": true
 },
 "footer": {
 "about": null,
 "show_pages": true,
 "phone": null,
 "whatsapp": null,
 "email": null,
 "address": null,
 "social": {
 "facebook": null,
 "instagram": null,
 "tiktok": null,
 "x": null,
 "youtube": null,
 "snapchat": null
 },
 "dark": true,
 "payments": true
 },
 "general": {
 "whatsapp_button": true,
 "show_out_of_stock": true,
 "products_per_page": 24,
 "floating_call": false,
 "call_phone": null,
 "animations": true
 },
 "display_font": true,
 "button": "pill",
 "product_card": {
 "image": "square",
 "tinted": true,
 "show_description": false,
 "show_rating": true,
 "button": "full",
 "radius": 22
 },
 "product_page": {
 "gallery": "thumbs",
 "zoom": true,
 "description": true,
 "reviews": true,
 "whatsapp_ask": true,
 "related_enabled": true,
 "related": "similar",
 "sticky_bar": true,
 "sticky_buttons": "cart",
 "viewers": {
 "enabled": false,
 "min": 40,
 "max": 120,
 "every": 15
 },
 "promises": [
 "أصلي 100%",
 "الدفع عند الاستلام",
 "استبدال سهل"
 ]
 },
 "listing": {
 "columns_desktop": 4,
 "columns_mobile": 2,
 "banner": true,
 "subcategories": "circles",
 "filters": "button"
 },
 "cart": {
 "free_shipping_bar": true,
 "suggestions_enabled": true,
 "suggestions": "offers",
 "order_notes": false
 }
 },
 "sections": [
 {
 "id": "efc6e4f12e54",
 "type": "glow_hero",
 "visible": true,
 "props": {
 "kicker": "مجموعة العناية الجديدة",
 "title": "بشرة صافية من أول أسبوع",
 "highlight": "صافية",
 "subtitle": "منتجات أصلية مختارة لنوع بشرتك، بمكونات مجرّبة وروتين بسيط تمشي عليه كل يوم.",
 "media_id": null,
 "badge": "خصم 30%",
 "rating": null,
 "primary_label": "تسوّقي دلوقتي",
 "primary_link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 },
 "second_label": "العروض",
 "second_link": {
 "type": "offers",
 "target_id": null,
 "url": null
 },
 "chips": [
 "أصلي 100%",
 "الدفع عند الاستلام",
 "توصيل سريع"
 ]
 }
 },
 {
 "id": "a4e80ee045f1",
 "type": "features",
 "visible": true,
 "props": {
 "title": null,
 "items": [
 {
 "icon": "shield",
 "title": "منتجات أصلية",
 "text": "من الوكيل مباشرة"
 },
 {
 "icon": "cash",
 "title": "الدفع عند الاستلام",
 "text": "أو بالكارت والمحفظة"
 },
 {
 "icon": "return",
 "title": "استبدال سهل",
 "text": "لو المنتج مقفول"
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
 "id": "bab82577b49d",
 "type": "shortcuts",
 "visible": true,
 "props": {
 "kicker": "ابدئي من هنا",
 "title": "تسوّقي حسب نوع بشرتك وشعرك",
 "description": null,
 "style": "circles",
 "items": [
 {
 "label": "دهنية",
 "text": null,
 "media_id": null,
 "color": "#f6e2df",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "جافة",
 "text": null,
 "media_id": null,
 "color": "#efe4d6",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "مختلطة",
 "text": null,
 "media_id": null,
 "color": "#dcebe3",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "حساسة",
 "text": null,
 "media_id": null,
 "color": "#eadff0",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "شعر جاف",
 "text": null,
 "media_id": null,
 "color": "#f3e6c9",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "شعر بيتساقط",
 "text": null,
 "media_id": null,
 "color": "#e1e9f2",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 }
 ]
 }
 },
 {
 "id": "696454620be9",
 "type": "shortcuts",
 "visible": true,
 "props": {
 "kicker": "حلول مجرّبة",
 "title": "عندك مشكلة معيّنة؟",
 "description": null,
 "style": "cards",
 "items": [
 {
 "label": "حبوب الشباب",
 "text": "منظّفات وسيرومات للحبوب والمسام",
 "media_id": null,
 "color": "#f6e2df",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "التصبّغات والبقع",
 "text": "فيتامين C والنياسيناميد وواقي الشمس",
 "media_id": null,
 "color": "#efe4d6",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "الخطوط والتجاعيد",
 "text": "ريتينول وترطيب عميق",
 "media_id": null,
 "color": "#dcebe3",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 },
 {
 "label": "تساقط الشعر",
 "text": "شامبو وسيروم للفروة",
 "media_id": null,
 "color": "#e1e9f2",
 "link": {
 "type": "all_products",
 "target_id": null,
 "url": null
 }
 }
 ]
 }
 },
 {
 "id": "bfac572a4cba",
 "type": "product_tabs",
 "visible": true,
 "props": {
 "title": "الأكثر طلبًا",
 "description": null,
 "limit": 8,
 "tabs": [
 {
 "label": "وصل حديثًا",
 "source": "latest",
 "category_id": null,
 "product_ids": []
 },
 {
 "label": "عروض",
 "source": "offers",
 "category_id": null,
 "product_ids": []
 }
 ]
 }
 },
 {
 "id": "ad514ecb8cdf",
 "type": "ingredients",
 "visible": true,
 "props": {
 "kicker": "اعرفي اللي بتحطيه",
 "title": "مكوّنات بنثق فيها",
 "description": null,
 "items": [
 {
 "symbol": "C",
 "name": "فيتامين C",
 "text": "نضارة وتوحيد اللون",
 "color": "#f6e2df",
 "link": {
 "type": "search",
 "target_id": null,
 "url": "فيتامين C"
 }
 },
 {
 "symbol": "B3",
 "name": "نياسيناميد",
 "text": "يقلّل المسام والدهون",
 "color": "#dcebe3",
 "link": {
 "type": "search",
 "target_id": null,
 "url": "نياسيناميد"
 }
 },
 {
 "symbol": "HA",
 "name": "هيالورونيك",
 "text": "ترطيب عميق طول اليوم",
 "color": "#e1e9f2",
 "link": {
 "type": "search",
 "target_id": null,
 "url": "هيالورونيك"
 }
 },
 {
 "symbol": "A",
 "name": "ريتينول",
 "text": "للخطوط وتجديد البشرة",
 "color": "#efe4d6",
 "link": {
 "type": "search",
 "target_id": null,
 "url": "ريتينول"
 }
 }
 ]
 }
 },
 {
 "id": "63c8d63528f8",
 "type": "skin_quiz",
 "visible": true,
 "props": {
 "kicker": "مش عارفة تبدئي منين؟",
 "title": "اعرفي روتينك المناسب في دقيقة",
 "text": "5 أسئلة بسيطة عن بشرتك، وهنرشحلك المنتجات المناسبة ليكي.",
 "button_label": "ابدئي الاختبار",
 "results": [
 {
 "id": "oily",
 "name": "بشرتك دهنية",
 "text": "محتاجة منظف خفيف يشيل الدهون من غير ما ينشّفها، ومرطب خفيف من غير زيوت، وواقي شمس جل.",
 "product_ids": [],
 "category_id": null
 },
 {
 "id": "dry",
 "name": "بشرتك جافة",
 "text": "محتاجة منظف كريمي هادي، ومرطب غني بيحبس المية في البشرة، وماتنسيش الترطيب الصبح وبالليل.",
 "product_ids": [],
 "category_id": null
 },
 {
 "id": "combo",
 "name": "بشرتك مختلطة",
 "text": "منطقة الجبهة والأنف دهنية والخدود عادية أو جافة، فمحتاجة منتجات متوازنة: منظف لطيف ومرطب خفيف.",
 "product_ids": [],
 "category_id": null
 },
 {
 "id": "sensitive",
 "name": "بشرتك حساسة",
 "text": "محتاجة منتجات هادية من غير عطور ولا كحول، وجرّبي أي منتج جديد على مساحة صغيرة الأول.",
 "product_ids": [],
 "category_id": null
 }
 ],
 "questions": [
 {
 "text": "بشرتك بتبقى عاملة إزاي آخر اليوم؟",
 "answers": [
 {
 "text": "لامعة في كل الوش",
 "results": [
 "oily"
 ]
 },
 {
 "text": "لامعة في الجبهة والأنف بس",
 "results": [
 "combo"
 ]
 },
 {
 "text": "مشدودة وناشفة",
 "results": [
 "dry"
 ]
 },
 {
 "text": "بتحمر أو بتهرش",
 "results": [
 "sensitive"
 ]
 }
 ]
 },
 {
 "text": "بعد ما بتغسلي وشك بنص ساعة بتحسي بإيه؟",
 "answers": [
 {
 "text": "بترجع تلمع بسرعة",
 "results": [
 "oily"
 ]
 },
 {
 "text": "بتشد ومحتاجة كريم على طول",
 "results": [
 "dry"
 ]
 },
 {
 "text": "الجبهة بتلمع والخدود عادية",
 "results": [
 "combo"
 ]
 },
 {
 "text": "بتلسع أو تحمر",
 "results": [
 "sensitive"
 ]
 }
 ]
 },
 {
 "text": "المسام عندك شكلها عامل إزاي؟",
 "answers": [
 {
 "text": "واسعة وباينة في كل الوش",
 "results": [
 "oily"
 ]
 },
 {
 "text": "واسعة في الأنف والجبهة بس",
 "results": [
 "combo"
 ]
 },
 {
 "text": "صغيرة ومش باينة تقريبًا",
 "results": [
 "dry",
 "sensitive"
 ]
 }
 ]
 },
 {
 "text": "الكريمات التقيلة بتعمل معاكي إيه؟",
 "answers": [
 {
 "text": "بتطلّع حبوب أو تلمّع",
 "results": [
 "oily",
 "combo"
 ]
 },
 {
 "text": "بتريحني وبتحتاجها",
 "results": [
 "dry"
 ]
 },
 {
 "text": "بتهيّج بشرتي",
 "results": [
 "sensitive"
 ]
 }
 ]
 },
 {
 "text": "بشرتك بتتأثر بالشمس أو المنتجات الجديدة؟",
 "answers": [
 {
 "text": "بتحمر وتهيج بسرعة",
 "results": [
 "sensitive"
 ]
 },
 {
 "text": "بتقشّر وتنشف",
 "results": [
 "dry"
 ]
 },
 {
 "text": "لأ، بس بتلمع أكتر",
 "results": [
 "oily"
 ]
 },
 {
 "text": "تقريبًا مش بتتأثر",
 "results": [
 "combo"
 ]
 }
 ]
 }
 ]
 }
 },
 {
 "id": "386aa3d4be03",
 "type": "testimonials",
 "visible": true,
 "props": {
 "title": "آراء عميلاتنا",
 "source": "auto",
 "items": []
 }
 },
 {
 "id": "23691e347311",
 "type": "cta",
 "visible": true,
 "props": {
 "title": "خلّيكي أول واحدة تعرف العروض",
 "text": "ابعتيلنا على واتساب ونبعتلك العروض الجديدة أول بأول.",
 "button_label": "ابعتيلنا على واتساب",
 "action": "whatsapp",
 "message": "عايزة أعرف العروض الجديدة",
 "link": {
 "type": "none",
 "target_id": null,
 "url": null
 }
 }
 }
 ]
}
```

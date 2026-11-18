# Theme Document: `shabe_store` («شابع · متجر» — Food & Restaurant Store Theme)

- **Kind:** `store`
- **Theme Key:** `shabe_store`
- **`MAX_SECTIONS`:** `30`
- **Built-in Section Types (`SECTION_TYPES`):** `food_hero`, `marquee`, `categories`, `product_tabs`, `bundles`, `products`, `why`, `steps`, `countdown`, `video`, `gallery`, `testimonials`, `hours`, `faq`, `location` (plus `ai` for approved custom AI sections)
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`

## 1. Settings (`settings`)
- `colors`: `{ "primary": "#rrggbb", "secondary": "#rrggbb", "background": "#rrggbb", "text": "#rrggbb", "dark": "#rrggbb" }`
- `font`: required string in `["cairo", "tajawal", "almarai", "ibm_plex_arabic", "noto_kufi", "readex_pro"]`
- `font_size`: required string in `["small", "medium", "large"]`
- `display_font`: required boolean
- `button`: required string in `["rounded", "pill", "square"]`
- `logo_media_id`, `favicon_media_id`: nullable integer
- `header`:
  - `sticky`, `search`, `categories_menu`: required booleans
  - `announcement`: nullable string `<= 200`
  - `layout`: required string in `["start", "center"]`
  - `countdown_ends_at`: nullable ISO date
  - `hotline`: nullable phone string `<= 30` (`^[0-9+ ()-]{3,30}$`)
  - `button_label`: nullable string `<= 30`
  - `button_link`: Store Link Shape (`{ "type": "none | all_products | offers | category | product | url", "target_id": int|null, "url": string|null }`)
- `footer`:
  - `about`: nullable string `<= 500`
  - `show_pages`, `dark`, `payments`: required booleans
  - `phone`, `whatsapp`: nullable string `<= 30`
  - `email`: nullable email `<= 191`
  - `address`: nullable string `<= 200`
  - `social`: `{ "facebook": null|url, "instagram": null|url, "tiktok": null|url, "x": null|url, "youtube": null|url, "snapchat": null|url }`
- `general`:
  - `whatsapp_button`, `show_out_of_stock`, `floating_call`, `animations`: required booleans
  - `call_phone`: nullable phone string `<= 30`
  - `products_per_page`: required integer in `[12, 16, 24, 32, 48]`
- `product_card`: `{ "image": "square | wide | circle", "show_description": bool, "show_rating": bool, "button": "icon | full", "border_width": 0..6, "border_color": "#rrggbb"|null, "radius": 0..40, "shadow": bool }`
- `product_page`: `{ "gallery": "thumbs | slider", "zoom": bool, "description": bool, "reviews": bool, "whatsapp_ask": bool, "related_enabled": bool, "related": "category | similar", "sticky_bar": bool, "sticky_buttons": "cart | both | buy", "viewers": { "enabled": bool, "min": int, "max": int, "every": 3..300 } }`
- `listing`: `{ "columns_desktop": 2..5, "columns_mobile": 1..2, "banner": bool, "subcategories": "circles | chips", "filters": "open | button | hidden" }`
- `cart`: `{ "free_shipping_bar": bool, "suggestions_enabled": bool, "suggestions": "offers | latest", "kitchen_notes": bool }`

## 2. Section Types (`sections`)
Allowed icons for `food_hero`, `why`, `steps`: `["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone", "flame", "chef", "leaf", "utensils", "meat", "timer", "thermo", "bike", "soup", "sparkle"]`.
- **`food_hero`:** `kicker` (`<= 40`), `title` (required `<= 100`), `highlight` (`<= 40`), `subtitle` (`<= 300`), `media_id` (nullable), `stickers` (array `0..2` of strings `<= 30`), `badge` (`<= 20`), `primary_label` (required `<= 30`), `primary_link` (Store Link), `second_label` (`<= 30`), `second_link` (Store Link), `trust` (array `0..4` of `{ icon, text <= 40 }`).
- **`marquee`:** `items` (array `1..10` of strings `<= 60`), `speed` (`"slow" | "normal" | "fast"`).
- **`categories`:** `title` (`<= 80`), `description` (`<= 200`), `category_ids` (array `<= 24` ints), `shape` (`"circle" | "square" | "card"`), `layout` (`"grid" | "slider"`), `columns_desktop` (`3..8`), `columns_mobile` (`2..4`).
- **`product_tabs`:** `title` (`<= 80`), `description` (`<= 200`), `limit` (`[4, 8, 12, 16, 24, 32]`), `tabs` (array `1..6` of `{ label <= 30, source: "latest | offers | category | manual", category_id: int|null, product_ids: int[] }`).
- **`bundles`:** `kicker` (`<= 40`), `title` (`<= 80`), `subtitle` (`<= 200`), `cards` (array `1..4` of `{ offer_id (required int), media_id (nullable), title <= 60, subtitle <= 80, points: string[] (<= 5), ribbon <= 24, button_label <= 30 }`).
- **`products`:** `title` (required `<= 80`), `description` (`<= 200`), `source` (`"latest" | "offers" | "category"`), `category_id` (int|null), `limit` (`[4, 8, 12, 16, 24, 32]`), `layout` (`"grid" | "slider"`), `columns` (`[2, 3, 4, 5]`), `show_view_all` (bool).
- **`why`:** `kicker` (`<= 40`), `title` (`<= 80`), `subtitle` (`<= 200`), `media_id` (nullable), `quote` (`<= 200`), `items` (array `2..6` of `{ icon, title <= 40, text <= 160 }`).
- **`steps`:** `kicker` (`<= 40`), `title` (`<= 80`), `items` (array `2..5` of `{ icon, title <= 40, text <= 160 }`).
- **`countdown`:** `media_id` (nullable), `kicker` (`<= 40`), `title` (required `<= 80`), `text` (`<= 200`), `button_label` (`<= 30`), `link`, `ends_at` (required ISO date), `on_end` (`"hide" | "ended"`).
- **`video`:** `url` (required YouTube/Vimeo https URL), `title` (`<= 80`), `text` (`<= 200`), `cover_media_id` (nullable).
- **`gallery`:** `title` (`<= 80`), `description` (`<= 200`), `items` (array `3..12` of `{ media_id (required), label <= 60, link }`).
- **`testimonials`:** `title` (`<= 80`), `source` (`"auto" | "manual"`), `items` (array `0..12` of `{ name <= 60, rating 1..5, text <= 400 }`).
- **`hours`:** `title` (`<= 80`), `subtitle` (`<= 200`), `days` (array of exactly 7 objects `{ open: bool, from: "HH:MM", to: "HH:MM" }`), `open_message` (required `<= 160`), `closed_message` (required `<= 160`).
- **`faq`:** `title` (`<= 80`), `text` (`<= 300`), `whatsapp_button` (bool), `items` (array `1..20` of `{ question <= 160, answer <= 1000 }`).
- **`location`:** `title` (`<= 80`), `description` (`<= 200`), `branches` (array `1..6` of `{ name <= 60, address <= 200, hours <= 60, phone <= 30, map_url (required Google Maps URL) }`).
- **`ai`:** `ai_section_id` (required int), `values` (`{}`).

## 3. Full `defaults()` Example
```json
{
    "settings": {
        "colors": {
            "primary": "#e4572e",
            "secondary": "#f2b33d",
            "background": "#fffaf2",
            "text": "#1b120c",
            "dark": "#17110d"
        },
        "font": "cairo",
        "font_size": "medium",
        "logo_media_id": null,
        "favicon_media_id": null,
        "header": {
            "sticky": true,
            "search": true,
            "announcement": "التوصيل ببلاش لأول طلب من المتجر",
            "layout": "start",
            "countdown_ends_at": null,
            "hotline": null,
            "button_label": "اطلب دلوقتي",
            "button_link": {
                "type": "all_products",
                "target_id": null,
                "url": null
            },
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
            "show_description": true,
            "show_rating": true,
            "button": "icon",
            "border_width": 1,
            "border_color": null,
            "radius": 24,
            "shadow": false
        },
        "product_page": {
            "gallery": "thumbs",
            "zoom": true,
            "description": true,
            "reviews": true,
            "whatsapp_ask": true,
            "related_enabled": true,
            "related": "category",
            "sticky_bar": true,
            "sticky_buttons": "both",
            "viewers": {
                "enabled": false,
                "min": 300,
                "max": 600,
                "every": 15
            }
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
            "kitchen_notes": true
        }
    },
    "sections": [
        {
            "id": "sec001000001",
            "type": "food_hero",
            "visible": true,
            "props": {
                "kicker": "طازة كل يوم · بيوصلك سخن",
                "title": "أكل يشبّعك ويفتح نفسك",
                "highlight": "يشبّعك",
                "subtitle": "اختار من المنيو اللي نفسك فيه، بيتعمل ساعة الطلب ويوصلك سخن، والدفع عند الاستلام.",
                "media_id": null,
                "stickers": [
                    "طازة كل يوم",
                    "بيوصلك سخن"
                ],
                "badge": "عرض النهارده",
                "primary_label": "اطلب دلوقتي",
                "primary_link": {
                    "type": "all_products",
                    "target_id": null,
                    "url": null
                },
                "second_label": "شوف المنيو",
                "second_link": {
                    "type": "offers",
                    "target_id": null,
                    "url": null
                },
                "trust": [
                    {
                        "icon": "bike",
                        "text": "توصيل في نفس اليوم"
                    },
                    {
                        "icon": "cash",
                        "text": "ادفع لما يوصلك"
                    },
                    {
                        "icon": "thermo",
                        "text": "بيوصل سخن"
                    }
                ]
            }
        },
        {
            "id": "sec002000001",
            "type": "marquee",
            "visible": true,
            "props": {
                "items": [
                    "مكونات طازة",
                    "متعمل ساعة الطلب",
                    "الدفع عند الاستلام",
                    "توصيل سريع"
                ],
                "speed": "normal"
            }
        },
        {
            "id": "sec003000001",
            "type": "categories",
            "visible": true,
            "props": {
                "title": "المنيو",
                "description": null,
                "category_ids": [],
                "shape": "circle",
                "layout": "slider",
                "columns_desktop": 6,
                "columns_mobile": 3
            }
        },
        {
            "id": "sec004000001",
            "type": "product_tabs",
            "visible": true,
            "props": {
                "title": "اختار أكلتك",
                "description": null,
                "limit": 8,
                "tabs": [
                    {
                        "label": "الجديد",
                        "source": "latest",
                        "category_id": null,
                        "product_ids": []
                    },
                    {
                        "label": "العروض",
                        "source": "offers",
                        "category_id": null,
                        "product_ids": []
                    }
                ]
            }
        },
        {
            "id": "sec005000001",
            "type": "why",
            "visible": true,
            "props": {
                "kicker": "ليه إحنا؟",
                "title": "الطعم اللي بتحبه، من غير مشوار",
                "subtitle": null,
                "media_id": null,
                "quote": null,
                "items": [
                    {
                        "icon": "leaf",
                        "title": "مكونات طازة",
                        "text": "بنشتري كل يوم، مفيش مجمد."
                    },
                    {
                        "icon": "chef",
                        "title": "وصفة البيت",
                        "text": "نفس الطعم كل مرة."
                    },
                    {
                        "icon": "thermo",
                        "title": "بيوصل سخن",
                        "text": "علب حافظة للحرارة لحد باب البيت."
                    },
                    {
                        "icon": "shield",
                        "title": "مطبخ نضيف",
                        "text": "نضافة ومراجعة كل يوم."
                    }
                ]
            }
        },
        {
            "id": "sec006000001",
            "type": "steps",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "٣ خطوات وتبقى شابع",
                "items": [
                    {
                        "icon": "utensils",
                        "title": "اختار من المنيو",
                        "text": "ضيف اللي نفسك فيه للسلة."
                    },
                    {
                        "icon": "phone",
                        "title": "نكلمك نأكد",
                        "text": "نتصل نأكد الطلب ومعاد التوصيل."
                    },
                    {
                        "icon": "bike",
                        "title": "يوصلك سخن",
                        "text": "تستلم وتدفع للمندوب."
                    }
                ]
            }
        },
        {
            "id": "sec007000001",
            "type": "testimonials",
            "visible": true,
            "props": {
                "title": "كلام اللي جرّبوا",
                "source": "auto",
                "items": []
            }
        },
        {
            "id": "sec008000001",
            "type": "hours",
            "visible": true,
            "props": {
                "title": "مواعيد المطبخ",
                "subtitle": null,
                "days": [
                    {
                        "open": true,
                        "from": "12:00",
                        "to": "23:00"
                    },
                    {
                        "open": true,
                        "from": "12:00",
                        "to": "23:00"
                    },
                    {
                        "open": true,
                        "from": "12:00",
                        "to": "23:00"
                    },
                    {
                        "open": true,
                        "from": "12:00",
                        "to": "23:00"
                    },
                    {
                        "open": true,
                        "from": "12:00",
                        "to": "23:00"
                    },
                    {
                        "open": true,
                        "from": "12:00",
                        "to": "23:00"
                    },
                    {
                        "open": true,
                        "from": "12:00",
                        "to": "23:00"
                    }
                ],
                "open_message": "المطبخ شغال دلوقتي وجاهز يستقبل طلبك.",
                "closed_message": "المطبخ مقفول دلوقتي، وأي طلب هيوصلك أول ما نفتح."
            }
        },
        {
            "id": "sec009000001",
            "type": "faq",
            "visible": true,
            "props": {
                "title": "عندك سؤال؟",
                "text": null,
                "whatsapp_button": true,
                "items": [
                    {
                        "question": "الطلب بيوصل في قد إيه؟",
                        "answer": "بنأكد طلبك بمكالمة ونحدد معاد التوصيل معاك."
                    },
                    {
                        "question": "الدفع بيبقى إزاي؟",
                        "answer": "كاش عند استلام الطلب."
                    }
                ]
            }
        }
    ]
}
```

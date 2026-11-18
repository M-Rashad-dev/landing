# Theme Document: `shabe_landing` («شابع» — Food & Restaurant Landing Theme)

- **Kind:** `landing`
- **Theme Key:** `shabe_landing`
- **`MAX_SECTIONS`:** `20`
- **Built-in Section Types (`SECTION_TYPES`):** `hero`, `marquee`, `menu`, `why`, `steps`, `bundles`, `gallery`, `video`, `compare`, `testimonials`, `urgency`, `order_form`, `guarantee`, `faq` (plus `ai` for approved custom AI sections)
- **Mandatory Rule:** Every landing page **must contain exactly one `order_form` section** with `"visible": true`.
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`

## 1. Settings (`settings`)
- `colors`: `{ "primary": "#rrggbb", "secondary": "#rrggbb", "background": "#rrggbb", "text": "#rrggbb", "dark": "#rrggbb" }`
- `font`: required string in `["cairo", "tajawal", "almarai", "ibm_plex_arabic", "noto_kufi", "readex_pro"]`
- `font_size`: required string in `["small", "medium", "large"]`
- `button`: required string in `["rounded", "pill", "square"]`
- `display_font`: required boolean
- `logo_media_id`: nullable integer
- `header`:
  - `show`: required boolean
  - `announcement`: nullable string `<= 200`
  - `countdown_ends_at`: nullable ISO date
  - `phone`: nullable string `<= 30`
  - `button_label`: nullable string `<= 40`
- `footer`:
  - `text`: nullable string `<= 300`
  - `phone`, `whatsapp`: nullable string `<= 30`
  - `social`: `{ "facebook": null|url, "instagram": null|url, "tiktok": null|url, "x": null|url, "youtube": null|url, "snapchat": null|url }`
- `general`:
  - `sticky_order_button`: required boolean
  - `whatsapp_button`: required boolean

## 2. Section Types (`sections`)
Allowed icons: `["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone", "flame", "chef", "leaf", "utensils", "meat", "timer", "thermo", "bike", "soup", "sparkle"]`.
- **`hero`:** `kicker` (`<= 60`), `title` (required `<= 120`), `highlight` (`<= 60`), `subtitle` (`<= 300`), `image_media_id` (nullable), `stickers` (array `0..2` of strings `<= 30`), `badge` (`<= 24`), `show_price` (bool), `show_rating` (bool), `button_label` (required `<= 40`), `second_label` (`<= 40`), `trust` (array `0..3` of `{ icon, text <= 40 }`).
- **`marquee`:** `items` (array `1..10` of strings `<= 40`).
- **`menu`:** `kicker` (`<= 60`), `title` (`<= 80`), `subtitle` (`<= 200`), `items` (array `1..8` of `{ image_media_id (nullable), title <= 40, text <= 120, tag <= 24 }`), `extras` (array `0..12` of strings `<= 40`).
- **`why`:** `kicker` (`<= 60`), `title` (`<= 80`), `subtitle` (`<= 200`), `image_media_id` (nullable), `quote` (`<= 160`), `items` (array `2..6` of `{ icon, title <= 40, text <= 120 }`).
- **`steps`:** `kicker` (`<= 60`), `title` (`<= 80`), `items` (array `2..4` of `{ icon, title <= 40, text <= 160 }`).
- **`bundles`:** `kicker` (`<= 60`), `title` (`<= 80`), `subtitle` (`<= 200`), `cards` (array `0..4` of `{ offer_id (nullable int), image_media_id (nullable), title <= 40, subtitle <= 60, points: string[] (<= 5), ribbon <= 24 }`).
- **`gallery`:** `title` (`<= 80`), `image_media_ids` (array `0..12` of ints).
- **`video`:** `title` (`<= 80`), `subtitle` (`<= 200`), `url` (required YouTube/Vimeo https URL), `cover_media_id` (nullable), `caption` (`<= 60`).
- **`compare`:** `title` (`<= 80`), `us` (required `<= 30`), `them` (required `<= 30`), `rows` (array `2..8` of `{ label <= 50, us <= 50, them <= 50 }`).
- **`testimonials`:** `kicker` (`<= 60`), `title` (`<= 80`), `source` (`"auto" | "manual"`), `items` (array `0..12` of `{ name <= 60, place <= 40, rating 1..5, text <= 400, image_media_id (nullable) }`), `show_score` (bool).
- **`urgency`:** `title` (required `<= 80`), `text` (`<= 160`), `ends_at` (nullable ISO date), `show_stock` (bool).
- **`order_form` (Required: exactly 1, `visible: true`):** `kicker` (`<= 60`), `title` (required `<= 80`), `subtitle` (`<= 200`), `button_label` (required `<= 40`), `fields` (required object for `name`, `phone`, `phone2`, `email`, `governorate`, `city`, `address`, `notes`), `offer_picker` (bool), `show_quantity` (bool), `points` (array `0..5` of strings `<= 60`), `image_media_id` (nullable).
- **`guarantee`:** `icon` (required icon), `title` (required `<= 80`), `text` (`<= 300`).
- **`faq`:** `title` (`<= 80`), `items` (array `1..12` of `{ question <= 150, answer <= 600 }`).
- **`ai`:** `ai_section_id` (required int), `values` (`{}`).

## 3. Full `defaults()` Example
```json
{
    "version": 1,
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
        "button": "rounded",
        "display_font": true,
        "logo_media_id": null,
        "header": {
            "show": true,
            "announcement": "عرض الافتتاح: التوصيل ببلاش لأول طلب",
            "countdown_ends_at": null,
            "phone": null,
            "button_label": "اطلب دلوقتي"
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
            "whatsapp_button": false
        }
    },
    "sections": [
        {
            "id": "sec001000001",
            "type": "hero",
            "visible": true,
            "props": {
                "kicker": "طازة كل يوم · بيوصلك سخن",
                "title": "أكلة شابع",
                "highlight": null,
                "subtitle": "أكل بيتي متعمل ساعة الطلب، بيوصلك سخن لحد باب البيت، والدفع عند الاستلام.",
                "image_media_id": null,
                "stickers": [
                    "طازة كل يوم",
                    "بيوصلك سخن"
                ],
                "badge": "النهارده بس",
                "show_price": true,
                "show_rating": true,
                "button_label": "اطلب دلوقتي",
                "second_label": "شوف اللي فيها",
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
                ]
            }
        },
        {
            "id": "sec003000001",
            "type": "menu",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "إيه اللي جوه؟",
                "subtitle": "كل صنف بوزنه، ومفيش حاجة مستخبية",
                "items": [
                    {
                        "image_media_id": null,
                        "title": "الطبق الرئيسي",
                        "text": "اكتب وصف الصنف هنا",
                        "tag": "½ كيلو"
                    },
                    {
                        "image_media_id": null,
                        "title": "صنف تاني",
                        "text": "اكتب وصف الصنف هنا",
                        "tag": "½ كيلو"
                    },
                    {
                        "image_media_id": null,
                        "title": "الأرز",
                        "text": "اكتب وصف الصنف هنا",
                        "tag": null
                    },
                    {
                        "image_media_id": null,
                        "title": "السلطات",
                        "text": "اكتب وصف الصنف هنا",
                        "tag": null
                    }
                ],
                "extras": [
                    "عيش",
                    "سلطة خضرا",
                    "صوصات"
                ]
            }
        },
        {
            "id": "sec004000001",
            "type": "why",
            "visible": true,
            "props": {
                "kicker": "ليه إحنا؟",
                "title": "الطعم اللي بتحبه، من غير مشوار",
                "subtitle": null,
                "image_media_id": null,
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
            "id": "sec005000001",
            "type": "steps",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "٣ خطوات وتبقى شابع",
                "items": [
                    {
                        "icon": "package",
                        "title": "اطلب من الفورم",
                        "text": "اختار واكتب عنوانك، من غير تسجيل ولا دفع أونلاين."
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
            "id": "sec006000001",
            "type": "bundles",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "اختار اللي على قد لمّتك",
                "subtitle": null,
                "cards": []
            }
        },
        {
            "id": "sec007000001",
            "type": "gallery",
            "visible": true,
            "props": {
                "title": "من المطبخ لسفرتك",
                "image_media_ids": []
            }
        },
        {
            "id": "sec008000001",
            "type": "testimonials",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "كلام اللي جرّبوا",
                "source": "auto",
                "items": [],
                "show_score": true
            }
        },
        {
            "id": "sec009000001",
            "type": "order_form",
            "visible": true,
            "props": {
                "kicker": "من غير دفع أونلاين",
                "title": "اطلب دلوقتي",
                "subtitle": "اكتب بياناتك وهنكلمك نأكد الطلب.",
                "button_label": "أكّد الطلب",
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
                    "متعمل ساعة الطلب",
                    "بيوصل سخن",
                    "الدفع عند الاستلام"
                ],
                "image_media_id": null
            }
        },
        {
            "id": "sec010000001",
            "type": "guarantee",
            "visible": true,
            "props": {
                "icon": "shield",
                "title": "لو مش عاجبك، حقك محفوظ",
                "text": "لو الطلب وصل بارد أو فيه حاجة مش مظبوطة، كلمنا في نفس اليوم ونعوّضك."
            }
        },
        {
            "id": "sec011000001",
            "type": "faq",
            "visible": true,
            "props": {
                "title": "عندك سؤال؟",
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

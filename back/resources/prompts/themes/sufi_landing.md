# Theme Document: `sufi_landing` («صوفي» — Luxury Landing Page Theme)

- **Kind:** `landing`
- **Theme Key:** `sufi_landing`
- **`MAX_SECTIONS`:** `20`
- **Built-in Section Types (`SECTION_TYPES`):** `hero`, `marquee`, `features`, `details`, `specs`, `gallery`, `video`, `bundles`, `stats`, `testimonials`, `countdown`, `order_form`, `promises`, `faq` (plus `ai` for approved custom AI sections)
- **Mandatory Rule:** Every landing page **must contain exactly one `order_form` section** with `"visible": true`.
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`

## 1. Settings (`settings`)
- `colors` & `colors_dark`: each `{ "primary": "#rrggbb", "secondary": "#rrggbb", "background": "#rrggbb", "text": "#rrggbb" }`
- `appearance`: `{ "default": "light | dark | system", "toggle": bool }`
- `font`: required string in `["cairo", "tajawal", "almarai", "ibm_plex_arabic", "noto_kufi", "readex_pro"]`
- `font_size`: required string in `["small", "medium", "large"]`
- `button`: required string in `["rounded", "pill", "square"]`
- `display_font`: required boolean
- `logo_media_id`, `logo_dark_media_id`: nullable integer
- `header`:
  - `show`: required boolean
  - `announcement`: nullable string `<= 200`
  - `button_label`: nullable string `<= 40`
- `footer`:
  - `text`: nullable string `<= 300`
  - `phone`, `whatsapp`: nullable string `<= 30`
  - `social`: `{ "facebook": null|url, "instagram": null|url, "tiktok": null|url, "x": null|url, "youtube": null|url, "snapchat": null|url }`
- `general`:
  - `sticky_order_button`, `whatsapp_button`, `animations`: required booleans

## 2. Section Types (`sections`)
Allowed icons: `["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone", "gem", "crown", "award", "feather", "droplet", "sparkle", "ruler", "layers", "leaf", "palette", "watch", "badge"]`.
- **`hero`:** `layout` (`"split" | "cover"`), `kicker` (`<= 60`), `title` (required `<= 120`), `highlight` (`<= 60`), `subtitle` (`<= 300`), `image_media_id` (nullable), `show_price` (bool), `show_rating` (bool), `button_label` (required `<= 40`), `second_label` (`<= 40`), `badges` (array `0..3` of strings `<= 30`).
- **`marquee`:** `items` (array `1..10` of strings `<= 40`).
- **`features`:** `kicker` (`<= 60`), `title` (`<= 80`), `subtitle` (`<= 200`), `items` (array `2..6` of `{ icon, title <= 40, text <= 160 }`).
- **`details`:** `kicker` (`<= 60`), `title` (`<= 80`), `rows` (array `1..4` of `{ image_media_id (nullable), title <= 60, text <= 400, points: string[] (<= 5, each <= 60) }`).
- **`specs`:** `kicker` (`<= 60`), `title` (`<= 80`), `image_media_id` (nullable), `rows` (array `2..12` of `{ label <= 40, value <= 80 }`), `note` (`<= 160`).
- **`gallery`:** `kicker` (`<= 60`), `title` (`<= 80`), `image_media_ids` (array `0..12` of ints).
- **`video`:** `title` (`<= 80`), `subtitle` (`<= 200`), `url` (required YouTube/Vimeo https URL), `cover_media_id` (nullable).
- **`bundles`:** `kicker` (`<= 60`), `title` (`<= 80`), `subtitle` (`<= 200`), `cards` (array `0..4` of `{ offer_id (nullable int), image_media_id (nullable), title <= 40, subtitle <= 60, points: string[] (<= 5), ribbon <= 24 }`).
- **`stats`:** `kicker` (`<= 60`), `title` (`<= 80`), `items` (array `2..4` of `{ value <= 16, label <= 40 }`).
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
            "primary": "#b9844f",
            "secondary": "#17181c",
            "background": "#faf8f4",
            "text": "#17181c"
        },
        "colors_dark": {
            "primary": "#d49a60",
            "secondary": "#f2f0ec",
            "background": "#111215",
            "text": "#f2f0ec"
        },
        "appearance": {
            "default": "light",
            "toggle": true
        },
        "font": "almarai",
        "font_size": "medium",
        "button": "pill",
        "display_font": true,
        "logo_media_id": null,
        "logo_dark_media_id": null,
        "header": {
            "show": true,
            "announcement": "شحن ببلاش لكل المحافظات لفترة محدودة",
            "button_label": "اطلبه دلوقتي"
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
            "id": "sec001000001",
            "type": "hero",
            "visible": true,
            "props": {
                "layout": "split",
                "kicker": "إصدار محدود",
                "title": "منتج يستاهل",
                "highlight": null,
                "subtitle": "تفاصيل مدروسة وخامة تحسّ بفرقها من أول لمسة. اطلبه دلوقتي وادفع لما يوصلك.",
                "image_media_id": null,
                "show_price": true,
                "show_rating": true,
                "button_label": "اطلبه دلوقتي",
                "second_label": "اعرف التفاصيل",
                "badges": [
                    "أصلي 100%",
                    "ضمان سنة",
                    "الدفع عند الاستلام"
                ]
            }
        },
        {
            "id": "sec002000001",
            "type": "marquee",
            "visible": true,
            "props": {
                "items": [
                    "خامة أصلية",
                    "تغليف فاخر",
                    "شحن لكل المحافظات",
                    "استبدال خلال 14 يوم"
                ]
            }
        },
        {
            "id": "sec003000001",
            "type": "features",
            "visible": true,
            "props": {
                "kicker": "ليه هتحبه",
                "title": "الفرق في التفاصيل",
                "subtitle": null,
                "items": [
                    {
                        "icon": "gem",
                        "title": "خامة فاخرة",
                        "text": "اكتب هنا إيه اللي يميّز خامة منتجك."
                    },
                    {
                        "icon": "feather",
                        "title": "مريح وخفيف",
                        "text": "اكتب هنا إحساس العميل وهو بيستخدمه."
                    },
                    {
                        "icon": "award",
                        "title": "صناعة متقنة",
                        "text": "اكتب هنا عن التصنيع والجودة."
                    },
                    {
                        "icon": "gift",
                        "title": "تغليف هدية",
                        "text": "بيوصلك في علبة أنيقة جاهزة تتهادى."
                    }
                ]
            }
        },
        {
            "id": "sec004000001",
            "type": "details",
            "visible": true,
            "props": {
                "kicker": "عن قرب",
                "title": "اتعمل عشان يعيش معاك",
                "rows": [
                    {
                        "image_media_id": null,
                        "title": "الخامة",
                        "text": "احكي هنا عن الخامة ومصدرها وليه اخترتها.",
                        "points": [
                            "خامة أصلية",
                            "لمسة نهائية يدوي"
                        ]
                    },
                    {
                        "image_media_id": null,
                        "title": "التصميم",
                        "text": "احكي هنا عن التصميم والتفاصيل اللي العميل مش هيلاقيها في مكان تاني.",
                        "points": [
                            "تصميم خاص بينا"
                        ]
                    }
                ]
            }
        },
        {
            "id": "sec005000001",
            "type": "specs",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "المواصفات",
                "image_media_id": null,
                "rows": [
                    {
                        "label": "الخامة",
                        "value": "اكتب الخامة"
                    },
                    {
                        "label": "المقاس",
                        "value": "اكتب المقاس"
                    },
                    {
                        "label": "اللون",
                        "value": "اكتب الألوان المتاحة"
                    },
                    {
                        "label": "الضمان",
                        "value": "سنة"
                    }
                ],
                "note": null
            }
        },
        {
            "id": "sec006000001",
            "type": "gallery",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "من كل زاوية",
                "image_media_ids": []
            }
        },
        {
            "id": "sec007000001",
            "type": "bundles",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "اختار العرض اللي يناسبك",
                "subtitle": null,
                "cards": []
            }
        },
        {
            "id": "sec008000001",
            "type": "testimonials",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "اللي جرّبوه بيقولوا",
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
                "kicker": "الدفع عند الاستلام",
                "title": "اطلبه دلوقتي",
                "subtitle": "اكتب بياناتك وهنكلمك نأكد الطلب قبل الشحن.",
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
                    "أصلي 100%",
                    "تغليف فاخر",
                    "استبدال خلال 14 يوم"
                ],
                "image_media_id": null
            }
        },
        {
            "id": "sec010000001",
            "type": "promises",
            "visible": true,
            "props": {
                "items": [
                    {
                        "icon": "truck",
                        "title": "شحن لكل المحافظات",
                        "text": "بيوصلك من يومين لـ 4 أيام."
                    },
                    {
                        "icon": "cash",
                        "title": "الدفع عند الاستلام",
                        "text": "تشوفه الأول وبعدين تدفع."
                    },
                    {
                        "icon": "return",
                        "title": "استبدال سهل",
                        "text": "خلال 14 يوم طالما بحالته."
                    }
                ]
            }
        },
        {
            "id": "sec011000001",
            "type": "faq",
            "visible": true,
            "props": {
                "kicker": null,
                "title": "أسئلة بتتسأل كتير",
                "items": [
                    {
                        "question": "المنتج أصلي؟",
                        "answer": "أيوه، أصلي 100% وبضمان."
                    },
                    {
                        "question": "الشحن بياخد قد إيه؟",
                        "answer": "من يومين لـ 4 أيام عمل حسب المحافظة."
                    },
                    {
                        "question": "الدفع بيبقى إزاي؟",
                        "answer": "كاش عند الاستلام، بعد ما تشوف المنتج."
                    }
                ]
            }
        }
    ]
}
```

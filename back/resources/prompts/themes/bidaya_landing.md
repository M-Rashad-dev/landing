# Theme Document: `bidaya_landing` («بداية» — Landing Page Theme)

- **Kind:** `landing`
- **Theme Key:** `bidaya_landing`
- **`MAX_SECTIONS`:** `12`
- **Built-in Section Types (`SECTION_TYPES`):** `hero`, `features`, `gallery`, `testimonials`, `faq`, `order_form` (plus `ai` for approved custom AI sections)
- **Mandatory Rule:** Every landing page **must contain exactly one `order_form` section** with `"visible": true`.
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`

## 1. Settings (`settings`)
- `colors`:
  - `primary`: required `#rrggbb` hex color
  - `secondary`: required `#rrggbb` hex color
  - `background`: required `#rrggbb` hex color
  - `text`: required `#rrggbb` hex color
- `font`: required string in `["cairo", "tajawal", "almarai", "ibm_plex_arabic", "noto_kufi", "readex_pro"]`
- `font_size`: required string in `["small", "medium", "large"]`
- `button`: required string in `["rounded", "pill", "square"]`
- `logo_media_id`: nullable integer (tenant media ID, `"upload:N"`, `"image:ID"`, or `"keep"`)
- `header`:
  - `show`: required boolean
  - `announcement`: nullable string `<= 200` chars
- `footer`:
  - `text`: nullable string `<= 300` chars
  - `phone`: nullable string `<= 30` chars
  - `whatsapp`: nullable string `<= 30` chars
  - `social`: object with keys `facebook`, `instagram`, `tiktok`, `x`, `youtube`, `snapchat`, each nullable safe URL `<= 300` chars
- `general`:
  - `sticky_order_button`: required boolean
  - `whatsapp_button`: required boolean

## 2. Section Types (`sections`)
Every section object has:
- `id`: required unique string (`^[A-Za-z0-9_-]{6,40}$`, e.g. `"sec001000001"`)
- `type`: required string in `["hero", "features", "gallery", "testimonials", "faq", "order_form", "ai"]`
- `visible`: required boolean (`order_form` must have `visible: true`)
- `props`: required object matching the section `type`:

### `hero`
- `title`: required string `<= 120`
- `subtitle`: nullable string `<= 300`
- `image_media_id`: nullable integer (tenant media ID, `"upload:N"`, `"image:ID"`, or `"keep"`)
- `show_price`: required boolean
- `button_label`: required string `<= 40`
- `badge`: nullable string `<= 40`

### `features`
- `title`: nullable string `<= 80`
- `items`: required array (`min: 2`, `max: 6`). Each item:
  - `icon`: required string in `["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone"]`
  - `title`: required string `<= 40`
  - `text`: nullable string `<= 120`

### `gallery`
- `title`: nullable string `<= 80`
- `image_media_ids`: present array of integers (`max: 12`)

### `testimonials`
- `title`: nullable string `<= 80`
- `source`: required string in `["auto", "manual"]`
- `items`: present array (`min: 1` when `manual`, `max: 12`). Each item:
  - `name`: required string `<= 60`
  - `rating`: required integer `1..5`
  - `text`: required string `<= 400`

### `faq`
- `title`: nullable string `<= 80`
- `items`: required array (`min: 1`, `max: 12`). Each item:
  - `question`: required string `<= 150`
  - `answer`: required string `<= 600`

### `order_form` (Required: exactly 1, `visible: true`)
- `title`: required string `<= 80`
- `subtitle`: nullable string `<= 200`
- `button_label`: required string `<= 40`
- `offer_picker`: required boolean
- `show_quantity`: required boolean
- `fields`: required object with keys `name`, `phone`, `phone2`, `email`, `governorate`, `city`, `address`, `notes`, each `{ "enabled": bool, "required": bool }` (`name` and `phone` are locked on)

### `ai` (Custom AI Section)
- `ai_section_id`: required integer (approved `AiSection` ID for `bidaya_landing`)
- `values`: present object `{}`

## 3. Full `defaults()` Example
```json
{
    "version": 1,
    "settings": {
        "colors": {
            "primary": "#0b875b",
            "secondary": "#ffc83d",
            "background": "#ffffff",
            "text": "#13261d"
        },
        "font": "cairo",
        "font_size": "medium",
        "button": "rounded",
        "logo_media_id": null,
        "header": {
            "show": true,
            "announcement": null
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
                "title": "عنوان المنتج أو العرض الرئيسي",
                "subtitle": "اكتب هنا سطرين يوضحوا أهم ميزة في المنتج وليه العميل يطلبه دلوقتي.",
                "image_media_id": null,
                "show_price": true,
                "button_label": "اطلب الآن",
                "badge": null
            }
        },
        {
            "id": "sec002000001",
            "type": "features",
            "visible": true,
            "props": {
                "title": "ليه تطلب مننا؟",
                "items": [
                    {
                        "icon": "truck",
                        "title": "شحن سريع",
                        "text": "توصيل لحد باب البيت في كل المحافظات."
                    },
                    {
                        "icon": "cash",
                        "title": "الدفع عند الاستلام",
                        "text": "عاين طلبك الأول وادفع لما يوصلك."
                    },
                    {
                        "icon": "return",
                        "title": "استبدال واسترجاع",
                        "text": "ضمان استبدال أو استرجاع خلال ١٤ يوم."
                    }
                ]
            }
        },
        {
            "id": "sec003000001",
            "type": "gallery",
            "visible": true,
            "props": {
                "title": "صور المنتج",
                "image_media_ids": []
            }
        },
        {
            "id": "sec004000001",
            "type": "testimonials",
            "visible": true,
            "props": {
                "title": "آراء العملاء",
                "source": "auto",
                "items": []
            }
        },
        {
            "id": "sec005000001",
            "type": "faq",
            "visible": true,
            "props": {
                "title": "الأسئلة الشائعة",
                "items": [
                    {
                        "question": "الشحن بياخد كام يوم؟",
                        "answer": "من يومين لـ ٤ أيام عمل حسب محافظتك."
                    },
                    {
                        "question": "إزاي أدفع؟",
                        "answer": "الدفع كاش للمندوب عند استلام الطلب."
                    }
                ]
            }
        },
        {
            "id": "sec006000001",
            "type": "order_form",
            "visible": true,
            "props": {
                "title": "سجّل طلبك الآن",
                "subtitle": "املا بياناتك وهنتواصل معاك لتأكيد الطلب والشحن.",
                "button_label": "تأكيد الطلب",
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
                "show_quantity": true
            }
        }
    ]
}
```


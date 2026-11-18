# Theme Document: `sufi_store` («صوفي» — Luxury Store Theme)

- **Kind:** `store`
- **Theme Key:** `sufi_store`
- **`MAX_SECTIONS`:** `30`
- **Built-in Section Types (`SECTION_TYPES`):** `hero`, `marquee`, `categories`, `product_tabs`, `banners`, `countdown`, `featured_product`, `products`, `video`, `brands`, `story`, `features`, `testimonials`, `gallery`, `faq`, `location` (plus `ai` for approved custom AI sections)
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`

## 1. Settings (`settings`)
- `colors` & `colors_dark`: each `{ "primary": "#rrggbb", "secondary": "#rrggbb", "background": "#rrggbb", "text": "#rrggbb" }`
- `appearance`: `{ "default": "light | dark | system", "toggle": bool }`
- `font`: required string in `["cairo", "tajawal", "almarai", "ibm_plex_arabic", "noto_kufi", "readex_pro"]`
- `font_size`: required string in `["small", "medium", "large"]`
- `logo_media_id` & `logo_dark_media_id`: nullable integer (tenant media ID, `"upload:N"`, `"image:ID"`, or `"keep"`)
- `favicon_media_id`: nullable integer
- `header`:
  - `sticky`: required boolean
  - `search`: required boolean
  - `announcement`: nullable string `<= 200`
  - `layout`: required string in `["center", "start", "end"]`
  - `topbar`: required boolean
  - `height`: string in `["sm", "md", "lg"]`
  - `logo_size`: string in `["sm", "md", "lg"]`
- `footer`:
  - `about`: nullable string `<= 500`
  - `show_pages`: required boolean
  - `phone`, `whatsapp`: nullable string `<= 30`
  - `email`: nullable email `<= 191`
  - `address`: nullable string `<= 200`
  - `logo`: boolean
  - `logo_size`: string in `["sm", "md", "lg"]`
  - `social`: `{ "facebook": null|url, "instagram": null|url, "tiktok": null|url, "x": null|url, "youtube": null|url, "snapchat": null|url }`
- `general`:
  - `whatsapp_button`: required boolean
  - `show_out_of_stock`: required boolean
  - `products_per_page`: required integer in `[12, 16, 24, 32, 48]`
  - `floating_call`: required boolean
  - `call_phone`, `whatsapp_number`: nullable phone string `<= 30` (`^[0-9+ ()-]{6,30}$`)
  - `animations`: required boolean
  - `offers_tab`: `{ "enabled": bool, "label": string|null (<= 30, required when enabled), "link": { "type": "none | all_products | offers | category | product | url", "target_id": int|null, "url": string|null } }`

## 2. Section Types (`sections`)
Each section has `{ "id": "sec...", "type": "...", "visible": true, "props": { ... } }`:
- **`hero`:** `slides` (array max 8 of `{ media_id, title <= 80, text <= 200, button_label <= 30, link }`), `autoplay` (bool), `height` (`"full" | "large" | "medium"`), `merge_header` (bool), `shade` (int `0..80`), `kicker` (nullable `<= 40`).
- **`marquee`:** `items` (array `1..10` of strings `<= 60`), `speed` (`"slow" | "normal" | "fast"`).
- **`categories`:** `title` (`<= 80`), `description` (`<= 200`), `category_ids` (array `<= 24` ints), `shape` (`"circle" | "square" | "card"`), `layout` (`"grid" | "slider"`), `columns_desktop` (`3..8`), `columns_mobile` (`2..4`).
- **`product_tabs`:** `title` (`<= 80`), `description` (`<= 200`), `limit` (`[4, 8, 12, 16, 24, 32]`), `tabs` (array `1..6` of `{ label <= 30, source: "latest | offers | category | manual", category_id: int|null, product_ids: int[] }`).
- **`banners`:** `items` (array `1..3` of `{ media_id (required), kicker <= 40, title <= 80, button_label <= 30, link }`).
- **`countdown`:** `media_id` (nullable), `kicker` (`<= 40`), `title` (required `<= 80`), `text` (`<= 200`), `button_label` (`<= 30`), `link`, `ends_at` (required ISO date), `on_end` (`"hide" | "ended"`).
- **`featured_product`:** `product_id` (required int), `kicker` (`<= 40`).
- **`products`:** `title` (required `<= 80`), `description` (`<= 200`), `source` (`"latest" | "offers" | "category"`), `category_id` (int|null), `limit` (`[4, 8, 12, 16, 24, 32]`), `layout` (`"grid" | "slider"`), `columns` (`[2, 3, 4, 5]`), `show_view_all` (bool).
- **`video`:** `url` (required YouTube/Vimeo https URL `<= 300`), `title` (`<= 80`), `text` (`<= 200`), `cover_media_id` (nullable).
- **`brands`:** `title` (`<= 80`), `items` (array `2..16` of `{ media_id (required), name <= 40, link }`).
- **`story`:** `kicker` (`<= 40`), `title` (required `<= 80`), `text` (`<= 800`), `media_id` (required), `media2_id` (nullable), `stats` (array `0..3` of `{ value <= 12, label <= 30 }`), `button_label` (`<= 30`), `link`.
- **`features`:** `title` (`<= 80`), `items` (array `2..4` of `{ icon in ["truck","cash","return","shield","support","gift","star","clock","tag","heart","package","phone"], title <= 40, text <= 120 }`).
- **`testimonials`:** `title` (`<= 80`), `source` (`"auto" | "manual"`), `items` (array `0..12` of `{ name <= 60, rating 1..5, text <= 400 }`), `layout` (`"slider" | "list"`).
- **`gallery`:** `title` (`<= 80`), `description` (`<= 200`), `items` (array `3..12` of `{ media_id (required), label <= 60, link }`).
- **`faq`:** `title` (`<= 80`), `text` (`<= 300`), `whatsapp_button` (bool), `items` (array `1..20` of `{ question <= 160, answer <= 1000 }`).
- **`location`:** `title` (`<= 80`), `description` (`<= 200`), `branches` (array `1..6` of `{ name <= 60, address <= 200, hours <= 60, phone <= 30, map_url (required Google Maps URL) }`).
- **`ai`:** `ai_section_id` (required int), `values` (`{}`).

## 3. Full `defaults()` Example
```json
{
    "settings": {
        "colors": {
            "primary": "#b9844f",
            "secondary": "#17181c",
            "background": "#faf8f4",
            "text": "#17181c"
        },
        "font": "almarai",
        "font_size": "medium",
        "logo_media_id": null,
        "favicon_media_id": null,
        "header": {
            "sticky": true,
            "search": true,
            "announcement": null,
            "layout": "center",
            "topbar": true,
            "height": "md",
            "logo_size": "md"
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
            "logo": true,
            "logo_size": "md"
        },
        "general": {
            "whatsapp_button": true,
            "show_out_of_stock": true,
            "products_per_page": 24,
            "floating_call": false,
            "call_phone": null,
            "whatsapp_number": null,
            "animations": true,
            "offers_tab": {
                "enabled": false,
                "label": null,
                "link": {
                    "type": "offers",
                    "target_id": null,
                    "url": null
                }
            }
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
        "logo_dark_media_id": null
    },
    "sections": [
        {
            "id": "sec001000001",
            "type": "hero",
            "visible": true,
            "props": {
                "slides": [],
                "autoplay": true,
                "height": "full",
                "merge_header": true,
                "shade": 40,
                "kicker": null
            }
        },
        {
            "id": "sec002000001",
            "type": "marquee",
            "visible": true,
            "props": {
                "items": [
                    "شحن لكل المحافظات",
                    "الدفع عند الاستلام",
                    "استبدال خلال 14 يوم",
                    "منتجات أصلية 100%"
                ],
                "speed": "normal"
            }
        },
        {
            "id": "sec003000001",
            "type": "categories",
            "visible": true,
            "props": {
                "title": "تسوّق حسب القسم",
                "description": null,
                "category_ids": [],
                "shape": "circle",
                "layout": "grid",
                "columns_desktop": 6,
                "columns_mobile": 3
            }
        },
        {
            "id": "sec004000001",
            "type": "product_tabs",
            "visible": true,
            "props": {
                "title": "اختياراتنا ليك",
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
            "id": "sec005000001",
            "type": "features",
            "visible": true,
            "props": {
                "title": null,
                "items": [
                    {
                        "icon": "truck",
                        "title": "شحن لكل المحافظات",
                        "text": "بنوصل طلبك لحد باب البيت."
                    },
                    {
                        "icon": "cash",
                        "title": "الدفع عند الاستلام",
                        "text": "ادفع لما طلبك يوصلك."
                    },
                    {
                        "icon": "return",
                        "title": "استرجاع سهل",
                        "text": "لو المنتج مش مناسب نرجعه بسهولة."
                    }
                ]
            }
        },
        {
            "id": "sec006000001",
            "type": "testimonials",
            "visible": true,
            "props": {
                "title": "آراء عملائنا",
                "source": "auto",
                "items": [],
                "layout": "slider"
            }
        },
        {
            "id": "sec007000001",
            "type": "faq",
            "visible": true,
            "props": {
                "title": "عندك سؤال؟",
                "text": null,
                "whatsapp_button": true,
                "items": [
                    {
                        "question": "الشحن بياخد قد إيه؟",
                        "answer": "من يومين لـ 4 أيام عمل حسب المحافظة، وهيوصلك رقم الشحنة أول ما الطلب يخرج."
                    },
                    {
                        "question": "أقدر أستبدل أو أرجّع المنتج؟",
                        "answer": "أيوه، خلال 14 يوم من الاستلام طالما المنتج بحالته."
                    },
                    {
                        "question": "الدفع بيبقى إزاي؟",
                        "answer": "تقدر تدفع عند الاستلام، أو بالطرق المتاحة في صفحة الدفع."
                    }
                ]
            }
        }
    ]
}
```

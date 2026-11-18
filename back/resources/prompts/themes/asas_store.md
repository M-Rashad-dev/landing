# Theme Document: `asas_store` («أساس» — Store Theme)

- **Kind:** `store`
- **Theme Key:** `asas_store`
- **`MAX_SECTIONS`:** `20`
- **Built-in Section Types (`SECTION_TYPES`):** `banner`, `products`, `features`, `testimonials` (plus `ai` for approved custom AI sections)
- **Allowed Fonts (`settings.font`):** `cairo`, `tajawal`, `almarai`, `ibm_plex_arabic`, `noto_kufi`, `readex_pro`

## 1. Settings (`settings`)
- `colors`:
  - `primary`: required `#rrggbb` hex color
  - `secondary`: required `#rrggbb` hex color
  - `background`: required `#rrggbb` hex color
  - `text`: required `#rrggbb` hex color
- `font`: required string in `["cairo", "tajawal", "almarai", "ibm_plex_arabic", "noto_kufi", "readex_pro"]`
- `font_size`: required string in `["small", "medium", "large"]`
- `logo_media_id`: nullable integer (tenant media ID, `"upload:N"`, `"image:ID"`, or `"keep"`)
- `favicon_media_id`: nullable integer (tenant media ID or `"keep"`)
- `header`:
  - `sticky`: required boolean
  - `search`: required boolean
  - `announcement`: nullable string `<= 200` chars
- `footer`:
  - `about`: nullable string `<= 500` chars
  - `show_pages`: required boolean
  - `phone`: nullable string `<= 30` chars
  - `whatsapp`: nullable string `<= 30` chars
  - `email`: nullable valid email string `<= 191` chars
  - `address`: nullable string `<= 200` chars
  - `social`: object with keys `facebook`, `instagram`, `tiktok`, `x`, `youtube`, `snapchat`, each nullable safe URL `<= 300` chars
- `general`:
  - `whatsapp_button`: required boolean
  - `show_out_of_stock`: required boolean
  - `products_per_page`: required integer in `[12, 16, 24, 32, 48]`

## 2. Section Types (`sections`)
Every section object has:
- `id`: required unique string (`^[A-Za-z0-9_-]{6,40}$`, e.g. `"sec001000001"`)
- `type`: required string in `["banner", "products", "features", "testimonials", "ai"]`
- `visible`: required boolean
- `props`: required object matching the section `type`:

### Store Link Shape (`link`)
`{ "type": "none | all_products | offers | category | product | url", "target_id": int|null, "url": string|null }`

### `banner`
- `autoplay`: required boolean
- `slides`: present array (`max: 8`). Each slide:
  - `media_id`: required integer (tenant media ID or `"image:ID"` / `"upload:N"`)
  - `title`: nullable string `<= 80`
  - `text`: nullable string `<= 200`
  - `button_label`: nullable string `<= 30`
  - `link`: required Store Link Shape

### `products`
- `title`: required string `<= 80`
- `description`: nullable string `<= 200`
- `source`: required string in `["latest", "offers", "category"]`
- `category_id`: nullable integer (required when `source === "category"`)
- `limit`: required integer in `[4, 8, 12, 16, 24, 32]`
- `layout`: required string in `["grid", "slider"]`
- `columns`: required integer in `[2, 3, 4, 5]`
- `show_view_all`: required boolean

### `features`
- `title`: nullable string `<= 80`
- `items`: required array (`min: 2`, `max: 4`). Each item:
  - `icon`: required string in `["truck", "cash", "return", "shield", "support", "gift", "star", "clock", "tag", "heart", "package", "phone"]`
  - `title`: required string `<= 40`
  - `text`: nullable string `<= 120`

### `testimonials`
- `title`: nullable string `<= 80`
- `source`: required string in `["auto", "manual"]`
- `items`: present array (`min: 1` when `manual`, `max: 12`). Each item:
  - `name`: required string `<= 60`
  - `rating`: required integer `1..5`
  - `text`: required string `<= 400`

### `ai` (Custom AI Section)
- `ai_section_id`: required integer (approved `AiSection` ID for `asas_store`)
- `values`: present object `{}`

## 3. Full `defaults()` Example
```json
{
    "settings": {
        "colors": {
            "primary": "#0b875b",
            "secondary": "#ffc83d",
            "background": "#ffffff",
            "text": "#13261d"
        },
        "font": "cairo",
        "font_size": "medium",
        "logo_media_id": null,
        "favicon_media_id": null,
        "header": {
            "sticky": true,
            "search": true,
            "announcement": null
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
            }
        },
        "general": {
            "whatsapp_button": true,
            "show_out_of_stock": true,
            "products_per_page": 24
        }
    },
    "sections": [
        {
            "id": "sec001000001",
            "type": "banner",
            "visible": true,
            "props": {
                "slides": [],
                "autoplay": true
            }
        },
        {
            "id": "sec002000001",
            "type": "products",
            "visible": true,
            "props": {
                "title": "أحدث المنتجات",
                "description": "وصل جديد، اختار اللي يعجبك.",
                "source": "latest",
                "category_id": null,
                "limit": 8,
                "layout": "grid",
                "columns": 4,
                "show_view_all": true
            }
        },
        {
            "id": "sec003000001",
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
            "id": "sec004000001",
            "type": "testimonials",
            "visible": true,
            "props": {
                "title": "آراء عملائنا",
                "source": "auto",
                "items": []
            }
        }
    ]
}
```

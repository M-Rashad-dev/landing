# Fix plan: «المصمم الذكي» and the support assistant after the first real tests (2026-11-18)

> **Who this is for:** the AI agent that continues this work.
> - Read `CLAUDE.md` and `docs/plans/ai-designer.md` §0 (the owner's rules) first.
> - Do the open tasks in order.
> - After each task, update the **PROGRESS** list at the bottom and send the owner one short Egyptian Arabic line.
> - When all are done, tell him exactly what to try (§ «Owner check»).
> - Run the gates before each commit:
>   - back: `composer test` and `composer lint`
>   - front: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, with vitest run from PowerShell
> - Push to `v4` and `main`.

The owner topped up OpenRouter with $5 and removed the local free-model lines, so the strong defaults run
(`qwen/qwen4-max` for chat and design, `qwen/qwen3-embedding-8b` for search,
`google/gemini-nano-banana-2.1` for images). He found the problems below.

---

## P0. The front end gates fail (task F0: DO THIS FIRST)
`pnpm typecheck` and `pnpm lint` fail on code from the AI designer stages. These errors already existed before this
fix plan; it didn't cause them. Fix every one, without changing behaviour, until
`pnpm lint && pnpm typecheck && pnpm test && pnpm build` are all green.

Typecheck (2026-11-18):
- `features/ai-designer/designer-dialog.tsx:677`: `SwitchRow` takes `title` (+ optional `description`), not
  `label`.
- `features/ai-designer/fields-form.tsx:206` and `:225`: `ImageGallery` expects `MediaItem[]` with no nulls. Filter
  out nulls with a correct type guard.
- `features/ai-designer/preview-dialog.tsx:100` and `run-preview-dialog.tsx:115`: `DeviceFrame` needs a `host`
  prop. Pass the store host or the page address, as the Builders do (see `features/builder/builder.tsx`).
- `features/builder/builder.tsx:223`, `:261` and `:294`: the `MediaUrls` type mismatch (two different `MediaUrls`
  types) and a number passed where a string is expected.

Lint:
- `setState` called synchronously inside effects (designer dialog ~line 129 and ~154): move it to the event
  handlers, or derive the state.
- An impure call during render (~line 493): use `Date.now()` / `Math.random()` only in effects or handlers.
- `cleanAttrs` → `const`.
- The unused `DialogHeader` import.
- `window.location.href` to an internal page → `useRouter().push()`.

Then run the whole front test suite.

## P1. The support assistant hands every question to a person (DONE)
- **Cause:** the production embedding model returns 4096 numbers per piece. `App\Ai\Knowledge::vectors()` cached all
  vectors in the **database** cache store. The value was too big for MariaDB (`max_allowed_packet`), the cache write
  threw, and `SupportAssistant::answer()` caught it and handed off with reason `unavailable`.
- **Fix:** the vectors cache uses its own store, `config('ai.knowledge.cache_store')` (env `AI_VECTORS_CACHE`,
  default `file`; tests `array`).
- **Owner action:** none. If the knowledge base was embedded with another model, run `php artisan ai:reembed` once.

## P2. «معرفتش أعمل ده بشكل سليم» very often (MAIN CAUSE DONE)
- **Cause found in `storage/logs/laravel.log` (`ai.designer.invalid_output`):** `qwen4-max` often answers with the
  JSON object wrapped in a list, `[ { "reply": … } ]`. The validator saw no `reply` and failed, even after the
  repair call.
- **Fix:** `AiDesigner::decodeJson()` unwraps a list to its first object. The support assistant uses the same
  decoder now.
- **Still to do (task F2):**
  1. (DONE) In `back/resources/prompts/ai-designer.md`, near the top, add: «Return exactly ONE JSON object (never an array,
     never text around it).»
  2. (DONE: `tests/Feature/Ai/AiDesignerFixesTest.php`) Add a unit test for `decodeJson`: a list-wrapped object, fenced JSON, and prose around the JSON.
  3. Try 5–6 real requests with the owner's key (a few cents; tell him first). Then read the new
     `ai.designer.invalid_output` / `ai.design_runner.invalid_output` warnings in the log. For each kind of error
     left, fix the cause (prompt rule, or accept a harmless variation in the validator) and write it in the
     progress list.

## P3. The phone preview shows the desktop layout (task F3: DONE, except step 5's front test)
- **Cause:**
  - The preview draws the section in a `div` inside `DeviceFrame`, not in an iframe.
  - The AI's CSS uses `@media (min-width: …)`, and media queries read the **browser window** width, not the
    frame's.
  - So the «موبايل» frame still applies the desktop rules (3 cards squeezed).
  - The live site on a real phone is right; that's why it looked fixed after approval.
- **Fix:** make AI sections respond to **their own width** with container queries. The Builder and the themes
  already work this way.
  1. **Back, `App\Ai\Designer\AiSectionCss::scope()`:** rewrite every `@media` whose condition only uses
     `min-width` / `max-width` (in `px`, `rem` or `em`) into `@container aisec (<same condition>)`.
     - Keep other media queries (like `prefers-reduced-motion`, `hover`) as `@media`.
     - Mixed conditions (`screen and (min-width: 640px)`): drop `screen and` / `all and` and convert.
     - Add unit tests next to the existing CSS tests.
  2. **Front, `front/src/themes/shared/ai-section/view.tsx`:** the inner wrapper (the `div` holding the HTML) gets
     `style={{ containerType: "inline-size", containerName: "aisec" }}`.
     - Use the inner one, because a container query can't style its own container element.
     - The scoped selectors still start with `[data-ai-v="…"]` on the outer wrapper, so nothing else changes.
  3. **Prompt (`ai-designer.md`):** tell the AI to write responsive rules as
     `@container aisec (min-width: 640px)` / `(min-width: 1024px)`, mobile-first. Media queries still work, because
     they are converted.
  4. **Existing approved sections:** their stored `css` was scoped before. Add a one-time artisan command
     `ai:rescope-sections` that re-runs `AiSectionCss::scope($version->css_raw, (string) $version->id)` for every
     version and saves `css`. Tell the owner to run it once (`php artisan ai:rescope-sections`, from `back/`).
  5. **Test:** a version with `@media (min-width: 640px){.grid{grid-template-columns:repeat(3,1fr)}}` renders 1
     column in the phone frame and 3 in the desktop frame. Check the stored CSS contains `@container aisec`.

## P4. The preview modal is too small (task F4: DONE, check it at 1366×768 and on a phone)
- **Change** `front/src/features/ai-designer/preview-dialog.tsx` and `run-preview-dialog.tsx`:
  - `DialogContent` covers the **whole screen** on every size: `fixed inset-0`, `w-screen`, `h-dvh`,
    `max-w-none`, `max-h-none`, `rounded-none`, `translate-x-0 translate-y-0`.
  - Override the centered positioning classes of `DialogContent`; check `components/ui/overlay.tsx`, which centers
    with `start-1/2 top-1/2 -translate-…`.
- **Body:** header row (title, device switch, close), then the frame area filling the rest (`flex-1 min-h-0`).
  - Desktop: the frame takes the full width.
  - Phone: about 390 px wide, centered, full height.
  - Footer: «رفض» and «اعتماد».
- The page inside scrolls in the frame. Nothing is cut off at 1366×768.
- Keep keyboard close (Esc) and focus trap.
- Update the front tests that query the dialog.

## P5. An edit request changes things the merchant didn't ask for (task F5: prompt + temperature DONE; the «missing field key» guard and its test are still open)
Example: «make phone show one card» also changed the section header.
- **Fix in the prompt** (`ai-designer.md`, editing part): add a short, strict rule list.
  - «When editing, copy every part of html, css and fields that the request does not mention **character for
    character**.
  - Change the smallest possible part.
  - Never rename classes, never restyle the header, colors or texts unless asked.
  - Keep all field keys.»
- **Fix in code:** for an edit request (a focused section), send `temperature: 0.2` (lower randomness). For new
  sections keep the default.
- **Guard in code:** after an edit, if a field key that existed before is missing and the merchant did not ask to
  remove anything, ask the AI once to restore it. Use the repair path; it is charged like any call.
- **Test** with `FakeAiClient`: the edit request is sent with temperature 0.2 and contains the strict edit rules.

---

## Owner check (when F2–F5 are done)
1. Rebuild and restart: in `front/` run `pnpm build`, then `bash tools/start-dev.sh`.
2. In `back/` run once: `php artisan ai:rescope-sections`.
3. **Support:** ask a simple question → the assistant answers (no handoff).
4. **Designer:**
   - Make «آراء العملاء» → «معاينة» full screen → switch «موبايل»: one card per row.
   - Ask an edit («خلي الموبايل كارت واحد») → only that changes.
5. Ask 3–4 different sections and a whole-page design. «معرفتش أعمل ده» should be rare. If it shows, send the
   time, so we can read the log line.

---

## PROGRESS (update after each task)
- 2026-11-18: P1 fixed (vectors cache in a file store). P2 main cause fixed (list-wrapped JSON). Old AI tests
  updated for the `designer` feature key. All AI tests pass. Next: F3 (container queries).
- 2026-11-18: F3 done:
  - `AiSectionCss` turns width `@media` into `@container aisec (...)`, with tests.
  - `view.tsx` wraps the HTML in a container (`containerName: "aisec"`).
  - New command `php artisan ai:rescope-sections` (the owner runs it once).
  - Prompt asks for container queries.
- 2026-11-18: F4 done: both preview dialogs are full screen and the frame fills the rest.
- 2026-11-18: F5 partly done: strict edit rules in the prompt, `AiDesigner::EDIT_TEMPERATURE = 0.2` for focused
  edits.
- 2026-11-18: P2 step 1 done (one-object rule in the prompt). Step 3 (real tries + log reading) is open.
- **Found:** the front gates fail from earlier designer code (see P0). **Next for the other agent:**
  1. F0
  2. the P3 step 5 front test
  3. the F5 guard
  4. P2 step 3
  5. Owner check

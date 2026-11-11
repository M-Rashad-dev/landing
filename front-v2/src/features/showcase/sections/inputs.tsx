"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { DatePicker, DateRangePicker, presetRange, type RangeValue } from "@/components/forms/date-pickers";
import { ColorInput, FileDrop, MarkdownEditor, MediaTiles, MoneyInput, PhoneInput, QuantityStepper } from "@/components/forms/inputs";
import { Badge } from "@/components/ui/badge";
import { Checkbox, RadioCards, SwitchRow } from "@/components/ui/choice";
import { MultiSelect, Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { AddonInput, Input, InputGroup, Textarea } from "@/components/ui/input";
import { SortableList } from "@/components/data/sortable-list";
import { ar } from "@/messages/ar";
import { DEMO_CATEGORIES, DEMO_CATEGORY_OPTIONS, DEMO_GOVERNORATES, DEMO_IMAGES } from "../fixtures";
import { ShowSection, Specimen } from "../frame";

const t = ar.showcase.inputs;

export function InputsSection() {
  const [price, setPrice] = useState("350");
  const [gov, setGov] = useState("");
  const [sort, setSort] = useState("newest");
  const [delta, setDelta] = useState("-20");
  const [color, setColor] = useState("#F26B1D");
  const [active, setActive] = useState(true);
  const [notify, setNotify] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [cats, setCats] = useState<string[]>(["2"]);
  const [range, setRange] = useState<RangeValue>({ ...presetRange("last30"), preset: "last30" });
  const [day, setDay] = useState("");
  const [startsAt, setStartsAt] = useState("2026-11-15T10:00");
  const [qty, setQty] = useState(2);
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState(DEMO_IMAGES);
  const [md, setMd] = useState("**قطن مصري 100%**\n\n- مقاسات من S لـ XXL\n- ألوان ثابتة");
  const [categories, setCategories] = useState(DEMO_CATEGORIES);

  return (
    <ShowSection id="inputs" title={ar.showcase.sections.inputs.title} description={ar.showcase.sections.inputs.description}>
      <Specimen label={ar.showcase.sections.inputs.title} className="grid w-full gap-4 sm:grid-cols-2">
        <Field label={t.text} htmlFor="sc-text" required hint={t.hint}>
          <Input id="sc-text" placeholder={t.textPlaceholder} />
        </Field>
        <Field label={t.withError} htmlFor="sc-err" required error={t.errorText}>
          <Input id="sc-err" aria-invalid />
        </Field>
        <Field label={t.money} htmlFor="sc-money" required>
          <MoneyInput id="sc-money" value={price} onChange={setPrice} />
        </Field>
        <Field label={t.moneySigned} htmlFor="sc-delta">
          <MoneyInput id="sc-delta" value={delta} onChange={setDelta} signed />
        </Field>
        <Field label={t.phone} htmlFor="sc-phone">
          <PhoneInput id="sc-phone" />
        </Field>
        <Field label={t.slug} htmlFor="sc-slug" optional>
          <AddonInput id="sc-slug" addon="/products/" defaultValue="linen-shirt" />
        </Field>
        <Field label={t.search} htmlFor="sc-search">
          <InputGroup id="sc-search" start={<Search />} placeholder={t.searchPlaceholder} />
        </Field>
        <Field label={t.select} htmlFor="sc-select">
          <Select id="sc-select" placeholder={t.selectPlaceholder} value={gov} onValueChange={setGov} options={DEMO_GOVERNORATES.map((g) => ({ value: g, label: g }))} searchable />
        </Field>
        <Field label={t.sort} htmlFor="sc-sort">
          <Select id="sc-sort" value={sort} onValueChange={setSort} options={(Object.keys(t.sorts) as Array<keyof typeof t.sorts>).map((k) => ({ value: k, label: t.sorts[k] }))} />
        </Field>
        <Field label={t.multi}>
          <MultiSelect options={DEMO_CATEGORY_OPTIONS} value={cats} onChange={setCats} placeholder={t.multiPlaceholder} countLabel={t.selectedCount} searchable />
        </Field>
        <Field label={t.disabled} htmlFor="sc-dis">
          <Input id="sc-dis" disabled defaultValue="INV-000123" />
        </Field>
        <Field label={t.textarea} htmlFor="sc-ta" className="sm:col-span-2">
          <Textarea id="sc-ta" rows={2} />
        </Field>
      </Specimen>

      <Specimen label={t.switch} className="grid w-full gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border px-3">
          <SwitchRow title={t.switch} description={t.switchHint} checked={active} onCheckedChange={setActive} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
          {t.checkbox}
        </label>
        <Field label={t.radio} className="sm:col-span-2">
          <RadioCards
            value={period}
            onValueChange={setPeriod}
            options={[
              { value: "monthly", title: t.radioMonthly, meta: <span className="tabular text-sm">100 ج.م</span> },
              { value: "yearly", title: t.radioYearly, description: t.radioYearlyHint, meta: <Badge tone="success" size="sm">-17%</Badge> },
            ]}
          />
        </Field>
      </Specimen>

      <Specimen label={t.date} className="grid w-full gap-4 sm:grid-cols-2">
        <Field label={t.date}>
          <DatePicker value={startsAt} onChange={setStartsAt} withTime />
        </Field>
        <Field label={t.range}>
          <DateRangePicker value={range} onChange={setRange} />
        </Field>
        <Field label={t.dateOnly}>
          <DatePicker value={day} onChange={setDay} />
        </Field>
        <Field label={t.color} htmlFor="sc-color">
          <ColorInput id="sc-color" value={color} onChange={setColor} />
        </Field>
        <Field label={t.quantity}>
          <QuantityStepper value={qty} onChange={setQty} />
        </Field>
      </Specimen>

      <Specimen label={t.file} className="grid w-full gap-4 sm:grid-cols-2">
        <Field label={t.file}>
          <FileDrop accept="image/jpeg,image/png,image/webp" file={file} onFile={setFile} hint={t.fileHint} />
        </Field>
        <Field label={t.media}>
          <MediaTiles images={images} onRemove={(id) => setImages((list) => list.filter((i) => i.id !== id))} onAdd={() => setImages(DEMO_IMAGES)} />
        </Field>
      </Specimen>

      <Specimen label={t.markdown} stack>
        <MarkdownEditor value={md} onChange={setMd} rows={5} />
      </Specimen>

      <Specimen label={ar.showcase.sortable.title} stack>
        <p className="text-xs text-ink-3">{ar.showcase.sortable.hint}</p>
        <SortableList
          items={categories}
          getId={(c) => c.id}
          onReorder={setCategories}
          depthOf={(c) => c.depth}
          render={(c) => (
            <span className="flex items-center justify-between gap-2 text-sm">
              <span className={c.depth === 0 ? "font-semibold" : undefined}>{c.name}</span>
              <span className="tabular text-xs text-ink-3">{c.count}</span>
            </span>
          )}
        />
      </Specimen>
    </ShowSection>
  );
}

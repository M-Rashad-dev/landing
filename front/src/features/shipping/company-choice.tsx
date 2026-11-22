"use client";

import { Search } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { toast } from "@/components/ui/feedback";
import { InputGroup } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { saveCompanyChoice, useRefreshShipping, type Company, type CompanyChoice, type ShippingSettings } from "./api";

const t = ar.carriers.choice;

/** The fee of a company in a governorate, or null when it doesn't deliver there. */
function feeIn(c: Company, governorate: string): number | null {
  const rate = c.rates.find((r) => r.governorate === governorate);
  if (rate && !rate.is_available) return null;
  return rate?.fee ?? c.default_fee;
}

/** With two companies or more: the customer picks at checkout, or the store sets one company per governorate. */
export function CompanyChoicePanel({ data }: { data: ShippingSettings }) {
  const refresh = useRefreshShipping();
  const active = data.companies.filter((c) => c.is_active);
  const [choice, setChoice] = React.useState<CompanyChoice>(data.company_choice);
  const [assigned, setAssigned] = React.useState<Record<string, number | null>>({ ...data.governorate_companies });
  const [filter, setFilter] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (active.length < 2) return null;

  async function save() {
    setBusy(true);
    try {
      await saveCompanyChoice(data.enabled, choice, choice === "governorate" ? assigned : {});
      toast.success(t.saved);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const dirty = choice !== data.company_choice || JSON.stringify(assigned) !== JSON.stringify({ ...data.governorate_companies });
  const shown = data.governorates.filter((g) => g.includes(filter.trim()));

  return (
    <Panel>
      <PanelHeader title={t.title} />
      <PanelBody className="flex flex-col gap-4">
        <RadioCards
          value={choice}
          onValueChange={(v) => setChoice(v as CompanyChoice)}
          options={[
            { value: "customer", title: t.customer, description: t.customerHint },
            { value: "governorate", title: t.governorate, description: t.governorateHint },
          ]}
        />
        {choice === "governorate" ? (
          <div className="flex flex-col gap-2">
            <InputGroup start={<Search />} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.search} aria-label={t.search} className="sm:w-56" />
            <ul className="divide-y divide-border rounded-lg border border-border">
              {shown.map((g) => {
                const serving = active.filter((c) => feeIn(c, g) !== null);
                return (
                  <li key={g} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-24 flex-1 text-sm font-medium">{g}</span>
                    <Select
                      className="w-56 max-w-[60%]"
                      value={assigned[g] ? String(assigned[g]) : ""}
                      onValueChange={(v) => setAssigned((a) => ({ ...a, [g]: v ? Number(v) : null }))}
                      emptyLabel={t.cheapest}
                      options={serving.map((c) => ({ value: String(c.id), label: c.name, hint: formatMoney(feeIn(c, g) ?? 0) }))}
                      aria-label={g}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </PanelBody>
      {dirty ? (
        <PanelFooter className="flex justify-end">
          <Button loading={busy} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      ) : null}
    </Panel>
  );
}

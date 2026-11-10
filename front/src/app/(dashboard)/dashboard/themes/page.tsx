import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ar } from "@/messages/ar";
import { MyThemes } from "./my-themes";

export const metadata: Metadata = { title: ar.themeStore.mineTitle };

export default function MyThemesPage() {
  return (
    <>
      <PageHeader
        title={ar.themeStore.mineTitle}
        description={ar.themeStore.mineDescription}
        actions={
          <Button asChild>
            <Link href="/dashboard/themes/store">
              <Store />
              {ar.themeStore.browse}
            </Link>
          </Button>
        }
      />
      <MyThemes />
    </>
  );
}

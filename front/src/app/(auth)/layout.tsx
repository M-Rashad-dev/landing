import { Rocket } from "lucide-react";
import Link from "next/link";
import { AppRoot } from "@/components/app-root";
import { ar } from "@/messages/ar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppRoot>
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-secondary to-background px-4 py-10">
        <Link href="/login" className="mb-6 flex items-center gap-2 text-lg font-extrabold text-primary">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Rocket className="size-5" aria-hidden />
          </span>
          {ar.app.name}
        </Link>
        <main className="w-full max-w-md">{children}</main>
      </div>
    </AppRoot>
  );
}

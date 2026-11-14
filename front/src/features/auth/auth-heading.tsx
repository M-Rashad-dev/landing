import Link from "next/link";

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <h1 className="font-display text-[1.75rem] font-bold leading-tight text-ink">{title}</h1>
      <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p>
    </div>
  );
}

export function AuthSwitch({ question, action, href }: { question: string; action: string; href: string }) {
  return (
    <p className="mt-6 text-center text-sm text-ink-2">
      {question}{" "}
      <Link href={href} className="font-semibold text-brand-strong underline-offset-4 hover:underline">
        {action}
      </Link>
    </p>
  );
}

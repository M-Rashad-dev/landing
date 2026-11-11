import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * primary = ink (the main action of a screen, one per area) · brand = orange (rare emphasis)
 * secondary = tinted · outline · ghost · danger · danger-ghost · link
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-ink hover:bg-primary-hover",
        brand: "bg-brand-strong text-brand-ink hover:bg-[#a8380a]",
        secondary: "bg-surface-2 text-ink hover:bg-surface-3",
        outline: "border border-border-strong bg-surface text-ink hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        danger: "bg-danger text-white hover:bg-[#a82222]",
        "danger-ghost": "text-danger hover:bg-danger-soft",
        link: "h-auto px-0 text-brand-strong underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg]:size-4",
        lg: "h-11 px-5 text-[15px] [&_svg]:size-[18px]",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-4",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} disabled={asChild ? undefined : disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-e-transparent" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

/** Buttons glued together (segmented). */
export function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="group" className={cn("inline-flex [&>*]:rounded-none [&>*:first-child]:rounded-s-lg [&>*:last-child]:rounded-e-lg [&>*+*]:-ms-px", className)} {...props} />;
}

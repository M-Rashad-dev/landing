import { GalleryClient } from "@/themes/shared/components/gallery-client";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import type { GalleryProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { mediaList } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";

export function CeliaGallery({ props, variant, ctx }: SectionProps<GalleryProps>) {
  const images = props.source === "custom" ? mediaList(ctx, props.image_media_ids) : (ctx.product?.images ?? []);
  if (images.length === 0) return <PreviewEmpty ctx={ctx} label={props.title} />;

  return (
    <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        {props.title ? <h2 className="t-heading mb-8 text-3xl font-black uppercase tracking-tight md:text-5xl">{props.title}</h2> : null}
        <GalleryClient
          images={images}
          layout={variant === "masonry" ? "masonry" : "thumbs-side"}
          autoplay={props.autoplay}
          showThumbnails={props.show_thumbnails}
          lightbox={props.lightbox}
          frameClassName="border-2 t-line"
          thumbClassName={(active) => cn("size-16 shrink-0 overflow-hidden border-2 sm:size-20", active ? "t-line shadow-[3px_3px_0_var(--c-fg)]" : "border-transparent opacity-60")}
        />
      </div>
    </section>
  );
}

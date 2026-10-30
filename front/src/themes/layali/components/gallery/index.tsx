import { GalleryClient } from "@/themes/shared/components/gallery-client";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import type { GalleryProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { mediaList } from "@/themes/shared/utils";

/** «ليالي» gallery: a spotlight slider in a glowing frame, or a grid of glass tiles. */
export function LayaliGallery({ props, variant, ctx }: SectionProps<GalleryProps>) {
  const images = props.source === "custom" ? mediaList(ctx, props.image_media_ids) : (ctx.product?.images ?? []);
  if (images.length === 0) return <PreviewEmpty ctx={ctx} label={props.title} />;

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        {props.title ? <h2 className="t-heading l-grad-text mb-12 text-center text-3xl font-bold md:text-4xl">{props.title}</h2> : null}
        <div className={variant === "spotlight" ? "l-ring" : undefined}>
          <GalleryClient
            images={images}
            layout={variant === "glass-grid" ? "grid" : "slider"}
            autoplay={props.autoplay}
            showThumbnails={props.show_thumbnails}
            lightbox={props.lightbox}
            frameClassName="rounded-[1.75rem] ring-1 ring-white/10 shadow-[0_30px_80px_-30px_var(--c-primary)]"
          />
        </div>
      </div>
    </section>
  );
}

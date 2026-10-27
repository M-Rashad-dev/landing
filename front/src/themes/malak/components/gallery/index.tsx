import { GalleryClient } from "@/themes/shared/components/gallery-client";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import type { GalleryProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { mediaList } from "@/themes/shared/utils";

export function MalakGallery({ props, variant, ctx }: SectionProps<GalleryProps>) {
  const images = props.source === "custom" ? mediaList(ctx, props.image_media_ids) : (ctx.product?.images ?? []);
  if (images.length === 0) return <PreviewEmpty ctx={ctx} label={props.title} />;

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        {props.title ? <h2 className="t-heading mb-10 text-center text-2xl font-bold md:text-3xl">{props.title}</h2> : null}
        <GalleryClient
          images={images}
          layout={variant === "grid" ? "grid" : "slider"}
          autoplay={props.autoplay}
          showThumbnails={props.show_thumbnails}
          lightbox={props.lightbox}
          frameClassName="rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,.06)]"
        />
      </div>
    </section>
  );
}

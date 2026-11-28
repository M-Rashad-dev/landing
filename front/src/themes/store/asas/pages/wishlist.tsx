"use client";

import { Heart } from "lucide-react";
import * as React from "react";
import { useWishlist, useWishlistCards } from "@/lib/store/wishlist";
import { ar } from "@/messages/ar";
import { StoreLink } from "@/themes/store/shared/context";
import type { ProductCard as Card } from "@/themes/store/shared/types";
import { Breadcrumb, Container, Empty } from "../parts";
import { ProductCard } from "../product-card";

const t = ar.storefront.wishlist;

/**
 * «المفضلة»: the products the visitor saved on this device (no account), as the theme's product cards, each with a
 * button to take it out. Every store theme's default page; a theme passes its own card.
 */
export function WishlistView({ Card = ProductCard }: { Card?: React.ComponentType<{ product: Card }> }) {
  const wishlist = useWishlist();
  const query = useWishlistCards(wishlist.ids);
  const cards = query.data ?? [];

  return (
    <Container className="flex flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={[{ name: t.title }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="as-2xl font-extrabold">{t.title}</h1>
          <p className="as-sm as-muted">{t.description}</p>
        </div>
        {wishlist.count > 0 ? (
          <button type="button" onClick={wishlist.clear} className="as-sm font-semibold as-primary hover:underline">
            {t.clear}
          </button>
        ) : null}
      </div>

      {wishlist.count === 0 ? (
        <Empty
          icon={<Heart className="size-6" />}
          title={t.emptyTitle}
          text={t.emptyText}
          action={
            <StoreLink href="/products" className="as-btn as-sm">
              {t.browse}
            </StoreLink>
          }
        />
      ) : query.failed ? (
        <Empty
          icon={<Heart className="size-6" />}
          title={t.failed}
          action={
            <button type="button" onClick={query.retry} className="as-btn as-sm">
              {t.retry}
            </button>
          }
        />
      ) : query.loading ? (
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @5xl:grid-cols-4" aria-busy="true">
          {wishlist.ids.slice(0, 8).map((id) => (
            <div key={id} className="aspect-[3/4] animate-pulse rounded-xl bg-(--as-soft)" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Empty icon={<Heart className="size-6" />} title={t.emptyTitle} text={t.emptyText} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @3xl:gap-4 @5xl:grid-cols-4">
          {cards.map((product) => (
            <li key={product.id} className="relative">
              <Card product={product} />
              <button
                type="button"
                onClick={() => wishlist.remove(product.id)}
                aria-label={t.remove(product.name)}
                className="absolute end-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-(--as-card) shadow-md hover:bg-(--as-soft)"
              >
                <Heart className="size-4 fill-(--as-primary) text-(--as-primary)" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

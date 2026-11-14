/**
 * The single entry for every Arabic string of the dashboard.
 * Each section lives in its own file under messages/ar/ (owner decision 2026-11-11);
 * screens always import `ar` from here, never the section files directly.
 */
import { admin } from "./ar/admin";
import { analytics } from "./ar/analytics";
import { auth } from "./ar/auth";
import { bidaya } from "./ar/bidaya";
import { catalog } from "./ar/catalog";
import { common } from "./ar/common";
import { design } from "./ar/design";
import { domain } from "./ar/domain";
import { growth } from "./ar/growth";
import { imports } from "./ar/imports";
import { marketing } from "./ar/marketing";
import { home } from "./ar/home";
import { landings } from "./ar/landings";
import { media } from "./ar/media";
import { nav } from "./ar/nav";
import { orders } from "./ar/orders";
import { promotions } from "./ar/promotions";
import { reviews } from "./ar/reviews";
import { settings } from "./ar/settings";
import { shipping } from "./ar/shipping";
import { showcase } from "./ar/showcase";
import { storePages } from "./ar/store-pages";
import { storefront } from "./ar/storefront";
import { errors, validation } from "./ar/validation";

export const ar = { common, nav, domain, showcase, auth, validation, errors, media, catalog, promotions, shipping, orders, home, settings, storefront, design, reviews, storePages, analytics, admin, landings, bidaya, growth, marketing, imports } as const;

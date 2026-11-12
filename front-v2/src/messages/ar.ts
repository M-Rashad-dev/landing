/**
 * The single entry for every Arabic string of the dashboard.
 * Each section lives in its own file under messages/ar/ (owner decision 2026-11-11);
 * screens always import `ar` from here, never the section files directly.
 */
import { auth } from "./ar/auth";
import { catalog } from "./ar/catalog";
import { common } from "./ar/common";
import { domain } from "./ar/domain";
import { media } from "./ar/media";
import { nav } from "./ar/nav";
import { orders } from "./ar/orders";
import { promotions } from "./ar/promotions";
import { shipping } from "./ar/shipping";
import { showcase } from "./ar/showcase";
import { errors, validation } from "./ar/validation";

export const ar = { common, nav, domain, showcase, auth, validation, errors, media, catalog, promotions, shipping, orders } as const;

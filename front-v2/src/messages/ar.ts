/**
 * The single entry for every Arabic string of the dashboard.
 * Each section lives in its own file under messages/ar/ (owner decision 2026-11-11);
 * screens always import `ar` from here, never the section files directly.
 */
import { auth } from "./ar/auth";
import { common } from "./ar/common";
import { domain } from "./ar/domain";
import { nav } from "./ar/nav";
import { showcase } from "./ar/showcase";
import { errors, validation } from "./ar/validation";

export const ar = { common, nav, domain, showcase, auth, validation, errors } as const;

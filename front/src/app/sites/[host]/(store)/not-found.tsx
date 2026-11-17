import { storeTheme } from "@/themes/store/registry";

/**
 * A missing product, category or page inside a store keeps the store's header and footer (its
 * frame). Next gives this page no params, so the text inside comes from the default theme.
 */
export default function NotFound() {
  const { NotFound: Missing } = storeTheme(null).pages;
  return <Missing />;
}

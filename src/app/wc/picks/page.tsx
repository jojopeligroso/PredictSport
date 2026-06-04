import { redirect } from "next/navigation";

/**
 * /wc/picks now redirects to /wc — the canonical picks-first landing.
 * Kept as a route so old bookmarks and links don't 404.
 */
export default function PicksRedirect() {
  redirect("/wc");
}

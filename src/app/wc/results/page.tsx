import { redirect } from "next/navigation";

/**
 * /wc/results now redirects to /wc?tab=results — fixtures and results
 * are folded into the picks hub as tabs.
 */
export default function ResultsRedirect() {
  redirect("/wc?tab=results");
}

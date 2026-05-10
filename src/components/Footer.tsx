import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-ps-border py-4 text-center text-[11px] text-ps-text-ter">
      <div className="flex items-center justify-center gap-3">
        <Link href="/privacy" className="hover:text-ps-text">
          Privacy
        </Link>
        <span aria-hidden="true">&middot;</span>
        <Link href="/terms" className="hover:text-ps-text">
          Terms
        </Link>
      </div>
    </footer>
  );
}

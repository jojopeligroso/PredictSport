import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — PredictSport",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[480px] px-4 py-10">
      <h1 className="mb-6 text-xl font-bold text-ps-text">Privacy Policy</h1>
      <p className="mb-4 text-xs text-ps-text-ter">Last updated: 10 May 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-ps-text-sec">
        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">1. Information We Collect</h2>
          <p>When you sign in with Google, we receive your name, email address, and profile picture. We also store the predictions you make and your competition activity.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">2. How We Use Your Information</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Manage your account and display your profile on leaderboards</li>
            <li>Calculate scores and rankings within your competitions</li>
            <li>Send notifications you have opted into (push, Telegram)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">3. Information Sharing</h2>
          <p>We do not sell or share your personal data with third parties for marketing. Your predictions and scores are visible to other members of competitions you join.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">4. Data Storage & Security</h2>
          <p>Your data is stored securely on Supabase (hosted in EU — Ireland region) and served via Vercel. Access is controlled by row-level security policies.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">5. Cookies & Sessions</h2>
          <p>We use functional session cookies to keep you signed in. We do not use tracking or advertising cookies.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">6. Your Rights</h2>
          <p>Under GDPR you have the right to access, correct, or delete your personal data. To exercise these rights, contact us at the address below.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">7. Third-Party Services</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Google OAuth — for authentication</li>
            <li>Supabase — database and auth infrastructure</li>
            <li>Vercel — hosting</li>
            <li>Telegram — optional notifications</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">8. Children&apos;s Privacy</h2>
          <p>PredictSport is not directed at children under 13. We do not knowingly collect data from children.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">9. Changes to This Policy</h2>
          <p>We may update this policy from time to time. Changes will be posted on this page with an updated date.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">10. Contact</h2>
          <p>For privacy-related questions, email <span className="text-ps-text">predictsport@gmail.com</span>.</p>
        </section>
      </div>

      <div className="mt-8 border-t border-ps-border pt-4">
        <Link href="/terms" className="text-xs text-ps-text-ter hover:text-ps-text">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}

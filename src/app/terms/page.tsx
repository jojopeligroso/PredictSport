import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — sportspredict.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[480px] px-4 py-10">
      <h1 className="mb-6 text-xl font-bold text-ps-text">Terms of Service</h1>
      <p className="mb-4 text-xs text-ps-text-ter">Last updated: 10 May 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-ps-text-sec">
        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">1. Acceptance of Terms</h2>
          <p>By accessing or using PredictSport, you agree to be bound by these terms. If you do not agree, do not use the service.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">2. Description of Service</h2>
          <p>PredictSport is a social sports prediction platform where friends compete by predicting sports outcomes. It is a game of skill for entertainment purposes only.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">3. User Accounts</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>You sign in using Google. You are responsible for your account activity.</li>
            <li>Competitions are invite-only. You join via a link shared by the competition admin.</li>
            <li>You must provide accurate profile information.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">4. User Conduct</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Do not abuse, harass, or impersonate other users.</li>
            <li>Do not use automated tools to submit predictions.</li>
            <li>Do not attempt to manipulate scores or exploit bugs.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">5. Intellectual Property</h2>
          <p>PredictSport and its design, code, and branding are owned by the operator. You retain ownership of the predictions you submit.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">6. Disclaimers</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>PredictSport is provided &ldquo;as is&rdquo; without warranties of any kind.</li>
            <li>We do not guarantee uninterrupted access or accuracy of sports data.</li>
            <li>Predictions are for entertainment among friends — no financial value is attached.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">7. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, PredictSport and its operator shall not be liable for any indirect, incidental, or consequential damages arising from use of the service.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">8. Termination</h2>
          <p>We may suspend or terminate your account if you violate these terms. You may delete your account at any time by contacting us.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">9. Governing Law</h2>
          <p>These terms are governed by the laws of Ireland. Any disputes shall be subject to the exclusive jurisdiction of the Irish courts.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">10. Changes to These Terms</h2>
          <p>We may update these terms from time to time. Continued use after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ps-text">11. Contact</h2>
          <p>For questions about these terms, email <span className="text-ps-text">predictsport@gmail.com</span>.</p>
        </section>
      </div>

      <div className="mt-8 border-t border-ps-border pt-4">
        <Link href="/privacy" className="text-xs text-ps-text-ter hover:text-ps-text">
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Privacy Policy | Sven',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-zinc-400">Last updated: 2026-06-29</p>

      <section className="mt-8 space-y-6 text-sm leading-7 text-zinc-200">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">1. Introduction</h2>
          <p className="mt-2">
            47 Network (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the Sven platform
            (&ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, store, and protect
            your personal information when you use our website, applications, and self-hosted deployments.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">2. Data We Collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Account data:</strong> email address, display name, and authentication credentials required to create and maintain your account.</li>
            <li><strong>Conversation data:</strong> messages, files, and audio exchanged through chat sessions for delivering assistant and multi-agent features.</li>
            <li><strong>Usage data:</strong> page views, feature interactions, and operational telemetry to maintain service reliability and improve performance.</li>
            <li><strong>Device data:</strong> device identifiers for companion and mobile applications, used for pairing and delivery.</li>
            <li><strong>Community data:</strong> display name, email, and motivation text submitted through community access requests.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">3. How We Use Your Data</h2>
          <p className="mt-2">We process personal data for the following purposes:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Providing, operating, and maintaining the Service including chat, approvals, automation, voice, and knowledge features.</li>
            <li>Authenticating your identity and managing sessions securely.</li>
            <li>Processing community access requests and maintaining verified-persona policies.</li>
            <li>Monitoring service health, debugging issues, and preventing abuse.</li>
            <li>Communicating service updates, security notices, and operational alerts.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">4. Legal Basis for Processing (GDPR)</h2>
          <p className="mt-2">
            For users in the European Economic Area, we process personal data on the following legal bases:
            performance of a contract (operating the Service for your account), legitimate interests (security,
            abuse prevention, service improvement), and consent (where explicitly requested, such as community onboarding).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">5. Data Storage and Security</h2>
          <p className="mt-2">
            Authentication credentials are handled via secure token flows and are never stored in plaintext.
            All production transport uses HTTPS/TLS 1.2 or higher. Data at rest is encrypted using industry-standard
            algorithms. Self-hosted deployments inherit the security posture of the operator&rsquo;s infrastructure.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">6. Data Retention</h2>
          <p className="mt-2">
            We retain personal data only for as long as necessary to provide the Service and fulfil the purposes
            described in this policy. Account data is retained while your account is active. Conversation data
            retention is configurable by operators in self-hosted deployments. When you delete your account,
            associated personal data is removed within 30 days, except where retention is required by law.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">7. Third-Party Services</h2>
          <p className="mt-2">
            The Service may connect to third-party providers for language model inference, authentication (SSO/OIDC/SAML),
            messaging channel delivery, and payment processing. These integrations are configured by operators.
            Each third party operates under its own privacy policy, and data shared with them is limited to what
            is necessary for the integration to function.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">8. Cookies and Tracking</h2>
          <p className="mt-2">
            Sven uses essential cookies for authentication and session management. We do not use third-party
            advertising trackers. Operational telemetry is collected server-side for service quality and is not
            shared with advertising networks.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">9. Your Rights</h2>
          <p className="mt-2">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate or incomplete data.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Export your data in a portable format.</li>
            <li>Withdraw consent where processing is based on consent.</li>
            <li>Object to processing based on legitimate interests.</li>
            <li>Lodge a complaint with your supervisory authority.</li>
          </ul>
          <p className="mt-2">
            For CCPA users: we do not sell or share personal information for cross-context behavioural advertising.
            You may exercise your right to know, delete, or opt out by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">10. Children&rsquo;s Privacy</h2>
          <p className="mt-2">
            The Service is not directed at individuals under the age of 16. We do not knowingly collect personal
            data from children. If we become aware that personal data has been collected from a child, we will
            take steps to delete it promptly.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">11. International Transfers</h2>
          <p className="mt-2">
            If you access the Service from outside the region where your data is stored, your information may be
            transferred internationally. We apply appropriate safeguards including standard contractual clauses
            where required by law.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">12. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. Material changes will be communicated through
            the Service or by email. Continued use of the Service after changes constitutes acceptance of the
            updated policy.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-zinc-100">13. Contact</h2>
          <p className="mt-2">
            For privacy-related inquiries, data subject requests, or complaints, contact us at{' '}
            <a href="mailto:privacy@sven.systems" className="text-cyan-400 hover:text-cyan-300 underline">
              privacy@sven.systems
            </a>.
          </p>
        </div>
      </section>
    </main>
  );
}


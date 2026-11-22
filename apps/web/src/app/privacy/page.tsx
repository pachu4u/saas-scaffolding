import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage, Section, V } from '@/components/legal/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How we process personal data under the EU General Data Protection Regulation (GDPR)"
    >
      <Section title="1. Controller">
        <p>
          The controller within the meaning of Art. 4 (7) GDPR for the processing described here is:
        </p>
        <p>
          <V>{LEGAL.companyName}</V>, <V>{LEGAL.street}</V>, <V>{LEGAL.postalCity}</V>,{' '}
          <V>{LEGAL.country}</V>
          <br />
          Email: <V>{LEGAL.privacyEmail}</V>
        </p>
        {LEGAL.dpo !== null && (
          <p>
            Data Protection Officer: <V>{LEGAL.dpo}</V>
          </p>
        )}
        <p>
          Full company details are in our{' '}
          <Link href="/impressum" className="underline">
            Impressum
          </Link>
          .
        </p>
      </Section>

      <Section title="2. Scope: our data vs. your workspace data">
        <p>
          This policy covers personal data we process as controller: when you visit our website,
          create an account, sign in, manage a subscription or contact us.
        </p>
        <p>
          Content and personal data that our customers put into their workspaces (for example team
          member details or data handled by connected applications) is processed by us on the
          customer&apos;s behalf as a processor under Art. 28 GDPR. For that data the customer is
          the controller, and our Data Processing Agreement applies. Requests about such data should
          go to the organisation that operates the workspace.
        </p>
      </Section>

      <Section title="3. Hosting in the EU">
        <p>
          The platform, its databases and its identity service are hosted on STACKIT cloud
          infrastructure (STACKIT GmbH &amp; Co. KG, Neckarsulm, Germany) in data centres in the
          European Union. STACKIT acts as our processor under a data processing agreement. We
          operate our own sign-in service (Keycloak) on this infrastructure; your credentials are
          not shared with third-party identity providers unless your organisation configures single
          sign-on with its own provider.
        </p>
      </Section>

      <Section title="4. What we process, why, and on which legal basis">
        <p>
          <strong>Website and server logs.</strong> When you access our services, our servers
          automatically record technical data such as IP address, date and time, requested URL,
          referrer, browser and operating system. We use this to deliver the service, keep it secure
          and investigate abuse. Legal basis: Art. 6 (1) (f) GDPR (our legitimate interest in a
          secure, working service). Logs are deleted after <V>[[LOG RETENTION, e.g. 30 days]]</V>{' '}
          unless needed to investigate a specific security incident.
        </p>
        <p>
          <strong>Account and workspace.</strong> When you sign up or are invited, we process your
          name, email address, password (stored only as a salted hash), organisation and workspace
          name, role and membership, and sign-in and audit events. Legal basis: Art. 6 (1) (b) GDPR
          (performance of the contract), and Art. 6 (1) (f) GDPR for security and audit logging.
        </p>
        <p>
          <strong>Billing.</strong> For paid plans we process billing contact, company and tax
          details, plan and invoice history. Card and payment details are entered directly with our
          payment provider Stripe and are not stored on our servers. Legal basis: Art. 6 (1) (b)
          GDPR and Art. 6 (1) (c) GDPR (statutory accounting and tax obligations).
        </p>
        <p>
          <strong>Transactional email.</strong> We send service emails such as email verification,
          invitations, security notices and billing notices. Legal basis: Art. 6 (1) (b) GDPR. We do
          not send marketing email without your separate consent.
        </p>
        <p>
          <strong>Support and contact.</strong> If you contact us, we process your message and
          contact details to answer you. Legal basis: Art. 6 (1) (b) or (f) GDPR.
        </p>
      </Section>

      <Section title="5. Cookies">
        <p>
          We only use cookies that are strictly necessary to provide the service you request:
          session and authentication cookies to keep you signed in, CSRF protection, and a cookie
          remembering which workspace you are working in. These are permitted without consent under
          § 25 (2) No. 2 TDDDG. We do not use analytics, advertising or tracking cookies.
        </p>
      </Section>

      <Section title="6. Recipients and processors">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>STACKIT GmbH &amp; Co. KG</strong> (Germany): cloud hosting, databases, object
            storage.
          </li>
          <li>
            <strong>Stripe Payments Europe, Ltd.</strong> (Ireland): payment processing and
            subscription billing. Stripe may transfer data to Stripe, Inc. in the USA; such
            transfers are based on the EU-U.S. Data Privacy Framework and/or the EU Standard
            Contractual Clauses (Art. 45, 46 GDPR). For data Stripe processes as an independent
            controller, see{' '}
            <a
              href="https://stripe.com/privacy"
              className="underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              stripe.com/privacy
            </a>
            .
          </li>
          <li>
            <strong>
              <V>{LEGAL.emailProvider}</V>
            </strong>
            : delivery of transactional email.
          </li>
          <li>
            Connected applications that your organisation enables in its workspace receive the user
            and role data needed for single sign-on and user provisioning, on your
            organisation&apos;s instruction.
          </li>
        </ul>
        <p>
          We do not sell personal data. Apart from the above, we disclose data only where we are
          legally required to.
        </p>
      </Section>

      <Section title="7. Retention">
        <p>
          We keep account data for as long as your account exists. After an account or workspace is
          deleted we delete the associated personal data within{' '}
          <V>[[DELETION PERIOD, e.g. 30 days]]</V>, except where statutory retention obligations
          apply: invoices and accounting records are kept for up to 10 years and business
          correspondence for up to 6 years (§ 147 AO, § 257 HGB). Encrypted backups are overwritten
          on a rolling basis within <V>[[BACKUP RETENTION, e.g. 30 days]]</V>.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          We protect data with encryption in transit (TLS), encrypted backups, access control based
          on least privilege, tenant isolation in the database and audit logging. No method of
          transmission or storage is completely secure, but we work to keep our measures in line
          with the state of the art (Art. 32 GDPR).
        </p>
      </Section>

      <Section title="9. Your rights">
        <p>Under the GDPR you have the right to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>access your personal data (Art. 15)</li>
          <li>rectification of inaccurate data (Art. 16)</li>
          <li>erasure (Art. 17)</li>
          <li>restriction of processing (Art. 18)</li>
          <li>data portability (Art. 20)</li>
          <li>withdraw any consent at any time, with effect for the future (Art. 7 (3))</li>
        </ul>
        <p>
          <strong>Right to object (Art. 21 GDPR):</strong> where we process data on the basis of our
          legitimate interests (Art. 6 (1) (f) GDPR), you may object at any time on grounds relating
          to your particular situation.
        </p>
        <p>
          To exercise your rights, email <V>{LEGAL.privacyEmail}</V>. You also have the right to
          lodge a complaint with a supervisory authority (Art. 77 GDPR), in particular in the EU
          member state of your residence or workplace. The authority competent for us is:{' '}
          <V>{LEGAL.supervisoryAuthority}</V>.
        </p>
      </Section>

      <Section title="10. Automated decisions">
        <p>
          We do not use automated decision-making, including profiling, that produces legal or
          similarly significant effects (Art. 22 GDPR).
        </p>
      </Section>

      <Section title="11. Changes">
        <p>
          We may update this policy when our services or legal requirements change. The current
          version is always available on this page with its last-updated date.
        </p>
      </Section>
    </LegalPage>
  );
}

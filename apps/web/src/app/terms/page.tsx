import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage, Section, V } from '@/components/legal/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <Section title="1. Scope and provider">
        <p>
          These Terms govern the use of the {LEGAL.productName} platform (the &quot;Service&quot;)
          provided by <V>{LEGAL.companyName}</V>, <V>{LEGAL.street}</V>, <V>{LEGAL.postalCity}</V>{' '}
          (&quot;we&quot;, &quot;us&quot;). Full details are in our{' '}
          <Link href="/impressum" className="underline">
            Impressum
          </Link>
          .
        </p>
        <p>
          The Service is offered exclusively to businesses within the meaning of § 14 BGB, legal
          entities under public law and special funds under public law (&quot;Customer&quot;), not
          to consumers. Conflicting or supplementary terms of the Customer do not apply unless we
          expressly agree to them in writing.
        </p>
      </Section>

      <Section title="2. Contract and account">
        <p>
          A contract is formed when you create a workspace or accept an order. The person creating
          the account confirms they are authorised to bind the Customer. You must provide accurate
          information and keep your credentials confidential. The Customer is responsible for all
          activity under its workspace and for the users it invites, and must tell us without delay
          about any suspected unauthorised access.
        </p>
      </Section>

      <Section title="3. The Service">
        <p>
          We provide a multi-tenant workspace with team management, single sign-on, billing and
          connected applications as described on our website and in the selected plan. We may
          develop and change the Service, provided that the core functionality of the booked plan is
          not materially reduced. We aim for high availability but do not guarantee uninterrupted
          operation unless a separate service level agreement has been concluded. Planned
          maintenance will be announced in advance where reasonably possible.
        </p>
      </Section>

      <Section title="4. Plans, fees and payment">
        <p>
          Fees depend on the selected plan and are shown before purchase. Unless stated otherwise,
          prices are net of statutory VAT. Subscriptions are billed in advance for the selected
          billing period via our payment provider Stripe and renew automatically until cancelled. If
          payment fails, we may suspend paid features after a reminder. Price changes for existing
          subscriptions will be announced at least 30 days before they take effect, and the Customer
          may cancel with effect from that date.
        </p>
      </Section>

      <Section title="5. Acceptable use">
        <p>The Customer must not, and must ensure its users do not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>use the Service in violation of applicable law or the rights of third parties;</li>
          <li>upload malware or attempt to breach the security or isolation of the Service;</li>
          <li>
            place excessive load on the Service, or scrape or reverse-engineer it beyond what the
            law allows;
          </li>
          <li>resell or sublicense the Service without our written consent.</li>
        </ul>
        <p>
          We may temporarily suspend access where there is a concrete indication of a serious
          violation or a threat to the security of the Service, and will inform the Customer.
        </p>
      </Section>

      <Section title="6. Customer data and data protection">
        <p>
          The Customer retains all rights to the data it stores in the Service (&quot;Customer
          Data&quot;). We process Customer Data only to provide the Service. Where Customer Data
          contains personal data, we process it as a processor on the Customer&apos;s behalf in
          accordance with our Data Processing Agreement under Art. 28 GDPR, which forms part of this
          contract. Data is hosted in the European Union. Our own processing as controller is
          described in our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          After the contract ends, the Customer can export its data for 30 days. We then delete
          Customer Data unless statutory retention obligations require otherwise.
        </p>
      </Section>

      <Section title="7. Intellectual property">
        <p>
          All rights in the Service, including software, design and documentation, remain with us or
          our licensors. For the term of the contract we grant the Customer a non-exclusive,
          non-transferable right to use the Service for its internal business purposes. Feedback may
          be used by us without obligation.
        </p>
      </Section>

      <Section title="8. Confidentiality">
        <p>
          Each party will keep confidential the other party&apos;s non-public information it
          receives in connection with the contract and use it only to perform the contract. This
          obligation survives termination.
        </p>
      </Section>

      <Section title="9. Liability">
        <p>
          We are liable without limitation for intent and gross negligence, for injury to life, body
          or health, under the German Product Liability Act, and where we have given a guarantee.
        </p>
        <p>
          For slight negligence we are liable only for breach of an essential contractual obligation
          (an obligation whose fulfilment makes proper performance of the contract possible and on
          which the Customer may regularly rely), and limited to the damage that is foreseeable and
          typical for this type of contract. In such cases our liability per contract year is
          further limited to the fees paid by the Customer in the twelve months before the damaging
          event.
        </p>
        <p>
          The Customer is responsible for keeping its own backups of business-critical data exported
          from the Service where appropriate. Liability for loss of data is limited to the effort
          that would have been required to restore it had such backups been made. Otherwise, our
          liability is excluded. These limitations also apply to our employees and agents.
        </p>
      </Section>

      <Section title="10. Term and termination">
        <p>
          Free plans can be cancelled at any time. Paid subscriptions run for the selected billing
          period and renew automatically; they can be cancelled at any time with effect from the end
          of the current period. The right of either party to terminate for good cause remains
          unaffected.
        </p>
      </Section>

      <Section title="11. Changes to these Terms">
        <p>
          We may amend these Terms for valid reasons, such as changes in law or new features. We
          will notify the Customer by email at least 30 days in advance. If the Customer does not
          object within that period, the amended Terms apply; we will point this out in the notice.
          If the Customer objects, either party may terminate the contract with effect from the date
          the changes would take effect.
        </p>
      </Section>

      <Section title="12. Final provisions">
        <p>
          The laws of the Federal Republic of Germany apply, excluding the UN Convention on
          Contracts for the International Sale of Goods. If the Customer is a merchant, a legal
          entity under public law or a special fund under public law, the exclusive place of
          jurisdiction is <V>{LEGAL.jurisdictionCity}</V>. Should any provision be invalid, the
          remaining provisions remain unaffected.
        </p>
        <p>
          Questions about these Terms: <V>{LEGAL.email}</V>
        </p>
      </Section>
    </LegalPage>
  );
}

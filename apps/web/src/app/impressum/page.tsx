import type { Metadata } from 'next';

import { LegalPage, Section, V } from '@/components/legal/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Impressum / Legal Notice' };

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum" subtitle="Legal notice pursuant to § 5 DDG and § 18 MStV">
      <Section title="Service provider (Angaben gemäß § 5 DDG)">
        <p>
          <V>{LEGAL.companyName}</V>
          <br />
          <V>{LEGAL.street}</V>
          <br />
          <V>{LEGAL.postalCity}</V>
          <br />
          <V>{LEGAL.country}</V>
        </p>
        <p>
          Represented by (Vertreten durch): <V>{LEGAL.representedBy}</V>
        </p>
      </Section>

      <Section title="Contact (Kontakt)">
        <p>
          Email: <V>{LEGAL.email}</V>
          <br />
          Phone: <V>{LEGAL.phone}</V>
        </p>
      </Section>

      <Section title="Commercial register (Registereintrag)">
        <p>
          Register court (Registergericht): <V>{LEGAL.registerCourt}</V>
          <br />
          Register number (Registernummer): <V>{LEGAL.registerNumber}</V>
        </p>
      </Section>

      <Section title="VAT ID (Umsatzsteuer-Identifikationsnummer)">
        <p>
          VAT identification number pursuant to § 27a UStG: <V>{LEGAL.vatId}</V>
        </p>
      </Section>

      <Section title="Responsible for content (Verantwortlich gemäß § 18 Abs. 2 MStV)">
        <p>
          <V>{LEGAL.contentResponsible}</V>
        </p>
      </Section>

      <Section title="Consumer dispute resolution (Verbraucherstreitbeilegung)">
        <p>
          We are neither willing nor obliged to participate in dispute resolution proceedings before
          a consumer arbitration board (§ 36 VSBG). Our services are offered exclusively to
          businesses.
        </p>
      </Section>

      <Section title="Liability for content and links">
        <p>
          As a service provider we are responsible for our own content on these pages in accordance
          with general law (§ 7 (1) DDG). We are not obliged to monitor transmitted or stored
          third-party information. Our pages contain links to external websites over whose content
          we have no control; the respective provider or operator is always responsible for the
          content of linked pages. If we become aware of any legal infringement, we will remove the
          relevant content or links immediately.
        </p>
      </Section>
    </LegalPage>
  );
}

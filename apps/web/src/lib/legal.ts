/**
 * Single source of truth for the legal entity details shown on /impressum,
 * /privacy and /terms.
 *
 * Every value wrapped in [[...]] is a PLACEHOLDER that must be replaced with
 * the operator's real details before go-live. Placeholders are rendered with
 * a visible highlight (see <Legal.V/>) so they cannot slip into production
 * unnoticed.
 */
export const LEGAL = {
  /** Last revision date shown at the top of each legal page. */
  lastUpdated: '22 November 2026',

  /** Full registered name incl. legal form, e.g. "Example GmbH". */
  companyName: '[[COMPANY LEGAL NAME AND FORM]]',
  /** Product / brand name. */
  productName: 'riogentix',
  street: '[[STREET AND NUMBER]]',
  postalCity: '[[POSTCODE CITY]]',
  country: '[[COUNTRY]]',

  /** Person(s) authorised to represent the company (Geschäftsführer). */
  representedBy: '[[MANAGING DIRECTOR(S)]]',

  email: '[[CONTACT EMAIL]]',
  phone: '[[PHONE NUMBER]]',

  /** e.g. "Amtsgericht München" — leave empty string if not registered. */
  registerCourt: '[[REGISTER COURT]]',
  /** e.g. "HRB 123456". */
  registerNumber: '[[REGISTER NUMBER]]',
  /** USt-IdNr. per § 27a UStG, e.g. "DE123456789". */
  vatId: '[[VAT ID]]',

  /** Person responsible for editorial content per § 18 (2) MStV, with address. */
  contentResponsible: '[[NAME, ADDRESS OF PERSON RESPONSIBLE FOR CONTENT]]',

  /** Address for privacy requests. Can be the same as `email`. */
  privacyEmail: '[[PRIVACY EMAIL]]',
  /**
   * Data Protection Officer. Only required in Germany if ≥20 people regularly
   * process personal data (§ 38 BDSG) or for core-activity monitoring.
   * Set to null if none is appointed.
   */
  dpo: '[[DPO NAME AND CONTACT, OR REMOVE]]' as string | null,

  /** Supervisory authority competent for the company's seat. */
  supervisoryAuthority: '[[DATA PROTECTION SUPERVISORY AUTHORITY FOR YOUR STATE]]',

  /** Transactional email provider used in production. */
  emailProvider: '[[EMAIL PROVIDER, e.g. STACKIT MailOut or Resend]]',

  /** Governing law / venue for the Terms. */
  jurisdictionCity: '[[CITY OF COMPANY SEAT]]',
} as const;

export function isPlaceholder(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('[[') && value.endsWith(']]');
}

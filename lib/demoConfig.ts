/**
 * The homeowner and assessment this demo opens as. In production these come from
 * the assessment record the texted link resolves to; here they seed it.
 */
export const demoConfig = {
  assessmentId: "demo-assessment",
  homeownerFirstName: "Borna",
  homeAddress: "412 Marlow Street, Tampa",
  policyRef: "HO-4471 • Aug 27",
  /**
   * Demo switch carried over from the design's props: turn it off to walk the
   * flow without the reviewer ever asking for a close-up.
   */
  aiFollowUps: true,
} as const;

export const SUPPORT_EMAIL = "inspectionsupport@chrptech.com";
export const SUPPORT_PHONE = "386.666.4830";

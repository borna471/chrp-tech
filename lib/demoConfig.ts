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
  /**
   * Testing only. Shows the reviewer's raw observations and findings under the
   * result card so model behaviour can be judged without opening DevTools.
   *
   * MUST be false before any real homeowner uses this. Findings are the
   * insurer's to interpret — an 8B model asserting "water damage" to a
   * policyholder is a claim implication it should not be making unsupervised.
   */
  showAnalysisDebug: true,
} as const;

export const SUPPORT_EMAIL = "inspectionsupport@chrptech.com";
export const SUPPORT_PHONE = "386.666.4830";

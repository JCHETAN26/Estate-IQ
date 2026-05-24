/**
 * Mortgage math.
 *
 * Standard amortization formula:
 *   M = P · r(1+r)^n / ((1+r)^n − 1)
 *
 *   M = monthly principal & interest payment
 *   P = loan principal
 *   r = monthly interest rate (annual rate / 12)
 *   n = number of payments (term years * 12)
 *
 * The zero-rate edge case (r=0) reduces to M = P / n.
 *
 * PMI heuristic:
 *   When the down payment is below 20% of purchase price, monthly PMI
 *   is approximated at 0.5% / 12 of the loan principal. This is a
 *   conventional industry rule of thumb (range is roughly 0.3%–1.5%
 *   annually depending on credit and LTV) — close enough for an
 *   investment-screening tool, and we expose pmiMonthly as a separate
 *   line item so callers can override it.
 */

const PMI_THRESHOLD_LTV = 0.8; // PMI required when LTV > 80%
const PMI_ANNUAL_RATE = 0.005; // 0.5% / year of loan principal

export type MortgageInputs = {
  /** Property purchase price. */
  listPrice: number;
  /** Percent (0–100), not a fraction. */
  downPaymentPct: number;
  /** Annual interest rate, percent. */
  interestRatePct: number;
  /** Loan term in years (typical: 15 or 30). */
  loanTermYears: number;
};

export type MortgageBreakdown = {
  loanAmount: number;
  downPayment: number;
  /** Effective loan-to-value ratio (0–1). */
  ltv: number;
  monthlyRate: number;
  monthlyPayments: number;
  /** Monthly principal & interest only. */
  monthlyPrincipalAndInterest: number;
  /** PMI approximation; zero when LTV <= 80%. */
  pmiMonthly: number;
  /** Total interest paid over the life of the loan. */
  totalInterestOverTerm: number;
};

/**
 * Compute a deterministic mortgage breakdown from financing inputs.
 *
 * Negative or non-finite inputs are coerced to safe defaults rather
 * than throwing — callers are expected to use the Zod schemas in
 * @estate-iq/shared to validate at the boundary.
 */
export function calculateMortgage(inputs: MortgageInputs): MortgageBreakdown {
  const listPrice = Math.max(0, inputs.listPrice);
  const downPaymentPct = clamp(inputs.downPaymentPct, 0, 100);
  const interestRatePct = Math.max(0, inputs.interestRatePct);
  const loanTermYears = Math.max(1, Math.floor(inputs.loanTermYears));

  const downPayment = round2(listPrice * (downPaymentPct / 100));
  const loanAmount = round2(listPrice - downPayment);
  const ltv = listPrice > 0 ? loanAmount / listPrice : 0;

  const monthlyRate = interestRatePct / 100 / 12;
  const monthlyPayments = loanTermYears * 12;

  const monthlyPrincipalAndInterest = round2(
    monthlyAmortizedPayment(loanAmount, monthlyRate, monthlyPayments),
  );

  const pmiMonthly = ltv > PMI_THRESHOLD_LTV ? round2((loanAmount * PMI_ANNUAL_RATE) / 12) : 0;

  const totalInterestOverTerm = round2(monthlyPrincipalAndInterest * monthlyPayments - loanAmount);

  return {
    loanAmount,
    downPayment,
    ltv,
    monthlyRate,
    monthlyPayments,
    monthlyPrincipalAndInterest,
    pmiMonthly,
    totalInterestOverTerm,
  };
}

/** Public helper for tests and ad-hoc callers. */
export function monthlyAmortizedPayment(
  principal: number,
  monthlyRate: number,
  numberOfPayments: number,
): number {
  if (principal <= 0 || numberOfPayments <= 0) return 0;
  if (monthlyRate === 0) return principal / numberOfPayments;
  const factor = Math.pow(1 + monthlyRate, numberOfPayments);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

Produce an investment memo for the following property using the supplied metrics. Output a single JSON object matching this schema:

```json
{
  "headline": "string  (one sentence summary verdict, ≤ 140 chars)",
  "summary": "string  (2-3 sentence executive summary, markdown allowed)",
  "strengths": ["string"],
  "risks": ["string"],
  "negotiationInsights": ["string"],
  "recommendation": "Buy | Pass | Negotiate | Investigate further",
  "confidence": "Low | Moderate | High"
}
```

Each list should contain 2-5 items. Each item is a single concise sentence (≤ 200 chars).

# Property

- Address: {{property.address}}, {{property.city}}, {{property.state}} {{property.zipCode}}
- List price: ${{numbers.listPrice}}
- Property type: {{property.propertyType}}
- Bedrooms: {{property.bedrooms}} Bathrooms: {{property.bathrooms}}
- Living area: {{numbers.squareFeet}} sqft
- Year built: {{numbers.yearBuilt}}

# Computed metrics

## Long-term rental performance

- Estimated monthly rent: ${{numbers.monthlyRent}} ({{rentSource}})
- Rent-to-price (annualized): {{numbers.rentToPricePct}}%
- Gross rent multiplier: {{numbers.grossRentMultiplier}}
- Meets the "1% rule": {{flags.meetsOnePercentRule}}

## Mortgage assumptions ({{numbers.downPaymentPct}}% down, {{numbers.interestRatePct}}% rate, {{numbers.loanTermYears}}-yr term)

- Loan amount: ${{numbers.loanAmount}}
- Monthly P&I: ${{numbers.monthlyPrincipalAndInterest}}
- Monthly PITI: ${{numbers.monthlyPaymentPITI}}
- Total interest over term: ${{numbers.totalInterestOverTerm}}

## Cash flow (long-term rental)

- Monthly cash flow: ${{numbers.monthlyCashFlow}}
- Annual cash flow: ${{numbers.annualCashFlow}}
- Net operating income (annual): ${{numbers.netOperatingIncome}}
- Cap rate: {{numbers.capRatePct}}%
- Cash-on-cash return: {{numbers.cashOnCashPct}}%
- Cash invested at close (down + ~3% closing): ${{numbers.cashInvested}}

## Short-term rental projection ({{airbnbSource}})

- ADR: ${{numbers.adr}}
- Occupancy: {{numbers.airbnbOccupancyPct}}%
- Projected gross revenue: ${{numbers.airbnbGrossRevenue}}
- Projected net cash flow: ${{numbers.airbnbNetCashFlow}}
- Furnishing break-even: {{numbers.airbnbBreakEvenMonths}} months
- STR risk level: {{flags.strRiskLevel}}

## Investment score

- Overall: {{numbers.investmentScore}}/100 ({{flags.investmentRating}})
- Cash flow factor: {{numbers.factorCashFlow}}/100
- Rent-to-price factor: {{numbers.factorRentToPrice}}/100
- Tax burden factor: {{numbers.factorTaxBurden}}/100
- Neighborhood growth factor: {{numbers.factorNeighborhood}}/100
- Appreciation factor: {{numbers.factorAppreciation}}/100

Remember: only use the numbers above. Do not invent any other figures.

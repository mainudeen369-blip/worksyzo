# 06 — Pricing & usage model

## Positioning

Affordable INR SaaS for Indian SMEs — **hypotheses until customer conversations validate**.

| Plan | Price (hypothesis) | Fits |
|------|--------------------|------|
| Free trial | 14 days | Evaluation |
| Starter | ₹999 / mo | Solo owner + small team |
| Business | ₹2,999 / mo | Growing SME |
| Growth | ₹7,999 / mo | Larger SME / multi-dept |
| Enterprise | Custom | SSO, dedicated needs later |

## What we meter

| Meter | Starter (example) | Business | Growth |
|-------|-------------------|----------|--------|
| Seats (active users) | 5 | 25 | 100 |
| Storage | 5 GB | 50 GB | 200 GB |
| Documents | 200 | 2,000 | 10,000 |
| AI requests / month | 500 | 5,000 | 25,000 |
| Embed/re-ingest | included soft cap | higher | higher |

Exact numbers are placeholders — store in `usage_limits` table so marketing can change without code deploys.

## Enforcement

1. Soft warn at 80%  
2. Hard block AI or uploads at 100% (configurable)  
3. Owners see usage dashboard  

## Architecture readiness (build in V1 even if Razorpay is Phase 7)

- `organizations.plan_code`  
- `subscriptions` row  
- `ai_usage_daily` increments on every AI call  
- Storage bytes tracked on document upload/delete  
- Feature flags: `billing.enabled=false` until Phase 7  

## Razorpay (Phase 7)

- Trial → paid subscription  
- Webhooks update `subscriptions.status`  
- Invoice/history in owner billing page  
- Proration / seat changes: keep simple at first (plan change at period end)

## Packaging advice

Sell **outcomes** (“your team’s AI that knows your company”), not “tokens.”  
Show usage so owners don’t get surprise bills.

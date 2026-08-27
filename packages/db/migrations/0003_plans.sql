-- ============================================================================
-- 0003_plans: plan limits live in data, not in code
-- ============================================================================
-- Pricing is a hypothesis (docs/06-pricing-and-usage.md). Keeping limits in a
-- table means changing packaging is an UPDATE, not a deploy.
-- ============================================================================

INSERT INTO usage_limits
  (plan_code, display_name, price_inr_monthly, max_users, max_documents, max_storage_bytes, max_ai_requests_month, sort_order)
VALUES
  ('trial',      'Free trial', 0,    5,   50,     1073741824,   200,   0),
  ('starter',    'Starter',    999,  5,   200,    5368709120,   500,   1),
  ('business',   'Business',   2999, 25,  2000,   53687091200,  5000,  2),
  ('growth',     'Growth',     7999, 100, 10000,  214748364800, 25000, 3),
  ('enterprise', 'Enterprise', 0,    1000, 100000, 1099511627776, 250000, 4)
ON CONFLICT (plan_code) DO UPDATE SET
  display_name          = EXCLUDED.display_name,
  price_inr_monthly     = EXCLUDED.price_inr_monthly,
  max_users             = EXCLUDED.max_users,
  max_documents         = EXCLUDED.max_documents,
  max_storage_bytes     = EXCLUDED.max_storage_bytes,
  max_ai_requests_month = EXCLUDED.max_ai_requests_month,
  sort_order            = EXCLUDED.sort_order;

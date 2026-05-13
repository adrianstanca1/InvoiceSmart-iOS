#!/usr/bin/env bash
# Contract smoke test for the InvoiceSmart iOS app.
#
# Exercises every request shape `services/api.ts` produces against a
# running backend, asserts the response field names + types match what
# `types.ts` declares. Failing here means the iOS app and the backend
# have drifted; passing means the contract is sound.
#
# Usage:
#   ./scripts/contract-smoke.sh                    # → http://127.0.0.1:3008
#   API=https://api.invoicesmart.cortexbuildpro.com ./scripts/contract-smoke.sh
#
# Requires: curl, jq.
set -euo pipefail

API="${API:-http://127.0.0.1:3008}"
TS=$(date +%s)
EMAIL="contract-smoke-${TS}@invoicesmart.test"
PW="contract-smoke-password-${TS}"
OUT=$(mktemp -d /tmp/invoicesmart-contract-XXXXXX)
PASS=0
FAIL=0

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

# usage: assert <jq filter> <expected> <where>
#   <jq filter> evaluated against the latest response file. Use `*` for
#   "any non-null value". Use `prefix:VAL` for "starts with VAL"
#   (handy when Postgres dates come back as ISO timestamps).
#   jq's `//` operator treats false as falsy, so we coerce via tostring
#   then check for the literal "null" / null-from-tostring-of-null.
assert() {
  local filter=$1 expected=$2 where=$3
  local actual
  actual=$(jq -r "($filter) | tostring" "$OUT/last.json" 2>/dev/null || echo "JQ_ERR")
  if [ "$actual" = "null" ] || [ "$actual" = "JQ_ERR" ] || [ -z "$actual" ]; then
    actual="MISSING"
  fi
  if [ "$expected" = "*" ] && [ "$actual" != "MISSING" ]; then
    PASS=$((PASS + 1)); green "  ✓ $where: $filter → $actual"
  elif [[ "$expected" == prefix:* ]] && [[ "$actual" == "${expected#prefix:}"* ]]; then
    PASS=$((PASS + 1)); green "  ✓ $where: $filter starts with ${expected#prefix:} (got $actual)"
  elif [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1)); green "  ✓ $where: $filter = $expected"
  else
    FAIL=$((FAIL + 1)); red "  ✗ $where: $filter expected $expected, got $actual"
  fi
}

# usage: probe <name> <method> <path> [body] [auth?]
probe() {
  local name=$1 method=$2 path=$3 body=${4:-} auth=${5:-}
  local args=(-sS -m 15 -o "$OUT/last.json" -w "%{http_code}" -X "$method" -H "Content-Type: application/json")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  [ -n "$body" ] && args+=(-d "$body")
  args+=("$API$path")
  local code
  code=$(curl "${args[@]}" 2>&1 || echo "ERR")
  printf '%-30s %s %s\n' "$name" "$code" "$path"
  echo "$code" > "$OUT/last.code"
}

yellow "=== InvoiceSmart contract smoke ==="
yellow "API: $API"
yellow "Email: $EMAIL"
yellow "Out: $OUT"
echo

# 1. Health
probe "health"     GET  "/api/health"
assert ".status"           "ok"                "health"
assert ".db.connected"     "true"              "health"
assert ".uptimeSec"        "*"                 "health"

# 2. Register — iOS sends {email, password, first_name, last_name, ...}
probe "register"   POST "/api/auth/register" "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"first_name\":\"Contract\",\"last_name\":\"Smoke\"}"
assert ".token"            "*"                 "register has token"
assert ".user.id"          "*"                 "register has user.id"
assert ".user.email"       "$EMAIL"            "register echoes email"
TOKEN=$(jq -r '.token' "$OUT/last.json")
USER_ID=$(jq -r '.user.id' "$OUT/last.json")

# 3. Login
probe "login"      POST "/api/auth/login" "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}"
assert ".token"            "*"                 "login token"
assert ".user.email"       "$EMAIL"            "login email"

# 4. /me → snake_case user
probe "me"         GET  "/api/auth/me" "" "$TOKEN"
assert ".id"               "$USER_ID"          "me.id"
assert ".email"            "$EMAIL"            "me.email"
assert ".first_name"       "Contract"          "me.first_name (snake_case)"
assert ".last_name"        "Smoke"             "me.last_name (snake_case)"

# 5. Create client — iOS sends {name, email, ...}; expect snake_case row
probe "client_create" POST "/api/clients" '{"name":"Acme Construction","email":"billing@acme.test","vat_number":"GB123456789"}' "$TOKEN"
assert ".id"               "*"                 "client_create.id"
assert ".user_id"          "$USER_ID"          "client_create.user_id"
assert ".name"             "Acme Construction" "client_create.name"
assert ".email"            "billing@acme.test" "client_create.email"
assert ".vat_number"       "GB123456789"       "client_create.vat_number (snake_case)"
assert ".created_at"       "*"                 "client_create.created_at"
CLIENT_ID=$(jq -r '.id' "$OUT/last.json")

# 6. List clients — iOS expects {data: Client[], pagination}
probe "client_list" GET "/api/clients" "" "$TOKEN"
assert ".data | type"      "array"             "client_list.data is array"
assert ".data | length"    "1"                 "client_list.data has 1 client"
assert ".data[0].name"     "Acme Construction" "client_list.data[0].name"
assert ".pagination.total" "1"                 "client_list.pagination.total"

# 7. Create invoice — iOS sends {client_id, tax_rate, line_items: [{description, quantity, unit_price}]}
INVOICE_BODY=$(cat <<JSON
{
  "client_id": "$CLIENT_ID",
  "issue_date": "2026-05-13",
  "due_date": "2026-06-13",
  "tax_rate": 20,
  "discount_rate": 0,
  "retention_rate": 0,
  "cis_rate": 0,
  "line_items": [
    {"description": "Site survey", "quantity": 1, "unit_price": 1500},
    {"description": "Foundation", "quantity": 40, "unit_price": 75}
  ],
  "invoice_prefix": "INV",
  "auto_increment": true
}
JSON
)
probe "invoice_create" POST "/api/invoices" "$INVOICE_BODY" "$TOKEN"
assert ".id"                "*"                "invoice_create.id"
assert ".invoice_number"    "INV-0001"         "invoice_create.invoice_number (snake_case)"
assert ".status"            "draft"            "invoice_create.status (lowercase)"
assert ".issue_date"        "prefix:2026-05-13" "invoice_create.issue_date (snake_case)"
assert ".due_date"          "prefix:2026-06-13" "invoice_create.due_date (snake_case)"
assert ".tax_rate"          "20.00"            "invoice_create.tax_rate (DECIMAL string)"
assert ".subtotal"          "4500.00"          "invoice_create.subtotal (DECIMAL string)"
assert ".tax_amount"        "900.00"           "invoice_create.tax_amount"
assert ".total_amount"      "5400.00"          "invoice_create.total_amount"
INVOICE_ID=$(jq -r '.id' "$OUT/last.json")

# 8. GET single invoice — must include line_items + transactions arrays
probe "invoice_get" GET "/api/invoices/$INVOICE_ID" "" "$TOKEN"
assert ".line_items | length"      "2"          "invoice_get.line_items has 2"
assert ".line_items[0].description" "Site survey" "invoice_get.line_items[0].description"
assert ".line_items[0].unit_price"  "1500.00"   "invoice_get.line_items[0].unit_price (snake_case DECIMAL)"
assert ".transactions | type"       "array"     "invoice_get.transactions is array"

# 9. Record partial payment — iOS sends {amount, payment_method, reference?}
probe "payment_partial" POST "/api/invoices/$INVOICE_ID/payments" '{"amount":2400,"payment_method":"bank-transfer","reference":"BT-001"}' "$TOKEN"
assert ".success"          "true"              "payment_partial.success"

# 10. Status should now be partial
probe "after_partial" GET "/api/invoices/$INVOICE_ID" "" "$TOKEN"
assert ".status"           "partial"           "after_partial.status (NEW enum value)"
assert ".amount_paid"      "2400.00"           "after_partial.amount_paid"
assert ".amount_due"       "3000.00"           "after_partial.amount_due"

# 11. Send invoice
probe "send"       POST "/api/invoices/$INVOICE_ID/send" "{}" "$TOKEN"
assert ".success"          "true"              "send.success"

# 12. Mark paid (force)
probe "mark_paid"  PATCH "/api/invoices/$INVOICE_ID/paid" "{}" "$TOKEN"
assert ".status"           "paid"              "mark_paid.status"
assert ".amount_due"       "0.00"              "mark_paid.amount_due"

# 13. Transactions filter
probe "txn_list"   GET "/api/transactions" "" "$TOKEN"
assert ".data | type"      "array"             "txn_list.data is array"

# 14. Tax rules — iOS expects {data: TaxRule[], pagination}
probe "tax_create" POST "/api/tax-rules" '{"name":"UK VAT Standard","rate":20,"type":"vat","country":"GB","is_default":true}' "$TOKEN"
assert ".name"             "UK VAT Standard"   "tax_create.name"
assert ".rate"             "20.00"             "tax_create.rate (DECIMAL string)"
assert ".is_default"       "true"              "tax_create.is_default (snake_case)"

probe "tax_list"   GET "/api/tax-rules" "" "$TOKEN"
assert ".data | length"    "1"                 "tax_list.data has 1"

# 15. Settings — sensitive masking + SSRF allowlist
probe "settings"   GET "/api/settings" "" "$TOKEN"
assert ".invoicePrefix"    "INV-"              "settings.invoicePrefix (camelCase report-like fields)"
assert ".defaultCurrency"  "GBP"               "settings.defaultCurrency"

probe "settings_ssrf" POST "/api/settings" '{"key":"aiEndpoint","value":"http://cortexbuild-postgres:5432"}' "$TOKEN"
test "$(cat $OUT/last.code)" = "400" && { green "  ✓ SSRF allowlist blocked internal host"; PASS=$((PASS + 1)); } || { red "  ✗ SSRF should have returned 400"; FAIL=$((FAIL + 1)); }

# 16. Reports dashboard — camelCase per backend
probe "dashboard"  GET "/api/reports/dashboard" "" "$TOKEN"
assert ".totalRevenue"     "5400"              "dashboard.totalRevenue"
assert ".invoiceCount"     "1"                 "dashboard.invoiceCount"
assert ".clientCount"      "1"                 "dashboard.clientCount"

# 17. Profit-loss — wrapped under .profitAndLoss
probe "pl"         GET "/api/reports/profit-loss" "" "$TOKEN"
assert ".profitAndLoss.revenue" "5400"         "pl.profitAndLoss.revenue (nested camelCase)"
assert ".profitAndLoss.netProfit" "5400"       "pl.profitAndLoss.netProfit"

# 18. AI config + fallback paths (don't need a real LLM)
probe "ai_config"  GET "/api/ai/config" "" "$TOKEN"
assert ".provider"         "ollama"            "ai_config.provider"
assert ".hasApiKey"        "false"             "ai_config.hasApiKey"

probe "ai_pl"      GET "/api/ai/summarize-pl" "" "$TOKEN"
assert ".ai.source"        "*"                 "ai/summarize-pl reports ai source"
assert ".metrics.revenue"  "5400"              "ai/summarize-pl.metrics.revenue"

# 19. Negative auth: 401 on missing bearer
probe "no_auth"    GET "/api/invoices"
test "$(cat $OUT/last.code)" = "401" && { green "  ✓ no token → 401"; PASS=$((PASS + 1)); } || { red "  ✗ no token expected 401"; FAIL=$((FAIL + 1)); }

# 20. UUID validation
probe "bad_uuid"   GET "/api/invoices/not-a-uuid" "" "$TOKEN"
test "$(cat $OUT/last.code)" = "400" && { green "  ✓ non-UUID id → 400"; PASS=$((PASS + 1)); } || { red "  ✗ non-UUID expected 400"; FAIL=$((FAIL + 1)); }

echo
yellow "=== summary ==="
green  "  Passed: $PASS"
if [ "$FAIL" -gt 0 ]; then
  red  "  Failed: $FAIL"
  yellow "  Test artefacts retained at: $OUT"
  exit 1
fi
green "  Failed: 0"
rm -rf "$OUT"
green "  All contract assertions green — iOS app ↔ backend contract is sound."

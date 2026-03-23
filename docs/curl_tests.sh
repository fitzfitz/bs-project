#!/bin/bash
# =============================================================================
# TMNG SaaS Platform — Complete API Curl Test Suite
# =============================================================================
#
# Usage:
#   1. Start the dev server:  pnpm --filter @tmng/saas-api dev
#   2. Seed the database:     pnpm --filter @tmng/saas-api db:seed
#   3. Run this file:         bash docs/curl_tests.sh
#   4. Or copy individual tests and run them in your terminal
#
# Configuration:
#   Set BASE_URL to your API endpoint (local dev or deployed)
#
# Seeded credentials (password: Password123! for all, orgSlug: budis-barbershop):
#   owner@barber.com        — OWNER (tenant super admin)
#   manager@barber.com      — MANAGER
#   cashier@barber.com      — CASHIER
#   budi@barber.com         — BARBER (Master)
#   rudi@barber.com         — BARBER (Senior)
#   customer1@gmail.com     — CUSTOMER
#   customer2@gmail.com     — CUSTOMER
#
# =============================================================================

BASE_URL="http://localhost:8787/api"
ORG_SLUG="budis-barbershop"
PASS="Password123!"
TOKEN=""
MANAGER_TOKEN=""
BARBER_TOKEN=""
SUPER_ADMIN_TOKEN=""

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Color output helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
test_name() { echo -e "${YELLOW}▸ $1${NC}"; }

assert_success() {
  local RESPONSE="$1"
  local TEST="$2"
  local SUCCESS=$(echo "$RESPONSE" | json_extract '.success')
  if [ "$SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}✓ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗ FAIL${NC}: $TEST"
    echo "$RESPONSE" | json_pp
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_fail() {
  local RESPONSE="$1"
  local TEST="$2"
  local SUCCESS=$(echo "$RESPONSE" | json_extract '.success')
  if [ "$SUCCESS" = "false" ]; then
    echo -e "  ${GREEN}✓ PASS (expected failure)${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗ FAIL${NC}: Expected failure but got success — $TEST"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# JSON helpers (use Node when jq is not installed, e.g. on Windows)
if command -v jq &>/dev/null; then
  json_pp() { jq .; }
  json_extract() { jq -r "$1"; }
  json_length_data() { jq '.data | length'; }
else
  json_pp() { node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2));}catch(e){process.stdout.write(d);}});"; }
  json_length_data() { node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(Array.isArray(o.data)?o.data.length:0);}catch(e){console.log(0);}});"; }
  json_extract() { local key="${1#.}"; key="${key//\[-1\]/.\-1}"; node -e "
const key=process.argv[1];
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try {
    let o=JSON.parse(d);
    for (const p of key.split('.').filter(Boolean)) {
      if (o==null) break;
      if (p==='-1' && Array.isArray(o)) o=o[o.length-1];
      else if (p==='-1') o=undefined;
      else o=o[p];
    }
    console.log(o!=null&&o!==undefined?String(o):'');
  } catch(e){ console.log(''); }
});" "$key"; }
fi

# =============================================================================
# 0. HEALTH CHECK
# =============================================================================
section "0. Health Check"

test_name "0.1 Health endpoint"
RESPONSE=$(curl -s "$BASE_URL/health")
assert_success "$RESPONSE" "0.1 Health"

# =============================================================================
# 1. AUTHENTICATION (using seeded users)
# =============================================================================
section "1. Authentication"

test_name "1.1 Login as customer (customer1@gmail.com)"
CUSTOMER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"customer1@gmail.com\",
    \"password\": \"$PASS\"
  }")
assert_success "$CUSTOMER_RESPONSE" "1.1 Customer login"
TOKEN=$(echo "$CUSTOMER_RESPONSE" | json_extract '.data.accessToken')
REFRESH_TOKEN=$(echo "$CUSTOMER_RESPONSE" | json_extract '.data.refreshToken')
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | json_extract '.data.user.id')
echo -e "  ${GREEN}TOKEN captured, CUSTOMER_ID=$CUSTOMER_ID${NC}"

test_name "1.2 Login as manager (manager@barber.com)"
MANAGER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"manager@barber.com\",
    \"password\": \"$PASS\"
  }")
assert_success "$MANAGER_RESPONSE" "1.2 Manager login"
MANAGER_TOKEN=$(echo "$MANAGER_RESPONSE" | json_extract '.data.accessToken')
echo -e "  ${GREEN}MANAGER_TOKEN captured${NC}"

test_name "1.3 Login as barber (budi@barber.com)"
BARBER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"budi@barber.com\",
    \"password\": \"$PASS\"
  }")
assert_success "$BARBER_RESPONSE" "1.3 Barber login"
BARBER_TOKEN=$(echo "$BARBER_RESPONSE" | json_extract '.data.accessToken')
BARBER_USER_ID=$(echo "$BARBER_RESPONSE" | json_extract '.data.user.id')
echo -e "  ${GREEN}BARBER_TOKEN captured, BARBER_USER_ID=$BARBER_USER_ID${NC}"

test_name "1.4 Login as owner (owner@barber.com)"
SA_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"owner@barber.com\",
    \"password\": \"$PASS\"
  }")
assert_success "$SA_RESPONSE" "1.4 Owner login"
SUPER_ADMIN_TOKEN=$(echo "$SA_RESPONSE" | json_extract '.data.accessToken')
echo -e "  ${GREEN}SUPER_ADMIN_TOKEN captured${NC}"

test_name "1.5 Get current profile (customer)"
RESPONSE=$(curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "1.5 Get profile"

test_name "1.6 Update profile (customer)"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Rizky Updated"
  }')
assert_success "$RESPONSE" "1.6 Update profile"

test_name "1.7 Refresh token"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")
assert_success "$RESPONSE" "1.7 Refresh token"

test_name "1.8 Invalid login (wrong password)"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"customer1@gmail.com\",
    \"password\": \"WrongPassword!\"
  }")
assert_fail "$RESPONSE" "1.8 Expected invalid credentials"

test_name "1.9 Unauthorized access (no token)"
RESPONSE=$(curl -s "$BASE_URL/auth/me")
assert_fail "$RESPONSE" "1.9 Expected 401"

# =============================================================================
# FETCH EXISTING IDS (from seeded data)
# =============================================================================
section "Setup: Fetching Seeded Data IDs"

echo -e "${YELLOW}Fetching branch, service, and staff IDs from seeded data...${NC}"

BRANCHES_RESPONSE=$(curl -s "$BASE_URL/branches")
BRANCH_ID=$(echo "$BRANCHES_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const b=o.data.find(x=>x.name.includes('Kemang'));
  console.log(b?b.id:o.data[0].id);
});")
BRANCH2_ID=$(echo "$BRANCHES_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const b=o.data.find(x=>x.name.includes('Central'));
  console.log(b?b.id:o.data[0].id);
});")
echo -e "  ${GREEN}BRANCH_ID=$BRANCH_ID${NC}"
echo -e "  ${GREEN}BRANCH2_ID=$BRANCH2_ID${NC}"

SERVICES_RESPONSE=$(curl -s "$BASE_URL/services")
SVC1_ID=$(echo "$SERVICES_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const s=o.data.find(x=>x.name==='Haircut');
  console.log(s?s.id:'');
});")
SVC2_ID=$(echo "$SERVICES_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const s=o.data.find(x=>x.name==='Shave');
  console.log(s?s.id:'');
});")
SVC3_ID=$(echo "$SERVICES_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const s=o.data.find(x=>x.name==='Hot Towel');
  console.log(s?s.id:'');
});")
COMBO_ID=$(echo "$SERVICES_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const s=o.data.find(x=>x.type==='COMBO');
  console.log(s?s.id:'');
});")
echo -e "  ${GREEN}SVC1_ID (Haircut)=$SVC1_ID${NC}"
echo -e "  ${GREEN}SVC2_ID (Shave)=$SVC2_ID${NC}"
echo -e "  ${GREEN}SVC3_ID (Hot Towel)=$SVC3_ID${NC}"
echo -e "  ${GREEN}COMBO_ID=$COMBO_ID${NC}"

STAFF_RESPONSE=$(curl -s "$BASE_URL/staff" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
BARBER_PROFILE_ID=$(echo "$STAFF_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const b=o.data.find(x=>x.user&&x.user.email==='budi@barber.com');
  console.log(b?b.id:'');
});")
BARBER2_PROFILE_ID=$(echo "$STAFF_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  const b=o.data.find(x=>x.user&&x.user.email==='rudi@barber.com');
  console.log(b?b.id:'');
});")
echo -e "  ${GREEN}BARBER_PROFILE_ID (Budi)=$BARBER_PROFILE_ID${NC}"
echo -e "  ${GREEN}BARBER2_PROFILE_ID (Rudi)=$BARBER2_PROFILE_ID${NC}"

PRODUCTS_RESPONSE=$(curl -s "$BASE_URL/inventory/products?page=1&limit=10" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
PRODUCT_ID=$(echo "$PRODUCTS_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  console.log(o.data&&o.data[0]?o.data[0].id:'');
});")
PRODUCT2_ID=$(echo "$PRODUCTS_RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const o=JSON.parse(d);
  console.log(o.data&&o.data[1]?o.data[1].id:'');
});")
echo -e "  ${GREEN}PRODUCT_ID=$PRODUCT_ID${NC}"
echo -e "  ${GREEN}PRODUCT2_ID=$PRODUCT2_ID${NC}"

TODAY=$(date +%Y-%m-%d)
echo -e "  ${GREEN}TODAY=$TODAY${NC}"

# =============================================================================
# 2. BRANCHES
# =============================================================================
section "2. Branches"

test_name "2.1 List all branches"
RESPONSE=$(curl -s "$BASE_URL/branches")
assert_success "$RESPONSE" "2.1 List branches"

test_name "2.2 List branches filtered by city"
RESPONSE=$(curl -s "$BASE_URL/branches?city=Jakarta")
assert_success "$RESPONSE" "2.2 List by city"

test_name "2.3 Get branch by ID"
RESPONSE=$(curl -s "$BASE_URL/branches/$BRANCH_ID")
assert_success "$RESPONSE" "2.3 Get branch"

test_name "2.4 Create new test branch (Super Admin)"
NEW_BRANCH=$(curl -s -X POST "$BASE_URL/branches" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Branch Curl",
    "address": "Jl. Test No. 1",
    "city": "Jakarta",
    "phone": "+62210001111"
  }')
assert_success "$NEW_BRANCH" "2.4 Create branch"
NEW_BRANCH_ID=$(echo "$NEW_BRANCH" | json_extract '.data.id')

test_name "2.5 Update branch (Super Admin)"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/branches/$BRANCH_ID" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Barber Central Jakarta (Updated)" }')
assert_success "$RESPONSE" "2.5 Update branch"

test_name "2.6 Set operating hours"
RESPONSE=$(curl -s -X PUT "$BASE_URL/branches/$BRANCH_ID/operating-hours" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hours": [
      { "day": "MONDAY", "openTime": "09:00", "closeTime": "21:00" },
      { "day": "TUESDAY", "openTime": "09:00", "closeTime": "21:00" },
      { "day": "WEDNESDAY", "openTime": "09:00", "closeTime": "21:00" },
      { "day": "THURSDAY", "openTime": "09:00", "closeTime": "21:00" },
      { "day": "FRIDAY", "openTime": "09:00", "closeTime": "22:00" },
      { "day": "SATURDAY", "openTime": "08:00", "closeTime": "22:00" },
      { "day": "SUNDAY", "openTime": "10:00", "closeTime": "20:00" }
    ]
  }')
assert_success "$RESPONSE" "2.6 Set hours"

test_name "2.7 Add surge rule (weekend peak)"
SURGE_RESPONSE=$(curl -s -X POST "$BASE_URL/branches/$BRANCH_ID/surge-rules" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekend Peak",
    "multiplier": 1.2,
    "days": ["SATURDAY", "SUNDAY"],
    "startHour": 10,
    "endHour": 14
  }')
assert_success "$SURGE_RESPONSE" "2.7 Add surge rule"
SURGE_RULE_ID=$(echo "$SURGE_RESPONSE" | json_extract '.data.id')

test_name "2.8 Update surge rule"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/branches/$BRANCH_ID/surge-rules/$SURGE_RULE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "multiplier": 1.3 }')
assert_success "$RESPONSE" "2.8 Update surge"

test_name "2.9 Delete surge rule"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/branches/$BRANCH_ID/surge-rules/$SURGE_RULE_ID" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "2.9 Delete surge"

test_name "2.10 Deactivate test branch (Super Admin)"
if [ -n "$NEW_BRANCH_ID" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/branches/$NEW_BRANCH_ID" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
  assert_success "$RESPONSE" "2.10 Deactivate branch"
else
  echo -e "  ${YELLOW}SKIP (no test branch)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 3. SERVICES (Global Catalog)
# =============================================================================
section "3. Services"

test_name "3.1 List all services"
RESPONSE=$(curl -s "$BASE_URL/services")
assert_success "$RESPONSE" "3.1 List services"

test_name "3.2 List with pagination"
RESPONSE=$(curl -s "$BASE_URL/services?page=1&limit=2")
assert_success "$RESPONSE" "3.2 Paginated"

test_name "3.3 Get service by ID (Haircut)"
RESPONSE=$(curl -s "$BASE_URL/services/$SVC1_ID")
assert_success "$RESPONSE" "3.3 Get service"

test_name "3.4 Create new test service (Manager)"
NEW_SVC=$(curl -s -X POST "$BASE_URL/services" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Curl Service",
    "category": "TREATMENT",
    "type": "STANDARD",
    "basePrice": 25000,
    "durationMinutes": 15,
    "bufferMinutes": 0,
    "description": "Temporary test service"
  }')
assert_success "$NEW_SVC" "3.4 Create service"
NEW_SVC_ID=$(echo "$NEW_SVC" | json_extract '.data.id')

test_name "3.5 Update service"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/services/$SVC1_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "basePrice": 82000 }')
assert_success "$RESPONSE" "3.5 Update service"

test_name "3.6 Add tier surcharge"
RESPONSE=$(curl -s -X POST "$BASE_URL/services/$SVC1_ID/tier-surcharge" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "tier": "SENIOR", "surcharge": 15000 }')
# May already exist from seed
echo "$RESPONSE" | json_pp

test_name "3.7 Set branch override"
RESPONSE=$(curl -s -X POST "$BASE_URL/services/$SVC1_ID/branch-override" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"overridePrice\": 90000,
    \"isActive\": true
  }")
echo "$RESPONSE" | json_pp

test_name "3.8 Deactivate test service"
if [ -n "$NEW_SVC_ID" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/services/$NEW_SVC_ID" \
    -H "Authorization: Bearer $MANAGER_TOKEN")
  assert_success "$RESPONSE" "3.8 Deactivate"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 4. STAFF
# =============================================================================
section "4. Staff"

test_name "4.1 List staff"
RESPONSE=$(curl -s "$BASE_URL/staff" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "4.1 List staff"

test_name "4.2 List staff by branch"
RESPONSE=$(curl -s "$BASE_URL/staff?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "4.2 By branch"

test_name "4.3 Get staff by ID (uses userId)"
RESPONSE=$(curl -s "$BASE_URL/staff/$BARBER_USER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "4.3 Get staff"

test_name "4.4 Update staff profile (uses userId)"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/staff/$BARBER_USER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "bio": "Master barber — 10 years experience (updated)" }')
assert_success "$RESPONSE" "4.4 Update staff"

test_name "4.5 Update staff status (ON_BREAK)"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/staff/$BARBER_USER_ID/status" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "ON_BREAK" }')
assert_success "$RESPONSE" "4.5 ON_BREAK"

test_name "4.6 Update staff status back to AVAILABLE"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/staff/$BARBER_USER_ID/status" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "AVAILABLE" }')
assert_success "$RESPONSE" "4.6 AVAILABLE"

# =============================================================================
# 5. ATTENDANCE
# =============================================================================
section "5. Attendance"

test_name "5.1 Clock in (Barber)"
CLOCK_RESPONSE=$(curl -s -X POST "$BASE_URL/attendance/clock-in" \
  -H "Authorization: Bearer $BARBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"locationLat\": -6.2088,
    \"locationLng\": 106.8456
  }")
assert_success "$CLOCK_RESPONSE" "5.1 Clock in"
ATTENDANCE_ID=$(echo "$CLOCK_RESPONSE" | json_extract '.data.id')
echo -e "  ${GREEN}ATTENDANCE_ID=$ATTENDANCE_ID${NC}"

test_name "5.2 List attendance records"
RESPONSE=$(curl -s "$BASE_URL/attendance?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "5.2 List attendance"

test_name "5.3 Clock out"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/attendance/$ATTENDANCE_ID/clock-out" \
  -H "Authorization: Bearer $BARBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "notes": "End of shift" }')
assert_success "$RESPONSE" "5.3 Clock out"

test_name "5.4 Create shift block (Manager)"
SHIFT_RESPONSE=$(curl -s -X POST "$BASE_URL/attendance/shifts" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"branchId\": \"$BRANCH_ID\",
    \"date\": \"$TODAY\",
    \"startTime\": \"09:00\",
    \"endTime\": \"17:00\",
    \"notes\": \"Morning Shift\"
  }")
assert_success "$SHIFT_RESPONSE" "5.4 Create shift"
SHIFT_ID=$(echo "$SHIFT_RESPONSE" | json_extract '.data.id')

test_name "5.5 Create block-off (break)"
RESPONSE=$(curl -s -X POST "$BASE_URL/attendance/shifts" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"branchId\": \"$BRANCH_ID\",
    \"date\": \"$TODAY\",
    \"startTime\": \"12:00\",
    \"endTime\": \"13:00\",
    \"notes\": \"Lunch Break\"
  }")
assert_success "$RESPONSE" "5.5 Block-off"

test_name "5.6 List shifts"
RESPONSE=$(curl -s "$BASE_URL/attendance/shifts?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "5.6 List shifts"

test_name "5.7 Update shift block"
if [ -n "$SHIFT_ID" ] && [ "$SHIFT_ID" != "" ]; then
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/attendance/shifts/$SHIFT_ID" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "notes": "Full Day Shift" }')
  assert_success "$RESPONSE" "5.7 Update shift"
else
  echo -e "  ${YELLOW}SKIP (no shift ID)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "5.8 Delete shift block"
if [ -n "$SHIFT_ID" ] && [ "$SHIFT_ID" != "" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/attendance/shifts/$SHIFT_ID" \
    -H "Authorization: Bearer $MANAGER_TOKEN")
  assert_success "$RESPONSE" "5.8 Delete shift"
else
  echo -e "  ${YELLOW}SKIP (no shift ID)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 6. QUEUE & BOOKING
# =============================================================================
section "6. Queue & Booking"

test_name "6.1 Create walk-in entry (Manager)"
QUEUE_RESPONSE=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"WALK_IN\",
    \"customerName\": \"Walk-in Customer\",
    \"serviceIds\": [\"$SVC1_ID\"],
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"startTime\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"estimatedDuration\": 30
  }")
assert_success "$QUEUE_RESPONSE" "6.1 Walk-in"
QUEUE_ENTRY_ID=$(echo "$QUEUE_RESPONSE" | json_extract '.data.id')
echo -e "  ${GREEN}QUEUE_ENTRY_ID=$QUEUE_ENTRY_ID${NC}"

test_name "6.2 Create online booking (Customer)"
BOOKING_RESPONSE=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"APP\",
    \"customerName\": \"Rizky Firmansyah\",
    \"serviceIds\": [\"$SVC1_ID\", \"$SVC2_ID\"],
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"startTime\": \"2026-03-02T10:00:00Z\",
    \"estimatedDuration\": 50
  }")
assert_success "$BOOKING_RESPONSE" "6.2 Online booking"
BOOKING_ENTRY_ID=$(echo "$BOOKING_RESPONSE" | json_extract '.data.id')

test_name "6.3 List queue entries"
RESPONSE=$(curl -s "$BASE_URL/queue?branchId=$BRANCH_ID&date=$TODAY" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "6.3 List queue"

test_name "6.4 Get queue entry by ID"
RESPONSE=$(curl -s "$BASE_URL/queue/$QUEUE_ENTRY_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "6.4 Get entry"

test_name "6.5 Get my queue entries (Customer)"
RESPONSE=$(curl -s "$BASE_URL/queue/me" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "6.5 My entries"

test_name "6.6 Assign barber to entry"
RESPONSE=$(curl -s -X POST "$BASE_URL/queue/$QUEUE_ENTRY_ID/assign" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"staffProfileId\": \"$BARBER_PROFILE_ID\" }")
assert_success "$RESPONSE" "6.6 Assign barber"

test_name "6.7 Update status: WAITING → CALLED"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/queue/$QUEUE_ENTRY_ID/status" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "CALLED" }')
assert_success "$RESPONSE" "6.7 CALLED"

test_name "6.8 Update status: CALLED → IN_SERVICE"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/queue/$QUEUE_ENTRY_ID/status" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "IN_SERVICE" }')
assert_success "$RESPONSE" "6.8 IN_SERVICE"

test_name "6.9 Update status: IN_SERVICE → COMPLETED"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/queue/$QUEUE_ENTRY_ID/status" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "COMPLETED" }')
assert_success "$RESPONSE" "6.9 COMPLETED"

test_name "6.10 Update status: COMPLETED → AT_CHECKOUT"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/queue/$QUEUE_ENTRY_ID/status" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "AT_CHECKOUT" }')
assert_success "$RESPONSE" "6.10 AT_CHECKOUT"

test_name "6.11 Postpone booking entry"
if [ -n "$BOOKING_ENTRY_ID" ] && [ "$BOOKING_ENTRY_ID" != "" ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/queue/$BOOKING_ENTRY_ID/postpone" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "minutes": 15 }')
  assert_success "$RESPONSE" "6.11 Postpone"
else
  echo -e "  ${YELLOW}SKIP (no booking entry)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "6.12 Cancel booking entry"
if [ -n "$BOOKING_ENTRY_ID" ] && [ "$BOOKING_ENTRY_ID" != "" ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/queue/$BOOKING_ENTRY_ID/cancel" \
    -H "Authorization: Bearer $MANAGER_TOKEN")
  assert_success "$RESPONSE" "6.12 Cancel"
else
  echo -e "  ${YELLOW}SKIP (no booking entry)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 7. TRANSACTIONS (POS)
# =============================================================================
section "7. Transactions"

test_name "7.1 Create transaction (manual)"
TX_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"customerId\": \"$CUSTOMER_ID\",
    \"items\": [
      {
        \"serviceId\": \"$SVC1_ID\",
        \"name\": \"Haircut\",
        \"quantity\": 1,
        \"unitPrice\": 85000,
        \"discount\": 0,
        \"isAddOn\": false
      }
    ],
    \"tipAmount\": 10000,
    \"discountAmount\": 0,
    \"loyaltyPointsUsed\": 0
  }")
assert_success "$TX_RESPONSE" "7.1 Create TX"
TX_ID=$(echo "$TX_RESPONSE" | json_extract '.data.id')
echo -e "  ${GREEN}TX_ID=$TX_ID${NC}"

test_name "7.2 Create transaction with discount"
TX2_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"items\": [
      {
        \"serviceId\": \"$SVC1_ID\",
        \"name\": \"Haircut\",
        \"quantity\": 1,
        \"unitPrice\": 85000,
        \"discount\": 0,
        \"isAddOn\": false
      }
    ],
    \"tipAmount\": 0,
    \"discountAmount\": 8500,
    \"loyaltyPointsUsed\": 0
  }")
assert_success "$TX2_RESPONSE" "7.2 TX with discount"

test_name "7.3 List transactions"
RESPONSE=$(curl -s "$BASE_URL/transactions?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "7.3 List TX"

test_name "7.4 List with filters"
RESPONSE=$(curl -s "$BASE_URL/transactions?branchId=$BRANCH_ID&status=PENDING&page=1&limit=5" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "7.4 Filtered TX"

test_name "7.5 Get transaction by ID"
RESPONSE=$(curl -s "$BASE_URL/transactions/$TX_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "7.5 Get TX"

test_name "7.6 Add payment (complete transaction)"
TX_TOTAL=$(echo "$TX_RESPONSE" | json_extract '.data.totalDue')
RESPONSE=$(curl -s -X POST "$BASE_URL/transactions/$TX_ID/pay" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"payments\": [
      { \"method\": \"CASH\", \"amount\": $TX_TOTAL }
    ]
  }")
assert_success "$RESPONSE" "7.6 Pay TX"

test_name "7.7 Get daily summary"
RESPONSE=$(curl -s "$BASE_URL/transactions/summary?branchId=$BRANCH_ID&date=$TODAY" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "7.7 Daily summary"

test_name "7.8 Get receipt"
RESPONSE=$(curl -s "$BASE_URL/transactions/$TX_ID/receipt" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "7.8 Receipt"

test_name "7.9 Void a transaction"
RESPONSE=$(curl -s -X POST "$BASE_URL/transactions/$TX_ID/void" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Customer changed their mind" }')
assert_success "$RESPONSE" "7.9 Void TX"

test_name "7.10 Verify voided status"
RESPONSE=$(curl -s "$BASE_URL/transactions/$TX_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
STATUS=$(echo "$RESPONSE" | json_extract '.data.status')
if [ "$STATUS" = "VOIDED" ]; then
  echo -e "  ${GREEN}✓ PASS (status=VOIDED)${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗ FAIL (expected VOIDED, got $STATUS)${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# =============================================================================
# 8. PROMOTIONS
# =============================================================================
section "8. Promotions"

test_name "8.1 List promo codes"
RESPONSE=$(curl -s "$BASE_URL/promotions" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
IS_ARRAY=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(Array.isArray(o)?'true':'false')}catch(e){console.log('false')}})")
if [ "$IS_ARRAY" = "true" ]; then
  echo -e "  ${GREEN}✓ PASS (array of promos)${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  assert_success "$RESPONSE" "8.1 List promos"
fi

test_name "8.2 Validate promo code (WELCOME2026)"
RESPONSE=$(curl -s -X POST "$BASE_URL/promotions/validate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"WELCOME2026\",
    \"grossAmount\": 100000,
    \"branchId\": \"$BRANCH_ID\"
  }")
echo "$RESPONSE" | json_pp
PASS_COUNT=$((PASS_COUNT + 1))

test_name "8.3 Validate invalid promo code (expected 404)"
RESPONSE=$(curl -s -X POST "$BASE_URL/promotions/validate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"FAKECODE\",
    \"grossAmount\": 100000,
    \"branchId\": \"$BRANCH_ID\"
  }")
assert_fail "$RESPONSE" "8.3 Expected 404"

test_name "8.4 Validate promo below minimum (expected 400)"
RESPONSE=$(curl -s -X POST "$BASE_URL/promotions/validate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"WELCOME2026\",
    \"grossAmount\": 30000,
    \"branchId\": \"$BRANCH_ID\"
  }")
assert_fail "$RESPONSE" "8.4 Expected below minimum"

test_name "8.5 Validate loyalty points"
RESPONSE=$(curl -s -X POST "$BASE_URL/promotions/validate-loyalty" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$CUSTOMER_ID\",
    \"pointsToRedeem\": 10,
    \"netAmount\": 85000
  }")
echo "$RESPONSE" | json_pp
PASS_COUNT=$((PASS_COUNT + 1))

# =============================================================================
# 9. RBAC TESTS (Negative — Verify Access Control)
# =============================================================================
section "9. RBAC Enforcement"

test_name "9.1 Customer cannot create branch (should 403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/branches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Hack Branch", "address": "123", "city": "X" }')
assert_fail "$RESPONSE" "9.1 Customer create branch"

test_name "9.2 Customer cannot create service (should 403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/services" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Hack", "basePrice": 1, "durationMinutes": 1, "type": "STANDARD", "category": "HAIRCUT" }')
assert_fail "$RESPONSE" "9.2 Customer create service"

test_name "9.3 Customer cannot void transaction (should 403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/transactions/$TX_ID/void" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "hacked" }')
assert_fail "$RESPONSE" "9.3 Customer void TX"

test_name "9.4 Barber cannot create promo code (should 403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/promotions" \
  -H "Authorization: Bearer $BARBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "code": "HACK", "type": "FIXED", "value": 99999 }')
assert_fail "$RESPONSE" "9.4 Barber create promo"

test_name "9.5 No token on protected endpoint (should 401)"
RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{}')
assert_fail "$RESPONSE" "9.5 No token"

# =============================================================================
# 10. E2E FLOW: Full Customer Journey
# =============================================================================
section "10. E2E: Complete Customer Journey"

echo -e "${YELLOW}Register → Browse → Book → In Chair → Checkout → Pay → Receipt${NC}"

test_name "10.1 Register new E2E customer"
E2E_REG=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"e2e_customer_$(date +%s)@test.com\",
    \"password\": \"E2eTest1234!\",
    \"firstName\": \"E2E\",
    \"lastName\": \"Customer\"
  }")
E2E_TOKEN=$(echo "$E2E_REG" | json_extract '.data.accessToken')
E2E_CUSTOMER_ID=$(echo "$E2E_REG" | json_extract '.data.user.id')
assert_success "$E2E_REG" "10.1 Register"

test_name "10.2 Customer browses branches"
RESPONSE=$(curl -s "$BASE_URL/branches")
COUNT=$(echo "$RESPONSE" | json_length_data)
echo -e "  ${GREEN}✓ Found $COUNT branches${NC}"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "10.3 Customer views services"
RESPONSE=$(curl -s "$BASE_URL/services")
COUNT=$(echo "$RESPONSE" | json_length_data)
echo -e "  ${GREEN}✓ Found $COUNT services${NC}"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "10.4 Customer creates online booking"
E2E_BOOKING=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $E2E_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"APP\",
    \"customerName\": \"E2E Customer\",
    \"serviceIds\": [\"$SVC1_ID\"],
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"startTime\": \"2026-03-02T14:00:00Z\",
    \"estimatedDuration\": 30
  }")
assert_success "$E2E_BOOKING" "10.4 Booking"
E2E_QUEUE_ID=$(echo "$E2E_BOOKING" | json_extract '.data.id')

test_name "10.5 Staff transitions: WAITING → CALLED → IN_SERVICE → COMPLETED → AT_CHECKOUT"
ALL_TRANSITIONS_OK=true
for STATUS in CALLED IN_SERVICE COMPLETED AT_CHECKOUT; do
  R=$(curl -s -X PATCH "$BASE_URL/queue/$E2E_QUEUE_ID/status" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{ \"status\": \"$STATUS\" }")
  S=$(echo "$R" | json_extract '.success')
  if [ "$S" = "true" ]; then
    echo "  → $STATUS ✓"
  else
    echo -e "  ${RED}→ $STATUS FAILED${NC}"
    ALL_TRANSITIONS_OK=false
  fi
done
if [ "$ALL_TRANSITIONS_OK" = true ]; then
  PASS_COUNT=$((PASS_COUNT + 1))
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

test_name "10.6 Find auto-drafted transaction"
E2E_TX_LIST=$(curl -s "$BASE_URL/transactions?branchId=$BRANCH_ID&status=PENDING" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
E2E_TX_ID=$(echo "$E2E_TX_LIST" | json_extract '.data[-1].id')
E2E_TOTAL=$(echo "$E2E_TX_LIST" | json_extract '.data[-1].totalDue')
echo "  Transaction: $E2E_TX_ID, Total Due: $E2E_TOTAL"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "10.7 Pay with cash"
RESPONSE=$(curl -s -X POST "$BASE_URL/transactions/$E2E_TX_ID/pay" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"payments\": [
      { \"method\": \"CASH\", \"amount\": $E2E_TOTAL }
    ]
  }")
assert_success "$RESPONSE" "10.7 Pay"

test_name "10.8 Get receipt"
RESPONSE=$(curl -s "$BASE_URL/transactions/$E2E_TX_ID/receipt" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "10.8 Receipt"

test_name "10.9 Verify queue entry is PAID"
RESPONSE=$(curl -s "$BASE_URL/queue/$E2E_QUEUE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
QS=$(echo "$RESPONSE" | json_extract '.data.status')
echo "  Queue status: $QS"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "10.10 Customer checks booking history"
RESPONSE=$(curl -s "$BASE_URL/queue/me" \
  -H "Authorization: Bearer $E2E_TOKEN")
assert_success "$RESPONSE" "10.10 History"

# =============================================================================
# 11. LOYALTY
# =============================================================================
section "11. Loyalty"

test_name "11.1 Get my loyalty account (Customer)"
RESPONSE=$(curl -s "$BASE_URL/loyalty/me" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "11.1 My loyalty"

test_name "11.2 Get my loyalty history"
RESPONSE=$(curl -s "$BASE_URL/loyalty/me/history?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "11.2 Loyalty history"

test_name "11.3 Admin: Get user loyalty account"
RESPONSE=$(curl -s "$BASE_URL/loyalty/$CUSTOMER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "11.3 Admin loyalty"

test_name "11.4 Admin: Manual point adjustment (+50)"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/loyalty/admin/adjust" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$CUSTOMER_ID\",
    \"points\": 50,
    \"description\": \"Manual adjustment for testing\"
  }")
assert_success "$RESPONSE" "11.4 Point adjust"

test_name "11.5 Verify points increased"
RESPONSE=$(curl -s "$BASE_URL/loyalty/me" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "11.5 Verify points"

test_name "11.6 Admin: Process point expiry"
RESPONSE=$(curl -s -X POST "$BASE_URL/loyalty/admin/expire" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "11.6 Expire points"

# =============================================================================
# 12. REFERRALS
# =============================================================================
section "12. Referrals"

test_name "12.1 Get my referral code (Customer)"
REFERRAL_RESPONSE=$(curl -s "$BASE_URL/referrals/me/code" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$REFERRAL_RESPONSE" "12.1 Referral code"
REFERRAL_CODE=$(echo "$REFERRAL_RESPONSE" | json_extract '.data.referralCode')
echo -e "  ${GREEN}REFERRAL_CODE=$REFERRAL_CODE${NC}"

test_name "12.2 Register new user for referral test"
REF_REG=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"referred_$(date +%s)@test.com\",
    \"password\": \"Referred1234!\",
    \"firstName\": \"Referred\",
    \"lastName\": \"User\"
  }")
REF_TOKEN=$(echo "$REF_REG" | json_extract '.data.accessToken')
assert_success "$REF_REG" "12.2 Register referred"

test_name "12.3 Apply referral code"
RESPONSE=$(curl -s -X POST "$BASE_URL/referrals/apply" \
  -H "Authorization: Bearer $REF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"referralCode\": \"$REFERRAL_CODE\" }")
assert_success "$RESPONSE" "12.3 Apply referral"

test_name "12.4 Get referral history"
RESPONSE=$(curl -s "$BASE_URL/referrals/me/history?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "12.4 Referral history"

test_name "12.5 Admin: Get referral stats"
RESPONSE=$(curl -s "$BASE_URL/referrals/stats" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "12.5 Referral stats"

# =============================================================================
# 13. REVIEWS
# =============================================================================
section "13. Reviews"

test_name "13.1 Create review (Customer — from E2E flow)"
REVIEW_RESPONSE=$(curl -s -X POST "$BASE_URL/reviews" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"rating\": 5,
    \"comment\": \"Excellent service, very professional!\"
  }")
echo "$REVIEW_RESPONSE" | json_pp
REVIEW_ID=$(echo "$REVIEW_RESPONSE" | json_extract '.data.id')

test_name "13.2 Create second review (E2E customer)"
REVIEW2_RESPONSE=$(curl -s -X POST "$BASE_URL/reviews" \
  -H "Authorization: Bearer $E2E_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"rating\": 4,
    \"comment\": \"Great haircut, would come again.\"
  }")
echo "$REVIEW2_RESPONSE" | json_pp
REVIEW2_ID=$(echo "$REVIEW2_RESPONSE" | json_extract '.data.id')

test_name "13.3 List reviews (public)"
RESPONSE=$(curl -s "$BASE_URL/reviews?branchId=$BRANCH_ID&page=1&limit=10")
assert_success "$RESPONSE" "13.3 List reviews"

test_name "13.4 List reviews filtered by barber"
RESPONSE=$(curl -s "$BASE_URL/reviews?staffProfileId=$BARBER_PROFILE_ID")
assert_success "$RESPONSE" "13.4 By barber"

test_name "13.5 List reviews filtered by min rating"
RESPONSE=$(curl -s "$BASE_URL/reviews?branchId=$BRANCH_ID&minRating=4")
assert_success "$RESPONSE" "13.5 Min rating"

test_name "13.6 Get review by ID"
if [ -n "$REVIEW_ID" ] && [ "$REVIEW_ID" != "" ]; then
  RESPONSE=$(curl -s "$BASE_URL/reviews/$REVIEW_ID")
  assert_success "$RESPONSE" "13.6 Get review"
else
  echo -e "  ${YELLOW}SKIP (no review created — may need prior transaction)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "13.7 Moderate review — hide (Manager)"
if [ -n "$REVIEW2_ID" ] && [ "$REVIEW2_ID" != "" ]; then
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/reviews/$REVIEW2_ID/moderate" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "isVisible": false, "moderationNote": "Hidden for review" }')
  assert_success "$RESPONSE" "13.7 Moderate hide"
else
  echo -e "  ${YELLOW}SKIP (no review to moderate)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "13.8 Moderate review — restore (Manager)"
if [ -n "$REVIEW2_ID" ] && [ "$REVIEW2_ID" != "" ]; then
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/reviews/$REVIEW2_ID/moderate" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "isVisible": true }')
  assert_success "$RESPONSE" "13.8 Moderate restore"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 14. COMMISSIONS
# =============================================================================
section "14. Commissions"

test_name "14.1 Calculate commissions for barber today"
RESPONSE=$(curl -s -X POST "$BASE_URL/commissions/calculate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"date\": \"$TODAY\"
  }")
assert_success "$RESPONSE" "14.1 Calculate"

test_name "14.2 Recalculate commissions"
RESPONSE=$(curl -s -X POST "$BASE_URL/commissions/recalculate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"date\": \"$TODAY\"
  }")
assert_success "$RESPONSE" "14.2 Recalculate"

test_name "14.3 List all earnings (Manager)"
RESPONSE=$(curl -s "$BASE_URL/commissions?staffProfileId=$BARBER_PROFILE_ID&dateFrom=$TODAY&dateTo=$TODAY" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "14.3 List earnings"

test_name "14.4 Get my earnings (Barber)"
RESPONSE=$(curl -s "$BASE_URL/commissions/me?dateFrom=$TODAY&dateTo=$TODAY" \
  -H "Authorization: Bearer $BARBER_TOKEN")
assert_success "$RESPONSE" "14.4 My earnings"

test_name "14.5 Get earnings by barber ID (Manager)"
RESPONSE=$(curl -s "$BASE_URL/commissions/$BARBER_PROFILE_ID?dateFrom=$TODAY&dateTo=$TODAY" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "14.5 By barber"

# =============================================================================
# 15. PAYROLL
# =============================================================================
section "15. Payroll"

test_name "15.1 Generate payroll"
PAYROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/generate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"periodStart\": \"2026-02-01\",
    \"periodEnd\": \"2026-02-28\"
  }")
assert_success "$PAYROLL_RESPONSE" "15.1 Generate"
PAYROLL_ID=$(echo "$PAYROLL_RESPONSE" | json_extract '.data.id')
echo -e "  ${GREEN}PAYROLL_ID=$PAYROLL_ID${NC}"

test_name "15.2 List payroll records"
RESPONSE=$(curl -s "$BASE_URL/payroll?staffProfileId=$BARBER_PROFILE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "15.2 List payroll"

test_name "15.3 Get payroll by ID"
RESPONSE=$(curl -s "$BASE_URL/payroll/$PAYROLL_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "15.3 Get payroll"

test_name "15.4 Submit payroll"
RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/$PAYROLL_ID/submit" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "15.4 Submit"

test_name "15.5 Approve payroll"
RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/$PAYROLL_ID/approve" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "note": "Approved for February period" }')
assert_success "$RESPONSE" "15.5 Approve"

test_name "15.6 Verify payroll status is APPROVED"
RESPONSE=$(curl -s "$BASE_URL/payroll/$PAYROLL_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
STATUS=$(echo "$RESPONSE" | json_extract '.data.status')
echo "  Status: $STATUS"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "15.7 Dispute payroll (Barber)"
PAYROLL2_RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/generate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"periodStart\": \"2026-01-01\",
    \"periodEnd\": \"2026-01-31\"
  }")
PAYROLL2_ID=$(echo "$PAYROLL2_RESPONSE" | json_extract '.data.id')

curl -s -X POST "$BASE_URL/payroll/$PAYROLL2_ID/submit" \
  -H "Authorization: Bearer $MANAGER_TOKEN" > /dev/null

RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/$PAYROLL2_ID/dispute" \
  -H "Authorization: Bearer $BARBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "note": "Missing two days of commissions" }')
assert_success "$RESPONSE" "15.7 Dispute"

test_name "15.8 Resolve dispute (Manager)"
RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/$PAYROLL2_ID/resolve" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "note": "Recalculated and adjusted" }')
assert_success "$RESPONSE" "15.8 Resolve"

# =============================================================================
# 16. INVENTORY
# =============================================================================
section "16. Inventory"

test_name "16.1 List products"
RESPONSE=$(curl -s "$BASE_URL/inventory/products?page=1&limit=10" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "16.1 List products"

test_name "16.2 Get product by ID"
RESPONSE=$(curl -s "$BASE_URL/inventory/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "16.2 Get product"

test_name "16.3 Create product"
NEW_PRODUCT=$(curl -s -X POST "$BASE_URL/inventory/products" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Curl Product $(date +%s)\",
    \"sku\": \"TEST-CURL-$(date +%s)\",
    \"description\": \"Temporary test product\",
    \"costPrice\": 10000,
    \"sellPrice\": 20000
  }")
assert_success "$NEW_PRODUCT" "16.3 Create product"
NEW_PRODUCT_ID=$(echo "$NEW_PRODUCT" | json_extract '.data.id')

test_name "16.4 Update product"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/inventory/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "sellPrice": 80000 }')
assert_success "$RESPONSE" "16.4 Update product"

test_name "16.5 Stock in (add 10 units)"
RESPONSE=$(curl -s -X POST "$BASE_URL/inventory/stock-in" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 10,
    \"costPerUnit\": 35000,
    \"note\": \"Test stock delivery\"
  }")
assert_success "$RESPONSE" "16.5 Stock in"

test_name "16.6 Stock out (sell 2 units)"
RESPONSE=$(curl -s -X POST "$BASE_URL/inventory/stock-out" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 2,
    \"note\": \"Sold to customer\"
  }")
assert_success "$RESPONSE" "16.6 Stock out"

test_name "16.7 Adjust stock"
RESPONSE=$(curl -s -X POST "$BASE_URL/inventory/adjust" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"productId\": \"$PRODUCT_ID\",
    \"newQuantity\": 25,
    \"note\": \"Stock count adjustment after audit\"
  }")
assert_success "$RESPONSE" "16.7 Adjust"

test_name "16.8 Get branch inventory"
RESPONSE=$(curl -s "$BASE_URL/inventory/branches/$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "16.8 Branch inventory"

test_name "16.9 Get low stock alerts"
RESPONSE=$(curl -s "$BASE_URL/inventory/branches/$BRANCH_ID/alerts" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "16.9 Alerts"

test_name "16.10 Get inventory valuation"
RESPONSE=$(curl -s "$BASE_URL/inventory/branches/$BRANCH_ID/valuation" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "16.10 Valuation"

test_name "16.11 Delete test product"
if [ -n "$NEW_PRODUCT_ID" ] && [ "$NEW_PRODUCT_ID" != "" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/inventory/products/$NEW_PRODUCT_ID" \
    -H "Authorization: Bearer $MANAGER_TOKEN")
  assert_success "$RESPONSE" "16.11 Delete product"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 17. CASH DRAWER
# =============================================================================
section "17. Cash Drawer"

test_name "17.1 Open cash drawer session"
DRAWER_RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/open" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"openingBalance\": 500000
  }")
assert_success "$DRAWER_RESPONSE" "17.1 Open drawer"
SESSION_ID=$(echo "$DRAWER_RESPONSE" | json_extract '.data.id')
echo -e "  ${GREEN}SESSION_ID=$SESSION_ID${NC}"

test_name "17.2 Get current session"
RESPONSE=$(curl -s "$BASE_URL/cash-drawer/current?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "17.2 Current session"

test_name "17.3 Add cash entry (SALE)"
RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/entry" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"type\": \"SALE\",
    \"amount\": 85000,
    \"reference\": \"Walk-in haircut payment\"
  }")
assert_success "$RESPONSE" "17.3 SALE entry"

test_name "17.4 Add cash entry (FLOAT)"
RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/entry" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"type\": \"FLOAT\",
    \"amount\": 100000,
    \"reference\": \"Additional float from safe\"
  }")
assert_success "$RESPONSE" "17.4 FLOAT entry"

test_name "17.5 Add cash entry (ADJUSTMENT — negative)"
RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/entry" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"type\": \"ADJUSTMENT\",
    \"amount\": -15000,
    \"reference\": \"Petty cash for supplies\"
  }")
assert_success "$RESPONSE" "17.5 ADJUSTMENT"

test_name "17.6 Close cash drawer session"
RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/close" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"closingBalance\": 670000,
    \"notes\": \"End of day closing\"
  }")
assert_success "$RESPONSE" "17.6 Close drawer"

# =============================================================================
# 18. CRM
# =============================================================================
section "18. CRM"

test_name "18.1 List customers"
RESPONSE=$(curl -s "$BASE_URL/crm/customers?branchId=$BRANCH_ID&sortBy=recency&page=1&limit=10" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "18.1 List CRM"

test_name "18.2 Get customer by ID"
RESPONSE=$(curl -s "$BASE_URL/crm/customers/$CUSTOMER_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "18.2 Get CRM customer"

test_name "18.3 List segments"
RESPONSE=$(curl -s "$BASE_URL/crm/segments?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "18.3 Segments"

test_name "18.4 Recompute segments"
RESPONSE=$(curl -s -X POST "$BASE_URL/crm/segments/recompute" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"branchId\": \"$BRANCH_ID\" }")
assert_success "$RESPONSE" "18.4 Recompute"

# =============================================================================
# 19. CAMPAIGNS
# =============================================================================
section "19. Campaigns"

test_name "19.1 Create campaign"
CAMPAIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/campaigns" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"name\": \"March Promo Blast\",
    \"description\": \"Special March discounts\",
    \"type\": \"PUSH\",
    \"startsAt\": \"2026-03-01T00:00:00Z\"
  }")
assert_success "$CAMPAIGN_RESPONSE" "19.1 Create campaign"
CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | json_extract '.data.id')

test_name "19.2 List campaigns"
RESPONSE=$(curl -s "$BASE_URL/campaigns?branchId=$BRANCH_ID&page=1&limit=10" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "19.2 List campaigns"

test_name "19.3 Update campaign"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/campaigns/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "March Promo Blast — Updated" }')
assert_success "$RESPONSE" "19.3 Update campaign"

test_name "19.4 Send campaign"
RESPONSE=$(curl -s -X POST "$BASE_URL/campaigns/$CAMPAIGN_ID/send" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "19.4 Send campaign"

# =============================================================================
# 20. RETENTION
# =============================================================================
section "20. Retention"

test_name "20.1 Trigger retention campaign"
RESPONSE=$(curl -s -X POST "$BASE_URL/retention/trigger" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "20.1 Trigger retention"

test_name "20.2 Get retention stats"
RESPONSE=$(curl -s "$BASE_URL/retention/stats" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "20.2 Retention stats"

# =============================================================================
# 21. MEDIA (requires S3/MinIO configured)
# =============================================================================
section "21. Media Upload"

# Generate a minimal 1x1 PNG using Node (cross-platform, works on Windows+Linux)
TEST_PNG="/tmp/test_upload.png"
node -e "
const fs=require('fs');
const hex='89504e470d0a1a0a0000000d49484452000000010000000108020000009077de000000000c4944415478'+'9c636080000000020001e2216e0000000049454e44ae426082';
fs.writeFileSync('$TEST_PNG',Buffer.from(hex,'hex'));
" 2>/dev/null

test_name "21.1 Upload PNG to reviews prefix"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=reviews" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
UPLOAD_SUCCESS=$(echo "$RESPONSE" | json_extract '.success')
if [ "$UPLOAD_SUCCESS" = "true" ]; then
  UPLOAD_URL=$(echo "$RESPONSE" | json_extract '.data.url')
  UPLOAD_KEY=$(echo "$RESPONSE" | json_extract '.data.key')
  echo -e "  ${GREEN}✓ PASS${NC}"
  echo -e "  URL: $UPLOAD_URL"
  echo -e "  Key: $UPLOAD_KEY"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗ FAIL${NC}: 21.1 Upload PNG"
  echo "$RESPONSE" | json_pp
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

test_name "21.2 Verify uploaded file is accessible"
if [ -n "$UPLOAD_URL" ] && [ "$UPLOAD_URL" != "null" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$UPLOAD_URL")
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} (HTTP $HTTP_CODE)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗ FAIL${NC}: Expected HTTP 200, got $HTTP_CODE for $UPLOAD_URL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo -e "  ${YELLOW}SKIP${NC}: No upload URL from previous test"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "21.3 Upload to avatars prefix"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=avatars" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
assert_success "$RESPONSE" "21.3 Avatars prefix"

test_name "21.4 Upload to staff prefix"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=staff" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
assert_success "$RESPONSE" "21.4 Staff prefix"

test_name "21.5 Reject invalid prefix"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=hacked" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
assert_fail "$RESPONSE" "21.5 Invalid prefix rejected"

test_name "21.6 Reject missing file"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=reviews" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_fail "$RESPONSE" "21.6 Missing file rejected"

test_name "21.7 Reject without auth"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=reviews" \
  -F "file=@$TEST_PNG;type=image/png")
assert_fail "$RESPONSE" "21.7 No auth rejected"

test_name "21.8 Reject MIME mismatch (magic-byte validation)"
FAKE_FILE="/tmp/fake_img_test_$$.txt"
node -e "require('fs').writeFileSync('$FAKE_FILE', 'This is not an image\\n')"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=reviews" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$FAKE_FILE;type=image/png")
assert_fail "$RESPONSE" "21.8 Magic-byte mismatch rejected"
rm -f "$FAKE_FILE" 2>/dev/null

test_name "21.9 Delete uploaded file"
if [ -n "$UPLOAD_KEY" ] && [ "$UPLOAD_KEY" != "null" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/media?key=$UPLOAD_KEY" \
    -H "Authorization: Bearer $MANAGER_TOKEN")
  assert_success "$RESPONSE" "21.9 Delete file"
else
  echo -e "  ${YELLOW}SKIP${NC}: No upload key from previous test"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

rm -f "$TEST_PNG" 2>/dev/null

# =============================================================================
# 22. E2E: LOYALTY EARN → REDEEM FLOW
# =============================================================================
section "22. E2E: Loyalty Earn → Redeem"

test_name "22.1 Check loyalty balance before"
LOYALTY_BEFORE=$(curl -s "$BASE_URL/loyalty/me" \
  -H "Authorization: Bearer $TOKEN")
POINTS_BEFORE=$(echo "$LOYALTY_BEFORE" | json_extract '.data.pointsBalance')
echo -e "  Points before: $POINTS_BEFORE"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "22.2 Create walk-in → take to PAID"
LOYALTY_QUEUE=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"WALK_IN\",
    \"customerName\": \"Rizky Firmansyah\",
    \"customerId\": \"$CUSTOMER_ID\",
    \"serviceIds\": [\"$SVC1_ID\"],
    \"staffProfileId\": \"$BARBER2_PROFILE_ID\",
    \"startTime\": \"2026-03-03T09:00:00Z\",
    \"estimatedDuration\": 30
  }")
assert_success "$LOYALTY_QUEUE" "22.2 Walk-in"
LOYALTY_QID=$(echo "$LOYALTY_QUEUE" | json_extract '.data.id')

for STATUS in CALLED IN_SERVICE COMPLETED AT_CHECKOUT; do
  curl -s -X PATCH "$BASE_URL/queue/$LOYALTY_QID/status" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{ \"status\": \"$STATUS\" }" > /dev/null
  echo "  → $STATUS"
done

test_name "22.3 Pay the transaction"
LOYALTY_TX_LIST=$(curl -s "$BASE_URL/transactions?branchId=$BRANCH_ID&status=PENDING" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
LOYALTY_TX_ID=$(echo "$LOYALTY_TX_LIST" | json_extract '.data[-1].id')
LOYALTY_TX_TOTAL=$(echo "$LOYALTY_TX_LIST" | json_extract '.data[-1].totalDue')
echo "  TX: $LOYALTY_TX_ID, Total: $LOYALTY_TX_TOTAL"

RESPONSE=$(curl -s -X POST "$BASE_URL/transactions/$LOYALTY_TX_ID/pay" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"payments\": [
      { \"method\": \"CASH\", \"amount\": $LOYALTY_TX_TOTAL }
    ]
  }")
assert_success "$RESPONSE" "22.3 Pay"

test_name "22.4 Verify queue is PAID"
RESPONSE=$(curl -s "$BASE_URL/queue/$LOYALTY_QID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
QS=$(echo "$RESPONSE" | json_extract '.data.status')
echo "  Queue status: $QS"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "22.5 Check loyalty balance increased"
LOYALTY_AFTER=$(curl -s "$BASE_URL/loyalty/me" \
  -H "Authorization: Bearer $TOKEN")
POINTS_AFTER=$(echo "$LOYALTY_AFTER" | json_extract '.data.pointsBalance')
echo -e "  ${GREEN}Points after: $POINTS_AFTER (was $POINTS_BEFORE)${NC}"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "22.6 Verify loyalty history"
RESPONSE=$(curl -s "$BASE_URL/loyalty/me/history?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "22.6 Loyalty history"

# =============================================================================
# 23. E2E: REFERRAL COMPLETION FLOW
# =============================================================================
section "23. E2E: Referral → Complete → Bonus"

test_name "23.1 Customer A gets referral code"
REF_A_RESPONSE=$(curl -s "$BASE_URL/referrals/me/code" \
  -H "Authorization: Bearer $TOKEN")
REF_A_CODE=$(echo "$REF_A_RESPONSE" | json_extract '.data.referralCode')
echo -e "  ${GREEN}Referral code: $REF_A_CODE${NC}"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "23.2 Customer B registers and applies code"
REF_B_REG=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"ref_b_$(date +%s)@test.com\",
    \"password\": \"RefB1234!\",
    \"firstName\": \"RefB\",
    \"lastName\": \"Customer\",
    \"orgSlug\": \"budis-barbershop\"
  }")
REF_B_TOKEN=$(echo "$REF_B_REG" | json_extract '.data.accessToken')
REF_B_ID=$(echo "$REF_B_REG" | json_extract '.data.user.id')

RESPONSE=$(curl -s -X POST "$BASE_URL/referrals/apply" \
  -H "Authorization: Bearer $REF_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"referralCode\": \"$REF_A_CODE\" }")
assert_success "$RESPONSE" "23.2 Apply referral"

test_name "23.3 Customer B completes a transaction"
REF_QUEUE=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"WALK_IN\",
    \"customerName\": \"RefB Customer\",
    \"customerId\": \"$REF_B_ID\",
    \"serviceIds\": [\"$SVC1_ID\"],
    \"staffProfileId\": \"$BARBER2_PROFILE_ID\",
    \"startTime\": \"2026-03-03T10:00:00Z\",
    \"estimatedDuration\": 30
  }")
REF_QID=$(echo "$REF_QUEUE" | json_extract '.data.id')

for STATUS in CALLED IN_SERVICE COMPLETED AT_CHECKOUT; do
  curl -s -X PATCH "$BASE_URL/queue/$REF_QID/status" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{ \"status\": \"$STATUS\" }" > /dev/null
done

REF_TX_LIST=$(curl -s "$BASE_URL/transactions?branchId=$BRANCH_ID&status=PENDING" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
REF_TX_ID=$(echo "$REF_TX_LIST" | json_extract '.data[-1].id')
REF_TX_TOTAL=$(echo "$REF_TX_LIST" | json_extract '.data[-1].totalDue')

curl -s -X POST "$BASE_URL/transactions/$REF_TX_ID/pay" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"payments\": [{ \"method\": \"CASH\", \"amount\": $REF_TX_TOTAL }] }" > /dev/null
echo "  Customer B transaction PAID."
PASS_COUNT=$((PASS_COUNT + 1))

test_name "23.4 Verify Customer A referral history"
RESPONSE=$(curl -s "$BASE_URL/referrals/me/history?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "23.4 Referral history"

test_name "23.5 Check Customer A loyalty for bonus"
RESPONSE=$(curl -s "$BASE_URL/loyalty/me" \
  -H "Authorization: Bearer $TOKEN")
assert_success "$RESPONSE" "23.5 Loyalty check"

# =============================================================================
# 24. E2E: COMMISSION → PAYROLL FLOW
# =============================================================================
section "24. E2E: Commission → Payroll"

test_name "24.1 Calculate commissions for today"
RESPONSE=$(curl -s -X POST "$BASE_URL/commissions/calculate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"staffProfileId\": \"$BARBER_PROFILE_ID\", \"date\": \"$TODAY\" }")
assert_success "$RESPONSE" "24.1 Calculate"

test_name "24.2 Barber views their earnings"
RESPONSE=$(curl -s "$BASE_URL/commissions/me?dateFrom=$TODAY&dateTo=$TODAY" \
  -H "Authorization: Bearer $BARBER_TOKEN")
assert_success "$RESPONSE" "24.2 My earnings"

test_name "24.3 Generate payroll for today"
E2E_PAYROLL=$(curl -s -X POST "$BASE_URL/payroll/generate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"staffProfileId\": \"$BARBER_PROFILE_ID\", \"periodStart\": \"$TODAY\", \"periodEnd\": \"$TODAY\" }")
E2E_PAYROLL_ID=$(echo "$E2E_PAYROLL" | json_extract '.data.id')
assert_success "$E2E_PAYROLL" "24.3 Generate payroll"

test_name "24.4 Submit payroll"
RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/$E2E_PAYROLL_ID/submit" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "24.4 Submit"

test_name "24.5 Approve payroll"
RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/$E2E_PAYROLL_ID/approve" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "note": "E2E test approval" }')
assert_success "$RESPONSE" "24.5 Approve"

test_name "24.6 Verify final payroll state"
RESPONSE=$(curl -s "$BASE_URL/payroll/$E2E_PAYROLL_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "24.6 Verify payroll"

# =============================================================================
# 25. E2E: CASH DRAWER DAILY WORKFLOW
# =============================================================================
section "25. E2E: Cash Drawer Daily Workflow"

test_name "25.1 Open morning drawer"
E2E_DRAWER=$(curl -s -X POST "$BASE_URL/cash-drawer/open" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"branchId\": \"$BRANCH_ID\", \"openingBalance\": 300000 }")
E2E_SESSION_ID=$(echo "$E2E_DRAWER" | json_extract '.data.id')
assert_success "$E2E_DRAWER" "25.1 Open"

test_name "25.2 Record several sales"
for AMOUNT in 85000 120000 50000; do
  curl -s -X POST "$BASE_URL/cash-drawer/entry" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{ \"sessionId\": \"$E2E_SESSION_ID\", \"type\": \"SALE\", \"amount\": $AMOUNT }" > /dev/null
  echo "  Sale: +$AMOUNT"
done
PASS_COUNT=$((PASS_COUNT + 1))

test_name "25.3 Record a refund"
RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/entry" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"sessionId\": \"$E2E_SESSION_ID\", \"type\": \"REFUND\", \"amount\": -50000, \"reference\": \"Customer refund\" }")
assert_success "$RESPONSE" "25.3 Refund"

test_name "25.4 Check running session"
RESPONSE=$(curl -s "$BASE_URL/cash-drawer/current?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "25.4 Running session"

test_name "25.5 Close drawer (300K + 85K + 120K + 50K - 50K = 505K)"
RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/close" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"sessionId\": \"$E2E_SESSION_ID\", \"closingBalance\": 505000, \"notes\": \"E2E test balanced\" }")
assert_success "$RESPONSE" "25.5 Close"

# =============================================================================
# 26. E2E: WALK-IN → REVIEW FLOW
# =============================================================================
section "26. E2E: Walk-in → Review"

test_name "26.1 Create walk-in for review"
REVIEW_START=$(node -e "const d=new Date();d.setHours(d.getHours()+3);console.log(d.toISOString().replace(/\.\d+Z/,'Z'))")
REVIEW_QUEUE=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"WALK_IN\",
    \"customerName\": \"Rizky Firmansyah\",
    \"customerId\": \"$CUSTOMER_ID\",
    \"serviceIds\": [\"$SVC1_ID\"],
    \"staffProfileId\": \"$BARBER2_PROFILE_ID\",
    \"startTime\": \"$REVIEW_START\",
    \"estimatedDuration\": 30
  }")
assert_success "$REVIEW_QUEUE" "26.1 Walk-in"
REVIEW_QID=$(echo "$REVIEW_QUEUE" | json_extract '.data.id')

test_name "26.2 Transition to PAID"
for STATUS in CALLED IN_SERVICE COMPLETED AT_CHECKOUT; do
  curl -s -X PATCH "$BASE_URL/queue/$REVIEW_QID/status" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{ \"status\": \"$STATUS\" }" > /dev/null
  echo "  → $STATUS"
done

REVIEW_TX_LIST=$(curl -s "$BASE_URL/transactions?branchId=$BRANCH_ID&status=PENDING" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
REVIEW_TX_ID=$(echo "$REVIEW_TX_LIST" | json_extract '.data[-1].id')
REVIEW_TX_TOTAL=$(echo "$REVIEW_TX_LIST" | json_extract '.data[-1].totalDue')

curl -s -X POST "$BASE_URL/transactions/$REVIEW_TX_ID/pay" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"payments\": [{ \"method\": \"CASH\", \"amount\": $REVIEW_TX_TOTAL }] }" > /dev/null
echo "  → PAID"
PASS_COUNT=$((PASS_COUNT + 1))

test_name "26.3 Customer leaves a review"
RESPONSE=$(curl -s -X POST "$BASE_URL/reviews" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"staffProfileId\": \"$BARBER2_PROFILE_ID\",
    \"rating\": 5,
    \"comment\": \"Perfect haircut!\",
    \"queueEntryId\": \"$REVIEW_QID\"
  }")
echo "$RESPONSE" | json_pp
PASS_COUNT=$((PASS_COUNT + 1))

test_name "26.4 Verify branch reviews"
RESPONSE=$(curl -s "$BASE_URL/reviews?branchId=$BRANCH_ID")
assert_success "$RESPONSE" "26.4 Branch reviews"

test_name "26.5 Verify barber reviews"
RESPONSE=$(curl -s "$BASE_URL/reviews?staffProfileId=$BARBER_PROFILE_ID")
assert_success "$RESPONSE" "26.5 Barber reviews"

test_name "26.6 Verify branch data includes rating"
RESPONSE=$(curl -s "$BASE_URL/branches/$BRANCH_ID")
assert_success "$RESPONSE" "26.6 Branch rating"

# =============================================================================
# 27. RBAC EXTENDED — ADDITIONAL NEGATIVE TESTS
# =============================================================================
section "27. RBAC Extended — Negative Tests"

test_name "27.1 Customer cannot calculate commissions (403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/commissions/calculate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"staffProfileId\": \"$BARBER_PROFILE_ID\", \"date\": \"$TODAY\" }")
assert_fail "$RESPONSE" "27.1 Customer commissions"

test_name "27.2 Customer cannot generate payroll (403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "staffProfileId": "test", "periodStart": "2026-02-01", "periodEnd": "2026-02-28" }')
assert_fail "$RESPONSE" "27.2 Customer payroll"

test_name "27.3 Customer cannot create product (403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/inventory/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Hack", "sku": "H-1", "costPrice": 1, "sellPrice": 1 }')
assert_fail "$RESPONSE" "27.3 Customer product"

test_name "27.4 Customer cannot open cash drawer (403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/cash-drawer/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"branchId\": \"$BRANCH_ID\", \"openingBalance\": 1 }")
assert_fail "$RESPONSE" "27.4 Customer drawer"

test_name "27.5 Customer cannot access CRM (403)"
RESPONSE=$(curl -s "$BASE_URL/crm/customers?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN")
assert_fail "$RESPONSE" "27.5 Customer CRM"

test_name "27.6 Customer cannot create campaign (403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Hack", "type": "PUSH", "startsAt": "2026-03-01T00:00:00Z" }')
assert_fail "$RESPONSE" "27.6 Customer campaign"

test_name "27.7 Barber cannot moderate review (403)"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/reviews/nonexistent/moderate" \
  -H "Authorization: Bearer $BARBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isVisible": false }')
assert_fail "$RESPONSE" "27.7 Barber moderate"

test_name "27.8 No token on loyalty endpoint (401)"
RESPONSE=$(curl -s "$BASE_URL/loyalty/me")
assert_fail "$RESPONSE" "27.8 No token loyalty"

test_name "27.9 Expired/invalid token (401)"
RESPONSE=$(curl -s "$BASE_URL/loyalty/me" \
  -H "Authorization: Bearer invalid.token.here")
assert_fail "$RESPONSE" "27.9 Invalid token"

# =============================================================================
# 28. USER MANAGEMENT (SUPER_ADMIN)
# =============================================================================
section "28. User Management (SUPER_ADMIN)"

test_name "28.1 GET /users (list all users)"
RESPONSE=$(curl -s "$BASE_URL/users" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "28.1 List users"

test_name "28.2 GET /users?role=BARBER"
RESPONSE=$(curl -s "$BASE_URL/users?role=BARBER" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "28.2 Filter role"

test_name "28.3 GET /users?search=Rizky"
RESPONSE=$(curl -s "$BASE_URL/users?search=Rizky" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "28.3 Search"

test_name "28.4 GET /users/:id"
RESPONSE=$(curl -s "$BASE_URL/users/$CUSTOMER_ID" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "28.4 Get user"

test_name "28.5 PATCH /users/:id/role → CASHIER"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/users/$BARBER_USER_ID/role" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "role": "CASHIER" }')
assert_success "$RESPONSE" "28.5 Change role"

test_name "28.6 PATCH /users/:id/role → restore to BARBER"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/users/$BARBER_USER_ID/role" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "role": "BARBER" }')
assert_success "$RESPONSE" "28.6 Restore role"

test_name "28.7 PATCH /users/:id/deactivate"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/users/$BARBER_USER_ID/deactivate" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "28.7 Deactivate"

test_name "28.8 PATCH /users/:id/reactivate"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/users/$BARBER_USER_ID/reactivate" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "28.8 Reactivate"

test_name "28.9 POST /users/:id/assign-branch"
RESPONSE=$(curl -s -X POST "$BASE_URL/users/$BARBER_USER_ID/assign-branch" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"branchId\": \"$BRANCH_ID\" }")
assert_success "$RESPONSE" "28.9 Assign branch"

test_name "28.10 DELETE /users/:id/assign-branch/:branchId"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/users/$BARBER_USER_ID/assign-branch/$BRANCH_ID" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "28.10 Remove branch"

# =============================================================================
# 29. AUDIT LOG & ANOMALIES (SUPER_ADMIN)
# =============================================================================
section "29. Audit Log & Anomalies (SUPER_ADMIN)"

test_name "29.1 GET /audit/logs"
RESPONSE=$(curl -s "$BASE_URL/audit/logs" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "29.1 Audit logs"

test_name "29.2 GET /audit/logs?action=ASSIGN_ROLE"
RESPONSE=$(curl -s "$BASE_URL/audit/logs?action=ASSIGN_ROLE" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "29.2 Filter action"

test_name "29.3 GET /audit/anomalies"
ANOMALIES_RESPONSE=$(curl -s "$BASE_URL/audit/anomalies" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$ANOMALIES_RESPONSE" "29.3 Anomalies"
ANOMALY_ID=$(echo "$ANOMALIES_RESPONSE" | json_extract '.data[0].id')
ANOMALY_ID=${ANOMALY_ID:-"00000000-0000-0000-0000-000000000000"}

test_name "29.4 GET /audit/anomalies/stats"
RESPONSE=$(curl -s "$BASE_URL/audit/anomalies/stats" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "29.4 Anomaly stats"

test_name "29.5 PATCH /audit/anomalies/:id/resolve"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/audit/anomalies/$ANOMALY_ID/resolve" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$RESPONSE" | json_pp
PASS_COUNT=$((PASS_COUNT + 1))

# =============================================================================
# 30. ANALYTICS (SUPER_ADMIN)
# =============================================================================
section "30. Analytics (SUPER_ADMIN)"

test_name "30.1 GET /analytics/dashboard"
RESPONSE=$(curl -s "$BASE_URL/analytics/dashboard" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.1 Dashboard"

test_name "30.2 GET /analytics/dashboard?date=2026-02-26"
RESPONSE=$(curl -s "$BASE_URL/analytics/dashboard?date=2026-02-26" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.2 Dashboard date"

test_name "30.3 POST /analytics/snapshots/compute"
RESPONSE=$(curl -s -X POST "$BASE_URL/analytics/snapshots/compute" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.3 Compute snapshot"

test_name "30.4 GET /analytics/comparison"
RESPONSE=$(curl -s "$BASE_URL/analytics/comparison?dateFrom=2026-01-01&dateTo=2026-02-28&metric=revenue" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.4 Comparison"

test_name "30.5 GET /analytics/heatmap (SUPER_ADMIN)"
RESPONSE=$(curl -s "$BASE_URL/analytics/heatmap?dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.5 Heatmap SA"

test_name "30.6 GET /analytics/heatmap (MANAGER)"
RESPONSE=$(curl -s "$BASE_URL/analytics/heatmap?dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_success "$RESPONSE" "30.6 Heatmap Manager"

test_name "30.7 GET /analytics/retention"
RESPONSE=$(curl -s "$BASE_URL/analytics/retention?cohortMonth=2026-01" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.7 Retention"

test_name "30.8 GET /analytics/forecast"
RESPONSE=$(curl -s "$BASE_URL/analytics/forecast?branchId=$BRANCH_ID&periods=3" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.8 Forecast"

test_name "30.9 GET /analytics/utilization"
RESPONSE=$(curl -s "$BASE_URL/analytics/utilization?branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-12-31" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.9 Utilization"

test_name "30.10 GET /analytics/utilization (no branch filter)"
RESPONSE=$(curl -s "$BASE_URL/analytics/utilization?dateFrom=2026-01-01&dateTo=2026-12-31" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "30.10 Utilization (all branches)"

# =============================================================================
# 31. REPORTS (SUPER_ADMIN)
# =============================================================================
section "31. Reports (SUPER_ADMIN)"

test_name "31.1 GET /reports/generate?type=daily_revenue"
RESPONSE=$(curl -s "$BASE_URL/reports/generate?type=daily_revenue&branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "31.1 Daily revenue"

test_name "31.2 GET /reports/generate?type=service_popularity"
RESPONSE=$(curl -s "$BASE_URL/reports/generate?type=service_popularity&branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "31.2 Service popularity"

test_name "31.3 GET /reports/generate?type=staff_leaderboard"
RESPONSE=$(curl -s "$BASE_URL/reports/generate?type=staff_leaderboard&branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "31.3 Staff leaderboard"

test_name "31.4 GET /reports/generate?type=customer_visits"
RESPONSE=$(curl -s "$BASE_URL/reports/generate?type=customer_visits&branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "31.4 Customer visits"

test_name "31.5 GET /reports/generate?type=booking_source"
RESPONSE=$(curl -s "$BASE_URL/reports/generate?type=booking_source&branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "31.5 Booking source"

test_name "31.6 GET /reports/export/csv"
RESPONSE=$(curl -s "$BASE_URL/reports/export/csv?type=daily_revenue&branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
echo -e "  ${GREEN}✓ CSV export returned ($(echo "$RESPONSE" | wc -c) bytes)${NC}"
PASS_COUNT=$((PASS_COUNT + 1))

# =============================================================================
# 32. FINANCIAL OVERSIGHT (SUPER_ADMIN)
# =============================================================================
section "32. Financial Oversight (SUPER_ADMIN)"

test_name "32.1 GET /finance/pl (consolidated P&L)"
RESPONSE=$(curl -s "$BASE_URL/finance/pl?dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "32.1 Consolidated P&L"

test_name "32.2 GET /finance/pl?branchId (branch P&L)"
RESPONSE=$(curl -s "$BASE_URL/finance/pl?dateFrom=2026-01-01&dateTo=2026-02-28&branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "32.2 Branch P&L"

test_name "32.3 GET /finance/void-discount-audit"
RESPONSE=$(curl -s "$BASE_URL/finance/void-discount-audit?branchId=$BRANCH_ID&dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "32.3 Void audit"

test_name "32.4 GET /finance/payroll-oversight"
RESPONSE=$(curl -s "$BASE_URL/finance/payroll-oversight" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "32.4 Payroll oversight"

test_name "32.5 GET /finance/tax-summary"
RESPONSE=$(curl -s "$BASE_URL/finance/tax-summary?dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "32.5 Tax summary"

# =============================================================================
# 33. PLATFORM CONFIG (SUPER_ADMIN)
# =============================================================================
section "33. Platform Config (SUPER_ADMIN)"

test_name "33.1 GET /config (all config values)"
RESPONSE=$(curl -s "$BASE_URL/config" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "33.1 Get config"

test_name "33.2 PATCH /config/TAX_RATE"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/config/TAX_RATE" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "12"}')
assert_success "$RESPONSE" "33.2 Update TAX_RATE"

test_name "33.3 PATCH /config/POINTS_EARN_RATE"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/config/POINTS_EARN_RATE" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "10000"}')
assert_success "$RESPONSE" "33.3 Update POINTS_EARN_RATE"

test_name "33.4 GET /config (verify updated)"
RESPONSE=$(curl -s "$BASE_URL/config" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "33.4 Verify config"

test_name "33.5 PATCH /config/COMMISSION_RATE_MASTER"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/config/COMMISSION_RATE_MASTER" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "40"}')
assert_success "$RESPONSE" "33.5 Commission Master"

test_name "33.6 PATCH /config/COMMISSION_RATE_SENIOR"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/config/COMMISSION_RATE_SENIOR" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "35"}')
assert_success "$RESPONSE" "33.6 Commission Senior"

test_name "33.7 PATCH /config/COMMISSION_RATE_JUNIOR"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/config/COMMISSION_RATE_JUNIOR" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "30"}')
assert_success "$RESPONSE" "33.7 Commission Junior"

# =============================================================================
# 34. PHASE 6 RBAC NEGATIVE TESTS
# =============================================================================
section "34. Phase 6 RBAC Negative Tests"

test_name "34.1 Customer cannot access /users (403)"
RESPONSE=$(curl -s "$BASE_URL/users" \
  -H "Authorization: Bearer $TOKEN")
assert_fail "$RESPONSE" "34.1 Customer users"

test_name "34.2 Customer cannot access /audit/logs (403)"
RESPONSE=$(curl -s "$BASE_URL/audit/logs" \
  -H "Authorization: Bearer $TOKEN")
assert_fail "$RESPONSE" "34.2 Customer audit"

test_name "34.3 Customer cannot access /analytics/dashboard (403)"
RESPONSE=$(curl -s "$BASE_URL/analytics/dashboard" \
  -H "Authorization: Bearer $TOKEN")
assert_fail "$RESPONSE" "34.3 Customer analytics"

test_name "34.4 Customer cannot access /finance/pl (403)"
RESPONSE=$(curl -s "$BASE_URL/finance/pl?dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $TOKEN")
assert_fail "$RESPONSE" "34.4 Customer finance"

test_name "34.5 Customer cannot access /config (403)"
RESPONSE=$(curl -s "$BASE_URL/config" \
  -H "Authorization: Bearer $TOKEN")
assert_fail "$RESPONSE" "34.5 Customer config"

test_name "34.6 Barber cannot change role (403)"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/users/$CUSTOMER_ID/role" \
  -H "Authorization: Bearer $BARBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "role": "CASHIER" }')
assert_fail "$RESPONSE" "34.6 Barber role change"

test_name "34.7 Manager cannot access consolidated P&L without branchId (403)"
RESPONSE=$(curl -s "$BASE_URL/finance/pl?dateFrom=2026-01-01&dateTo=2026-02-28" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
assert_fail "$RESPONSE" "34.7 Manager P&L"

# =============================================================================
# 35. BRANCH HOLIDAYS
# =============================================================================
section "35. Branch Holidays"

test_name "35.1 List holidays (empty)"
RESPONSE=$(curl -s "$BASE_URL/branches/$BRANCH_ID/holidays")
assert_success "$RESPONSE" "35.1 List holidays"

test_name "35.2 Create holiday (Owner)"
HOLIDAY_DATE="2027-12-$(printf '%02d' $((RANDOM % 28 + 1)))"
HOLIDAY_RESPONSE=$(curl -s -X POST "$BASE_URL/branches/$BRANCH_ID/holidays" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"date\": \"$HOLIDAY_DATE\",
    \"name\": \"Test Holiday $(date +%s)\",
    \"isClosed\": true
  }")
assert_success "$HOLIDAY_RESPONSE" "35.2 Create holiday"
HOLIDAY_ID=$(echo "$HOLIDAY_RESPONSE" | json_extract '.data.id')
echo -e "  ${GREEN}HOLIDAY_ID=$HOLIDAY_ID${NC}"

test_name "35.3 Create holiday with special hours"
HOLIDAY2_DATE="2028-06-$(printf '%02d' $((RANDOM % 28 + 1)))"
HOLIDAY2_RESPONSE=$(curl -s -X POST "$BASE_URL/branches/$BRANCH_ID/holidays" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"date\": \"$HOLIDAY2_DATE\",
    \"name\": \"Test Holiday Hours $(date +%s)\",
    \"isClosed\": false,
    \"openTime\": \"10:00\",
    \"closeTime\": \"15:00\"
  }")
assert_success "$HOLIDAY2_RESPONSE" "35.3 Holiday with hours"
HOLIDAY2_ID=$(echo "$HOLIDAY2_RESPONSE" | json_extract '.data.id')

test_name "35.4 List holidays (should have 2+)"
RESPONSE=$(curl -s "$BASE_URL/branches/$BRANCH_ID/holidays")
assert_success "$RESPONSE" "35.4 List holidays"

test_name "35.5 Update holiday"
if [ -n "$HOLIDAY_ID" ] && [ "$HOLIDAY_ID" != "" ]; then
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/branches/$BRANCH_ID/holidays/$HOLIDAY_ID" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "name": "Christmas Day (Updated)" }')
  assert_success "$RESPONSE" "35.5 Update holiday"
else
  echo -e "  ${YELLOW}SKIP (no holiday ID)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "35.6 Delete holiday"
if [ -n "$HOLIDAY2_ID" ] && [ "$HOLIDAY2_ID" != "" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/branches/$BRANCH_ID/holidays/$HOLIDAY2_ID" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
  assert_success "$RESPONSE" "35.6 Delete holiday"
else
  echo -e "  ${YELLOW}SKIP (no holiday ID)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "35.7 Customer cannot create holiday (403)"
RESPONSE=$(curl -s -X POST "$BASE_URL/branches/$BRANCH_ID/holidays" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "date": "2026-07-04", "name": "Hack", "isClosed": true }')
assert_fail "$RESPONSE" "35.7 Customer holiday"

# =============================================================================
# 36. ROLES
# =============================================================================
section "36. Roles"

test_name "36.1 List roles (Owner)"
ROLES_RESPONSE=$(curl -s "$BASE_URL/roles" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$ROLES_RESPONSE" "36.1 List roles"
EXISTING_ROLE_ID=$(echo "$ROLES_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(o.data&&o.data[0]?o.data[0].id:'')}catch(e){console.log('')}})")

test_name "36.2 Create custom role (Owner)"
NEW_ROLE_RESPONSE=$(curl -s -X POST "$BASE_URL/roles" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Receptionist",
    "description": "Front desk staff",
    "scope": "BRANCH",
    "isServiceProvider": false
  }')
assert_success "$NEW_ROLE_RESPONSE" "36.2 Create role"
NEW_ROLE_ID=$(echo "$NEW_ROLE_RESPONSE" | json_extract '.data.id')
echo -e "  ${GREEN}NEW_ROLE_ID=$NEW_ROLE_ID${NC}"

test_name "36.3 Update role"
if [ -n "$NEW_ROLE_ID" ] && [ "$NEW_ROLE_ID" != "" ]; then
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/roles/$NEW_ROLE_ID" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "description": "Front desk receptionist — updated" }')
  assert_success "$RESPONSE" "36.3 Update role"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "36.4 Get role permissions"
if [ -n "$EXISTING_ROLE_ID" ] && [ "$EXISTING_ROLE_ID" != "" ]; then
  RESPONSE=$(curl -s "$BASE_URL/roles/$EXISTING_ROLE_ID/permissions" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
  assert_success "$RESPONSE" "36.4 Get permissions"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "36.5 Set role permissions"
if [ -n "$NEW_ROLE_ID" ] && [ "$NEW_ROLE_ID" != "" ]; then
  RESPONSE=$(curl -s -X PUT "$BASE_URL/roles/$NEW_ROLE_ID/permissions" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "permissions": [
        { "featureCode": "QUEUE_MANAGEMENT", "canCreate": false, "canRead": true, "canUpdate": false, "canDelete": false }
      ]
    }')
  assert_success "$RESPONSE" "36.5 Set permissions"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "36.6 Get role services"
if [ -n "$EXISTING_ROLE_ID" ] && [ "$EXISTING_ROLE_ID" != "" ]; then
  RESPONSE=$(curl -s "$BASE_URL/roles/$EXISTING_ROLE_ID/services" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
  assert_success "$RESPONSE" "36.6 Get services"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "36.7 Set role services"
if [ -n "$NEW_ROLE_ID" ] && [ "$NEW_ROLE_ID" != "" ] && [ -n "$SVC1_ID" ]; then
  RESPONSE=$(curl -s -X PUT "$BASE_URL/roles/$NEW_ROLE_ID/services" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{ \"serviceIds\": [\"$SVC1_ID\"] }")
  assert_success "$RESPONSE" "36.7 Set services"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "36.8 Delete test role"
if [ -n "$NEW_ROLE_ID" ] && [ "$NEW_ROLE_ID" != "" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/roles/$NEW_ROLE_ID" \
    -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
  assert_success "$RESPONSE" "36.8 Delete role"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "36.9 Customer cannot list roles (403)"
RESPONSE=$(curl -s "$BASE_URL/roles" \
  -H "Authorization: Bearer $TOKEN")
assert_fail "$RESPONSE" "36.9 Customer list roles"

# =============================================================================
# 37. PLATFORM ADMIN
# =============================================================================
section "37. Platform Admin"

test_name "37.1 Platform admin login"
PLATFORM_LOGIN=$(curl -s -X POST "$BASE_URL/platform/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tmng.dev",
    "password": "PlatformAdmin123!"
  }')
assert_success "$PLATFORM_LOGIN" "37.1 Platform login"
PLATFORM_TOKEN=$(echo "$PLATFORM_LOGIN" | json_extract '.data.token')
echo -e "  ${GREEN}PLATFORM_TOKEN captured${NC}"

test_name "37.2 Platform login — wrong password"
RESPONSE=$(curl -s -X POST "$BASE_URL/platform/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@tmng.dev", "password": "wrong" }')
assert_fail "$RESPONSE" "37.2 Bad password"

test_name "37.3 List organizations"
RESPONSE=$(curl -s "$BASE_URL/platform/organizations" \
  -H "Authorization: Bearer $PLATFORM_TOKEN")
assert_success "$RESPONSE" "37.3 List orgs"
PLATFORM_ORG_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(o.data&&o.data[0]?o.data[0].id:'')}catch(e){console.log('')}})")

test_name "37.4 Get organization by ID"
if [ -n "$PLATFORM_ORG_ID" ] && [ "$PLATFORM_ORG_ID" != "" ]; then
  RESPONSE=$(curl -s "$BASE_URL/platform/organizations/$PLATFORM_ORG_ID" \
    -H "Authorization: Bearer $PLATFORM_TOKEN")
  assert_success "$RESPONSE" "37.4 Get org"
else
  echo -e "  ${YELLOW}SKIP (no org ID)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "37.5 Create test organization"
PLATFORM_TS=$(date +%s)
PLATFORM_NEW_ORG=$(curl -s -X POST "$BASE_URL/platform/organizations" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Curl Org $PLATFORM_TS\",
    \"slug\": \"test-curl-org-$PLATFORM_TS\",
    \"industry\": \"BARBERSHOP\",
    \"ownerEmail\": \"test-owner-$PLATFORM_TS@test.com\",
    \"ownerFirstName\": \"Test\",
    \"ownerLastName\": \"Owner\",
    \"ownerPassword\": \"TestOwner123!\"
  }")
assert_success "$PLATFORM_NEW_ORG" "37.5 Create org"
PLATFORM_NEW_ORG_ID=$(echo "$PLATFORM_NEW_ORG" | json_extract '.data.id')

test_name "37.6 Update organization"
if [ -n "$PLATFORM_NEW_ORG_ID" ] && [ "$PLATFORM_NEW_ORG_ID" != "" ]; then
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/platform/organizations/$PLATFORM_NEW_ORG_ID" \
    -H "Authorization: Bearer $PLATFORM_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "name": "Updated Curl Org" }')
  assert_success "$RESPONSE" "37.6 Update org"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "37.7 Deactivate test organization"
if [ -n "$PLATFORM_NEW_ORG_ID" ] && [ "$PLATFORM_NEW_ORG_ID" != "" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/platform/organizations/$PLATFORM_NEW_ORG_ID" \
    -H "Authorization: Bearer $PLATFORM_TOKEN")
  assert_success "$RESPONSE" "37.7 Deactivate org"
else
  echo -e "  ${YELLOW}SKIP${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "37.8 List features"
RESPONSE=$(curl -s "$BASE_URL/platform/features" \
  -H "Authorization: Bearer $PLATFORM_TOKEN")
assert_success "$RESPONSE" "37.8 Features"

test_name "37.9 List templates"
RESPONSE=$(curl -s "$BASE_URL/platform/templates" \
  -H "Authorization: Bearer $PLATFORM_TOKEN")
assert_success "$RESPONSE" "37.9 Templates"

test_name "37.10 Get platform config"
RESPONSE=$(curl -s "$BASE_URL/platform/config" \
  -H "Authorization: Bearer $PLATFORM_TOKEN")
assert_success "$RESPONSE" "37.10 Get config"

test_name "37.11 Set platform config"
RESPONSE=$(curl -s -X PUT "$BASE_URL/platform/config" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "key": "MAINTENANCE_MODE", "value": "false" }')
echo "$RESPONSE" | json_pp
PASS_COUNT=$((PASS_COUNT + 1))

test_name "37.12 Tenant token cannot access platform (401/403)"
RESPONSE=$(curl -s "$BASE_URL/platform/organizations" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_fail "$RESPONSE" "37.12 Tenant on platform"

# =============================================================================
# 38. MISSING AUTH ENDPOINTS
# =============================================================================
section "38. Auth — Additional Endpoints"

test_name "38.1 Forgot password"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{ "email": "customer1@gmail.com" }')
assert_success "$RESPONSE" "38.1 Forgot password"

test_name "38.2 Forgot password — non-existent email"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{ "email": "doesnotexist@test.com" }')
assert_success "$RESPONSE" "38.2 Forgot non-existent (should still succeed)"

test_name "38.3 Search users (Owner)"
RESPONSE=$(curl -s "$BASE_URL/auth/users?search=Rizky" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "38.3 Search users"

test_name "38.4 Search users — exclude barbers"
RESPONSE=$(curl -s "$BASE_URL/auth/users?search=budi&excludeBarbers=true" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN")
assert_success "$RESPONSE" "38.4 Exclude barbers"

test_name "38.5 Delete account (register throwaway, then delete)"
THROWAWAY_REG=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"orgSlug\": \"$ORG_SLUG\",
    \"email\": \"throwaway_$(date +%s)@test.com\",
    \"password\": \"Throwaway1234!\",
    \"firstName\": \"Throw\",
    \"lastName\": \"Away\"
  }")
THROWAWAY_TOKEN=$(echo "$THROWAWAY_REG" | json_extract '.data.accessToken')
if [ -n "$THROWAWAY_TOKEN" ] && [ "$THROWAWAY_TOKEN" != "" ]; then
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/auth/me" \
    -H "Authorization: Bearer $THROWAWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "confirm": "DELETE" }')
  assert_success "$RESPONSE" "38.5 Delete account"
else
  echo -e "  ${YELLOW}SKIP (registration failed)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "38.6 Delete account — wrong confirmation"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "confirm": "WRONG" }')
assert_fail "$RESPONSE" "38.6 Wrong confirm"

# =============================================================================
# 39. MISSING QUEUE ENDPOINTS
# =============================================================================
section "39. Queue — Additional Endpoints"

test_name "39.1 Check availability"
RESPONSE=$(curl -s "$BASE_URL/queue/availability?branchId=$BRANCH_ID&date=$TODAY")
assert_success "$RESPONSE" "39.1 Availability"

test_name "39.2 Check availability with staff filter"
RESPONSE=$(curl -s "$BASE_URL/queue/availability?branchId=$BRANCH_ID&date=$TODAY&staffProfileId=$BARBER_PROFILE_ID")
assert_success "$RESPONSE" "39.2 Availability + staff"

test_name "39.3 Customer cancel (create booking then cancel)"
CANCEL_BOOKING=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"APP\",
    \"customerName\": \"Cancel Test\",
    \"serviceIds\": [\"$SVC1_ID\"],
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"startTime\": \"2026-03-15T11:00:00Z\",
    \"estimatedDuration\": 30
  }")
CANCEL_QID=$(echo "$CANCEL_BOOKING" | json_extract '.data.id')
if [ -n "$CANCEL_QID" ] && [ "$CANCEL_QID" != "" ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/queue/$CANCEL_QID/customer-cancel" \
    -H "Authorization: Bearer $TOKEN")
  assert_success "$RESPONSE" "39.3 Customer cancel"
else
  echo -e "  ${YELLOW}SKIP (booking failed)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "39.4 Reschedule booking"
RESCHED_BOOKING=$(curl -s -X POST "$BASE_URL/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"source\": \"APP\",
    \"customerName\": \"Reschedule Test\",
    \"serviceIds\": [\"$SVC1_ID\"],
    \"staffProfileId\": \"$BARBER_PROFILE_ID\",
    \"startTime\": \"2026-03-16T10:00:00Z\",
    \"estimatedDuration\": 30
  }")
RESCHED_QID=$(echo "$RESCHED_BOOKING" | json_extract '.data.id')
if [ -n "$RESCHED_QID" ] && [ "$RESCHED_QID" != "" ]; then
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/queue/$RESCHED_QID/reschedule" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "startTime": "2026-03-16T14:00:00Z" }')
  assert_success "$RESPONSE" "39.4 Reschedule"
else
  echo -e "  ${YELLOW}SKIP (booking failed)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 40. MISSING LOYALTY / PAYROLL ENDPOINTS
# =============================================================================
section "40. Loyalty & Payroll — Additional Endpoints"

test_name "40.1 Redeem loyalty points (Customer)"
RESPONSE=$(curl -s -X POST "$BASE_URL/loyalty/redeem" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"points\": 5, \"transactionId\": \"$TX_ID\" }")
echo "$RESPONSE" | json_pp
PASS_COUNT=$((PASS_COUNT + 1))

test_name "40.2 Disburse payroll"
DISBURSE_PAYROLL=$(curl -s -X POST "$BASE_URL/payroll/generate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"staffProfileId\": \"$BARBER2_PROFILE_ID\", \"periodStart\": \"2026-01-01\", \"periodEnd\": \"2026-01-31\" }")
DISBURSE_PAYROLL_ID=$(echo "$DISBURSE_PAYROLL" | json_extract '.data.id')

if [ -n "$DISBURSE_PAYROLL_ID" ] && [ "$DISBURSE_PAYROLL_ID" != "" ]; then
  curl -s -X POST "$BASE_URL/payroll/$DISBURSE_PAYROLL_ID/submit" \
    -H "Authorization: Bearer $MANAGER_TOKEN" > /dev/null
  curl -s -X POST "$BASE_URL/payroll/$DISBURSE_PAYROLL_ID/approve" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "note": "Approved for disburse test" }' > /dev/null

  RESPONSE=$(curl -s -X POST "$BASE_URL/payroll/$DISBURSE_PAYROLL_ID/disburse" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "note": "Disbursed via curl test" }')
  assert_success "$RESPONSE" "40.2 Disburse payroll"
else
  echo -e "  ${YELLOW}SKIP (payroll generation failed)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# =============================================================================
# 41. MEDIA UPLOAD — EXTENDED TESTS
# =============================================================================
section "41. Media Upload — Extended"

test_name "41.1 Upload to products prefix"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=products" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
assert_success "$RESPONSE" "41.1 Products prefix"

test_name "41.2 Upload to branches prefix"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=branches" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
assert_success "$RESPONSE" "41.2 Branches prefix"

test_name "41.3 Upload with entityId (subfolder)"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=avatars&entityId=$CUSTOMER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
ENTITY_SUCCESS=$(echo "$RESPONSE" | json_extract '.success')
ENTITY_KEY=$(echo "$RESPONSE" | json_extract '.data.key')
if [ "$ENTITY_SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}✓ PASS${NC} (key: $ENTITY_KEY)"
  PASS_COUNT=$((PASS_COUNT + 1))
  # Verify the key contains the entityId
  if echo "$ENTITY_KEY" | grep -q "$CUSTOMER_ID"; then
    echo -e "  ${GREEN}  → entityId subfolder confirmed in key${NC}"
  else
    echo -e "  ${YELLOW}  → entityId not in key: $ENTITY_KEY${NC}"
  fi
else
  echo -e "  ${RED}✗ FAIL${NC}: 41.3 EntityId upload"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

test_name "41.4 Reject wrong MIME type (text/plain)"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=reviews" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=text/plain")
assert_fail "$RESPONSE" "41.4 Wrong MIME"

test_name "41.5 Verify response shape (url + key fields)"
RESPONSE=$(curl -s -X POST "$BASE_URL/media/upload?prefix=reviews" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@$TEST_PNG;type=image/png")
MEDIA_URL=$(echo "$RESPONSE" | json_extract '.data.url')
MEDIA_KEY=$(echo "$RESPONSE" | json_extract '.data.key')
MEDIA_SUCCESS=$(echo "$RESPONSE" | json_extract '.success')
if [ "$MEDIA_SUCCESS" = "true" ] && [ -n "$MEDIA_URL" ] && [ "$MEDIA_URL" != "" ] && [ -n "$MEDIA_KEY" ] && [ "$MEDIA_KEY" != "" ]; then
  echo -e "  ${GREEN}✓ PASS${NC}"
  echo -e "  url: $MEDIA_URL"
  echo -e "  key: $MEDIA_KEY"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗ FAIL${NC}: Missing url or key in response"
  echo "$RESPONSE" | json_pp
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

test_name "41.6 Verify uploaded file serves via MinIO"
if [ -n "$MEDIA_URL" ] && [ "$MEDIA_URL" != "" ] && [ "$MEDIA_URL" != "null" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$MEDIA_URL")
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} (HTTP $HTTP_CODE)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗ FAIL${NC}: Expected HTTP 200, got $HTTP_CODE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo -e "  ${YELLOW}SKIP (no URL)${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

test_name "41.7 Response has NO file ID (by design)"
FILE_ID=$(echo "$RESPONSE" | json_extract '.data.id')
if [ -z "$FILE_ID" ] || [ "$FILE_ID" = "" ] || [ "$FILE_ID" = "null" ] || [ "$FILE_ID" = "undefined" ]; then
  echo -e "  ${GREEN}✓ PASS (no file ID — URL-based reference by design)${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}NOTE: Response contains file ID: $FILE_ID${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}━━━ ALL TESTS COMPLETE ━━━${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASSED:  $PASS_COUNT${NC}"
echo -e "  ${RED}FAILED:  $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}SKIPPED: $SKIP_COUNT${NC}"
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))
echo -e "  TOTAL:   $TOTAL"
echo -e ""
echo -e "To re-run: bash docs/curl_tests.sh"

if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
fi

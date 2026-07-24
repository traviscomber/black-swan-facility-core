# ACTION PLAN - UNBLOCK PHASE A TESTING

**Objective**: Get calendar data loading so we can validate Phase A-D features  
**Current Blocker**: Calendar shows "Cargando..." indefinitely (no data)  
**Root Cause**: Unknown (likely DB empty, RLS issue, or silent API error)

---

## PHASE 1: QUICK DIAGNOSTICS (15 min)

### Step 1.1: Check if calendar error is being caught
Add temporary debug logging to `loadData` function to see what's happening:

**File**: `app/bookings/calendar/page.tsx`  
**Action**: Add console.log in loadData to see if queries return data or errors

```typescript
const loadData = useCallback(async () => {
  setLoading(true)
  setError(null)
  const [locationsResult, bedsResult, ...] = await Promise.all([...])
  
  console.log("[v0] Locations:", locationsResult.data?.length, locationsResult.error)
  console.log("[v0] Beds:", bedsResult.data?.length, bedsResult.error)
  console.log("[v0] Reservations:", reservationsResult.data?.length, reservationsResult.error)
  
  const firstError = locationsResult.error || bedsResult.error || ...
  if (firstError) setError(firstError.message)
  ...
}, ...)
```

### Step 1.2: Check browser console
1. Reload calendar page
2. Open DevTools console (F12)
3. Look for "[v0]" logs showing data counts

**Expected outcomes**:
- ✅ Data loads: "Locations: 5, Beds: 10, Reservations: 3"
- ❌ Data is null: "Locations: 0, Beds: 0, Reservations: 0"
- ❌ RLS error: "error": "new row violates row level security policy"
- ❌ Other error: See actual error message

### Step 1.3: Check Supabase RLS policies
Query Supabase REST API directly (with your user's auth token):

```bash
# Get your JWT from browser (Application → Cookies → sb-...):
curl -H "Authorization: Bearer YOUR_JWT" \
  "https://YOUR_SUPABASE_URL/rest/v1/beds?select=*" 
```

If you see RLS errors, problem is access control. If you see empty array, DB is empty.

---

## PHASE 2: INTERPRET DIAGNOSTICS (5 min)

Based on Phase 1 findings, follow the corresponding path:

### If Data Loads (Best Case ✅)
- Console shows "Locations: N, Beds: N, Reservations: N"  
- **Action**: Calendar should display data, proceed to Phase A-D testing
- **Next**: PASO 6-11 manual validation

### If Data is Empty (DB Empty) ❌
- Console shows "Locations: 0, Beds: 0, Reservations: 0"  
- **Action**: Seed test data
- **Next**: PHASE 3 - Seed Data

### If RLS Blocked (Access Error) ❌
- Console shows RLS policy error
- **Action**: Check RLS policies on tables
- **Next**: Contact DBA or review Supabase policies

### If Other Error ❌
- Console shows different error message
- **Action**: Investigate specific error
- **Next**: Debug based on error message

---

## PHASE 3: SEED TEST DATA (30 min)

If Phase 1 diagnostics show empty database:

### Step 3.1: Create test data directly in Supabase

Login to Supabase → SQL Editor → Run:

```sql
-- Create location
INSERT INTO locations (id, name, is_active)
VALUES ('loc-1', 'Main Building', true);

-- Create rooms
INSERT INTO rooms (id, room_number, room_type, location_id)
VALUES 
  ('room-1', '101', 'Suite', 'loc-1'),
  ('room-2', '102', 'Double', 'loc-1');

-- Create beds
INSERT INTO beds (id, bed_number, bed_type, room_id)
VALUES
  ('bed-1', 'A', 'King', 'room-1'),
  ('bed-2', 'B', 'Queen', 'room-1'),
  ('bed-3', 'A', 'Queen', 'room-2');

-- Create reservations (Jul 24 - Aug 6)
INSERT INTO reservations 
  (id, bed_id, guest_name, check_in, check_out, status)
VALUES
  ('res-1', 'bed-1', 'John Smith', '2026-07-25', '2026-07-28', 'confirmed'),
  ('res-2', 'bed-2', 'Jane Doe', '2026-07-24', '2026-07-26', 'confirmed'),
  ('res-3', 'bed-3', 'Bob Johnson', '2026-08-01', '2026-08-05', 'confirmed');
```

### Step 3.2: Refresh calendar in browser
- Reload page (F5)
- Check if data appears

**Expected**: Calendar shows 3 beds with colored reservation blocks

---

## PHASE 4: VALIDATE PHASE A FEATURES (30 min)

Once calendar data loads:

### Test A1: Horizontal Drag
- Find a reservation block
- Drag horizontally to different date
- **Expected**: Block moves smoothly, animation plays

### Test A2: Vertical Autoscroll
- Drag reservation to bottom edge of calendar
- **Expected**: Calendar scrolls automatically as you drag near bottom

### Test A3: FLIP Animation
- Release drag after moving
- **Expected**: Smooth 220ms animation from old position to new

### Test A4: Touch Handles
- Open DevTools → Device mode → iPad
- Hover over reservation block
- **Expected**: Resize handles visible and larger (32px vs 12px desktop)

### Test A5: No Errors
- Check console (F12) for errors
- **Expected**: No errors, only "[v0]" debug logs

---

## SUCCESS CRITERIA

✅ All features pass Phases 1-4:
- [ ] Calendar data loads (Phase 1)
- [ ] Test data seeded (Phase 3)
- [ ] Horizontal drag works (Phase 4)
- [ ] Vertical autoscroll works (Phase 4)
- [ ] FLIP animations play (Phase 4)
- [ ] Touch handles are large (Phase 4)
- [ ] No console errors (Phase 4)

If ALL pass → Phase A VALIDATED ✅

---

## TECHNICAL DEBT (Not blocking Phase A)

### TypeScript Errors in lib/language-context.ts
- **Count**: 285+ errors
- **Issue**: Duplicate object keys in translation definitions
- **Severity**: MEDIUM (doesn't affect app, but invalid TS)
- **Fix**: Deduplicate keys in language translations
- **Timeline**: After Phase A-D validation (not critical path)
- **Current**: Ignored via `next.config.mjs` `ignoreBuildErrors: true`

---

## HOW TO EXECUTE THIS PLAN

1. **Right now**: Run PHASE 1 diagnostics (add console.log, reload page, check console)
2. **Based on Phase 1 result**: Jump to corresponding Phase (2-4)
3. **Report findings**: Share Phase 1 console output
4. **Next steps**: I'll guide based on what we find

**Time investment**: 30-45 min total to validate Phase A


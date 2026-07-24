# Deployment Guide - Hospitality Reservation System Phases 1-4

## Prerequisites

- Vercel project connected to `black-swan-facility-core` repository
- Supabase project configured with database
- Main branch updated with all changes

## Step 1: Push Code to GitHub

All code changes have been made locally. Push to the v0 feature branch:

```bash
git add -A
git commit -m "Phase 1-4: Double-booking prevention, atomic transactions, conflict calendar, drag-resize

- Phase 1: Add check_reservation_conflict() trigger + index for double-booking prevention
- Phase 2: Create create_reservation_atomic() RPC for all-or-nothing reservation + invoice
- Phase 3: Build AvailabilityCalendarPicker component with real-time conflict display
- Phase 4: Add ResizableReservationBlock for drag-to-resize timeline editing

Files:
- supabase/migrations/20260723000000_add_double_booking_prevention.sql
- supabase/migrations/20260723000100_create_atomic_reservation_rpc.sql
- components/availability-calendar-picker.tsx
- components/resizable-reservation-block.tsx
- app/api/bookings/reservations/route.ts
- app/api/bookings/reservations/update/route.ts
- components/add-reservation-dialog.tsx (updated)
- app/bookings/calendar/page.tsx (updated)

Status: Ready for production"

git push origin v0/travis-2540-6f17a1e2
```

## Step 2: Run Database Migrations

In Supabase SQL Editor (or via migration runner):

### Migration 1: Double-Booking Prevention

```sql
-- From: supabase/migrations/20260723000000_add_double_booking_prevention.sql
-- Creates:
--   - Function: check_reservation_conflict()
--   - Trigger: prevent_reservation_conflicts
--   - Index: idx_reservations_bed_dates

-- Paste entire migration file and execute
```

Verify:
```sql
-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'prevent_reservation_conflicts';

-- Check index exists
SELECT indexname FROM pg_indexes 
WHERE indexname = 'idx_reservations_bed_dates';
```

### Migration 2: Atomic RPC Function

```sql
-- From: supabase/migrations/20260723000100_create_atomic_reservation_rpc.sql
-- Creates:
--   - Function: create_reservation_atomic(...)
--   - Function: create_reservation_invoice(...) [already exists, updated]
--   - RLS grants to authenticated users

-- Paste entire migration file and execute
```

Verify:
```sql
-- Check RPC exists and is executable
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'create_reservation_atomic';

-- Test call (should return success=false for non-existent bed)
SELECT public.create_reservation_atomic(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Test Guest',
  'test@example.com',
  '+1234567890',
  '2026-07-24'::date,
  '2026-07-25'::date
);
```

## Step 3: Deploy to Vercel

Option A (Recommended - via GitHub PR):
```bash
# Create PR from v0/travis-2540-6f17a1e2 to main
# Vercel will automatically preview the changes
# Once approved, merge to main for production deployment
```

Option B (Direct push):
```bash
git push origin v0/travis-2540-6f17a1e2:main
# Vercel will automatically detect and deploy
```

Monitor deployment:
1. Go to https://vercel.com/dashboard
2. Select `black-swan-facility-core` project
3. Watch build logs
4. Deployment complete when status is "Ready"

## Step 4: Verify Deployments

### Test Phase 1: Double-Booking Prevention

```bash
# Via API (using curl or Postman)
curl -X POST http://localhost:3000/api/bookings/reservations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bed_id": "YOUR_BED_ID",
    "guest_name": "Test Guest 1",
    "check_in": "2026-07-24",
    "check_out": "2026-07-26",
    "total_amount": 100
  }'

# Try same request again → Should get 409 Conflict
```

### Test Phase 2: Atomic Transaction

```bash
# Create reservation (should auto-create invoice)
curl -X POST http://localhost:3000/api/bookings/reservations \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# Check if invoice was created:
SELECT * FROM invoices 
WHERE reservation_id = 'YOUR_RESERVATION_ID';
```

### Test Phase 3: Availability Calendar

1. Open http://localhost:3000/bookings/calendar
2. Click "New Reservation"
3. Select a location
4. Select a bed
5. Verify calendar shows:
   - Green dates for available
   - Red dates for booked
   - Blue dates for selected range

### Test Phase 4: Drag-to-Resize

1. In calendar view, hover over a reservation block
2. Cursor should change to grab icon on hover
3. Click and drag left edge → Check-in updates
4. Click and drag right edge → Check-out updates
5. Drag into conflict → Red error appears, drag cancels

## Step 5: Production Checklist

Before enabling for all users:

- [ ] All database migrations executed without errors
- [ ] RPC functions verify successfully
- [ ] Test reservations can be created via new API
- [ ] Conflict detection works (try double-booking)
- [ ] Calendar loads without errors
- [ ] Drag-to-resize responds smoothly
- [ ] Mobile view functions (if applicable)
- [ ] Error messages are clear and helpful
- [ ] Logs show no errors in Vercel/Supabase
- [ ] Performance is acceptable (< 2s page load)

## Rollback Plan

If issues occur:

### Rollback Code
```bash
# Revert to previous version
git revert HEAD --no-edit
git push origin v0/travis-2540-6f17a1e2

# Or manually revert components in Vercel dashboard settings
```

### Rollback Database (if needed)
```sql
-- Disable Phase 1 trigger
DROP TRIGGER prevent_reservation_conflicts ON public.reservations;

-- Old code will fall back to direct .insert()
-- (but won't have conflict prevention)
```

### Restore from Backup
- Supabase maintains daily backups
- Can restore point-in-time if data corruption occurs
- See: https://supabase.com/docs/guides/database/backups

## Monitoring After Deployment

### Key Metrics to Watch

1. **Reservation Creation Success Rate**
   - Target: 95%+ success
   - Monitor: Supabase query logs

2. **API Response Times**
   - Target: < 500ms for create_reservation_atomic
   - Monitor: Vercel Analytics

3. **Conflict Detection**
   - Count: Should block ~5-10% of "bad" requests
   - Monitor: Application logs

4. **User Feedback**
   - Common issues: Drag handling on mobile, date selection
   - Monitor: Error reporting / support tickets

### Log Queries

```sql
-- Check recent conflicts (Phase 1)
SELECT created_at, guest_name, status, check_in, check_out 
FROM reservations 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check RPC execution errors
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%create_reservation_atomic%';
```

## Support / Troubleshooting

### Issue: "409 Conflict" when dates shouldn't conflict

**Solution**: Verify trigger was created correctly
```sql
SELECT pg_get_triggerdef('prevent_reservation_conflicts'::regclass);
```

### Issue: Drag-to-resize doesn't work on mobile

**Solution**: Mobile touch support not included in Phase 4
- Workaround: Disable drag on touch devices, show edit dialog instead
- Future: Implement touch event handlers

### Issue: Calendar loads slowly

**Solution**: Check if index was created
```sql
EXPLAIN ANALYZE SELECT * FROM reservations 
WHERE bed_id = 'YOUR_BED_ID' 
AND status NOT IN ('cancelled', 'canceled', 'void', 'voided')
AND check_in < '2026-08-23' 
AND check_out > '2026-07-23';
```

### Issue: Invoice not created with reservation

**Solution**: Check RPC function permissions
```sql
-- Verify permissions are set
SELECT grantee, privilege_type FROM information_schema.role_table_grants 
WHERE table_name = 'invoices' AND grantee = 'authenticated';
```

---

## Contact / Questions

For deployment issues or questions:
- Check Vercel logs: https://vercel.com/dashboard
- Check Supabase logs: https://supabase.com/dashboard
- Review this guide: HOSPITALITY_IMPLEMENTATION_COMPLETE.md

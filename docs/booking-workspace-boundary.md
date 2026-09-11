# Booking workspace boundary

Black Swan Booking is a focused hospitality workspace inside BSFC.

- The BedBooking-like sidebar remains local to `/bookings`.
- The BlackSwan brand in that sidebar is the explicit route back to `/{locale}/os`.
- Cross-workspace destinations such as Employees may leave the booking shell and return to the global BSFC shell.
- Booking parity must not duplicate the global OS navigation inside the booking sidebar.
- Vercel preview deployments for the batching branch remain disabled; GitHub quality gates validate the full application before merge.

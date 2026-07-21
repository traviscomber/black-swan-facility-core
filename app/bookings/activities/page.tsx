"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, isAfter, isBefore, isSameDay, parseISO, startOfDay } from "date-fns"
import {
  ArrowLeft,
  BedDouble,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import
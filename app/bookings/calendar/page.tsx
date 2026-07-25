"use client"

import type React from "react"
import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { Ban, BedDouble, CalendarDays, CheckSquare
export interface BedBookingDisplayIdentity {
  displayName: string
  guestCapacity: number | null
  source: "bedbooking_verified" | "canonical_fallback"
}

type RoomIdentity = {
  propertyName: string
  roomNumber: string
}

const VERIFIED_BEDBOOKING_ROOM_IDENTITIES = new Map<string, BedBookingDisplayIdentity>([
  ["clubhouse::notro", { displayName: "CH-Notro", guestCapacity: 2, source: "bedbooking_verified" }],
  ["clubhouse::avellano", { displayName: "CH-Avellano", guestCapacity: 6, source: "bedbooking_verified" }],
  ["clubhouse::ulmo", { displayName: "CH-Ulmo", guestCapacity: 5, source: "bedbooking_verified" }],
  ["garden house::habitación 1", { displayName: "Garden House 1", guestCapacity: 2, source: "bedbooking_verified" }],
  ["garden house::habitación 2", { displayName: "Garden House 2", guestCapacity: 2, source: "bedbooking_verified" }],
  ["garden house::habitación 3", { displayName: "Garden House 3", guestCapacity: 2, source: "bedbooking_verified" }],
  ["bamboo house::room 1", { displayName: "BH-Bamboo House 1", guestCapacity: 2, source: "bedbooking_verified" }],
  ["bamboo house::room 2", { displayName: "BH-Bamboo House 2", guestCapacity: 2, source: "bedbooking_verified" }],
  ["bamboo house::room 3", { displayName: "BH-Bamboo House 3", guestCapacity: 2, source: "bedbooking_verified" }],
  ["ed office::oficina", { displayName: "Office Room", guestCapacity: 1, source: "bedbooking_verified" }],
  ["prairy house 2::room1", { displayName: "PH2- Prairie House 1", guestCapacity: 2, source: "bedbooking_verified" }],
  ["prairy house 2::room2", { displayName: "PH2- Prairie House 2", guestCapacity: 2, source: "bedbooking_verified" }],
  ["prairy house 2::room3", { displayName: "PH2- Prairie House 3", guestCapacity: 2, source: "bedbooking_verified" }],
])

export const VERIFIED_BEDBOOKING_REFERENCE_ROWS = [
  { displayName: "TO-Arrayan", guestCapacity: 2 },
  { displayName: "TO-Copihue", guestCapacity: 2 },
  { displayName: "TO-Camelia", guestCapacity: 2 },
  { displayName: "TO-Hortensia", guestCapacity: 2 },
  { displayName: "TO-Loto", guestCapacity: 2 },
  { displayName: "TO-Chilco", guestCapacity: 2 },
  { displayName: "CP-Bandurrias", guestCapacity: 2 },
  { displayName: "CP-Cisne Negro", guestCapacity: 2 },
  { displayName: "CP-Queltehue", guestCapacity: 2 },
  { displayName: "CP-Choroy", guestCapacity: 2 },
  { displayName: "CH-Notro", guestCapacity: 2 },
  { displayName: "CH-Avellano", guestCapacity: 6 },
  { displayName: "CH-Ulmo", guestCapacity: 5 },
  { displayName: "Garden House 1", guestCapacity: 2 },
  { displayName: "Garden House 2", guestCapacity: 2 },
  { displayName: "Garden House 3", guestCapacity: 2 },
  { displayName: "BH-Bamboo House 1", guestCapacity: 2 },
  { displayName: "BH-Bamboo House 2", guestCapacity: 2 },
  { displayName: "BH-Bamboo House 3", guestCapacity: 2 },
  { displayName: "Hotelito 1", guestCapacity: 2 },
  { displayName: "Hotelito 2", guestCapacity: 2 },
  { displayName: "Hotelito 3", guestCapacity: 2 },
  { displayName: "Office Room", guestCapacity: 1 },
  { displayName: "Office Room 2", guestCapacity: 1 },
  { displayName: "PH1- Prairie House 1", guestCapacity: 2 },
  { displayName: "PH1- Prairie House 2", guestCapacity: 2 },
  { displayName: "PH1- Prairie House 3", guestCapacity: 2 },
  { displayName: "PH2- Prairie House 1", guestCapacity: 2 },
  { displayName: "PH2- Prairie House 2", guestCapacity: 2 },
  { displayName: "PH2- Prairie House 3", guestCapacity: 2 },
  { displayName: "PH3- Prairie House 1", guestCapacity: 2 },
  { displayName: "PH3- Prairie House 2", guestCapacity: 2 },
  { displayName: "PH3- Prairie House 3", guestCapacity: 2 },
  { displayName: "CH- Chef House 1", guestCapacity: 2 },
  { displayName: "CH- Chef House 2", guestCapacity: 2 },
  { displayName: "PC- Puerto Claro 1", guestCapacity: 2 },
  { displayName: "PC- Puerto Claro 2", guestCapacity: 2 },
  { displayName: "PC- Puerto Claro 3", guestCapacity: 2 },
  { displayName: "CH-Canelo", guestCapacity: 2 },
  { displayName: "CH-Laurel", guestCapacity: 2 },
  { displayName: "Glamping Tent", guestCapacity: 2 },
] as const

function key(propertyName: string, roomNumber: string) {
  return `${propertyName.trim().toLocaleLowerCase("es-CL")}::${roomNumber.trim().toLocaleLowerCase("es-CL")}`
}

function fallbackDisplayName(propertyName: string, roomNumber: string) {
  const normalizedProperty = propertyName.trim()
  const normalizedRoom = roomNumber.trim()
  if (normalizedProperty === "Garden House") {
    const match = normalizedRoom.match(/(\d+)$/)
    if (match) return `Garden House ${match[1]}`
  }
  return normalizedRoom || normalizedProperty
}

export function getBedBookingDisplayIdentity({ propertyName, roomNumber }: RoomIdentity): BedBookingDisplayIdentity {
  return VERIFIED_BEDBOOKING_ROOM_IDENTITIES.get(key(propertyName, roomNumber)) ?? {
    displayName: fallbackDisplayName(propertyName, roomNumber),
    guestCapacity: null,
    source: "canonical_fallback",
  }
}

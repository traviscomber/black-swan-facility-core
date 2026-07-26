export type OperationalArea =
  | "ganaderia"
  | "hospitalidad"
  | "housekeeping"
  | "mantenimiento"
  | "huerto_vinedo"
  | "infraestructura"
  | "logistica"
  | "seguridad"
  | "administracion"

export type OperationalTaskTemplate = {
  id: string
  area: OperationalArea
  category: string
  title: string
  description: string
  estimatedMinutes: number
  priority: "baja" | "media" | "alta" | "urgente"
  animalHandling?: boolean
  safetyNotes?: string
  suitableForVolunteers?: boolean
}

export const operationalAreaLabels: Record<OperationalArea, string> = {
  ganaderia: "Ganadería y animales",
  hospitalidad: "Hospitalidad y huéspedes",
  housekeeping: "Housekeeping y habitaciones",
  mantenimiento: "Mantenimiento",
  huerto_vinedo: "Huerto y viñedo",
  infraestructura: "Infraestructura y exteriores",
  logistica: "Logística y abastecimiento",
  seguridad: "Seguridad y prevención",
  administracion: "Administración y apoyo",
}

export const operationalTaskTemplates: OperationalTaskTemplate[] = [
  { id: "ganado-ronda", area: "ganaderia", category: "Observación animal", title: "Ronda de observación del ganado", description: "Revisar comportamiento, movilidad, consumo de agua y señales visibles de lesión o enfermedad. Informar anomalías sin realizar tratamientos no autorizados.", estimatedMinutes: 45, priority: "alta", animalHandling: true, safetyNotes: "No ingresar solo a corrales con animales reactivos. Mantener vía de salida despejada.", suitableForVolunteers: false },
  { id: "ganado-agua", area: "ganaderia", category: "Agua y alimentación", title: "Revisar bebederos y suministro de agua", description: "Comprobar nivel, limpieza, flujo, filtraciones y acceso seguro de los animales. Registrar fallas para mantenimiento.", estimatedMinutes: 40, priority: "alta", animalHandling: true, safetyNotes: "Cortar energía antes de intervenir bombas o cableado. No trabajar entre animales en movimiento.", suitableForVolunteers: true },
  { id: "ganado-alimento", area: "ganaderia", category: "Agua y alimentación", title: "Preparar y distribuir alimentación animal", description: "Distribuir la ración definida para cada grupo, revisar comederos y reportar rechazo de alimento o consumo irregular.", estimatedMinutes: 60, priority: "alta", animalHandling: true, safetyNotes: "Usar solo raciones e indicaciones autorizadas. No modificar dosis ni suplementos.", suitableForVolunteers: true },
  { id: "ganado-cercos", area: "ganaderia", category: "Potreros y cercos", title: "Inspeccionar cercos, portones y pasos de ganado", description: "Recorrer el sector asignado, detectar alambres sueltos, postes dañados, portones abiertos y riesgos de escape.", estimatedMinutes: 90, priority: "alta", animalHandling: true, safetyNotes: "No reparar cercos eléctricos energizados. Señalizar el sector antes de intervenir.", suitableForVolunteers: true },
  { id: "ganado-corrales", area: "ganaderia", category: "Corrales", title: "Limpiar y ordenar corrales", description: "Retirar residuos, limpiar zonas de tránsito y mantener accesos, mangas y áreas de manejo despejadas.", estimatedMinutes: 90, priority: "media", animalHandling: true, safetyNotes: "Realizar con el corral despejado o bajo supervisión del responsable de animales.", suitableForVolunteers: true },
  { id: "ganado-registro", area: "ganaderia", category: "Registros", title: "Actualizar registro diario de animales", description: "Registrar observaciones, movimientos, alimentación, alertas de salud y novedades informadas por el encargado.", estimatedMinutes: 30, priority: "media", animalHandling: false, suitableForVolunteers: true },

  { id: "hosp-checkin", area: "hospitalidad", category: "Llegadas", title: "Preparar llegada de huéspedes", description: "Confirmar habitación, accesos, calefacción, iluminación, agua, información de bienvenida y solicitudes registradas.", estimatedMinutes: 45, priority: "alta", suitableForVolunteers: true },
  { id: "hosp-request", area: "hospitalidad", category: "Solicitudes", title: "Atender solicitud de huésped", description: "Revisar la solicitud asignada, coordinar la solución y registrar resultado o escalamiento.", estimatedMinutes: 30, priority: "alta", suitableForVolunteers: false },
  { id: "hosp-common", area: "hospitalidad", category: "Áreas comunes", title: "Revisar áreas comunes para huéspedes", description: "Verificar orden, limpieza, temperatura, iluminación, mobiliario y disponibilidad de insumos en espacios compartidos.", estimatedMinutes: 45, priority: "media", suitableForVolunteers: true },
  { id: "hosp-experience", area: "hospitalidad", category: "Experiencia", title: "Preparar actividad o experiencia para huéspedes", description: "Confirmar lugar, materiales, condiciones climáticas, seguridad, horario y responsable de la actividad.", estimatedMinutes: 60, priority: "media", suitableForVolunteers: true },

  { id: "hk-checkout", area: "housekeeping", category: "Habitaciones", title: "Limpieza completa posterior a salida", description: "Ventilar, retirar ropa usada, limpiar baño y superficies, reponer textiles e insumos y reportar daños u objetos olvidados.", estimatedMinutes: 75, priority: "alta", suitableForVolunteers: false },
  { id: "hk-refresh", area: "housekeeping", category: "Habitaciones", title: "Repaso diario de habitación ocupada", description: "Ordenar, retirar residuos, reponer insumos autorizados y reportar necesidades de mantenimiento sin mover pertenencias personales.", estimatedMinutes: 30, priority: "media", suitableForVolunteers: false },
  { id: "hk-laundry", area: "housekeeping", category: "Lavandería", title: "Clasificar y procesar ropa de cama", description: "Separar textiles, revisar manchas o daños, lavar según tipo, secar, doblar y registrar bajas necesarias.", estimatedMinutes: 90, priority: "media", suitableForVolunteers: true },
  { id: "hk-inventory", area: "housekeeping", category: "Insumos", title: "Revisar stock de housekeeping", description: "Contar ropa de cama, toallas, artículos de aseo y consumibles; informar faltantes o diferencias.", estimatedMinutes: 45, priority: "media", suitableForVolunteers: true },

  { id: "mant-water", area: "mantenimiento", category: "Agua", title: "Inspeccionar sistema de agua del sector", description: "Revisar bombas, estanques, caudal, filtraciones, ruidos anormales y presión visible. Registrar evidencia de fallas.", estimatedMinutes: 60, priority: "alta", safetyNotes: "No intervenir tableros eléctricos ni equipos presurizados sin autorización.", suitableForVolunteers: false },
  { id: "mant-heating", area: "mantenimiento", category: "Calefacción", title: "Revisar calefacción y agua caliente", description: "Comprobar funcionamiento, temperatura, combustible o energía disponible y señales de fuga o combustión anormal.", estimatedMinutes: 45, priority: "alta", safetyNotes: "Suspender uso y escalar ante olor a gas, humo o sobrecalentamiento.", suitableForVolunteers: false },
  { id: "mant-tools", area: "mantenimiento", category: "Herramientas", title: "Ordenar y revisar herramientas", description: "Limpiar, ordenar, comprobar estado y registrar herramientas faltantes, dañadas o inseguras.", estimatedMinutes: 60, priority: "media", suitableForVolunteers: true },
  { id: "mant-waste", area: "mantenimiento", category: "Residuos", title: "Retirar y clasificar residuos operativos", description: "Retirar residuos de puntos asignados, separar reciclables y trasladar materiales al área definida.", estimatedMinutes: 60, priority: "media", safetyNotes: "No manipular químicos, vidrio roto o residuos peligrosos sin equipo y responsable autorizado.", suitableForVolunteers: true },

  { id: "huerto-riego", area: "huerto_vinedo", category: "Riego", title: "Revisar y ejecutar riego programado", description: "Comprobar humedad, líneas de riego, goteros, válvulas y fugas. Aplicar únicamente el programa indicado.", estimatedMinutes: 75, priority: "alta", suitableForVolunteers: true },
  { id: "huerto-maleza", area: "huerto_vinedo", category: "Manejo vegetal", title: "Control manual de malezas", description: "Retirar malezas en el sector asignado evitando daño a cultivos, raíces, tutores y líneas de riego.", estimatedMinutes: 120, priority: "media", suitableForVolunteers: true },
  { id: "huerto-cosecha", area: "huerto_vinedo", category: "Cosecha", title: "Cosechar y clasificar producción", description: "Cosechar según madurez indicada, separar producto dañado y trasladar en contenedores limpios.", estimatedMinutes: 120, priority: "media", suitableForVolunteers: true },
  { id: "vinedo-inspection", area: "huerto_vinedo", category: "Viñedo", title: "Inspeccionar hileras del viñedo", description: "Revisar tutores, alambres, brotes, riego, daño de fauna y signos visibles de enfermedad para informar al responsable.", estimatedMinutes: 90, priority: "media", suitableForVolunteers: true },

  { id: "infra-trails", area: "infraestructura", category: "Senderos", title: "Inspeccionar y despejar senderos", description: "Retirar ramas y obstáculos menores, revisar drenajes, señalética y riesgos de caída. Escalar árboles o daños mayores.", estimatedMinutes: 120, priority: "media", safetyNotes: "No usar motosierra ni intervenir árboles tensionados sin personal calificado.", suitableForVolunteers: true },
  { id: "infra-drainage", area: "infraestructura", category: "Drenajes", title: "Limpiar canaletas y drenajes superficiales", description: "Retirar hojas y sedimentos, verificar flujo y reportar erosión, obstrucciones profundas o daños estructurales.", estimatedMinutes: 90, priority: "alta", suitableForVolunteers: true },
  { id: "infra-signage", area: "infraestructura", category: "Señalética", title: "Revisar señalética y demarcaciones", description: "Comprobar visibilidad, fijaciones, contenido y ubicación de señalética operativa, de seguridad y para huéspedes.", estimatedMinutes: 60, priority: "baja", suitableForVolunteers: true },

  { id: "log-receiving", area: "logistica", category: "Recepción", title: "Recibir y verificar abastecimiento", description: "Comparar productos y cantidades con la orden, revisar estado, registrar diferencias y almacenar según corresponda.", estimatedMinutes: 45, priority: "media", suitableForVolunteers: false },
  { id: "log-inventory", area: "logistica", category: "Inventario", title: "Conteo de inventario del sector", description: "Contar existencias físicas, identificar faltantes, vencimientos o daños y registrar diferencias sin ajustar datos históricos.", estimatedMinutes: 90, priority: "media", suitableForVolunteers: true },
  { id: "log-vehicle", area: "logistica", category: "Vehículos", title: "Revisión visual previa de vehículo", description: "Revisar neumáticos, luces, niveles visibles, daños, limpieza y elementos de seguridad antes de uso.", estimatedMinutes: 20, priority: "alta", safetyNotes: "No conducir ni intervenir mecánica sin autorización y licencia correspondiente.", suitableForVolunteers: false },

  { id: "safe-round", area: "seguridad", category: "Prevención", title: "Ronda preventiva del sector", description: "Revisar accesos, iluminación, obstáculos, extintores visibles, salidas y condiciones inseguras. Registrar y escalar hallazgos.", estimatedMinutes: 45, priority: "alta", suitableForVolunteers: false },
  { id: "safe-weather", area: "seguridad", category: "Clima", title: "Preparar sector ante lluvia o viento fuerte", description: "Asegurar objetos sueltos, despejar drenajes accesibles, revisar cierres y comunicar riesgos operativos.", estimatedMinutes: 60, priority: "alta", safetyNotes: "No trabajar en altura ni cerca de árboles inestables durante viento fuerte.", suitableForVolunteers: true },

  { id: "admin-records", area: "administracion", category: "Registros", title: "Actualizar registros operativos del día", description: "Consolidar tareas, novedades, consumos, incidencias y pendientes informados por los responsables de cada área.", estimatedMinutes: 45, priority: "media", suitableForVolunteers: true },
  { id: "admin-photos", area: "administracion", category: "Evidencia", title: "Ordenar evidencia fotográfica operativa", description: "Clasificar fotografías por fecha, sector y actividad, evitando incluir datos personales innecesarios.", estimatedMinutes: 60, priority: "baja", suitableForVolunteers: true },
]

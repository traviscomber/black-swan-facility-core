# Black Swan i18n terminology policy

Supported product locales are `en`, `es`, and `de`. URL locale is authoritative.

## Product names kept in English

These are product concepts or branded surface names and should remain unchanged unless the product is deliberately renamed:

- Black Swan
- Orchard AI
- Game Plan
- OS

Do not translate these differently page by page. Surrounding verbs, descriptions, helper text, and accessibility copy must still be localized naturally.

## Operational terminology

| Concept | English | Spanish | German |
| --- | --- | --- | --- |
| forecast | forecast / projected | proyectado / proyección | Prognose / prognostiziert |
| import gap | import gap | brecha de importación | Importlücke |
| self-sufficiency | self-sufficiency | autosuficiencia | Selbstversorgung |
| food demand | food demand | demanda alimentaria | Lebensmittelbedarf |
| planned supply | planned supply | producción planificada | geplante Produktion |
| harvested | harvested | cosechado | geerntet |
| booking occupancy | booking occupancy | ocupación de reservas | Buchungsbelegung |
| guest-days | guest-days | días-huésped | Gasttage |
| waste buffer | waste buffer | margen por merma | Verlustpuffer |
| crop | crop | cultivo | Kultur |

## Style rules

- Spanish uses sentence case for headings and actions unless a proper noun requires capitalization.
- German nouns follow normal German capitalization; avoid importing English UI words when a standard German operational term exists.
- Keep units and domain identifiers stable (`kg`, database enum values, API fields, route slugs).
- Localize dates, numbers, percentages, currency, and time through `Intl.*` or an existing formatter helper rather than handcrafted strings.
- Do not persist translated placeholder/default UI copy into domain data. User-authored names remain exactly as entered.
- Missing German copy must remain observable; do not silently fall back to English on `/de`.

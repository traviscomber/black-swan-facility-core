# Vineyard - Guía de Uso: Fotos y Excel

## 📍 Dónde están las características

### 1. **Subir Fotos de Viñas**
- **Ubicación:** `/vineyard/photos` 
- **Acceso:** En la página principal del Vineyard, haz clic en botón **"Fotos"** en la esquina superior derecha
- **Funcionalidades:**
  - ✅ Visualiza todas tus viñas (viñas_vines)
  - ✅ Sube fotos individuales para cada viña
  - ✅ Galería con todas las fotos
  - ✅ Estadísticas de cobertura fotográfica

### 2. **Importar Datos de Excel**
- **Ubicación:** Página principal del Vineyard (`/vineyard`)
- **Acceso:** Desplázate hacia abajo y encontrarás la sección **"Import Data"** con botón **"Choose File to Import"**
- **Funcionalidades:**
  - ✅ Importar datos de viñas desde archivos Excel/CSV
  - ✅ Vista previa de los datos antes de importar
  - ✅ Validación automática de formatos

## 📊 Estructura de Datos Disponible

### Tablas para Importar:
1. **vineyard_plots** - Parcelas del viñedo
   - name, location, area_hectares, vine_variety, planted_year, etc.

2. **vineyard_vines** - Viñas individuales
   - vine_number, plot_id, health_status, estimated_production, photo_url

3. **vineyard_harvest_records** - Registros de cosecha
   - plot_id, harvest_date, quantity_harvested, quality_rating

4. **vineyard_care_logs** - Registros de cuidados
   - plot_id, care_type, date, description, materials_used

5. **vineyard_pests** - Registro de plagas
   - plot_id, pest_name, severity, treatment_date, effectiveness

### Archivos Excel Soportados:
- `.xlsx` (Excel moderno)
- `.csv` (Valores separados por comas)
- Primera fila como encabezados

## 🚀 Flujo de Trabajo Recomendado

### Para Fotos:
1. Dirígete a `/vineyard/photos`
2. Haz clic en **"Subir Fotos"**
3. Selecciona una viña
4. Sube la imagen
5. ¡Listo! La foto aparecerá en la galería

### Para Excel:
1. Prepara tu archivo Excel con los datos
2. Ve a la página principal del Vineyard
3. Desplázate a la sección **"Import Data"**
4. Haz clic en **"Choose File to Import"**
5. Selecciona tu archivo
6. Revisa la vista previa
7. Confirma la importación

## 📁 Almacenamiento

- **Fotos:** Se guardan en Supabase Storage
- **Datos:** Se guardan en tablas de Supabase
- **Acceso:** Solo usuario autenticado (privado)

## ✨ Características Técnicas

- Upload a Supabase Storage (limite 50MB por archivo)
- Validación de tipos de archivo
- Procesamiento de Excel con librería `xlsx`
- Galería responsive con vista previa
- Estadísticas en tiempo real

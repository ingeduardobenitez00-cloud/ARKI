
# Scripts de Servidor - Sincronización Estratégica

Esta carpeta contiene la herramienta para actualizar el padrón nacional manteniendo la integridad de tus datos cargados manualmente (Teléfonos, GPS, Votos Seguros) y eliminando automáticamente los registros que ya no figuran en el padrón oficial.

## `import.js` (Sincronización Total con Purga)

Este script realiza una **Sincronización con Purga de Diferencia**. Esto significa que:
1. **Actualiza:** Modifica locales, mesas y órdenes del padrón oficial.
2. **Protege:** NO borra los teléfonos ni las ubicaciones GPS que ya cargaste. Si la celda del Excel está vacía, el sistema mantiene el dato que ya existe en la base de datos.
3. **Limpia:** Elimina automáticamente de la base de datos cualquier registro que NO figure en tu nuevo archivo Excel (la diferencia).

### Estructura Requerida del Excel (`padron.xlsx`)

**IMPORTANTE:** 
- **Nombre del Archivo:** Debe llamarse exactamente `padron.xlsx`.
- **Hoja (Pestaña):** El script toma automáticamente la **PRIMERA HOJA** del libro, sin importar su nombre.
- **Columnas:** El orden NO importa. El sistema identifica los datos por el nombre del encabezado (primera fila):

| Encabezado (Nombre de Columna) | Descripción |
| :--- | :--- |
| **CEDULA** | Obligatorio. Número de Cédula sin puntos ni comas. |
| **NOMBRE** | Nombre(s) del elector. |
| **APELLIDO** | Apellido(s) del elector. |
| **CODIGO_SEC** | Número de Seccional (ej: 34). |
| **LOCAL** | Nombre del Local de Votación. |
| **MESA** | Número de Mesa. |
| **ORDEN** | Número de Orden. |
| **DEPARTAMENTO** | Nombre del Departamento (ej: CAPITAL). |
| **DIRECCION** | (Opcional) Domicilio. |
| **FECHA_NACI** | (Opcional) Fecha de Nacimiento. |

---

### Procedimiento de Actualización Paso a Paso

1. **Preparar el Archivo:** 
   - Asegúrate de que los encabezados coincidan con la tabla de arriba.
   - Guarda el archivo como `padron.xlsx`.
2. **Ubicación (Sustitución):** 
   - Borra cualquier archivo `padron.xlsx` viejo en la carpeta `scripts/`.
   - Copia tu nuevo archivo `padron.xlsx` dentro de la carpeta `scripts/`.
3. **Verificar Credenciales:** 
   - Asegúrate de que el archivo `serviceAccountKey.json` esté presente en la carpeta `scripts/`.
4. **Ejecutar el Script:**
   - Abre una terminal en el directorio raíz del proyecto y ejecuta el siguiente comando:
   ```bash
   node scripts/import.js
   ```
5. **Finalización:** El script te mostrará un resumen final con el total de registros actualizados y eliminados.

### Paso Final Obligatorio (En la App)
Después de que el script termine con éxito, entra a la App con tu usuario administrador:
1. Ve al módulo de **Configuración**.
2. Presiona el botón **"SINCRONIZAR PADRÓN NACIONAL"**. 
Esto reconstruirá los selectores de locales y mesas para que todo el equipo vea los datos actualizados al instante.

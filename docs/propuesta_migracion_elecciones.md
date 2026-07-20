# Propuesta de Migración y Sistema Multi-Elección

**Fecha de la propuesta:** Julio 2026
**Objetivo:** Adaptar el sistema actual para archivar los datos de las elecciones "Internas ANR", preparar la base de datos desde cero para las "Elecciones Generales Municipales", y procesar la migración de un nuevo padrón de 450,000 electores desde un archivo `.dbf`.

---

## 1. Archivo del Historial (Internas ANR)
Actualmente, el sistema tiene colecciones operativas activas con la información de las elecciones anteriores. El primer paso de la migración consiste en hacer una copia de seguridad segura de esta información.
- **Acción:** Ejecutar un script de migración que lea todos los documentos de las colecciones actuales como `votos_seguros`, `dia_d` y otras métricas de la elección.
- **Destino:** Copiar estos documentos a nuevas colecciones de archivo, añadiendo un sufijo identificativo. Por ejemplo: `votosSeguros_InternasANR_2026` y `diaD_InternasANR_2026`.

## 2. Limpieza y Preparación para Nuevas Elecciones
Una vez confirmada la integridad del respaldo, es necesario resetear las tablas operativas para que los operadores y coordinadores comiencen con el sistema en cero para las Elecciones Generales Municipales.
- **Acción:** El script vaciará (eliminará los documentos de) las colecciones principales operativas (`votos_seguros`, `dia_d`, etc.).
- **Resultado:** Los contadores del dashboard y los reportes volverán a 0, listos para la nueva carga.

## 3. Desarrollo de Vista Histórica en el Panel de Administración
Para no perder la capacidad de consulta de las elecciones pasadas, se habilitará un módulo exclusivo para administradores.
- **Acción:** Crear un nuevo apartado en el menú lateral del administrador llamado **"Historial de Elecciones"** o agregar un filtro en los reportes actuales.
- **Funcionalidad:** Un botón o selector donde el administrador elija "Internas ANR". Al seleccionarlo, la interfaz de reportes se conectará directamente a las colecciones archivadas (`votosSeguros_InternasANR_2026`, etc.).
- **Seguridad:** Esta vista será estrictamente de "solo lectura", previniendo cualquier modificación accidental a los registros históricos.

## 4. Migración del Nuevo Padrón (DBF)
El archivo `.dbf` contiene el nuevo padrón con 450,000 registros, superando los 266,409 actuales.
- **Acción:** Se desarrollará un script en Node.js utilizando la librería `node-dbf` para procesar el archivo localmente.
- **Lógica de Comparación:** 
  1. Si la cédula ya existe en la base de datos de Firebase, se compara el local de votación. Si cambió, se actualiza en Firebase y se guarda en un registro de auditoría (`cambios_padron`).
  2. Si la cédula no existe, se inserta como un elector nuevo.
- **Costos:** Como la ejecución es local y las actualizaciones van a Firebase/Firestore, el único costo asociado será el consumo de lectura/escritura en Google Cloud Platform. Por este volumen de operaciones, el costo se estima mínimo (probablemente menos de $5 USD, o nulo si hay cuota de capa gratuita disponible).

---

## Próximos Pasos (Para implementar en un mes)
1. Colocar el archivo `.dbf` del nuevo padrón en la carpeta del proyecto.
2. Identificar los nombres exactos de las columnas en el archivo `.dbf` (cédula, local de votación, etc.).
3. Confirmar los nombres de las colecciones actuales en Firebase.
4. Avisarme cuando estés listo para comenzar y generaremos y ejecutaremos el script paso a paso.

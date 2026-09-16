
import { 
    Users, 
    LayoutGrid, 
    FileSearch, 
    BookHeart, 
    Settings, 
    BookCheck, 
    ClipboardCheck, 
    Archive, 
    Wifi, 
    Phone, 
    MessageSquare, 
    Map as LucideMapIcon, 
    ShieldCheck, 
    Database, 
    Share2, 
    ClipboardList, 
    UserCircle, 
    Film, 
    LayoutDashboard, 
    HelpCircle,
    FileDown,
    Cpu,
    UserPlus,
    History,
    AppWindow,
    MapIcon,
    QrCode,
    BarChart3,
    Image as ImageIcon,
    FileSpreadsheet,
    PhoneCall,
    Briefcase,
    LayoutList,
    FileText,
    Printer
} from 'lucide-react';

export const allMenuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, tooltip: 'PANEL DE CONTROL PRINCIPAL Y VISTA GENERAL.' },
  { href: '/mapa-tecnico', label: 'Mapa Técnico', icon: MapIcon, tooltip: 'GESTIÓN TERRITORIAL TÉCNICA Y POLÍTICA POR DISTRITOS.' },
  { href: '/padron', label: 'Consulta Padrón', icon: LayoutGrid, tooltip: 'EXPLORA Y BUSCA EN EL PADRÓN ELECTORAL COMPLETO.' },
  { href: '/padron-export', label: 'Padrón Exportar', icon: FileDown, tooltip: 'GENERA REPORTES EN EXCEL Y PDF POR SECCIONAL.' },
  { href: '/resumen-seccional', label: 'Resumen Seccional', icon: LayoutList, tooltip: 'VISTA RESUMIDA DE LOCALES POR SECCIONAL CON EXPORTACIÓN DIRECTA.' },
  { href: '/comparar-padron', label: 'Comparar Padrón', icon: FileSpreadsheet, tooltip: 'COMPARA UN EXCEL CON EL PADRÓN Y DESCARGA EL RESULTADO.' },
  { href: '/consulta', label: 'Registra Votos', icon: FileSearch, tooltip: 'BUSCA ELECTORES Y MARCA SU VOTO COMO SEGURO.' },
  { href: '/telefonos', label: 'Actualizar Teléfonos', icon: Phone, tooltip: 'AGREGA O ACTUALIZA LOS NÚMEROS DE TELÉFONO DE LOS EMPADRONADOS.' },
  { href: '/seguimiento-llamadas', label: 'Call Center', icon: PhoneCall, tooltip: 'ESCANEA EL PADRÓN Y REGISTRA EL SEGUIMIENTO DE LLAMADAS.' },
  { href: '/migrar-celulares', label: 'Migrar Celulares', icon: FileSpreadsheet, tooltip: 'MIGRA NÚMEROS DE CELULARES DESDE EXCEL AL PADRÓN NACIONAL Y COMPENDIO.' },
  { href: '/migrar-votos', label: 'Migrar Votos Seguros', icon: FileSpreadsheet, tooltip: 'MIGRA VOTOS SEGUROS DESDE EXCEL DE FORMA MASIVA ASOCIANDO OPERADORES.' },
  { href: '/biblioteca', label: 'Biblioteca Multimedia', icon: Film, tooltip: 'GESTIONA LA BIBLIOTECA DE IMÁGENES Y VIDEOS DEL SISTEMA.' },
  { href: '/difusion', label: 'Difusión WhatsApp', icon: MessageSquare, tooltip: 'ENVÍA INVITACIONES, VIDEOS Y FLYERS PERSONALIZADOS POR WHATSAPP.' },
  { href: '/difusion-masiva', label: 'Co-Piloto Masivo', icon: Share2, tooltip: 'ENVÍA CAMPAÑAS EN AUTOMÁTICO REUTILIZANDO PESTAÑAS (ANTI-BAN).' },
  { href: '/whatsapp-excel', label: 'Difusión Excel', icon: FileSpreadsheet, tooltip: 'ENVÍA MENSAJES MASIVOS DIRECTAMENTE DESDE UN ARCHIVO EXCEL.' },
  { href: '/inscripciones-eventos', label: 'Inscripciones Públicas', icon: UserPlus, tooltip: 'GESTIONA LAS PERSONAS QUE SE INSCRIBIERON DESDE EL LINK PÚBLICO.' },
  { href: '/inscripciones-archivadas', label: 'Historial Inscripciones', icon: History, tooltip: 'CONSULTA LAS LISTAS DE INSCRIPCIONES PÚBLICAS ARCHIVADAS.' },
  { href: '/ajustes-inscripcion', label: 'Ajustes Portal Público', icon: AppWindow, tooltip: 'CONFIGURA EL NOMBRE, FLYER Y ESTADO DEL PORTAL DE INSCRIPCIÓN.' },
  { href: '/reuniones', label: 'Reuniones', icon: Users, tooltip: 'GESTIONA LA LISTA DE PARTICIPANTES PARA LA REUNIÓN ACTUAL.' },
  { href: '/reuniones-archivadas', label: 'Reuniones Archivadas', icon: Archive, tooltip: 'CONSULTA EL HISTORIAL DE REUNIONES PASADAS.' },
  { href: '/control-votacion', label: 'Control Votación', icon: ClipboardCheck, tooltip: 'CONTROLA EL ESTADO DE VOTACIÓN POR MESA.' },
  { href: '/escaner-actas', label: 'Escaner de Actas', icon: QrCode, tooltip: 'ESCANEO DE ACTAS TREP Y CARGA DE RESULTADOS.' },
  { href: '/resultados-electorales', label: 'Resultados en Vivo', icon: BarChart3, tooltip: 'VISUALIZA LOS RESULTADOS ELECTORALES EN TIEMPO REAL.' },
  { href: '/resultados-distritos', label: 'Resultados Distritos', icon: BarChart3, tooltip: 'EXPLORA LOS RESULTADOS DE TODOS LOS DISTRITOS.' },
  { href: '/resultados-por-local', label: 'Resultados por Local', icon: MapIcon, tooltip: 'VISUALIZA LOS RESULTADOS OFICIALES POR LOCAL DE VOTACIÓN.' },
  { href: '/reporte-mesas', label: 'Reporte de Actas', icon: FileSpreadsheet, tooltip: 'TABLA DE RESULTADOS OFICIALES POR MESA CON EXPORTACIÓN A PDF.' },
  { href: '/simulador', label: 'Simulador Máquina', icon: AppWindow, tooltip: 'SIMULADOR OFICIAL DE LA MÁQUINA DE VOTACIÓN TSJE.' },
  { href: '/configuracion-electoral', label: 'Metadata Electoral', icon: ImageIcon, tooltip: 'GESTIONA FOTOS Y NOMBRES DE CANDIDATOS.' },
  { href: '/voto-seguro', label: 'Lista Voto Seguro', icon: BookHeart, tooltip: 'VISUALIZA LA LISTA DE VOTOS SEGUROS (PERSONAL O DE TU SECC).' },
  { href: '/audiencia', label: 'Audiencia/Pedidos', icon: Briefcase, tooltip: 'REGISTRA Y GESTIONA LOS PEDIDOS DE LOS ELECTORES O DIRIGENTES.' },
  { href: '/mapa-global', label: 'Mapa Territorial', icon: LucideMapIcon, tooltip: 'VISUALIZA EN EL MAPA A LOS ELECTORES (PERSONAL O DE TU SECC).' },
  { href: '/imprimir-listado-dirigente', label: 'Imprimir Dirigente', icon: Printer, tooltip: 'IMPRIME EL LISTADO DE VOTOS DE UN DIRIGENTE POR LOCAL.' },
  { href: '/reportes', label: 'Reportes', icon: BookCheck, tooltip: 'GENERA REPORTES DE VOTOS SEGUROS POR SECCIONAL.' },
  { href: '/auditoria', label: 'Auditoría', icon: ShieldCheck, tooltip: 'MONITOREA LAS ACCIONES REALIZADAS POR LOS USUARIOS EN EL SISTEMA.' },
  { href: '/conexiones', label: 'Conexiones', icon: Wifi, tooltip: 'MONITOREA LOS USUARIOS CONECTADOS AL SISTEMA.' },
  { href: '/users', label: 'Usuarios', icon: Users, tooltip: 'GESTIONA LOS USUARIOS Y SUS PERMISOS.' },
  { href: '/control-operadores', label: 'Rendimiento Operadores', icon: BarChart3, tooltip: 'MIDE Y CONTROLA EL RENDIMIENTO DE VOTOS SEGUROS DE CADA OPERADOR.' },
  { href: '/configuracion', label: 'Configuración', icon: Settings, tooltip: 'CONFIGURA PARÁMETROS TÉCNICOS E IDENTIDAD PWA.' },
  { href: '/perfil', label: 'Mi Perfil', icon: UserCircle, tooltip: 'GESTIONA TU INFORMACIÓN PERSONAL Y CAMBIA TU CONTRASEÑA.' },
  { href: '/laboratorio-qr', label: 'Laboratorio QR', icon: Cpu, tooltip: 'INGENIERÍA INVERSA Y VALIDACIÓN DE ACTAS.' },
  { href: '/verificador-actas', label: 'Verificador de Actas', icon: ShieldCheck, tooltip: 'AUDITORÍA VISUAL DE FOTOS VS RESULTADOS CARGADOS.' },
  { href: '/admin/config-setup', label: 'Setup Config', icon: Database, tooltip: 'CONFIGURACIÓN DE MOLDES ELECTORALES.' },
];

export const menuCategories = [
  {
    label: 'Principal',
    icon: LayoutDashboard,
    items: ['/'],
    href: '/'
  },
  {
    label: 'Inteligencia Electoral',
    icon: MapIcon,
    items: ['/mapa-tecnico', '/mapa-global']
  },
  {
    label: 'Padrón Electoral',
    icon: Database,
    items: ['/padron', '/padron-export', '/resumen-seccional', '/comparar-padron']
  },
  {
    label: 'Carga de Votos Seguros',
    icon: Database,
    items: ['/consulta', '/voto-seguro', '/imprimir-listado-dirigente', '/migrar-votos', '/audiencia']
  },
  {
    label: 'Comunicación',
    icon: Share2,
    items: ['/telefonos', '/seguimiento-llamadas', '/migrar-celulares', '/biblioteca', '/difusion', '/difusion-masiva', '/whatsapp-excel']
  },
  {
    label: 'Operación Día D',
    icon: ClipboardCheck,
    items: ['/control-votacion', '/escaner-actas', '/resultados-electorales', '/resultados-distritos', '/resultados-por-local', '/reporte-mesas', '/simulador', '/configuracion-electoral', '/verificador-actas', '/reportes']
  },
  {
    label: 'Asistencia y Eventos',
    icon: ClipboardList,
    items: ['/inscripciones-eventos', '/inscripciones-archivadas', '/ajustes-inscripcion', '/reuniones', '/reuniones-archivadas']
  },
  {
    label: 'Panel Maestro',
    icon: ShieldCheck,
    items: ['/auditoria', '/conexiones', '/users', '/control-operadores', '/configuracion']
  }
];

export const userRoles: { [key: string]: { permissions: string[] } } = {
  'Super-Admin': {
    permissions: allMenuItems.map(item => item.href)
  },
  'Admin': {
    permissions: allMenuItems.map(item => item.href)
  },
  'Presidente': {
    permissions: allMenuItems.map(item => item.href)
  },
  'Coordinador': {
    permissions: ['/', '/mapa-tecnico', '/padron', '/padron-export', '/resumen-seccional', '/comparar-padron', '/consulta', '/telefonos', '/seguimiento-llamadas', '/biblioteca', '/difusion', '/difusion-masiva', '/whatsapp-excel', '/inscripciones-eventos', '/inscripciones-archivadas', '/ajustes-inscripcion', '/voto-seguro', '/imprimir-listado-dirigente', '/audiencia', '/mapa-global', '/reportes', '/reuniones', '/reuniones-archivadas', '/control-votacion', '/perfil', '/migrar-votos', '/simulador', '/reporte-mesas', '/resultados-distritos']
  },
  'Dirigente': {
    permissions: ['/', '/mapa-tecnico', '/padron', '/resumen-seccional', '/comparar-padron', '/consulta', '/telefonos', '/seguimiento-llamadas', '/biblioteca', '/difusion', '/difusion-masiva', '/whatsapp-excel', '/voto-seguro', '/imprimir-listado-dirigente', '/audiencia', '/mapa-global', '/reportes', '/perfil', '/migrar-votos', '/simulador']
  },
  'Mesario': {
    permissions: ['/', '/control-votacion', '/escaner-actas', '/perfil', '/simulador']
  },
  'Recepcionista': {
    permissions: ['/', '/inscripciones-eventos', '/inscripciones-archivadas', '/ajustes-inscripcion', '/reuniones', '/reuniones-archivadas', '/perfil']
  },
  'Comunicaciones': {
    permissions: ['/', '/telefonos', '/seguimiento-llamadas', '/biblioteca', '/difusion', '/difusion-masiva', '/whatsapp-excel', '/migrar-celulares', '/perfil']
  },
  'Vista': {
    permissions: ['/', '/padron', '/resultados-electorales', '/resultados-distritos', '/resultados-por-local', '/reporte-mesas', '/perfil', '/simulador']
  }
};

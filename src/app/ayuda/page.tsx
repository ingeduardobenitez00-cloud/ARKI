"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
    HelpCircle,
    FileDown,
    Loader2,
    Server,
    Cpu,
    ShieldCheck,
    Search,
    MapPin,
    Smartphone,
    MessageSquare,
    ClipboardCheck,
    Ticket,
    LocateFixed,
    Users,
    ClipboardList,
    UserCheck,
    Lock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

export default function AyudaPage() {
    const [isExporting, setIsExporting] = useState(false);
    const { toast } = useToast();

    const handleExportPDF = async () => {
        setIsExporting(true);
        toast({ title: "Generando Manual...", description: "Preparando documento técnico por roles." });

        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            let yPos = 20;

            doc.setFontSize(18);
            doc.setTextColor(239, 68, 68);
            doc.setFont("helvetica", "bold");
            doc.text("LISTA 2P - OPCIÓN 2", pageWidth / 2, yPos, { align: 'center' });
            yPos += 8;

            doc.setFontSize(10);
            doc.setTextColor(80);
            doc.setFont("helvetica", "normal");
            doc.text("CAMILO PÉREZ INTENDENTE - EL ARKI SOTOMAYOR CONCEJAL", pageWidth / 2, yPos, { align: 'center' });
            yPos += 12;

            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text("MANUAL DE OPERACIONES POR ROLES", pageWidth / 2, yPos, { align: 'center' });
            yPos += 15;

            const sections = [
                {
                    title: "1. ADMINISTRADOR / SUPER-ADMIN",
                    content: [
                        "- Control Total: Acceso a todos los módulos del sistema.",
                        "- Gestión de Usuarios: Creación, edición y eliminación de cuentas. Asignación de permisos granulares.",
                        "- Configuración Maestra: Sincronización del padrón ANR y optimización de metadatos (Locales y Mesas).",
                        "- Auditoría: Monitoreo global de cada acción realizada por cualquier usuario para garantizar transparencia."
                    ]
                },
                {
                    title: "2. COORDINADOR DE SECCIONAL",
                    content: [
                        "- Supervisión Territorial: Visión total de la Seccional asignada.",
                        "- Control de Dirigentes: Monitoreo de los votos seguros registrados por todos los dirigentes de su zona.",
                        "- Reportes: Exportación masiva de datos en Excel y PDF para su área específica.",
                        "- Mapa Territorial: Visualización geográfica de la fuerza electoral en su seccional."
                    ]
                },
                {
                    title: "3. DIRIGENTE (OPERADOR DE CAMPO)",
                    content: [
                        "- Captura de Votos: Registro de teléfonos, instituciones y ubicación GPS de electores.",
                        "- Comunicación Directa: Envío de Flyers personalizados y videos de campaña vía WhatsApp.",
                        "- Lista Personal: Gestión de su propio listado de 'Voto Seguro' para seguimiento.",
                        "- Geolocalización: Marcación exacta de hogares visitados para logística de transporte el Día D."
                    ]
                },
                {
                    title: "4. MESARIO (OPERACIÓN DÍA D)",
                    content: [
                        "- Control de Participación: Marcación en tiempo real de electores que han votado mediante número de orden.",
                        "- Gestión por Mesa: Acceso exclusivo a las mesas asignadas para evitar errores de carga.",
                        "- Sincronización: Los datos cargados actualizan automáticamente los mapas de calor de los coordinadores."
                    ]
                },
                {
                    title: "5. RECEPCIONISTA (ASISTENCIA)",
                    content: [
                        "- Gestión de Eventos: Registro rápido de participantes en reuniones mediante número de cédula.",
                        "- Historial: Consulta de personas presentes en reuniones anteriores.",
                        "- Captura de Contactos: Actualización de teléfonos de personas que asisten a los eventos."
                    ]
                }
            ];

            sections.forEach(section => {
                if (yPos > 250) { doc.addPage(); yPos = 20; }
                doc.setFontSize(12);
                doc.setTextColor(239, 68, 68);
                doc.setFont("helvetica", "bold");
                doc.text(section.title, 20, yPos);
                yPos += 7;
                
                doc.setFontSize(9);
                doc.setTextColor(0);
                doc.setFont("helvetica", "normal");
                section.content.forEach(line => {
                    const splitText = doc.splitTextToSize(line, pageWidth - 40);
                    doc.text(splitText, 25, yPos);
                    yPos += (splitText.length * 5);
                });
                yPos += 5;
            });

            doc.save('Manual_Operativo_Lista_2P.pdf');
            toast({ title: "¡Descarga Exitosa!", description: "El manual se ha generado correctamente." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo generar el documento PDF.", variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-medium uppercase tracking-tight flex items-center gap-3">
                        <HelpCircle className="h-9 w-9 text-primary" />
                        Guía de Usuario
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-sm">SISTEMA GESTIÓN ELECTORAL LISTA 2P - OPCIÓN 2</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Button 
                        onClick={handleExportPDF} 
                        disabled={isExporting}
                        className="bg-primary hover:bg-primary/90 font-medium uppercase shadow-lg h-11 px-6 text-xs"
                    >
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        DESCARGAR MANUAL PDF
                    </Button>
                    <Badge className="py-1.5 px-3 text-[10px] font-medium uppercase bg-primary/10 text-primary border-primary/20">Versión 5.0 - ESTABLE</Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-primary/10 bg-primary/5 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase flex items-center gap-2">
                            <Server className="h-3.5 w-3.5 text-primary" /> Consulta Global
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[10px] font-medium uppercase leading-relaxed opacity-70">
                            Búsqueda en toda la ANR sin límites de registros.
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-blue-600/10 bg-blue-600/5 md:col-span-2 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase flex items-center gap-2 text-blue-600">
                            <ShieldCheck className="h-3.5 w-3.5" /> Inteligencia Territorial
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[10px] font-medium uppercase leading-relaxed text-blue-900/70">
                            Mapeo en tiempo real de electores ubicados y control de participación por número de orden.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="roles" className="border rounded-2xl px-6 bg-white shadow-sm border-primary/10">
                    <AccordionTrigger className="hover:no-underline py-5">
                        <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                <Users className="h-5 w-5 text-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium uppercase">Uso del Sistema por Roles</h3>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase">Instrucciones según tu cargo asignado.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 border rounded-xl bg-primary/5">
                                <h4 className="font-medium text-[11px] uppercase mb-2 flex items-center gap-2"><Lock className="h-3 w-3" /> Administrador</h4>
                                <p className="text-[10px] font-medium uppercase opacity-70">Gestiona usuarios, sincroniza el padrón y monitorea la auditoría global.</p>
                            </div>
                            <div className="p-4 border rounded-xl bg-blue-50">
                                <h4 className="font-medium text-[11px] uppercase mb-2 flex items-center gap-2"><UserCheck className="h-3 w-3" /> Coordinador</h4>
                                <p className="text-[10px] font-medium uppercase opacity-70">Supervisa todos los registros de su seccional y genera reportes masivos.</p>
                            </div>
                            <div className="p-4 border rounded-xl bg-muted/30">
                                <h4 className="font-medium text-[11px] uppercase mb-2 flex items-center gap-2"><Smartphone className="h-3 w-3" /> Dirigente</h4>
                                <p className="text-[10px] font-medium uppercase opacity-70">Carga votos seguros, captura GPS y envía multimedia por WhatsApp.</p>
                            </div>
                            <div className="p-4 border rounded-xl bg-muted/30">
                                <h4 className="font-medium text-[11px] uppercase mb-2 flex items-center gap-2"><ClipboardCheck className="h-3 w-3" /> Mesario</h4>
                                <p className="text-[10px] font-medium uppercase opacity-70">Marca los votos efectuados por número de orden el día de la elección.</p>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="padron" className="border rounded-2xl px-6 bg-white shadow-sm border-primary/10">
                    <AccordionTrigger className="hover:no-underline py-5">
                        <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Search className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium uppercase">Gestión del Padrón</h3>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase">Búsqueda global y exportación masiva.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 space-y-4">
                        <div className="p-4 border rounded-xl bg-muted/30">
                            <p className="text-[10px] font-medium uppercase leading-relaxed">
                                El buscador permite localizar a cualquier elector de la ANR. Los administradores pueden exportar el padrón completo de una seccional a Excel o PDF horizontal con las 10 columnas autorizadas.
                            </p>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="territorio" className="border rounded-2xl px-6 bg-white shadow-sm border-primary/10">
                    <AccordionTrigger className="hover:no-underline py-5">
                        <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium uppercase">Captura Territorial</h3>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase">Votos Seguros, GPS y Flyers Digitales.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Card className="border-dashed">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-[10px] font-medium uppercase flex items-center gap-2">
                                        <Smartphone className="h-3 w-3"/> 1. Contacto
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-3 pb-3 text-[9px] font-medium uppercase">
                                    Cargue teléfono e institución para centralizar la comunicación.
                                </CardContent>
                            </Card>
                            <Card className="border-dashed">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-[10px] font-medium uppercase flex items-center gap-2">
                                        <LocateFixed className="h-3 w-3"/> 2. GPS
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-3 pb-3 text-[9px] font-medium uppercase">
                                    Capture la ubicación exacta con el botón de GPS o manual en el mapa.
                                </CardContent>
                            </Card>
                            <Card className="border-dashed">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-[10px] font-medium uppercase flex items-center gap-2">
                                        <Ticket className="h-3 w-3"/> 3. Flyer
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-3 pb-3 text-[9px] font-medium uppercase">
                                    Genere la imagen de invitación para enviar por WhatsApp.
                                </CardContent>
                            </Card>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="text-center pt-10 opacity-40">
                <p className="text-[9px] font-medium uppercase tracking-[0.3em]">SISTEMA GESTIÓN ELECTORAL - LISTA 2P OPCIÓN 2</p>
            </div>
        </div>
    );
}


"use client";

import { useState, useMemo } from 'react';
import { collection, query, orderBy, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Archive, Calendar, Smartphone, Loader2, Trash2, History, SmartphoneIcon, Filter, FileDown, FileText, ChevronDown, Zap, CheckSquare, Square, CheckCircle2, FileSpreadsheet, Lock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ArchivedInscripcion {
    id: string;
    archiveName: string;
    archivedAt: any;
    archivedBy: string;
    totalParticipants: number;
    participants: any[];
}

const EXPORTABLE_COLUMNS = [
    { id: 'createdAt', label: 'FECHA REGISTRO' },
    { id: 'eventName', label: 'EVENTO' },
    { id: 'cedula', label: 'CEDULA' },
    { id: 'nombre', label: 'NOMBRE' },
    { id: 'apellido', label: 'APELLIDO' },
    { id: 'telefono', label: 'TELEFONO' },
    { id: 'seccional', label: 'SECCIONAL' },
    { id: 'local', label: 'LOCAL' },
    { id: 'mesa', label: 'MESA' },
    { id: 'orden', label: 'ORDEN' },
];

export default function InscripcionesArchivadasPage() {
    const db = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
    const [isExporting, setIsExporting] = useState<Record<string, boolean>>({});
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [archiveToDelete, setArchiveToDelete] = useState<ArchivedInscripcion | null>(null);
    const [seccionalFilters, setSeccionalFilters] = useState<Record<string, string>>({});
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedColumns, setSelectedColumns] = useState<string[]>(EXPORTABLE_COLUMNS.map(c => c.id));
    const [activeArchiveForExport, setActiveArchiveForExport] = useState<ArchivedInscripcion | null>(null);
    const [activeDataForExport, setActiveDataForExport] = useState<any[]>([]);
    const [customFilename, setCustomFilename] = useState('');

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
    const canExportPDF = isAdmin || user?.moduleActions?.['/inscripciones-eventos']?.includes('pdf');
    const canExportExcel = isAdmin || user?.moduleActions?.['/inscripciones-eventos']?.includes('excel');

    const archivesQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'archived_inscripciones_eventos'), orderBy('archivedAt', 'desc'));
    }, [db]);

    const { data: archives, isLoading } = useCollection<ArchivedInscripcion>(archivesQuery);

    const formatTimestamp = (ts: any) => {
        if (!ts) return '---';
        try {
            const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
            return format(date, "d MMM, yyyy", { locale: es });
        } catch (e) { return '---'; }
    };

    const handleSyncPhones = async (archive: ArchivedInscripcion) => {
        if (!db) return;
        setIsSyncing(prev => ({ ...prev, [archive.id]: true }));
        try {
            const batch = writeBatch(db);
            archive.participants.forEach(p => { if (p.telefono && p.cedula) batch.update(doc(db, 'sheet1', String(p.cedula)), { TELEFONO: p.telefono }); });
            await batch.commit(); toast({ title: '¡Sincronizado!' });
        } finally { setIsSyncing(prev => ({ ...prev, [archive.id]: false })); }
    };

    const executeExportCSV = async (filename: string) => {
        if (!canExportExcel) {
            toast({ title: "Acceso Denegado", variant: "destructive" });
            return;
        }
        if (!activeDataForExport.length) return;
        const currentId = activeArchiveForExport?.id || 'export';
        setIsExporting(prev => ({ ...prev, [currentId]: true }));
        try {
            const cols = EXPORTABLE_COLUMNS.filter(c => selectedColumns.includes(c.id));
            const headers = cols.map(c => c.label).join(';');
            let csvContent = "\uFEFF" + headers + "\n";
            activeDataForExport.forEach(p => {
                const row = cols.map(c => {
                    let val = c.id === 'createdAt' ? formatTimestamp(p.createdAt) : p[c.id];
                    return `"${String(val || '').replace(/;/g, ' ').toUpperCase()}"`;
                });
                csvContent += row.join(';') + "\n";
            });
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.body.appendChild(document.createElement('a'));
            link.href = URL.createObjectURL(blob);
            link.download = (filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'HISTORIAL') + '.csv';
            link.click();
            document.body.removeChild(link);
            toast({ title: "Excel generado" });
            setIsExportDialogOpen(false);
        } finally { setIsExporting(prev => ({ ...prev, [currentId]: false })); }
    };

    const handleExportPDF = (archive: ArchivedInscripcion, data: any[]) => {
        if (!canExportPDF) {
            toast({ title: "Acceso Denegado", variant: "destructive" });
            return;
        }
        if (!data.length) return;
        setIsExporting(prev => ({ ...prev, [archive.id]: true }));
        try {
            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(18); doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold"); doc.text("LISTA 2P - OPCIÓN 2", pageWidth / 2, 20, { align: 'center' });
            const tableColumn = ["CÉDULA", "ELECTOR", "TELÉFONO", "SECC", "LOCAL"];
            const tableRows = data.map(p => [p.cedula, `${p.nombre} ${p.apellido}`.toUpperCase(), p.telefono, p.seccional, p.local]);
            (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 35, headStyles: { fillColor: [239, 68, 68] } });
            doc.save(`LISTA_HISTORICA_${archive.archiveName}.pdf`);
        } finally { setIsExporting(prev => ({ ...prev, [archive.id]: false })); }
    };
    
    const handleDeleteArchive = async () => {
        if (!archiveToDelete || !db) return;
        deleteDoc(doc(db, 'archived_inscripciones_eventos', archiveToDelete.id)).then(() => { toast({ title: 'Eliminado' }); setIsAlertOpen(false); });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><History className="h-8 w-8 text-primary" /> Historial de Inscripciones</h1><p className="text-muted-foreground font-medium uppercase text-[10px] mt-1">Recuperación de contactos de eventos pasados.</p></div>
            </div>

            <Card className="border-primary/10 shadow-sm overflow-hidden bg-white rounded-3xl">
                <CardHeader className="bg-muted/30 border-b py-5"><CardTitle className="font-black uppercase text-sm flex items-center gap-2"><Archive className="h-4 w-4 text-primary" /> Archivos Guardados</CardTitle></CardHeader>
                <CardContent className="pt-6 px-6 pb-10">
                    {isLoading ? <Skeleton className="h-16 w-full rounded-2xl" /> : archives?.length ? (
                        <Accordion type="multiple" className="w-full space-y-3">
                            {archives.map(archive => {
                                const currentFilter = seccionalFilters[archive.id] || 'ALL';
                                const filtered = archive.participants.filter(p => currentFilter === 'ALL' || String(p.seccional) === currentFilter);
                                const secs = Array.from(new Set(archive.participants.map(p => String(p.seccional)))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                                return (
                                    <AccordionItem key={archive.id} value={archive.id} className="border rounded-2xl px-4 bg-muted/5 overflow-hidden">
                                        <AccordionTrigger className="hover:no-underline py-5"><div className="flex flex-col sm:flex-row sm:items-center gap-4 text-left w-full"><div className="h-12 w-12 rounded-xl bg-white border border-primary/10 flex items-center justify-center shrink-0"><Archive className="h-6 w-6 text-primary" /></div><div className="flex-1 space-y-1"><h3 className="font-black text-sm uppercase text-slate-900">{archive.archiveName}</h3><div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase"><Calendar className="h-3 w-3" /> {formatTimestamp(archive.archivedAt)}</div></div><Badge variant="secondary" className="font-black text-[10px]">{archive.totalParticipants} PARTICIPANTES</Badge></div></AccordionTrigger>
                                        <AccordionContent className="pb-6 pt-2"><div className="bg-white rounded-2xl border border-primary/5 shadow-inner overflow-hidden">
                                                <div className="p-4 border-b flex flex-wrap justify-between items-center gap-4">
                                                    <div className="flex items-center gap-2 bg-white border border-primary/10 rounded-lg px-2 h-8"><Filter className="h-3 w-3 text-primary" /><select value={currentFilter} onChange={(e) => setSeccionalFilters(prev => ({ ...prev, [archive.id]: e.target.value }))} className="bg-transparent text-[9px] font-black uppercase outline-none"><option value="ALL">TODAS</option>{secs.map(s => (<option key={s} value={s}>SECC {s}</option>))}</select></div>
                                                    <div className="flex gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase rounded-lg border-primary/20"><FileDown className="h-3 w-3 mr-2" /> EXPORTAR <ChevronDown className="ml-1 h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 font-black uppercase text-[9px]"><DropdownMenuItem onClick={() => { if(canExportExcel) { setActiveArchiveForExport(archive); setActiveDataForExport(filtered); setCustomFilename(`REPORTE_${archive.archiveName}`); setIsExportDialogOpen(true); } else toast({title: "Bloqueado", variant: "destructive"}); }} disabled={!canExportExcel} className={cn("cursor-pointer gap-2 font-bold", canExportExcel ? "text-green-600" : "text-muted-foreground")}>{canExportExcel ? <FileSpreadsheet className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} Excel (.csv)</DropdownMenuItem><DropdownMenuItem onClick={() => { if(canExportPDF) handleExportPDF(archive, filtered); else toast({title: "Bloqueado", variant: "destructive"}); }} disabled={!canExportPDF} className={cn("cursor-pointer gap-2 font-bold", canExportPDF ? "text-red-600" : "text-muted-foreground")}>{canExportPDF ? <FileText className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} PDF (.pdf)</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button size="sm" onClick={() => handleSyncPhones(archive)} disabled={isSyncing[archive.id]} className="h-8 text-[9px] font-black uppercase rounded-lg shadow-sm"><SmartphoneIcon className="h-3 w-3 mr-2" /> SINCRONIZAR</Button>{isAdmin && <Button size="icon" variant="destructive" onClick={() => { setArchiveToDelete(archive); setIsAlertOpen(true); }} className="h-8 w-8 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></Button>}</div>
                                                </div>
                                                <Table><TableHeader><TableRow className="bg-muted/30 text-[9px] font-black uppercase"><TableHead className="w-[100px] text-center">Cédula</TableHead><TableHead>Elector</TableHead><TableHead>WhatsApp</TableHead><TableHead className="text-center">SECC</TableHead></TableRow></TableHeader><TableBody>{filtered.length > 0 ? filtered.map((p, idx) => (<TableRow key={idx} className="hover:bg-slate-50 transition-colors border-b last:border-0"><TableCell className="text-center font-mono text-[10px] font-bold text-slate-600">{p.cedula}</TableCell><TableCell className="py-4"><div className="flex flex-col"><span className="text-[11px] font-black uppercase text-slate-900">{p.nombre} {p.apellido}</span></div></TableCell><TableCell className="text-green-700 font-black text-[10px]">{p.telefono}</TableCell><TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black uppercase">SECC {p.seccional}</Badge></TableCell></TableRow>)) : <TableRow><TableCell colSpan={4} className="h-20 text-center opacity-30">Vacio</TableCell></TableRow>}</TableBody></Table>
                                            </div></AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : <div className="text-center py-20 opacity-20 border-2 border-dashed rounded-3xl"><History className="h-16 w-16 mx-auto mb-4" /><p className="font-black uppercase text-xs">Sin archivos</p></div>}
                </CardContent>
            </Card>

            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="h-6 w-6 text-green-600" /> Exportar Planilla</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Nombre del Archivo</Label><Input value={customFilename} onChange={(e) => setCustomFilename(e.target.value.toUpperCase())} className="font-black h-12 uppercase" /></div>
                        <div className="grid grid-cols-2 gap-2">{EXPORTABLE_COLUMNS.map(col => (<div key={col.id} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])}><Checkbox checked={selectedColumns.includes(col.id)} /><Label className="text-[9px] font-black uppercase cursor-pointer">{col.label}</Label></div>))}</div>
                    </div>
                    <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsExportDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</Button><Button onClick={() => executeExportCSV(customFilename)} disabled={selectedColumns.length === 0} className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg">GENERAR EXCEL</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent className="rounded-[2rem]"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿ELIMINAR?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-black uppercase text-xs h-11 rounded-xl">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDeleteArchive} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-8 rounded-xl shadow-lg">ELIMINAR</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

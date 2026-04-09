
"use client";

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, deleteDoc, doc, getDocs, writeBatch, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Search, 
    Loader2, 
    UserPlus, 
    Trash2, 
    FileDown, 
    FileText, 
    ChevronDown, 
    Smartphone, 
    Zap, 
    Archive,
    History,
    X,
    CheckCircle2,
    Filter,
    Users2,
    ArrowRight,
    FileSpreadsheet,
    Lock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { logAction } from '@/lib/audit';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Inscripcion {
    id: string;
    cedula: string | number;
    nombre: string;
    apellido: string;
    telefono: string;
    seccional: string;
    local: string;
    mesa: string | number;
    orden: string | number;
    eventName: string;
    createdAt: any;
}

export default function InscripcionesEventosPage() {
    const db = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSeccional, setSelectedSeccional] = useState('ALL');
    const [seccionales, setSeccionales] = useState<{id: string, nombre: string}[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Inscripcion | null>(null);
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
    const [archiveName, setArchiveName] = useState('');
    const [isFilenameDialogOpen, setIsFilenameDialogOpen] = useState(false);
    const [customFilename, setCustomFilename] = useState('');

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
    const canExportPDF = isAdmin || user?.moduleActions?.['/inscripciones-eventos']?.includes('pdf');
    const canExportExcel = isAdmin || user?.moduleActions?.['/inscripciones-eventos']?.includes('excel');

    useEffect(() => {
        const fetchSeccionales = async () => {
            if (!db) return;
            try {
                const q = query(collection(db, 'seccionales'));
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, nombre: String(d.data().nombre || d.id) }));
                list.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }));
                setSeccionales(list);
            } catch (e) {}
        };
        fetchSeccionales();
    }, [db]);

    const inscripcionesQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'inscripciones'), orderBy('createdAt', 'desc'));
    }, [db]);

    const { data: inscripciones, isLoading } = useCollection<Inscripcion>(inscripcionesQuery);

    const filteredData = useMemo(() => {
        if (!inscripciones) return [];
        let data = inscripciones;
        if (selectedSeccional !== 'ALL') data = data.filter(i => String(i.seccional) === String(selectedSeccional));
        const term = searchTerm.trim().toUpperCase();
        if (term) data = data.filter(i => String(i.cedula).includes(term) || i.nombre.toUpperCase().includes(term) || i.apellido.toUpperCase().includes(term) || i.eventName.toUpperCase().includes(term));
        return data;
    }, [inscripciones, searchTerm, selectedSeccional]);

    const formatTimestamp = (ts: any) => {
        if (!ts) return '---';
        try {
            const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
            return format(date, "d MMM, HH:mm", { locale: es });
        } catch (e) { return '---'; }
    };

    const executeExportCSV = async (filename: string) => {
        if (!canExportExcel) {
            toast({ title: "Acceso Denegado", description: "No tienes permiso para exportar Excel.", variant: "destructive" });
            return;
        }
        if (filteredData.length === 0) return;
        setIsExporting(true);
        try {
            const headers = ['FECHA', 'EVENTO', 'CEDULA', 'NOMBRE', 'APELLIDO', 'TELEFONO', 'SECCIONAL', 'LOCAL', 'MESA', 'ORDEN'].join(';');
            let csvContent = "\uFEFF" + headers + "\n";
            filteredData.forEach(i => {
                const row = [formatTimestamp(i.createdAt), i.eventName || 'GENERAL', i.cedula, i.nombre, i.apellido, i.telefono, i.seccional, i.local, i.mesa, i.orden];
                csvContent += row.map(v => `"${String(v || '').replace(/;/g, ' ').toUpperCase()}"`).join(';') + "\n";
            });
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.body.appendChild(document.createElement('a'));
            link.href = URL.createObjectURL(blob);
            link.download = (filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'REPORTE_INSCRIPCIONES') + '.csv';
            link.click();
            document.body.removeChild(link);
            toast({ title: "Excel generado" });
            setIsFilenameDialogOpen(false);
        } finally { setIsExporting(false); }
    };

    const handleExportPDF = () => {
        if (!canExportPDF) {
            toast({ title: "Acceso Denegado", description: "No tienes permiso para exportar PDF.", variant: "destructive" });
            return;
        }
        if (filteredData.length === 0) return;
        setIsExporting(true);
        try {
            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(18); doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold");
            doc.text("LISTA 2P - OPCIÓN 2", pageWidth / 2, 20, { align: 'center' });
            doc.setFontSize(12); doc.setTextColor(80, 80, 80);
            doc.text("REGISTRO DE INSCRIPCIONES PÚBLICAS", pageWidth / 2, 28, { align: 'center' });
            const tableColumn = ["FECHA", "EVENTO", "CÉDULA", "ELECTOR", "TELÉFONO", "SECC"];
            const tableRows = filteredData.map(i => [formatTimestamp(i.createdAt), i.eventName, i.cedula, `${i.nombre} ${i.apellido}`, i.telefono, i.seccional]);
            (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 35, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [239, 68, 68] } });
            doc.save(`inscripciones_publicas_${new Date().getTime()}.pdf`);
            toast({ title: "PDF generado" });
        } finally { setIsExporting(false); }
    };

    const handleArchive = async () => {
        if (!db || !user || !inscripciones || inscripciones.length === 0 || !archiveName.trim()) return;
        setIsArchiving(true);
        try {
            await addDoc(collection(db, 'archived_inscripciones_eventos'), { archiveName: archiveName.toUpperCase(), archivedAt: serverTimestamp(), archivedBy: user.name, totalParticipants: inscripciones.length, participants: inscripciones });
            const batch = writeBatch(db);
            inscripciones.forEach((i) => { batch.delete(doc(db, 'inscripciones', i.id)); });
            const settingsRef = doc(db, 'system_settings', 'global');
            batch.set(settingsRef, { public_registration_count: 0 }, { merge: true });
            await batch.commit();
            toast({ title: "Evento Archivado" });
            setIsArchiveDialogOpen(false);
        } finally { setIsArchiving(false); }
    };

    const handleDelete = async () => {
        if (!itemToDelete || !db) return;
        try { await deleteDoc(doc(db, 'inscripciones', itemToDelete.id)); toast({ title: "Registro eliminado" }); } finally { setIsAlertOpen(false); setItemToDelete(null); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><UserPlus className="h-8 w-8 text-primary" /> Inscripciones Públicas</h1><p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Gestión de captación externa desde /inscripcion.</p></div>
                <div className="flex flex-wrap gap-2"><Button variant="outline" asChild className="h-11 font-black uppercase text-xs border-primary/10"><Link href="/inscripciones-archivadas"><History className="mr-2 h-4 w-4 text-primary" /> VER HISTORIAL</Link></Button>{isAdmin && (<Button variant="outline" onClick={() => setIsArchiveDialogOpen(true)} disabled={!inscripciones?.length || isLoading} className="h-11 font-black uppercase text-xs border-primary/20"><Archive className="mr-2 h-4 w-4 text-primary" /> ARCHIVAR Y LIMPIAR</Button>)}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="default" className="h-11 font-black uppercase text-xs shadow-lg"><FileDown className="mr-2 h-4 w-4" /> EXPORTAR LISTADO <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 font-black uppercase text-[10px] p-2"><DropdownMenuItem onClick={() => { if(canExportExcel) { setCustomFilename(`INSCRIPCIONES_${new Date().toLocaleDateString().replace(/\//g, '-')}`); setIsFilenameDialogOpen(true); } else toast({title: "Acceso Denegado", variant: "destructive"}); }} disabled={!canExportExcel} className={cn("cursor-pointer font-bold", canExportExcel ? "text-green-600" : "text-muted-foreground")}><FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Excel (.csv)</DropdownMenuItem><DropdownMenuItem onClick={() => { if(canExportPDF) handleExportPDF(); else toast({title: "Acceso Denegado", variant: "destructive"}); }} disabled={!canExportPDF} className={cn("cursor-pointer font-bold", canExportPDF ? "text-red-600" : "text-muted-foreground")}><FileText className="h-3.5 w-3.5 mr-2" /> PDF (.pdf)</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
            </div>

            <Card className="border-primary/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="space-y-1"><div className="flex items-center gap-3"><CardTitle className="text-[11px] font-black uppercase">Monitor de Registros</CardTitle><Badge className="bg-primary font-black text-[10px] uppercase tracking-widest px-3 py-1"><Users2 className="h-3 w-3 mr-1.5" /> {filteredData.length} INSCRIPTOS</Badge></div></div><div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto"><div className="flex items-center gap-2 bg-background border border-primary/10 rounded-xl px-3 h-10 shadow-sm"><Filter className="h-3.5 w-3.5 text-muted-foreground" /><Select value={selectedSeccional} onValueChange={setSelectedSeccional}><SelectTrigger className="w-[160px] border-none bg-transparent h-8 font-bold text-[10px] uppercase focus:ring-0"><SelectValue placeholder="FILTRAR SECC" /></SelectTrigger><SelectContent><SelectItem value="ALL" className="text-[10px] font-bold uppercase">TODAS LAS SECC</SelectItem>{seccionales.map(s => <SelectItem key={s.id} value={s.nombre} className="text-[10px] font-bold uppercase">SECCIONAL {s.nombre}</SelectItem>)}</SelectContent></Select></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="BUSCAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-background font-bold border-primary/10 h-10 uppercase text-[10px]" /></div></div></div></CardHeader>
                <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/50 text-[10px] font-black uppercase"><TableHead className="w-[140px]">Fecha / Hora</TableHead><TableHead>Evento Destino</TableHead><TableHead className="w-[100px] text-center">Cédula</TableHead><TableHead>Elector</TableHead><TableHead>WhatsApp</TableHead><TableHead className="text-center">SECC</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>{isLoading ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)) : filteredData.length > 0 ? filteredData.map((insc) => (<TableRow key={insc.id} className="hover:bg-primary/[0.02] transition-colors border-b"><TableCell className="py-4"><div className="flex flex-col gap-0.5"><span className="text-[10px] font-black text-slate-900">{formatTimestamp(insc.createdAt)}</span></div></TableCell><TableCell><Badge variant="outline" className="text-[9px] font-black border-primary/20 bg-primary/5 text-primary uppercase">{insc.eventName || 'GENERAL'}</Badge></TableCell><TableCell className="text-center"><span className="font-mono text-[11px] font-black text-slate-600">{insc.cedula}</span></TableCell><TableCell><div className="flex flex-col"><span className="text-xs font-black uppercase tracking-tight text-slate-900">{insc.nombre} {insc.apellido}</span></div></TableCell><TableCell><div className="flex items-center gap-2 text-green-700 font-black text-xs"><Smartphone className="h-3.5 w-3.5" />{insc.telefono}</div></TableCell><TableCell className="text-center"><Badge variant="secondary" className="text-[9px] font-black bg-slate-100 border-slate-200">SECC {insc.seccional}</Badge></TableCell><TableCell className="text-right">{isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setItemToDelete(insc); setIsAlertOpen(true); }}><Trash2 className="h-4 w-4" /></Button>)}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={7} className="h-64 text-center opacity-20"><UserPlus className="h-16 w-16 mx-auto mb-2" /><p className="font-black uppercase text-xs">Sin registros</p></TableCell></TableRow>}</TableBody></Table></div></CardContent>
            </Card>

            <Dialog open={isFilenameDialogOpen} onOpenChange={setIsFilenameDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="h-6 w-6 text-green-600" /> Nombre del Archivo</DialogTitle><DialogDescription className="font-bold text-[10px] uppercase">Ingresa el nombre para el reporte (CSV compatible con Excel).</DialogDescription></DialogHeader>
                    <div className="py-4"><Label className="text-[10px] font-black uppercase mb-2 block">Nombre del Reporte</Label><Input value={customFilename} onChange={(e) => setCustomFilename(e.target.value)} className="font-black h-12 uppercase" autoFocus /></div>
                    <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsFilenameDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</Button><Button onClick={() => executeExportCSV(customFilename)} disabled={!customFilename.trim() || isExporting} className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg">{isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} DESCARGAR EXCEL</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent className="rounded-[2.5rem]"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿ELIMINAR REGISTRO?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-black uppercase text-xs h-11 rounded-2xl">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-6 rounded-2xl">ELIMINAR</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>

            <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3"><Archive className="h-6 w-6 text-primary" /> Archivar Evento Actual</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Nombre del Archivo Histórico</Label><Input placeholder="EJ: LANZAMIENTO" value={archiveName} onChange={(e) => setArchiveName(e.target.value.toUpperCase())} className="font-black uppercase h-12 rounded-xl" autoFocus /></div></div>
                    <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</Button><Button onClick={handleArchive} disabled={!archiveName.trim() || isArchiving} className="font-black uppercase text-[10px] h-11 rounded-xl px-6">{isArchiving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} CONFIRMAR Y LIMPIAR</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

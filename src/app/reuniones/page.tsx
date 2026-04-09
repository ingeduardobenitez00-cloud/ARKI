
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, doc, writeBatch, getDoc, addDoc, serverTimestamp, deleteDoc, orderBy } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, UserPlus, BookUser, Trash2, FileDown, Archive, FileText, ChevronDown, Users, Hash, MapPin, Building, Smartphone, Zap, Info, FileSpreadsheet, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection } from '@/firebase/firestore/use-collection';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { logAction } from '@/lib/audit';

interface PadronData {
    id: string;
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    CODIGO_SEC?: string | number;
    [key: string]: any;
    observacion?: string;
    TELEFONO?: string;
}

interface ParticipantData extends PadronData {
    original_doc_id: string;
}

const PADRON_COLLECTION = 'sheet1';
const REUNION_COLLECTION = 'reunion_actual';

export default function ReunionesPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<PadronData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [participantToDelete, setParticipantToDelete] = useState<ParticipantData | null>(null);
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
    const [reunionName, setReunionName] = useState('');
    const [telefono, setTelefono] = useState('');

    const [isFilenameDialogOpen, setIsFilenameDialogOpen] = useState(false);
    const [customFilename, setCustomFilename] = useState('');

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
    const canExportPDF = isAdmin || user?.moduleActions?.['/reuniones']?.includes('pdf');
    const canExportExcel = isAdmin || user?.moduleActions?.['/reuniones']?.includes('excel');

    const participantesQuery = useMemoFirebase(() => {
        if (!db) return null;
        let q = query(collection(db, REUNION_COLLECTION), orderBy('NOMBRE', 'asc'));
        if (user && !isAdmin) q = query(q, where('registradoPor_id', '==', user.id));
        return q;
    }, [db, user, isAdmin]);

    const { data: participantes, isLoading: isLoadingParticipantes } = useCollection<ParticipantData>(participantesQuery);

    const applyPhoneMask = (value: string) => {
        const cleanValue = value.replace(/\D/g, '').slice(0, 10);
        let formatted = cleanValue;
        if (cleanValue.length > 4 && cleanValue.length <= 7) formatted = `${cleanValue.slice(0, 4)}-${cleanValue.slice(4)}`;
        else if (cleanValue.length > 7) formatted = `${cleanValue.slice(0, 4)}-${cleanValue.slice(4, 7)}-${cleanValue.slice(7)}`;
        return formatted;
    };

    useEffect(() => { if (selectedPerson) setTelefono(applyPhoneMask(selectedPerson.TELEFONO || '')); else setTelefono(''); }, [selectedPerson]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (!term) return;
        setIsSearching(true); setSelectedPerson(null);
        try {
            const dataCol = collection(db!, PADRON_COLLECTION);
            const q1 = query(dataCol, where('CEDULA', '==', Number(term)));
            const q2 = query(dataCol, where('CEDULA', '==', term));
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const found = [...snap1.docs, ...snap2.docs].map(doc => ({ id: doc.id, ...doc.data() } as PadronData));
            if (found.length > 0) setSelectedPerson(found[0]);
            else toast({ title: 'No hallado', variant: 'destructive' });
        } finally { setIsSearching(false); }
    };
    
    const handleSave = async () => {
        if (!selectedPerson || !user) return;
        setIsSaving(true);
        const participantData = { ...selectedPerson, original_doc_id: selectedPerson.id, TELEFONO: telefono, registradoPor_id: user.id, registradoPor_nombre: user.name, observacion: 'PARTICIPANTE REUNION' };
        addDoc(collection(db!, REUNION_COLLECTION), participantData)
            .then(() => { toast({ title: '¡Registrado!' }); setSelectedPerson(null); setSearchTerm(''); })
            .finally(() => setIsSaving(false));
    };

    const handleDelete = async () => {
        if (!participantToDelete) return;
        deleteDoc(doc(db!, REUNION_COLLECTION, participantToDelete.id)).then(() => { toast({ title: 'Eliminado' }); setIsAlertOpen(false); });
    };

    const handleArchiveMeeting = async () => {
        if (!participantes || !reunionName.trim() || !user) return;
        setIsSaving(true);
        try {
            await addDoc(collection(db!, 'archived_meetings'), { name: reunionName.toUpperCase(), archivedAt: serverTimestamp(), participants: participantes, archivedBy: user.name });
            const batch = writeBatch(db!);
            participantes.forEach(p => batch.delete(doc(db!, REUNION_COLLECTION, p.id)));
            await batch.commit();
            toast({ title: 'Archivado' });
            setReunionName('');
        } finally { setIsSaving(false); setIsArchiveDialogOpen(false); }
    };

    const executeExportCSV = async (filename: string) => {
        if (!canExportExcel) {
            toast({ title: "Acceso Denegado", description: "No tienes permiso para exportar Excel.", variant: "destructive" });
            return;
        }
        if (!participantes || participantes.length === 0) return;
        setIsExporting(true);
        try {
            const headers = ['CEDULA', 'NOMBRE', 'SECCIONAL', 'TELEFONO', 'REGISTRADO POR'].join(';');
            let csvContent = "\uFEFF" + headers + "\n";
            participantes.forEach(p => {
                const row = [p.CEDULA, `${p.NOMBRE} ${p.APELLIDO}`, p.CODIGO_SEC || '', p.TELEFONO || '', p.registradoPor_nombre || ''];
                csvContent += row.map(v => `"${String(v || '').replace(/;/g, ' ').toUpperCase()}"`).join(';') + "\n";
            });
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.body.appendChild(document.createElement('a'));
            link.href = URL.createObjectURL(blob);
            link.download = (filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'ASISTENCIA') + '.csv';
            link.click();
            document.body.removeChild(link);
            toast({ title: "Excel generado" });
            setIsFilenameDialogOpen(false);
        } finally { setIsExporting(false); }
    };

    const handleExportPDF = async () => {
        if (!canExportPDF) {
            toast({ title: "Acceso Denegado", description: "No tienes permiso para exportar PDF.", variant: "destructive" });
            return;
        }
        if (!participantes || participantes.length === 0) return;
        setIsExporting(true);
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(18); doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold");
            doc.text("LISTA 2P - OPCIÓN 2", pageWidth / 2, 20, { align: 'center' });
            const tableColumn = ["CÉDULA", "NOMBRE Y APELLIDO", "SECC", "TELÉFONO"];
            const tableRows = participantes.map(p => [p.CEDULA, `${p.NOMBRE} ${p.APELLIDO}`, p.CODIGO_SEC || '---', p.TELEFONO || '---']);
            (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 35, styles: { fontSize: 8 }, headStyles: { fillColor: [239, 68, 68] } });
            doc.save(`asistencia_${new Date().getTime()}.pdf`);
            toast({ title: "PDF generado" });
        } finally { setIsExporting(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><Users className="h-8 w-8 text-primary" /> Registro de Asistencia</h1><p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Control de participantes para reuniones.</p></div>
                {isAdmin && (<div className="flex gap-2"><Button variant="outline" asChild className="h-11 font-black uppercase text-xs border-primary/10"><Link href="/reuniones-archivadas"><Archive className="mr-2 h-4 w-4" /> VER ARCHIVADAS</Link></Button><Button variant="outline" onClick={() => setIsArchiveDialogOpen(true)} disabled={!participantes?.length} className="h-11 font-black uppercase text-xs"><Archive className="mr-2 h-4 w-4" /> ARCHIVAR LISTA</Button></div>)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-primary/10 shadow-sm overflow-hidden h-fit"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-xs font-black uppercase flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Buscar por Cédula</CardTitle></CardHeader>
                    <CardContent className="pt-6"><form onSubmit={handleSearch} className="flex gap-2"><Input placeholder="NÚMEROS CI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.replace(/\D/g, ''))} className="font-bold text-lg h-12" inputMode="numeric"/><Button type="submit" disabled={isSearching} className="h-12 w-12 p-0">{isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="h-5 w-5" />}</Button></form></CardContent>
                </Card>

                <Card className="lg:col-span-2 border-primary/10 shadow-lg overflow-hidden min-h-[200px]"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-xs font-black uppercase flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Ficha de Registro</CardTitle></CardHeader>
                    <CardContent className="pt-6">{selectedPerson ? (<div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-primary/5 p-5 rounded-2xl border border-primary/10"><div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Identidad</Label><p className="font-black text-lg uppercase leading-tight">{selectedPerson.NOMBRE} {selectedPerson.APELLIDO}</p><div className="flex items-center gap-3 mt-1"><Badge variant="outline" className="font-black text-[10px] gap-1.5 border-primary/20"><Hash className="h-2.5 w-2.5"/> {selectedPerson.CEDULA}</Badge><Badge variant="secondary" className="font-black text-[10px] gap-1.5 bg-primary/10 text-primary border-primary/5"><MapPin className="h-2.5 w-2.5"/> SECC {selectedPerson.CODIGO_SEC}</Badge></div></div></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Smartphone className="h-3 w-3" /> Teléfono WhatsApp (Formato XXXX-XXX-XXX)</Label><Input value={telefono} onChange={(e) => setTelefono(applyPhoneMask(e.target.value))} placeholder="0981-152-121" className="h-11 font-bold text-lg" inputMode="numeric"/></div>
                                <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest text-base shadow-xl shadow-primary/20 rounded-2xl transition-all active:scale-95">{isSaving ? <Loader2 className="animate-spin mr-3" /> : <UserPlus className="mr-3 h-5 w-5" />} REGISTRAR EN REUNIÓN</Button></div>) : (<div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-30"><BookUser className="h-16 w-16 mb-2" /><p className="font-black uppercase text-xs tracking-widest text-center px-10">Ingresa una cédula.</p></div>)}</CardContent>
                </Card>
            </div>

            <Card className="border-primary/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between"><div><CardTitle className="text-sm font-black uppercase">Participantes Actuales</CardTitle></div>{participantes && participantes.length > 0 && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="default" size="sm" className="h-9 font-black uppercase text-[10px] gap-2 px-4 shadow-md"><FileDown className="h-3.5 w-3.5" /> EXPORTAR LISTADO <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 font-black uppercase text-[10px] p-2"><DropdownMenuItem onClick={() => { if(canExportExcel) { setCustomFilename(`REUNION_${new Date().toLocaleDateString().replace(/\//g, '-')}`); setIsFilenameDialogOpen(true); } else toast({title: "Acceso Denegado", variant: "destructive"}); }} disabled={!canExportExcel} className={cn("cursor-pointer gap-2 font-bold", canExportExcel ? "text-green-600" : "text-muted-foreground")}>{canExportExcel ? <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> : <Lock className="h-3.5 w-3.5 mr-2" />} Excel (.csv)</DropdownMenuItem><DropdownMenuItem onClick={() => { if(canExportPDF) handleExportPDF(); else toast({title: "Acceso Denegado", variant: "destructive"}); }} disabled={!canExportPDF} className={cn("cursor-pointer gap-2 font-bold", canExportPDF ? "text-red-600" : "text-muted-foreground")}>{canExportPDF ? <FileText className="h-3.5 w-3.5 mr-2" /> : <Lock className="h-3.5 w-3.5 mr-2" />} PDF (.pdf)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}</CardHeader>
                <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/50 text-[10px] font-black uppercase"><TableHead className="w-[120px] text-center">Cédula</TableHead><TableHead>Nombre y Apellido</TableHead><TableHead className="text-center">SECC</TableHead><TableHead>Teléfono</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>{isLoadingParticipantes ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>)) : participantes && participantes.length > 0 ? participantes.map(p => (<TableRow key={p.id} className="hover:bg-primary/[0.02] transition-colors border-b"><TableCell className="text-center py-4"><span className="font-mono text-[11px] font-black text-muted-foreground">{p.CEDULA}</span></TableCell><TableCell className="py-4"><span className="font-black text-xs uppercase tracking-tight">{p.NOMBRE} {p.APELLIDO}</span></TableCell><TableCell className="text-center py-4"><Badge variant="outline" className="text-[10px] font-black border-primary/10">SECC {p.CODIGO_SEC}</Badge></TableCell><TableCell className="py-4"><span className="text-xs font-bold text-green-700">{p.TELEFONO || '---'}</span></TableCell><TableCell className="text-right py-4">{isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setParticipantToDelete(p); setIsAlertOpen(true); }}><Trash2 className="h-4 w-4"/></Button>)}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={5} className="h-48 text-center opacity-20"><Users className="h-12 w-12 mx-auto" /><p className="font-black uppercase text-xs">Lista Vacía</p></TableCell></TableRow>}</TableBody></Table></div></CardContent>
            </Card>

            <Dialog open={isFilenameDialogOpen} onOpenChange={setIsFilenameDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="h-6 w-6 text-green-600" /> Nombre del Archivo</DialogTitle></DialogHeader>
                    <div className="py-4"><Label className="text-[10px] font-black uppercase mb-2 block">Nombre del Reporte</Label><Input value={customFilename} onChange={(e) => setCustomFilename(e.target.value)} className="font-black h-12 uppercase" autoFocus /></div>
                    <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsFilenameDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</Button><Button onClick={() => executeExportCSV(customFilename)} disabled={!customFilename.trim() || isExporting} className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg">{isExporting ? <Loader2 className="animate-spin h-4 w-4" /> : <FileDown className="h-4 w-4" />} DESCARGAR EXCEL</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿ELIMINAR?</AlertDialogTitle><AlertDialogDescription>Se quitará a <strong>{participantToDelete?.NOMBRE}</strong>.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-black uppercase text-xs h-11">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-6">ELIMINAR</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>

            <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl"><DialogHeader><DialogTitle className="font-black uppercase">Archivar Reunión</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase">Nombre del Evento</Label><Input value={reunionName} onChange={(e) => setReunionName(e.target.value.toUpperCase())} placeholder="EJ: REUNIÓN" className="font-black uppercase" autoFocus /></div></div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)} className="font-black uppercase text-[10px]">CANCELAR</Button><Button onClick={handleArchiveMeeting} disabled={!reunionName.trim() || isSaving} className="font-black uppercase text-[10px]">{isSaving ? <Loader2 className="animate-spin mr-2" /> : <Archive className="mr-2 h-4 w-4" />} CONFIRMAR</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

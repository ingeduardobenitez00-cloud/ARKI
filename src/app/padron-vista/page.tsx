
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, limit, orderBy, startAfter, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Library, FileDown, FileText, ChevronDown, Filter, Loader2, AlertCircle, FileSpreadsheet, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PadronDocument {
  id: string;
  [key: string]: any;
}

const PAGE_SIZE = 100;
const COLLECTION_NAME = 'sheet1';
const MAX_RECORDS = 2000;

const columnsToDisplay = [
    { key: 'CODIGO_SEC', label: 'SECC' },
    { key: 'LOCAL', label: 'LOCAL' },
    { key: 'MESA', label: 'MESA' },
    { key: 'ORDEN', label: 'ORDEN' },
    { key: 'CEDULA', label: 'CEDULA' },
    { key: 'NOMBRE', label: 'NOMBRE' },
    { key: 'APELLIDO', label: 'APELLIDO' },
    { key: 'DIRECCION', label: 'DIRECCION' },
    { key: 'FECHA_NACI', label: 'FECHA NACI' },
    { key: 'TELEFONO', label: 'TELEFONO' },
];

export default function PadronVistaPage() {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [allSeccionalData, setAllSeccionalData] = useState<PadronDocument[]>([]);
  const [seccionales, setSeccionales] = useState<{id: string, nombre: string}[]>([]);
  const [selectedSeccional, setSelectedSeccional] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [isFilenameDialogOpen, setIsFilenameDialogOpen] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchMode, setSearchMode] = useState(false);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
  const canExportPDF = isAdmin || user?.moduleActions?.['/padron']?.includes('pdf');
  const canExportExcel = isAdmin || user?.moduleActions?.['/padron']?.includes('excel');

  useEffect(() => {
    const fetchInitial = async () => {
        if (!db) return;
        try {
            const q = query(collection(db, 'seccionales'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, nombre: String(d.data().nombre || d.id) }));
            list.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }));
            setSeccionales(list);
        } catch (e) {}
    };
    fetchInitial();
  }, [db]);

  const loadSeccionalData = useCallback(async (isNextPage = false) => {
    if (!db || !selectedSeccional || selectedSeccional === 'ALL') { 
        setAllSeccionalData([]); 
        setLastVisible(null);
        setHasMore(false);
        return; 
    }
    
    setIsLoading(true); 
    if (!isNextPage) {
        setPage(1); 
        setSearchTerm('');
        setAllSeccionalData([]);
        setLastVisible(null);
    }
    
    try {
        const valStr = String(selectedSeccional).trim();
        const dataCollection = collection(db, COLLECTION_NAME);
        
        // Base query - Ordenar por APELLIDO y NOMBRE para paginación consistente
        let baseQuery = query(
            dataCollection, 
            where('CODIGO_SEC', '==', valStr), 
            orderBy('APELLIDO'), 
            orderBy('NOMBRE'),
            limit(PAGE_SIZE)
        );

        // Si falló la anterior (por tipo de dato), probamos con número
        // Nota: En Firestore real, mezclar tipos de datos en la misma columna es problemático para índices.
        
        if (isNextPage && lastVisible) {
            baseQuery = query(baseQuery, startAfter(lastVisible));
        }

        const snapshot = await getDocs(baseQuery);
        const records = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PadronDocument));
        
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(records.length === PAGE_SIZE);
        
        if (isNextPage) {
            setAllSeccionalData(prev => [...prev, ...records]);
        } else {
            setAllSeccionalData(records);
        }
    } catch (e: any) {
        console.error("Error loading data", e);
        // Fallback simple si el índice no existe o hay error de tipo
        if (!isNextPage) {
             const fallbackQuery = query(collection(db, COLLECTION_NAME), where('CODIGO_SEC', '==', selectedSeccional), limit(PAGE_SIZE));
             const snap = await getDocs(fallbackQuery);
             setAllSeccionalData(snap.docs.map(d => ({id: d.id, ...d.data()})));
             setHasMore(false);
        }
    } finally { setIsLoading(false); }
  }, [db, selectedSeccional, lastVisible]);

  useEffect(() => { loadSeccionalData(); }, [loadSeccionalData]);

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return allSeccionalData;
    return allSeccionalData.filter(p => 
        (p.NOMBRE || '').toUpperCase().includes(term) || 
        (p.APELLIDO || '').toUpperCase().includes(term) || 
        String(p.CEDULA).includes(term)
    );
  }, [allSeccionalData, searchTerm]);

  const handleGlobalSearch = async () => {
    const term = searchTerm.trim();
    if (!term || !db) return;
    
    setIsLoading(true);
    setSearchMode(true);
    try {
        // 1. Intentar búsqueda directa por ID (Cédula) - LA MÁS BARATA
        const docRef = doc(db, COLLECTION_NAME, term);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            setAllSeccionalData([{ id: snap.id, ...snap.data() } as PadronDocument]);
            setHasMore(false);
            return;
        }

        // 2. Si no es cédula, buscar por campo CEDULA exacto
        const qCed = query(collection(db, COLLECTION_NAME), where('CEDULA', '==', term), limit(1));
        const snapCed = await getDocs(qCed);
        if (!snapCed.empty) {
            setAllSeccionalData(snapCed.docs.map(d => ({ id: d.id, ...d.data() } as PadronDocument)));
            setHasMore(false);
            return;
        }

        // 3. Búsqueda por nombre (Limitada para evitar costos)
        const qName = query(
            collection(db, COLLECTION_NAME), 
            where('APELLIDO', '>=', term.toUpperCase()), 
            where('APELLIDO', '<=', term.toUpperCase() + '\uf8ff'),
            limit(50)
        );
        const snapName = await getDocs(qName);
        setAllSeccionalData(snapName.docs.map(d => ({ id: d.id, ...d.data() } as PadronDocument)));
        setHasMore(false);
        
        if (snapName.empty) {
            toast({ title: "No se encontraron resultados", description: "Prueba con la cédula o el apellido exacto." });
        }
    } finally { 
        setIsLoading(false); 
    }
  };

  // Eliminamos displayData y totalPages ya que usamos paginación de servidor

  const formatValue = (value: any, key: string): string => {
    if (value === null || typeof value === 'undefined' || String(value) === 'null') return '';
    if (key === 'FECHA_NACI' && typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return !isNaN(date.getTime()) ? date.toLocaleDateString('es-ES', { timeZone: 'UTC' }) : '';
    }
    return String(value);
  };

  const executeExportCSV = async (filename: string) => {
    if (!canExportExcel) {
        toast({ title: "Acceso Denegado", variant: "destructive" });
        return;
    }
    if (filteredData.length === 0) return;
    setIsExporting(true);
    try {
        const headers = columnsToDisplay.map(col => col.label).join(';');
        let csvContent = "\uFEFF" + headers + "\n";
        filteredData.forEach(row => {
            const line = columnsToDisplay.map(col => `"${formatValue(row[col.key], col.key).replace(/;/g, ' ').toUpperCase()}"`);
            csvContent += line.join(';') + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement('a'));
        link.href = URL.createObjectURL(blob);
        link.download = (filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'PADRON') + '.csv';
        link.click();
        document.body.removeChild(link);
        toast({ title: "Excel generado" });
        setIsFilenameDialogOpen(false);
    } finally { setIsExporting(false); }
  };

  const handleExportPDF = async () => {
    if (!canExportPDF) {
        toast({ title: "Acceso Denegado", variant: "destructive" });
        return;
    }
    if (filteredData.length === 0) return;
    setIsExporting(true);
    try {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFontSize(18); doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold"); doc.text("LISTA 2P", 148, 20, { align: 'center' });
        const tableColumn = columnsToDisplay.map(c => c.label);
        const tableRows = filteredData.map(row => columnsToDisplay.map(col => formatValue(row[col.key], col.key)));
        (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 35, styles: { fontSize: 7 }, headStyles: { fillColor: [239, 68, 68] } });
        doc.save(`padron_secc_${selectedSeccional}.pdf`);
    } finally { setIsExporting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><Library className="h-8 w-8 text-primary" /> Vista Dinámica del Padrón</h1></div>
        <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border shadow-sm">
                    <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                    <Select value={selectedSeccional} onValueChange={setSelectedSeccional}>
                        <SelectTrigger className="w-[180px] h-9 border-none bg-transparent font-black">
                            <SelectValue placeholder="Elegir SECC" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Seleccionar SECC...</SelectItem>
                            {seccionales.map(s => <SelectItem key={s.id} value={s.nombre}>SECC {s.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-[8px] font-bold text-orange-600 uppercase mt-1 mr-1">Límite: 2,000 registros por SECC</p>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="default" className="h-11 font-black shadow-lg" disabled={isExporting || filteredData.length === 0}>{isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} EXPORTAR <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 font-bold">
                    <DropdownMenuItem onClick={() => { if(canExportExcel) { setCustomFilename(`PADRON_SECC_${selectedSeccional}`); setIsFilenameDialogOpen(true); } else toast({title: "Acceso Denegado", variant: "destructive"}); }} disabled={!canExportExcel} className={cn("cursor-pointer font-black", canExportExcel ? "text-green-600" : "text-muted-foreground")}>{canExportExcel ? <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> : <Lock className="mr-2 h-4 w-4" />} Excel (.csv)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { if(canExportPDF) handleExportPDF(); else toast({title: "Acceso Denegado", variant: "destructive"}); }} disabled={!canExportPDF} className={cn("cursor-pointer font-black", canExportPDF ? "text-red-600" : "text-muted-foreground")}>{canExportPDF ? <FileText className="mr-2 h-4 w-4 text-red-600" /> : <Lock className="mr-2 h-4 w-4" />} PDF (.pdf)</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="space-y-2 pt-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Búsqueda rápida en SECC {selectedSeccional}</Label>
                <div className="flex gap-2">
                    <div className="relative w-full md:w-1/2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Nombre o Cédula..." 
                            className="pl-10 h-11 font-black" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                        />
                    </div>
                    <Button onClick={handleGlobalSearch} disabled={isLoading || !searchTerm.trim()} className="h-11 font-black uppercase">
                        Buscar
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-auto max-h-[600px]">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 text-[10px] font-black uppercase">
                            {columnsToDisplay.map(col => <TableHead key={col.key} className="text-center">{col.label}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && allSeccionalData.length === 0 ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={columnsToDisplay.length}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                            ))
                        ) : filteredData.length > 0 ? (
                            <>
                                {filteredData.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/20 transition-colors">
                                        {columnsToDisplay.map(col => (
                                            <TableCell key={col.key} className="text-[11px] font-bold uppercase py-3 whitespace-nowrap text-center">
                                                {formatValue(row[col.key], col.key)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                                {hasMore && !searchMode && (
                                    <TableRow>
                                        <TableCell colSpan={columnsToDisplay.length} className="p-4 text-center">
                                            <Button 
                                                variant="ghost" 
                                                onClick={() => loadSeccionalData(true)} 
                                                disabled={isLoading}
                                                className="font-black text-primary hover:bg-primary/5 uppercase text-[10px]"
                                            >
                                                {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Cargar más registros de esta SECC...'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        ) : (
                            <TableRow><TableCell colSpan={columnsToDisplay.length} className="h-64 text-center opacity-20">Vacio</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter className="bg-muted/10 py-4 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {allSeccionalData.length > 0 && <span>Mostrando {allSeccionalData.length} registros</span>}
            </div>
            {searchMode && (
                <Button variant="link" onClick={() => { setSearchMode(false); loadSeccionalData(); }} className="text-[10px] font-black uppercase">
                    Volver al listado por SECC
                </Button>
            )}
        </CardFooter>
      </Card>

      <Dialog open={isFilenameDialogOpen} onOpenChange={setIsFilenameDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="h-6 w-6 text-green-600" /> Nombre del Archivo</DialogTitle></DialogHeader>
            <div className="py-4"><Label className="text-[10px] font-black uppercase mb-2 block">Nombre del Reporte</Label><Input value={customFilename} onChange={(e) => setCustomFilename(e.target.value)} className="font-black h-12 uppercase" autoFocus /></div>
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsFilenameDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</Button><Button onClick={() => executeExportCSV(customFilename)} disabled={!customFilename.trim() || isExporting} className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg">DESCARGAR EXCEL</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

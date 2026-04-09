"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, ChevronDown, Filter, Loader2, AlertCircle, Search, Database, ChevronLeft, ChevronRight, FileSpreadsheet, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PadronDocument {
  id: string;
  [key: string]: any;
}

const PAGE_SIZE = 50;
const COLLECTION_NAME = 'sheet1';

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

export default function PadronExportPage() {
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

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
  const canExportPDF = isAdmin || user?.moduleActions?.['/padron-export']?.includes('pdf');
  const canExportExcel = isAdmin || user?.moduleActions?.['/padron-export']?.includes('excel');

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

  const loadSeccionalData = useCallback(async () => {
    if (!db || !selectedSeccional || selectedSeccional === 'ALL') {
        setAllSeccionalData([]);
        return;
    }

    setIsLoading(true);
    setPage(1);
    setSearchTerm('');
    
    try {
        const cleanVal = String(selectedSeccional).trim();
        const dataCollection = collection(db, COLLECTION_NAME);
        
        const qText = query(dataCollection, where('CODIGO_SEC', '==', cleanVal));
        const snapshotText = await getDocs(qText);
        let records = snapshotText.docs.map(d => ({ id: d.id, ...d.data() } as PadronDocument));

        if (!isNaN(Number(cleanVal))) {
            const qNum = query(dataCollection, where('CODIGO_SEC', '==', Number(cleanVal)));
            const snapshotNum = await getDocs(qNum);
            const numRecords = snapshotNum.docs.map(d => ({ id: d.id, ...d.data() } as PadronDocument));
            const seenIds = new Set(records.map(r => r.id));
            numRecords.forEach(r => { if (!seenIds.has(r.id)) records.push(r); });
        }

        records.sort((a, b) => {
            const apellidoA = String(a.APELLIDO || '').toUpperCase();
            const apellidoB = String(b.APELLIDO || '').toUpperCase();
            if (apellidoA !== apellidoB) return apellidoA.localeCompare(apellidoB);
            return String(a.NOMBRE || '').toUpperCase().localeCompare(String(b.NOMBRE || '').toUpperCase());
        });

        setAllSeccionalData(records);
        
        if (records.length === 0) {
            toast({ title: "Sin registros", description: `No se hallaron datos para la seccional ${cleanVal}.` });
        }
    } catch (error: any) {
        toast({ title: "Error técnico", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [db, selectedSeccional, toast]);

  useEffect(() => { 
    if (selectedSeccional !== 'ALL') loadSeccionalData(); 
  }, [selectedSeccional, loadSeccionalData]);

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return allSeccionalData;
    const searchWords = term.split(' ').filter(word => word.length > 0);
    return allSeccionalData.filter(p => {
        const fullName = `${p.NOMBRE || ''} ${p.APELLIDO || ''}`.toUpperCase();
        const ci = String(p.CEDULA || '');
        return searchWords.every(word => fullName.includes(word)) || ci.includes(term);
    });
  }, [allSeccionalData, searchTerm]);

  const displayData = useMemo(() => filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredData, page]);
  const totalPages = useMemo(() => Math.ceil(filteredData.length / PAGE_SIZE), [filteredData]);

  const formatValue = (value: any, key: string): string => {
    if (value === null || typeof value === 'undefined' || String(value) === 'null') return '';
    if (key === 'FECHA_NACI' && typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) return date.toLocaleDateString('es-ES', { timeZone: 'UTC' });
    }
    return String(value);
  };

  const executeExportCSV = async (filename: string) => {
    if (!canExportExcel) {
        toast({ title: "Acceso Denegado", description: "No tienes permiso para exportar Excel.", variant: "destructive" });
        return;
    }
    if (filteredData.length === 0) return;
    setIsExporting(true);
    
    try {
        const headers = columnsToDisplay.map(col => col.label).join(';');
        let csvContent = "\uFEFF" + headers + "\n";

        const chunkSize = 2000;
        for (let i = 0; i < filteredData.length; i += chunkSize) {
            const chunk = filteredData.slice(i, i + chunkSize);
            const chunkString = chunk.map(row => 
                columnsToDisplay.map(col => {
                    const val = formatValue(row[col.key], col.key).toUpperCase();
                    return `"${val.replace(/;/g, ' ')}"`;
                }).join(';')
            ).join('\n');
            
            csvContent += chunkString + "\n";
            if (i + chunkSize < filteredData.length) {
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement('a'));
        link.href = url;
        link.download = (filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'REPORTE') + '.csv';
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({ title: "¡Exportación Exitosa!" });
        setIsFilenameDialogOpen(false);
    } catch (e) {
        toast({ title: "Fallo en la generación del archivo", variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!canExportPDF) {
        toast({ title: "Acceso Denegado", description: "No tienes permiso para exportar PDF.", variant: "destructive" });
        return;
    }
    if (filteredData.length === 0) return;
    setIsExporting(true);
    try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(14); doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold");
        doc.text("LISTA 2P - OPCIÓN 2", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        doc.text(`Padrón Electoral - SECCIONAL ${selectedSeccional}`, pageWidth / 2, 22, { align: 'center' });
        
        const tableColumn = columnsToDisplay.map(c => c.label);
        const tableRows = filteredData.map(row => columnsToDisplay.map(col => formatValue(row[col.key], col.key)));
        
        (doc as any).autoTable({ 
            head: [tableColumn], 
            body: tableRows, 
            startY: 28, 
            styles: { fontSize: 5, cellPadding: 0.5, halign: 'center' }, 
            headStyles: { fillColor: [239, 68, 68] }, 
            margin: { top: 28, left: 5, right: 5 } 
        });
        
        doc.save(`padron_vertical_secc_${selectedSeccional}.pdf`);
        toast({ title: "PDF Vertical Generado" });
    } catch (e) {
        toast({ title: "Error al generar PDF", variant: "destructive" });
    } finally { 
        setIsExporting(false); 
    }
  };

  const openFilenameDialog = () => {
    if (!canExportExcel) {
        toast({ title: "Acceso Denegado", description: "No tienes permiso para exportar Excel.", variant: "destructive" });
        return;
    }
    setCustomFilename(`PADRON_SECC_${selectedSeccional}_${new Date().getTime()}`);
    setIsFilenameDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-medium uppercase tracking-tight flex items-center gap-3"><FileDown className="h-8 w-8 text-primary" /> Padrón para Exportar</h1>
            <p className="text-muted-foreground font-medium uppercase text-xs">Consulta y exporta el total de registros oficiales sin límites.</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border shadow-sm">
                <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                <Select value={selectedSeccional} onValueChange={setSelectedSeccional}>
                    <SelectTrigger className="w-[180px] h-9 border-none bg-transparent font-medium">
                        <SelectValue placeholder="Elegir Seccional" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Seleccionar Seccional...</SelectItem>
                        {seccionales.map(s => <SelectItem key={s.id} value={s.nombre}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="default" className="h-11 font-medium shadow-lg uppercase" disabled={isExporting || selectedSeccional === 'ALL'}>
                        {isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} 
                        EXPORTAR <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 font-medium uppercase">
                    <DropdownMenuItem onClick={openFilenameDialog} disabled={!canExportExcel} className={cn("cursor-pointer font-bold", canExportExcel ? "text-green-600" : "text-muted-foreground")}>
                        {canExportExcel ? <FileSpreadsheet className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />} Excel (.csv)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF} disabled={!canExportPDF} className={cn("cursor-pointer font-bold", canExportPDF ? "text-red-600" : "text-muted-foreground")}>
                        {canExportPDF ? <FileText className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />} PDF (.pdf)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="space-y-2 pt-4">
                <Label className="text-[10px] font-medium uppercase text-muted-foreground tracking-widest">
                    Búsqueda rápida en vista previa {selectedSeccional !== 'ALL' ? `(Seccional ${selectedSeccional})` : '...'}
                </Label>
                <div className="flex gap-2">
                    <div className="relative w-full md:w-1/2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="BUSCAR POR NOMBRE O CÉDULA..." 
                            className="pl-10 h-11 font-medium uppercase" 
                            value={searchTerm} 
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} 
                            disabled={allSeccionalData.length === 0 && !isLoading} 
                        />
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b">
            <div className="relative w-full overflow-auto max-h-[600px] min-h-[300px]">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 text-[10px] font-medium uppercase sticky top-0 z-10">
                            {columnsToDisplay.map(col => <TableHead key={col.key} className="text-center py-4">{col.label}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={columnsToDisplay.length}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                            ))
                        ) : displayData.length > 0 ? (
                            displayData.map((row) => (
                                <TableRow key={row.id} className="hover:bg-muted/20 transition-colors border-b">
                                    {columnsToDisplay.map(col => (
                                        <TableCell key={col.key} className="text-[11px] font-medium uppercase py-3 whitespace-nowrap text-center">
                                            {formatValue(row[col.key], col.key)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columnsToDisplay.length} className="h-64 text-center">
                                    {selectedSeccional === 'ALL' ? (
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Database className="w-12 h-12 mx-auto mb-2 text-primary" />
                                            <p className="font-medium uppercase text-xs tracking-widest text-center">Selecciona una seccional arriba para comenzar.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-destructive" />
                                            <p className="font-medium uppercase text-xs tracking-widest text-center">No se hallaron registros.</p>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
          </div>
        </CardContent>
         <CardFooter className="bg-muted/10 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-widest">
                {!isLoading && filteredData.length > 0 && (<span>Total Seccional: {filteredData.length.toLocaleString()} registros</span>)}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1 || isLoading} className="font-medium h-8 px-3 uppercase">
                    <ChevronLeft className="h-4 w-4 mr-1" /> INICIO
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading} className="font-medium h-8 px-3 text-[10px] uppercase">
                    ANTERIOR
                </Button>
                <span className="flex items-center px-4 h-8 rounded-md bg-white border text-[10px] font-medium uppercase shadow-sm">
                    Página {page} de {totalPages || 1}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || isLoading || totalPages === 0} className="font-medium h-8 px-3 text-[10px] uppercase">
                    SIGUIENTE
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages || isLoading || totalPages === 0} className="font-medium h-8 px-3 uppercase">
                    FIN <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </CardFooter>
      </Card>

      <Dialog open={isFilenameDialogOpen} onOpenChange={setIsFilenameDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3">
                    <FileSpreadsheet className="h-6 w-6 text-green-600" /> 
                    Nombre del Archivo
                </DialogTitle>
                <DialogDescription className="font-bold text-[10px] uppercase">
                    Ingresa el nombre para el Excel (formato CSV compatible).
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label className="text-[10px] font-black uppercase mb-2 block">Nombre del Reporte</Label>
                <Input value={customFilename} onChange={(e) => setCustomFilename(e.target.value)} placeholder="REPORTE_SECCIONAL" className="font-black h-12 uppercase" autoFocus />
            </div>
            <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsFilenameDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">
                    CANCELAR
                </Button>
                <Button 
                    onClick={() => executeExportCSV(customFilename)} 
                    disabled={!customFilename.trim() || isExporting} 
                    className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg"
                >
                    {isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} 
                    DESCARGAR EXCEL
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

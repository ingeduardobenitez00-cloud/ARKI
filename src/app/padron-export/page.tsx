"use client";
import { COLLECTION_PADRON } from '@/lib/constants';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
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
import JSZip from 'jszip';

interface PadronDocument {
  id: string;
  [key: string]: any;
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};

const PAGE_SIZE = 50;


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
    { key: 'N_PARTIDO', label: 'PARTIDO' },
    { key: 'VOTO1', label: 'JUN 2021' },
    { key: 'VOTO2', label: 'OCT 2021' },
    { key: 'VOTO3', label: 'DIC 2022' },
    { key: 'VOTO4', label: 'ABR 2023' },
    { key: 'VOTO5', label: 'JUN 2026' }
];

export default function PadronExportPage() {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [allSeccionalData, setAllSeccionalData] = useState<PadronDocument[]>([]);
  const [seccionales, setSeccionales] = useState<{id: string, nombre: string}[]>([]);
  
  const [selectedSeccional, setSelectedSeccional] = useState<string>('ALL');
  const [locales, setLocales] = useState<string[]>([]);
  const [selectedLocal, setSelectedLocal] = useState<string>('ALL');
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

        let metadataLocales: string[] = [];
        try {
            const localesRef = collection(db, 'locales_votacion');
            const qLocales = query(localesRef, where('seccional_id', '==', cleanVal));
            const localesSnap = await getDocs(qLocales);
            
            metadataLocales = localesSnap.docs
                .map(d => d.data().nombre || d.data().LOCAL)
                .filter(Boolean)
                .map(name => String(name).trim().toUpperCase());
                
            metadataLocales.sort();
            setLocales(Array.from(new Set(metadataLocales)));
        } catch (e) {
            console.error("Error fetching locales:", e);
            setLocales([]);
        }
        setSelectedLocal('ALL');

        const dataCollection = collection(db, COLLECTION_PADRON);
        let records: PadronDocument[] = [];
        
        const uniqueLocales = Array.from(new Set(metadataLocales));

        if (uniqueLocales.length > 0) {
            const chunkSize = 30;
            const chunks = [];
            for (let i = 0; i < uniqueLocales.length; i += chunkSize) {
                chunks.push(uniqueLocales.slice(i, i + chunkSize));
            }
            
            const fetchPromises = chunks.map(async (chunk) => {
                const q = query(dataCollection, where('LOCAL', 'in', chunk));
                const snap = await getDocs(q);
                return snap.docs.map(d => {
                    const data = d.data();
                    if (!data.CEDULA) {
                        data.CEDULA = d.id;
                    }
                    return { id: d.id, ...data } as PadronDocument;
                });
            });
            
            const results = await Promise.all(fetchPromises);
            const allFetched = results.flat();
            
            const seenIds = new Set();
            for (const r of allFetched) {
                if (!seenIds.has(r.id)) {
                    seenIds.add(r.id);
                    records.push(r);
                }
            }
        }

        records.sort((a, b) => {
            const localA = String(a.LOCAL || '').trim().toUpperCase();
            const localB = String(b.LOCAL || '').trim().toUpperCase();
            if (localA !== localB) return localA.localeCompare(localB);

            const mesaA = parseInt(a.MESA || '0', 10);
            const mesaB = parseInt(b.MESA || '0', 10);
            if (mesaA !== mesaB) return mesaA - mesaB;
            
            const ordenA = parseInt(a.ORDEN || '0', 10);
            const ordenB = parseInt(b.ORDEN || '0', 10);
            return ordenA - ordenB;
        });

        // Recalcular ORDEN por LOCAL y MESA
        let currentLocal = '';
        let currentMesa = '';
        let mesaCounter = 1;

        for (const row of records) {
            const loc = String(row.LOCAL || '').trim().toUpperCase();
            const mesa = String(row.MESA || '').trim();

            if (loc !== currentLocal || mesa !== currentMesa) {
                currentLocal = loc;
                currentMesa = mesa;
                mesaCounter = 1;
            }

            row.ORDEN = mesaCounter.toString();
            mesaCounter++;
        }

        setAllSeccionalData(records);
        
        if (records.length === 0) {
            toast({ title: "Sin registros", description: `No se hallaron datos para la seccional ${cleanVal}.` });
        }
    } catch (error: any) {
        console.error(error);
        toast({ title: "Error técnico", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [db, selectedSeccional, toast]);

  useEffect(() => { 
    if (selectedSeccional !== 'ALL') {
      loadSeccionalData(); 
    } else {
      setLocales([]);
      setSelectedLocal('ALL');
    }
  }, [selectedSeccional, loadSeccionalData]);

  const filteredData = useMemo(() => {
    let data = allSeccionalData;
    
    if (selectedLocal !== 'ALL') {
      const targetLocal = selectedLocal.trim().toUpperCase();
      data = data.filter(p => {
          const valLocal = String(p.LOCAL || '').trim().toUpperCase();
          return valLocal === targetLocal;
      });
    }

    const term = searchTerm.trim().toUpperCase();
    if (!term) return data;
    const searchWords = term.split(' ').filter(word => word.length > 0);
    return data.filter(p => {
        const fullName = `${p.NOMBRE || ''} ${p.APELLIDO || ''}`.toUpperCase();
        const ci = String(p.CEDULA || '');
        return searchWords.every(word => fullName.includes(word)) || ci.includes(term);
    });
  }, [allSeccionalData, searchTerm, selectedLocal]);

  const displayData = useMemo(() => filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredData, page]);
  const totalPages = useMemo(() => Math.ceil(filteredData.length / PAGE_SIZE), [filteredData]);

  const formatValue = (value: any, key: string): string => {
    if (value === null || typeof value === 'undefined' || String(value) === 'null') return '';
    if (key === 'FECHA_NACI') {
        if (typeof value === 'number') {
            const date = new Date(Math.round((value - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) {
                const day = String(date.getUTCDate()).padStart(2, '0');
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const year = date.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }
        } else if (typeof value === 'string') {
            const valTrimmed = value.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(valTrimmed)) {
                const parts = valTrimmed.split('-');
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(valTrimmed)) {
                return valTrimmed;
            }
            const date = new Date(valTrimmed);
            if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            }
        }
    }
    return String(value);
  };

  const executeExportCSV = async (filename: string) => {
    if (!canExportExcel) {
        toast({ title: "Función Bloqueada", description: "Solicita a la apoderación del equipo o al departamento de informática la habilitación de esta función.", variant: "destructive" });
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

  const formatCedula = (ced: any) => {
      if (!ced) return '';
      const num = Number(String(ced).replace(/\D/g, ''));
      if (isNaN(num)) return String(ced);
      return num.toLocaleString('en-US');
  };

  const getPdfHeaders = () => [
      [
          { content: 'Ord', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Mesa', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Cedula', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Apellido(s) y Nombre(s)', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
          { content: 'Direccion', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
          { content: 'Partido(s)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Secc.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Histórico de voto', colSpan: 5, styles: { halign: 'center' } }
      ],
      [
          { content: 'Jun\n2021', styles: { halign: 'center' } },
          { content: 'Oct\n2021', styles: { halign: 'center' } },
          { content: 'Dic\n2022', styles: { halign: 'center' } },
          { content: 'Abr\n2023', styles: { halign: 'center' } },
          { content: 'Jun\n2026', styles: { halign: 'center' } }
      ]
  ];

  const mapRowToPdfArray = (row: any) => {
      return [
          row.ORDEN || '',
          row.MESA || '',
          formatCedula(row.CEDULA),
          `${row.APELLIDO || ''}, ${row.NOMBRE || ''}`.trim().replace(/^,|,$/g, '').trim(),
          row.DIRECCION || '',
          row.N_PARTIDO ? `/${row.N_PARTIDO}` : '',
          row.CODIGO_SEC || '',
          row.VOTO1 || '',
          row.VOTO2 || '',
          row.VOTO3 || '',
          row.VOTO4 || '',
          row.VOTO5 || ''
      ];
  };

  const getPdfAutoTableOptions = (doc: any, titleText: string, tableRows: any[], logoIzquierdo: any, leftWidth: number, leftHeight: number, logoDerecho: any, rightWidth: number, rightHeight: number, pageWidth: number, totalPagesExp: string) => {
      return { 
          head: getPdfHeaders(), 
          body: tableRows, 
          startY: 32,
          theme: 'grid',
          styles: { 
              fontSize: 5, 
              cellPadding: 1, 
              textColor: [0, 0, 0],
              lineColor: [0, 0, 0],
              lineWidth: 0.2
          }, 
          headStyles: { 
              fillColor: [255, 255, 255],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
              lineColor: [0, 0, 0],
              lineWidth: 0.5
          }, 
          alternateRowStyles: {
              fillColor: [255, 255, 255]
          },
          margin: { top: 32, left: 10, right: 10 },
          didDrawPage: function (data: any) {
              if (logoIzquierdo) doc.addImage(logoIzquierdo, 'PNG', 15, 10, leftWidth, leftHeight);
              if (logoDerecho) doc.addImage(logoDerecho, 'PNG', pageWidth - 15 - rightWidth, 10, rightWidth, rightHeight);
              
              doc.setFontSize(14); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
              doc.text("LISTA 1 - OPCIÓN 5", pageWidth / 2, 18, { align: 'center' });
              
              doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
              doc.text(titleText, pageWidth / 2, 25, { align: 'center' });

              let str = 'Página ' + doc.internal.getNumberOfPages();
              if (typeof doc.putTotalPages === 'function') {
                  str = str + ' de ' + totalPagesExp;
              }
              doc.setFontSize(8);
              doc.setTextColor(100, 100, 100);
              doc.text(str, pageWidth - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
          }
      };
  };

  const handleExportPDF = async () => {
    if (!canExportPDF) {
        toast({ title: "Función Bloqueada", description: "Solicita a la apoderación del equipo o al departamento de informática la habilitación de esta función.", variant: "destructive" });
        return;
    }
    if (filteredData.length === 0) return;
    setIsExporting(true);
    try {
        const doc = new jsPDF('p', 'mm', 'legal');
        const pageWidth = doc.internal.pageSize.getWidth();
        
        let logoIzquierdo: any = null;
        let leftWidth = 0, leftHeight = 18;
        let logoDerecho: any = null;
        let rightWidth = 0, rightHeight = 18;

        try {
            logoIzquierdo = await loadImage('/logo_derecho.png');
            leftWidth = leftHeight * (logoIzquierdo.width / logoIzquierdo.height);

            logoDerecho = await loadImage('/logo_izquierdo.png');
            rightWidth = rightHeight * (logoDerecho.width / logoDerecho.height);
        } catch (e) {
            console.log("No se pudieron cargar los logos", e);
        }

        const titleText = selectedLocal !== 'ALL' 
            ? `Padrón Electoral - SECCIONAL ${selectedSeccional} - ${selectedLocal}`
            : `Padrón Electoral - SECCIONAL ${selectedSeccional}`;
        
        const tableRows = filteredData.map((row) => mapRowToPdfArray(row));
        const totalPagesExp = '{total_pages_count_string}';

        (doc as any).autoTable(getPdfAutoTableOptions(doc, titleText, tableRows, logoIzquierdo, leftWidth, leftHeight, logoDerecho, rightWidth, rightHeight, pageWidth, totalPagesExp));
        
        if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages(totalPagesExp);
        }
        
        doc.save(`padron_vertical_secc_${selectedSeccional}.pdf`);
        toast({ title: "PDF Generado" });
    } catch (e) {
        toast({ title: "Error al generar PDF", variant: "destructive" });
    } finally { 
        setIsExporting(false); 
    }
  };

  const handleExportAllLocalesZIP = async () => {
    if (!canExportPDF) {
        toast({ title: "Función Bloqueada", description: "Solicita a la apoderación del equipo o al departamento de informática la habilitación de esta función.", variant: "destructive" });
        return;
    }
    if (allSeccionalData.length === 0) return;
    
    setIsExporting(true);
    toast({ title: "Generando paquete ZIP...", description: "Esto puede tardar unos momentos. Por favor espera." });
    
    try {
        const zip = new JSZip();
        
        let logoIzquierdo: any = null;
        let leftWidth = 0, leftHeight = 18;
        let logoDerecho: any = null;
        let rightWidth = 0, rightHeight = 18;

        try {
            logoIzquierdo = await loadImage('/logo_derecho.png');
            leftWidth = leftHeight * (logoIzquierdo.width / logoIzquierdo.height);

            logoDerecho = await loadImage('/logo_izquierdo.png');
            rightWidth = rightHeight * (logoDerecho.width / logoDerecho.height);
        } catch (e) {}

        const uniqueLocalesInSeccional = Array.from(new Set(allSeccionalData.map(r => {
            const loc = r.LOCAL;
            return String(loc || 'DESCONOCIDO').trim().toUpperCase();
        })));

        for (const local of uniqueLocalesInSeccional) {
            const localData = allSeccionalData.filter(p => {
                const loc = String(p.LOCAL || '').trim().toUpperCase();
                return loc === local;
            });
            
            if (localData.length === 0) continue;
            
            const doc = new jsPDF('p', 'mm', 'legal');
            const pageWidth = doc.internal.pageSize.getWidth();
            const titleText = `Padrón Electoral - SECCIONAL ${selectedSeccional} - ${local}`;
            
            const tableRows = localData.map((row) => mapRowToPdfArray(row));
            const totalPagesExp = '{total_pages_count_string}';

            (doc as any).autoTable(getPdfAutoTableOptions(doc, titleText, tableRows, logoIzquierdo, leftWidth, leftHeight, logoDerecho, rightWidth, rightHeight, pageWidth, totalPagesExp));
            
            if (typeof doc.putTotalPages === 'function') {
                doc.putTotalPages(totalPagesExp);
            }
            
            const pdfBlob = doc.output('blob');
            const safeLocalName = local.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            zip.file(`SECC_${selectedSeccional}_${safeLocalName}.pdf`, pdfBlob);
            
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.body.appendChild(document.createElement('a'));
        link.href = url;
        link.download = `TODOS_LOS_LOCALES_SECCIONAL_${selectedSeccional}.zip`;
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({ title: "¡Paquete ZIP descargado exitosamente!" });
    } catch (e) {
        console.error(e);
        toast({ title: "Error al generar ZIP", variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
  };

  const openFilenameDialog = () => {
    if (!canExportExcel) {
        toast({ title: "Función Bloqueada", description: "Solicita a la apoderación del equipo o al departamento de informática la habilitación de esta función.", variant: "destructive" });
        return;
    }
    let filenameBase = `PADRON_SECC_${selectedSeccional}`;
    if (selectedLocal !== 'ALL') {
        const sanitizedLocal = selectedLocal.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
        filenameBase += `_${sanitizedLocal}`;
    }
    setCustomFilename(`${filenameBase}_${new Date().getTime()}`);
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
            
            {selectedSeccional !== 'ALL' && locales.length > 0 && (
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border shadow-sm">
                    <Select value={selectedLocal} onValueChange={setSelectedLocal}>
                        <SelectTrigger className="w-[220px] h-9 border-none bg-transparent font-medium truncate">
                            <SelectValue placeholder="Elegir Local" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">TODOS (SECC. {selectedSeccional})</SelectItem>
                            {locales.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

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
                    {selectedLocal === 'ALL' && locales.length > 0 && (
                        <DropdownMenuItem onClick={handleExportAllLocalesZIP} disabled={!canExportPDF} className={cn("cursor-pointer font-bold border-t mt-1 pt-2", canExportPDF ? "text-blue-600" : "text-muted-foreground")}>
                            {canExportPDF ? <Database className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />} TODOS LOS LOCALES (ZIP)
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="space-y-2 pt-4">
                <Label className="text-[10px] font-medium uppercase text-muted-foreground tracking-widest">
                    Búsqueda rápida en vista previa {selectedSeccional !== 'ALL' ? `(Seccional ${selectedSeccional}${selectedLocal !== 'ALL' ? ` - ${selectedLocal}` : ''})` : '...'}
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
                        <TableRow className="bg-muted/50 text-[10px] font-medium uppercase sticky top-0 z-20">
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">SECC</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">LOCAL</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">MESA</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">ORDEN</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">CEDULA</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">NOMBRE</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">APELLIDO</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">DIRECCION</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">FECHA NACI</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">TELEFONO</TableHead>
                            <TableHead rowSpan={2} className="text-center py-2 border-r border-b bg-muted/95 backdrop-blur">PARTIDO</TableHead>
                            <TableHead colSpan={5} className="text-center py-1 border-b bg-muted/95 backdrop-blur">HISTÓRICO DE VOTO</TableHead>
                        </TableRow>
                        <TableRow className="bg-muted/50 text-[10px] font-medium uppercase sticky top-[32px] z-10 shadow-sm">
                            <TableHead className="text-center py-1 border-r border-b bg-muted/95 backdrop-blur">JUN 2021</TableHead>
                            <TableHead className="text-center py-1 border-r border-b bg-muted/95 backdrop-blur">OCT 2021</TableHead>
                            <TableHead className="text-center py-1 border-r border-b bg-muted/95 backdrop-blur">DIC 2022</TableHead>
                            <TableHead className="text-center py-1 border-r border-b bg-muted/95 backdrop-blur">ABR 2023</TableHead>
                            <TableHead className="text-center py-1 border-b bg-muted/95 backdrop-blur">JUN 2026</TableHead>
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

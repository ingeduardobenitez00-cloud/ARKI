"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Filter, Loader2, Database, LayoutList, FileSpreadsheet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PadronDocument {
  id: string;
  [key: string]: any;
}

interface LocalSummary {
    localName: string;
    electoresCount: number;
    mesasCount: number;
    isVinculado: boolean;
    data: PadronDocument[];
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};

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
    { key: 'N_PARTIDO', label: 'PARTIDO' },
    { key: 'VOTO1', label: 'JUN 2021' },
    { key: 'VOTO2', label: 'OCT 2021' },
    { key: 'VOTO3', label: 'DIC 2022' },
    { key: 'VOTO4', label: 'ABR 2023' },
    { key: 'VOTO5', label: 'JUN 2026' }
];

export default function ResumenSeccionalPage() {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [seccionales, setSeccionales] = useState<{id: string, nombre: string}[]>([]);
  const [selectedSeccional, setSelectedSeccional] = useState<string>('ALL');
  
  const [localesSummary, setLocalesSummary] = useState<LocalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingLocal, setExportingLocal] = useState<string | null>(null);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
  const canExportPDF = isAdmin || user?.moduleActions?.['/resumen-seccional']?.includes('pdf') || true;
  const canExportExcel = isAdmin || user?.moduleActions?.['/resumen-seccional']?.includes('excel') || true;

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
        setLocalesSummary([]);
        return;
    }

    setIsLoading(true);
    
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
        } catch (e) {
            console.error("Error fetching locales:", e);
        }

        const dataCollection = collection(db, COLLECTION_NAME);
        let records: PadronDocument[] = [];
        
        try {
            const qData = query(dataCollection, where('CODIGO_SEC', '==', cleanVal));
            const snap = await getDocs(qData);
            records = snap.docs.map(d => {
                const data = d.data();
                if (!data.CEDULA) {
                    data.CEDULA = d.id;
                }
                return { id: d.id, ...data } as PadronDocument;
            });
        } catch (err) {
            console.error("Error fetching by CODIGO_SEC:", err);
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

        let currentLocalStr = '';
        let currentMesaStr = '';
        let mesaCounter = 1;

        for (const row of records) {
            const loc = String(row.LOCAL || '').trim().toUpperCase();
            const mesa = String(row.MESA || '').trim();

            if (loc !== currentLocalStr || mesa !== currentMesaStr) {
                currentLocalStr = loc;
                currentMesaStr = mesa;
                mesaCounter = 1;
            }

            row.ORDEN = mesaCounter.toString();
            mesaCounter++;
        }

        const groupedMap = new Map<string, LocalSummary>();

        for (const row of records) {
            const locName = String(row.LOCAL || '').trim().toUpperCase() || 'DESCONOCIDO';
            if (!groupedMap.has(locName)) {
                groupedMap.set(locName, {
                    localName: locName,
                    electoresCount: 0,
                    mesasCount: 0,
                    isVinculado: false,
                    data: []
                });
            }
            groupedMap.get(locName)!.data.push(row);
        }

        const uniqueLocalesSet = new Set(metadataLocales);
        const summaryArray = Array.from(groupedMap.values());
        for (const summary of summaryArray) {
            summary.electoresCount = summary.data.length;
            const uniqueMesas = new Set(summary.data.map(r => String(r.MESA || '').trim()));
            summary.mesasCount = uniqueMesas.size;
            summary.isVinculado = uniqueLocalesSet.has(summary.localName);
        }

        summaryArray.sort((a, b) => {
            if (a.isVinculado && !b.isVinculado) return -1;
            if (!a.isVinculado && b.isVinculado) return 1;
            return a.localName.localeCompare(b.localName);
        });

        setLocalesSummary(summaryArray);
        
        if (summaryArray.length === 0) {
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
      setLocalesSummary([]);
    }
  }, [selectedSeccional, loadSeccionalData]);


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

  const handleExportPDF = async (summary: LocalSummary) => {
    if (!canExportPDF) {
        toast({ title: "Función Bloqueada", variant: "destructive" });
        return;
    }
    
    setExportingLocal(summary.localName);
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
        } catch (e) {}

        const titleText = `Padrón Electoral - SECCIONAL ${selectedSeccional} - ${summary.localName}`;
        const tableRows = summary.data.map((row) => mapRowToPdfArray(row));
        const totalPagesExp = '{total_pages_count_string}';

        (doc as any).autoTable(getPdfAutoTableOptions(doc, titleText, tableRows, logoIzquierdo, leftWidth, leftHeight, logoDerecho, rightWidth, rightHeight, pageWidth, totalPagesExp));
        
        if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages(totalPagesExp);
        }
        
        const safeLocalName = summary.localName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        doc.save(`PADRON_SECC_${selectedSeccional}_${safeLocalName}.pdf`);
        toast({ title: "PDF Generado", description: summary.localName });
    } catch (e) {
        toast({ title: "Error al generar PDF", variant: "destructive" });
    } finally { 
        setExportingLocal(null); 
    }
  };

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

  const handleExportExcel = async (summary: LocalSummary) => {
    if (!canExportExcel) {
        toast({ title: "Función Bloqueada", variant: "destructive" });
        return;
    }
    
    setExportingLocal(summary.localName);
    
    try {
        const headers = columnsToDisplay.map(col => col.label).join(';');
        let csvContent = "\uFEFF" + headers + "\n";

        const chunkSize = 2000;
        for (let i = 0; i < summary.data.length; i += chunkSize) {
            const chunk = summary.data.slice(i, i + chunkSize);
            const chunkString = chunk.map(row => 
                columnsToDisplay.map(col => {
                    const val = formatValue(row[col.key], col.key).toUpperCase();
                    return `"${val.replace(/;/g, ' ')}"`;
                }).join(';')
            ).join('\n');
            
            csvContent += chunkString + "\n";
            if (i + chunkSize < summary.data.length) {
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement('a'));
        link.href = url;
        const safeLocalName = summary.localName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        link.download = `PADRON_SECC_${selectedSeccional}_${safeLocalName}.csv`;
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({ title: "Excel Generado", description: summary.localName });
    } catch (e) {
        toast({ title: "Fallo en la generación del archivo", variant: "destructive" });
    } finally {
        setExportingLocal(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-medium uppercase tracking-tight flex items-center gap-3"><LayoutList className="h-8 w-8 text-primary" /> Resumen Seccional</h1>
            <p className="text-muted-foreground font-medium uppercase text-xs">VISTA RESUMIDA DE LOCALES POR SECCIONAL CON EXPORTACIÓN DIRECTA.</p>
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
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="space-y-2 pt-4">
                <h3 className="font-bold text-lg uppercase">
                    {selectedSeccional !== 'ALL' ? `Locales de la Seccional ${selectedSeccional}` : 'Seleccione una seccional para ver el resumen'}
                </h3>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b">
            <div className="relative w-full overflow-auto min-h-[300px]">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 text-[11px] font-bold uppercase">
                            <TableHead className="py-3 px-4">Local de Votación</TableHead>
                            <TableHead className="text-center py-3">Cant. de Mesas</TableHead>
                            <TableHead className="text-center py-3">Cant. de Electores</TableHead>
                            <TableHead className="text-right py-3 pr-6">Acciones (Padrón)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={4} className="p-4"><div className="h-10 bg-muted/50 rounded-md animate-pulse" /></TableCell></TableRow>
                            ))
                        ) : localesSummary.length > 0 ? (
                            localesSummary.map((summary, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/20 transition-colors border-b">
                                    <TableCell className="text-[13px] font-bold uppercase py-4 px-4">
                                        <div className="flex flex-col">
                                            <span>{summary.localName}</span>
                                            {!summary.isVinculado && (
                                                <span className="text-[9px] text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full w-fit mt-1">VOTAN EN OTRO LOCAL</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[12px] font-medium py-4 text-center">
                                        {summary.mesasCount} Mesas
                                    </TableCell>
                                    <TableCell className="text-[12px] font-medium py-4 text-center">
                                        {summary.electoresCount.toLocaleString()} Electores
                                    </TableCell>
                                    <TableCell className="py-4 pr-6 text-right space-x-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleExportPDF(summary)}
                                            disabled={exportingLocal === summary.localName}
                                            className="font-bold text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            {exportingLocal === summary.localName ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                                            PDF
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleExportExcel(summary)}
                                            disabled={exportingLocal === summary.localName}
                                            className="font-bold text-green-600 hover:text-green-700 hover:bg-green-50"
                                        >
                                            {exportingLocal === summary.localName ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                                            EXCEL
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-64 text-center">
                                    {selectedSeccional === 'ALL' ? (
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Database className="w-12 h-12 mx-auto mb-2 text-primary" />
                                            <p className="font-medium uppercase text-xs tracking-widest text-center">Selecciona una seccional arriba para comenzar.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Database className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                                            <p className="font-medium uppercase text-xs tracking-widest text-center">No se encontraron locales.</p>
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
      </Card>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, User as UserIcon, Loader2, MapPin, Printer, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface UserData {
  id: string;
  name: string;
  role: string;
  seccionales?: string[];
}

interface VotoSeguroData {
  id: string;
  CEDULA: number | string;
  NOMBRE: string;
  APELLIDO: string;
  CODIGO_SEC?: string | number;
  SECCIONAL?: string | number;
  LOCAL?: string;
  DESC_LOCAL?: string;
  MESA?: string | number;
  ORDEN?: string | number;
  TELEFONO?: string;
  TELEFONO_MIGRADO?: string;
  registradoPor_id?: string;
  registradoPor_nombre?: string;
}

const loadImage = (url: string) => {
  return new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
  });
};

export default function ImprimirListadoDirigentePage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDirigente, setSelectedDirigente] = useState<UserData | null>(null);
  
  const [votos, setVotos] = useState<VotoSeguroData[]>([]);
  const [isLoadingVotos, setIsLoadingVotos] = useState(false);

  const isAllowed = user?.role === 'Super-Admin' || user?.role === 'Admin' || user?.role === 'Presidente' || user?.role === 'Coordinador';

  // Fetch all users to allow searching
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isAllowed) return null;
    return query(collection(db, 'users'));
  }, [db, isAllowed]);

  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserData>(usersQuery);

  const localesQuery = useMemoFirebase(() => {
    if (!db || !isAllowed) return null;
    return query(collection(db, 'locales_votacion'));
  }, [db, isAllowed]);
  
  const { data: allLocales } = useCollection<any>(localesQuery);
  
  const localToSeccionalMap = useMemo(() => {
      const map: Record<string, string> = {};
      if (allLocales) {
          allLocales.forEach((l: any) => {
              const normLocal = String(l.nombre || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
              if (normLocal && l.seccional_id) {
                  map[normLocal] = String(l.seccional_id).trim();
              }
          });
      }
      return map;
  }, [allLocales]);

  const dirigentesPorSeccional = useMemo(() => {
    if (!allUsers) return {};
    const groups: Record<string, UserData[]> = {};
    
    allUsers.forEach(u => {
      if (['Dirigente', 'Coordinador', 'Presidente', 'Admin', 'Super-Admin'].includes(u.role)) {
        const secs = u.seccionales && u.seccionales.length > 0 ? u.seccionales : ['SIN SECCIONAL'];
        secs.forEach(sec => {
          const secStr = String(sec).toUpperCase().replace('SECCIONAL', '').trim();
          const key = secStr === 'SIN SECCIONAL' ? 'SIN SECCIONAL' : `SECCIONAL ${secStr}`;
          
          // Prevenir duplicados (ya que un usuario multi-seccional puede tener la misma seccional repetida o la lógica de arriba agrupar mal si no validamos el ID)
          if (!groups[key]) groups[key] = [];
          if (!groups[key].find(existingUser => existingUser.id === u.id)) {
            groups[key].push(u);
          }
        });
      }
    });

    Object.keys(groups).forEach(k => {
      groups[k].sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    });

    return groups;
  }, [allUsers]);

  useEffect(() => {
    if (selectedDirigente && db) {
      fetchVotos(selectedDirigente);
    } else {
      setVotos([]);
    }
  }, [selectedDirigente, db]);

  const fetchVotos = async (dirigente: UserData) => {
    if (!db) return;
    setIsLoadingVotos(true);
    try {
      const q = query(
        collection(db, 'votos_confirmados'),
        where('registradoPor_id', '==', dirigente.id),
        orderBy('APELLIDO', 'asc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VotoSeguroData));
      setVotos(data);
    } catch (error) {
      console.error(error);
      toast({ title: "Error al cargar votos", variant: "destructive" });
    } finally {
      setIsLoadingVotos(false);
    }
  };

  const groupedVotos = useMemo(() => {
    const groups: Record<string, VotoSeguroData[]> = {};
    votos.forEach(v => {
      const local = String(v.DESC_LOCAL || v.LOCAL || 'SIN LOCAL ESPECIFICADO').trim().toUpperCase();

      if (!groups[local]) {
        groups[local] = [];
      }
      groups[local].push(v);
    });

    // Ordenar locales alfabéticamente
    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    const sortedGroups: Record<string, VotoSeguroData[]> = {};
    
    sortedKeys.forEach(k => {
        // Ordenar votos por apellido dentro de cada local
        sortedGroups[k] = groups[k].sort((a,b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));
    });

    return sortedGroups;
  }, [votos, localToSeccionalMap]);

  const exportPDF = async () => {
    if (!selectedDirigente || votos.length === 0) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      let logoIzquierdo: any = null;
      let leftWidth = 0, leftHeight = 18;
      let logoDerecho: any = null;
      let rightWidth = 0, rightHeight = 18;

      try {
          logoIzquierdo = await loadImage('/logo_derecho.png');
          if (logoIzquierdo) leftWidth = leftHeight * (logoIzquierdo.width / logoIzquierdo.height);

          logoDerecho = await loadImage('/logo_izquierdo.png');
          if (logoDerecho) rightWidth = rightHeight * (logoDerecho.width / logoDerecho.height);
      } catch (e) {
          console.log("No se pudieron cargar los logos", e);
      }

      let currentY = 20;

      // Dibujar logos en la primera página
      if (logoIzquierdo) doc.addImage(logoIzquierdo, 'PNG', 14, 10, leftWidth, leftHeight);
      if (logoDerecho) doc.addImage(logoDerecho, 'PNG', pageWidth - 14 - rightWidth, 10, rightWidth, rightHeight);

      // Ajustar currentY debajo de los logos si es necesario
      currentY = Math.max(currentY, 10 + leftHeight + 10);

      doc.setFontSize(18);
      doc.setTextColor(20, 20, 20);
      doc.text(`Listado de Votos Seguros`, 14, currentY);
      
      currentY += 8;
      doc.setFontSize(14);
      doc.setTextColor(50, 50, 50);
      doc.text(`Dirigente: ${selectedDirigente.name}`, 14, currentY);

      currentY += 6;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, currentY);
      doc.text(`Total de electores: ${votos.length}`, 120, currentY);

      currentY += 10;

      Object.entries(groupedVotos).forEach(([local, localVotos], index) => {
        // Añadir página si no hay espacio para el título del local
        if (currentY > 260) {
            doc.addPage();
            currentY = 20;
        }

        // Título del Local
        const normLocal = local.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const configuredSeccional = localToSeccionalMap[normLocal];
        const seccionalLocal = configuredSeccional || localVotos[0]?.CODIGO_SEC || localVotos[0]?.SECCIONAL || 'N/A';
        
        doc.setFontSize(9);
        doc.setTextColor(180, 0, 0); // Rojo
        doc.setFont("helvetica", "bold");
        doc.text(`SECCIONAL ${seccionalLocal} - LOCAL: ${local} (Total: ${localVotos.length})`, 14, currentY);
        currentY += 4;

        const tableColumn = ["SECC", "Mesa / Orden", "Cédula", "Nombre y Apellido", "Teléfono"];
        const tableRows: any[] = [];

        localVotos.forEach(row => {
            const tableRow = [
                row.CODIGO_SEC || row.SECCIONAL || '',
                `M: ${row.MESA || ''} / O: ${row.ORDEN || ''}`,
                row.CEDULA || '',
                `${row.NOMBRE || ''} ${row.APELLIDO || ''}`.trim(),
                row.TELEFONO_MIGRADO || row.TELEFONO || ''
            ];
            tableRows.push(tableRow);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [252, 252, 252] },
            styles: { fontSize: 8 },
            margin: { left: 14, right: 14 },
            didDrawPage: (data) => {
                // Actualizar currentY después de dibujar la tabla para el siguiente local
                currentY = data.cursor ? data.cursor.y + 10 : currentY + 10;
            }
        });
        
        // autoTable didDrawPage might not update currentY correctly for the last table in loop
        // We get the final Y position from the document
        currentY = (doc as any).lastAutoTable.finalY + 10;
      });

      const filename = `LISTADO_${selectedDirigente.name.replace(/[^a-zA-Z0-9]/g, '_').trim()}.pdf`;
      doc.save(filename);
      toast({ title: `PDF Exportado con éxito` });
    } catch (error) {
      console.error(error);
      toast({ title: "Error al generar el PDF", variant: "destructive" });
    }
  };

  const exportExcel = () => {
    if (!selectedDirigente || votos.length === 0) return;

    try {
      const dataForExcel: any[] = [];

      Object.entries(groupedVotos).forEach(([local, localVotos]) => {
        localVotos.forEach(row => {
          dataForExcel.push({
            'DIRIGENTE': selectedDirigente.name,
            'LOCAL': local,
            'SECCIONAL': row.CODIGO_SEC || row.SECCIONAL || '',
            'MESA': row.MESA || '',
            'ORDEN': row.ORDEN || '',
            'CEDULA': row.CEDULA || '',
            'NOMBRE Y APELLIDO': `${row.NOMBRE || ''} ${row.APELLIDO || ''}`.trim(),
            'TELEFONO': row.TELEFONO_MIGRADO || row.TELEFONO || ''
          });
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Votos");

      const filename = `LISTADO_${selectedDirigente.name.replace(/[^a-zA-Z0-9]/g, '_').trim()}.xlsx`;
      XLSX.writeFile(workbook, filename);
      
      toast({ title: `Excel Exportado con éxito` });
    } catch (error) {
      console.error(error);
      toast({ title: "Error al generar el Excel", variant: "destructive" });
    }
  };

  if (!user || !isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center p-8 space-y-6">
        <div className="h-20 w-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100">
          <Printer className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-black uppercase text-slate-800">Acceso Restringido</h2>
        <p className="text-muted-foreground text-sm font-medium">Esta herramienta está habilitada para Administradores y Coordinadores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 p-4 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <Printer className="h-6 w-6 text-primary" />
            Imprimir Listado Dirigente
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Busca un dirigente e imprime su listado de votos estructurado por Locales de Votación.
          </p>
        </div>
      </div>

      {selectedDirigente && (
        <Card className="border-primary/10 shadow-sm rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 ring-2 ring-primary/20">
          <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6 flex flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-black uppercase text-primary">Vista Previa: {selectedDirigente.name}</CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground mt-1">
                Total de votos registrados: {votos.length}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button variant="outline" onClick={() => setSelectedDirigente(null)} className="h-10 px-4 font-black uppercase gap-2 text-xs">
                    Cerrar
                </Button>
                {votos.length > 0 && (
                    <>
                        <Button onClick={exportExcel} variant="secondary" className="h-10 px-6 font-black uppercase gap-2 shadow-md text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                            <Download className="h-4 w-4" />
                            Excel
                        </Button>
                        <Button onClick={exportPDF} className="h-10 px-6 font-black uppercase gap-2 shadow-md text-xs">
                            <FileText className="h-4 w-4" />
                            PDF
                        </Button>
                    </>
                )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 p-0">
            {isLoadingVotos ? (
              <div className="p-10 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground animate-pulse">Obteniendo listado de votos...</p>
              </div>
            ) : votos.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-bold text-muted-foreground">Este dirigente no tiene votos registrados aún.</p>
              </div>
            ) : (
              <div className="bg-slate-50/50">
                {Object.entries(groupedVotos).map(([local, localVotos]) => (
                    <div key={local} className="mb-6 border-b border-slate-200 last:border-0 pb-6 last:pb-0">
                        <div className="bg-slate-100/80 px-6 py-3 border-y border-slate-200 flex items-center justify-between sticky top-0 z-10">
                            <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-red-500" />
                                {local}
                            </h3>
                            <Badge variant="outline" className="bg-white text-[10px] font-black">
                                {localVotos.length} ELECTORES
                            </Badge>
                        </div>
                        <div className="px-6 pt-4 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="text-[10px] font-black uppercase bg-transparent hover:bg-transparent">
                                        <TableHead className="w-[80px]">SECC</TableHead>
                                        <TableHead className="w-[120px]">Mesa/Orden</TableHead>
                                        <TableHead className="w-[100px]">Cédula</TableHead>
                                        <TableHead>Nombre y Apellido</TableHead>
                                        <TableHead className="w-[120px]">Teléfono</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {localVotos.map(v => (
                                        <TableRow key={v.id} className="text-xs hover:bg-white">
                                            <TableCell className="font-bold">{v.CODIGO_SEC || v.SECCIONAL}</TableCell>
                                            <TableCell className="font-bold text-primary">M: {v.MESA} / O: {v.ORDEN}</TableCell>
                                            <TableCell className="font-mono">{v.CEDULA}</TableCell>
                                            <TableCell className="font-black uppercase">{v.NOMBRE} {v.APELLIDO}</TableCell>
                                            <TableCell className="font-bold text-muted-foreground">{v.TELEFONO_MIGRADO || v.TELEFONO}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={`border-primary/10 shadow-sm rounded-3xl transition-all duration-300 ${selectedDirigente ? 'opacity-50 pointer-events-none' : ''}`}>
        <CardHeader className="bg-muted/30 border-b border-primary/5 pb-6 rounded-t-3xl">
          <CardTitle className="text-sm font-black uppercase text-primary">1. Seleccionar Dirigente</CardTitle>
          <CardDescription className="text-xs font-bold text-muted-foreground">Escribe el nombre o selecciona del listado por seccional.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar dirigente por nombre..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 font-bold uppercase"
            />
          </div>

          {isLoadingUsers ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-bold text-muted-foreground">Cargando dirigentes...</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {Object.entries(dirigentesPorSeccional)
                .sort((a, b) => {
                  if (a[0] === 'SIN SECCIONAL') return 1;
                  if (b[0] === 'SIN SECCIONAL') return -1;
                  return a[0].localeCompare(b[0], undefined, { numeric: true });
                })
                .map(([sec, dirigentes]) => {
                  const q = searchQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                  const filteredDirigentes = q 
                    ? dirigentes.filter(d => (d.name || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q))
                    : dirigentes;

                  if (filteredDirigentes.length === 0) return null;

                  return (
                    <AccordionItem value={sec} key={sec} className="border border-primary/10 rounded-2xl bg-white shadow-sm overflow-hidden px-2">
                      <AccordionTrigger className="hover:no-underline hover:bg-muted/30 px-4 py-4 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-primary" />
                          <span className="font-black text-slate-800 uppercase">{sec}</span>
                          <Badge variant="secondary" className="ml-2 text-[10px] bg-primary/10 text-primary hover:bg-primary/20">{filteredDirigentes.length} DIRIGENTES</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 px-2 pb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {filteredDirigentes.map(u => (
                            <div 
                              key={u.id}
                              onClick={() => {
                                setSelectedDirigente(u);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between shadow-sm hover:shadow-md ${selectedDirigente?.id === u.id ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 hover:border-primary/30'}`}
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase line-clamp-1">{u.name}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{u.role}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

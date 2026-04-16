
"use client";

import { useState, useMemo } from 'react';
import { collection, doc, updateDoc, deleteDoc, getCountFromServer, query, limit, orderBy } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useAuth } from '@/hooks/use-auth';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookHeart, FileDown, User as UserIcon, Trash2, Loader2, Smartphone, MapPin, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';

interface VotoSeguroData {
  id: string;
  CEDULA: number | string;
  NOMBRE: string;
  APELLIDO: string;
  CODIGO_SEC?: string | number;
  LOCAL?: string;
  MESA?: string | number;
  ORDEN?: string | number;
  TELEFONO?: string;
  registradoPor_id?: string;
  registradoPor_nombre?: string;
  [key: string]: any;
}

interface GroupedVotos {
  [userName: string]: {
    userId: string;
    seccional: string;
    votos: VotoSeguroData[];
  };
}

export default function VotoSeguroPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [votoToDelete, setVotoToDelete] = useState<VotoSeguroData | null>(null);
  const [isFilenameDialogOpen, setIsFilenameDialogOpen] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [limitCount, setLimitCount] = useState(50);
  const [refreshKey, setRefreshKey] = useState(0);

  // ESCUCHADOR EN TIEMPO REAL A LA COLECCIÓN DE CAPTURAS CON LÍMITE
  const registeredQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
        collection(db, 'votos_confirmados'),
        orderBy('APELLIDO', 'asc'),
        limit(limitCount)
    );
  }, [db, user, limitCount, refreshKey]);

  const { data: rawList, isLoading } = useCollection<VotoSeguroData>(registeredQuery);

  // CONTEO EFICIENTE DESDE EL SERVIDOR (PLAN BLAZE OPTIMIZADO)
  useState(() => {
    if (!db) return;
    getCountFromServer(collection(db, 'votos_confirmados')).then(snap => {
        setTotalCount(snap.data().count);
    });
  });

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente';
  const isCoordinador = user?.role === 'Coordinador';
  const isDirigente = user?.role === 'Dirigente';
  const userSeccionales = useMemo(() => user?.seccionales || [], [user]);

  // FILTRADO POR ROLES Y JURISDICCIÓN
  const filteredList = useMemo(() => {
    if (!rawList || !user) return [];
    
    if (isAdmin) return rawList;

    if (isCoordinador) {
        return rawList.filter(item => {
            const itemSec = String(item.CODIGO_SEC || '');
            return userSeccionales.includes(itemSec);
        });
    }

    if (isDirigente) {
        return rawList.filter(item => item.registradoPor_id === user.id);
    }

    return [];
  }, [rawList, user, isAdmin, isCoordinador, isDirigente, userSeccionales]);

  // AGRUPAMIENTO POR USUARIO CON CÍRCULO DE SECCIONAL
  const groupedData = useMemo(() => {
    const groups: GroupedVotos = {};
    filteredList.forEach(voto => {
        const userName = voto.registradoPor_nombre || 'USUARIO DESCONOCIDO';
        const userId = voto.registradoPor_id || 'unknown';
        const itemSecc = String(voto.CODIGO_SEC || '');

        if (!groups[userName]) {
            groups[userName] = { userId, seccional: itemSecc, votos: [] };
        }
        groups[userName].votos.push(voto);
    });

    const sorted: GroupedVotos = {};
    Object.keys(groups).sort().forEach(k => {
        groups[k].votos.sort((a,b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));
        sorted[k] = groups[k];
    });
    return sorted;
  }, [filteredList]);

  const executeExportCSV = async (filename: string) => {
    if (filteredList.length === 0) return;
    setIsExporting(true);
    try {
        const headers = ['SECC', 'LOCAL', 'MESA', 'ORDEN', 'CEDULA', 'NOMBRE', 'APELLIDO', 'TELEFONO'].join(';');
        let csvContent = "\uFEFF" + headers + "\n";
        filteredList.forEach(row => {
            const line = [row.CODIGO_SEC, row.LOCAL, row.MESA, row.ORDEN, row.CEDULA, row.NOMBRE, row.APELLIDO, row.TELEFONO]
                .map(v => `"${String(v || '').replace(/;/g, ' ').toUpperCase()}"`).join(';');
            csvContent += line + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement('a'));
        link.href = URL.createObjectURL(blob);
        link.download = (filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'VOTOS_SEGUROS') + '.csv';
        link.click();
        document.body.removeChild(link);
        toast({ title: "Exportación exitosa" });
        setIsFilenameDialogOpen(false);
    } finally { setIsExporting(false); }
  };

  const handleDelete = async () => {
    if (!votoToDelete || !db || !user) return;
    setIsDeleting(true);
    const docRef = doc(db, 'votos_confirmados', votoToDelete.id);
    const padronRef = doc(db, 'sheet1', votoToDelete.id);

    Promise.all([
        deleteDoc(docRef),
        updateDoc(padronRef, { observacion: null })
    ]).then(() => { 
        logAction(db, { userId: user.id, userName: user.name, module: 'VOTO SEGURO', action: 'ELIMINÓ VOTO SEGURO', targetName: `${votoToDelete.NOMBRE}` });
        toast({ title: 'Registro eliminado' }); 
    }).finally(() => { setIsDeleting(false); setIsAlertOpen(false); setVotoToDelete(null); });
  };

  const renderTable = (items: VotoSeguroData[]) => (
    <div className="overflow-x-auto">
        <Table>
            <TableHeader><TableRow className="bg-muted/50 text-[10px] font-black uppercase"><TableHead className="w-[100px] text-center">Cédula</TableHead><TableHead>Elector</TableHead><TableHead className="text-center">SECC</TableHead><TableHead>Local / Mesa</TableHead><TableHead>Teléfono</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
            <TableBody>
                {items.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-[10px] text-center">{p.CEDULA}</TableCell>
                        <TableCell className="font-black text-[11px] uppercase">{p.NOMBRE} {p.APELLIDO}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[9px] font-black border-primary/10">SECC {p.CODIGO_SEC}</Badge></TableCell>
                        <TableCell className="text-[10px] uppercase">
                            <div>{p.LOCAL}</div>
                            <div className="text-primary font-bold">M: {p.MESA} / O: {p.ORDEN}</div>
                        </TableCell>
                        <TableCell className="text-[11px] font-bold text-green-700">{p.TELEFONO || '---'}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => { setVotoToDelete(p); setIsAlertOpen(true); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><BookHeart className="h-8 w-8 text-primary" /> Listado de Voto Seguro</h1><p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Control optimizado de captación por operador.</p></div>
        <div className="flex gap-2">
            <Button onClick={() => setRefreshKey(v => v + 1)} variant="outline" className="font-black uppercase text-[10px] h-9 border-primary/20"><Loader2 className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} /> REFRESCAR</Button>
            <Button onClick={() => setIsFilenameDialogOpen(true)} disabled={filteredList.length === 0 || isExporting} variant="default" className="font-black uppercase text-[10px] h-9 shadow-lg"><FileDown className="mr-2 h-4 w-4" /> EXPORTAR VISTA</Button>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-[11px] font-black uppercase">Resumen de Capturas</CardTitle>
                    <Badge className="bg-primary font-black text-[10px] uppercase tracking-widest px-3 py-1">
                        {totalCount !== null ? `${totalCount} TOTALES` : filteredList.length + ' CARGADOS'}
                    </Badge>
                </div>
                {totalCount !== null && totalCount > limitCount && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setLimitCount(prev => prev + 50)}
                        className="h-8 font-black text-[9px] uppercase border-primary/20 hover:bg-primary/5"
                    >
                        Cargar más (+50)
                    </Button>
                )}
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : 
            Object.keys(groupedData).length > 0 ? (
                <div className="p-4">
                    <Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(groupedData).map(([userName, userData]) => (
                            <AccordionItem key={userName} value={userName} className="border rounded-xl px-4 bg-muted/5">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/5"><UserIcon className="h-4 w-4 text-primary" /></div>
                                        <div className="flex items-center gap-2 flex-1 text-left">
                                            <span className="font-black text-xs uppercase text-slate-900">{userName}</span>
                                            {userData.seccional && <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[8px] font-black text-white shadow-sm ring-2 ring-white">{userData.seccional}</div>}
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] font-black bg-white shrink-0">{userData.votos.length} Votos</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4"><div className="border rounded-lg bg-white overflow-hidden shadow-sm">{renderTable(userData.votos)}</div></AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            ) : <div className="text-center py-24 opacity-30"><BookHeart className="w-16 h-16 mx-auto mb-2 text-primary" /><p className="font-black uppercase text-xs tracking-widest">Sin registros capturados en tu zona</p></div>}
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-3 flex justify-between items-center px-6"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">SISTEMA DE GESTIÓN ESTRATÉGICA - LISTA 2P OPCION 2</p><Badge variant="outline" className="text-[9px] font-black border-primary/10">NÚCLEO v5.2</Badge></CardFooter>
      </Card>

      <Dialog open={isFilenameDialogOpen} onOpenChange={setIsFilenameDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3"><FileDown className="h-6 w-6 text-primary" /> Exportar Planilla</DialogTitle></DialogHeader>
            <div className="py-4"><Label className="text-[10px] font-black uppercase mb-2 block">Nombre del Reporte</Label><Input value={customFilename} onChange={(e) => setCustomFilename(e.target.value.toUpperCase())} className="font-black h-12 uppercase" placeholder="VOTOS_SEGUROS" autoFocus /></div>
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsFilenameDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</Button><Button onClick={() => executeExportCSV(customFilename)} disabled={!customFilename.trim() || isExporting} className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg">{isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} DESCARGAR EXCEL</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase text-xl">¿ELIMINAR MARCA?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-black uppercase text-xs h-11 rounded-xl">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-6 rounded-xl">{isDeleting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />} ELIMINAR</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

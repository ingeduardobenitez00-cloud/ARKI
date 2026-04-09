
"use client";

import { useState, useMemo } from 'react';
import { collection, query, limit, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollectionOnce } from '@/firebase/firestore/use-collection-once';
import { useAuth } from '@/hooks/use-auth';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookCheck, User as UserIcon, CheckCircle2, Circle, RefreshCw, Smartphone, MapPin, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  estado_votacion?: string;
  registradoPor_id?: string;
  registradoPor_nombre?: string;
  [key: string]: any;
}

interface GroupedReport {
  [userName: string]: {
    userId: string;
    seccional: string;
    votos: VotoSeguroData[];
    votosEfectuados: number;
  };
}

export default function ReportesPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const [totalCaptures, setTotalCaptures] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. ESCUCHADOR EN TIEMPO REAL CON LÍMITE PARA ESTABILIDAD DE COSTOS
  const registeredQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'votos_confirmados'), limit(300));
  }, [db, user, refreshKey]);

  const { data: rawList, isLoading } = useCollectionOnce<VotoSeguroData>(registeredQuery);

  // CONTEO GLOBAL DESDE EL SERVIDOR
  useState(() => {
    if (!db) return;
    getCountFromServer(collection(db, 'votos_confirmados')).then((snap: any) => {
        setTotalCaptures(snap.data().count);
    });
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente';
  const isCoordinador = user?.role === 'Coordinador';
  const isDirigente = user?.role === 'Dirigente';
  const userSeccionales = useMemo(() => user?.seccionales || [], [user]);

  // 2. FILTRADO POR ROLES Y JURISDICCIÓN
  const filteredList = useMemo(() => {
    if (!rawList || !user) return [];
    
    if (isAdmin) return rawList;

    if (isCoordinador) {
        return rawList.filter((item: VotoSeguroData) => {
            const itemSec = String(item.CODIGO_SEC || '');
            return userSeccionales.includes(itemSec);
        });
    }

    if (isDirigente) {
        return rawList.filter((item: VotoSeguroData) => item.registradoPor_id === user.id);
    }

    return [];
  }, [rawList, user, isAdmin, isCoordinador, isDirigente, userSeccionales]);

  // 3. AGRUPAMIENTO POR USUARIO CON CÁLCULO DE PARTICIPACIÓN
  const groupedData = useMemo(() => {
    const groups: GroupedReport = {};
    filteredList.forEach((voto: VotoSeguroData) => {
        const userName = voto.registradoPor_nombre || 'USUARIO DESCONOCIDO';
        const userId = voto.registradoPor_id || 'unknown';
        const itemSecc = String(voto.CODIGO_SEC || '');
        const yaVoto = voto.estado_votacion === 'Ya Votó';

        if (!groups[userName]) {
            groups[userName] = { userId, seccional: itemSecc, votos: [], votosEfectuados: 0 };
        }
        groups[userName].votos.push(voto);
        if (yaVoto) groups[userName].votosEfectuados += 1;
    });

    const sorted: GroupedReport = {};
    Object.keys(groups).sort().forEach(k => {
        groups[k].votos.sort((a,b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));
        sorted[k] = groups[k];
    });
    return sorted;
  }, [filteredList]);

  const renderTable = (items: VotoSeguroData[]) => (
    <div className="overflow-x-auto">
        <Table>
            <TableHeader><TableRow className="bg-muted/50 text-[10px] font-black uppercase"><TableHead className="w-[100px] text-center">Cédula</TableHead><TableHead>Elector</TableHead><TableHead className="text-center">SECC</TableHead><TableHead>Local / Mesa</TableHead><TableHead className="text-center">Participó?</TableHead></TableRow></TableHeader>
            <TableBody>
                {items.map((p) => {
                    const haVotado = p.estado_votacion === 'Ya Votó';
                    return (
                        <TableRow key={p.id} className={cn("transition-colors", haVotado ? "bg-green-50/30" : "hover:bg-muted/20")}>
                            <TableCell className="font-mono text-[10px] text-center font-bold text-slate-600">{p.CEDULA}</TableCell>
                            <TableCell className="font-black text-[11px] uppercase">{p.NOMBRE} {p.APELLIDO}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="text-[9px] font-black border-primary/10">SECC {p.CODIGO_SEC}</Badge></TableCell>
                            <TableCell className="text-[10px] uppercase">
                                <div>{p.LOCAL}</div>
                                <div className="text-primary font-bold">M: {p.MESA} / O: {p.ORDEN}</div>
                            </TableCell>
                            <TableCell className="text-center">
                                {haVotado ? (
                                    <Badge className="bg-green-600 font-black text-[8px] uppercase tracking-tighter gap-1">
                                        <CheckCircle2 className="h-2.5 w-2.5" /> YA VOTÓ
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-slate-400 font-black text-[8px] uppercase tracking-tighter gap-1">
                                        <Circle className="h-2.5 w-2.5" /> PENDIENTE
                                    </Badge>
                                )}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><BookCheck className="h-8 w-8 text-primary" /> Reporte de Gestión Territorial</h1><p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Control de participación real de votos seguros.</p></div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
                <CardTitle className="text-[11px] font-black uppercase">Resumen de Capturas</CardTitle>
                <Badge className="bg-primary font-black text-[10px] uppercase tracking-widest px-3 py-1">
                    {totalCaptures !== null ? `${totalCaptures} CAPTURAS TOTALES` : (filteredList.length + ' CARGADAS')}
                </Badge>
                {totalCaptures !== null && totalCaptures > 300 && (
                    <span className="text-[9px] font-bold text-orange-600 uppercase">Mostrando últimos 300 (Usa filtros para más detalle)</span>
                )}
            </div>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={isLoading}
                className="h-8 gap-2 text-[10px] font-black uppercase hover:bg-primary/5 text-primary"
            >
                <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                Actualizar
            </Button>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : 
            Object.keys(groupedData).length > 0 ? (
                <div className="p-4">
                    <Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(groupedData).map(([userName, userData]) => {
                            const pendientes = userData.votos.length - userData.votosEfectuados;
                            return (
                                <AccordionItem key={userName} value={userName} className="border rounded-xl px-4 bg-muted/5">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/5"><UserIcon className="h-4 w-4 text-primary" /></div>
                                            <div className="flex items-center gap-2 flex-1 text-left">
                                                <span className="font-black text-xs uppercase text-slate-900">{userName}</span>
                                                {userData.seccional && <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[8px] font-black text-white shadow-sm ring-2 ring-white">{userData.seccional}</div>}
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <Badge variant="outline" className="text-[9px] font-black bg-white">{userData.votos.length} TOTAL</Badge>
                                                <Badge className="text-[9px] font-black bg-green-600">{userData.votosEfectuados} VOTARON</Badge>
                                                <Badge className="text-[9px] font-black bg-orange-500 text-white">{pendientes} PENDIENTES</Badge>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-4"><div className="border rounded-lg bg-white overflow-hidden shadow-sm">{renderTable(userData.votos)}</div></AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>
            ) : <div className="text-center py-24 opacity-30"><BookCheck className="w-16 h-16 mx-auto mb-2 text-primary" /><p className="font-black uppercase text-xs tracking-widest">Sin registros capturados para reportar</p></div>}
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-3 flex justify-between items-center px-6"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">SISTEMA DE GESTIÓN ESTRATÉGICA - LISTA 2P OPCION 2</p><Badge variant="outline" className="text-[9px] font-black border-primary/10">NÚCLEO v5.2</Badge></CardFooter>
      </Card>
    </div>
  );
}

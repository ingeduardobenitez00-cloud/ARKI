
"use client";

import { useState, useMemo, useEffect } from 'react';
import { collection, query, getCountFromServer, where, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useAuth } from '@/hooks/use-auth';

import { useToast } from '@/hooks/use-toast';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookCheck, User as UserIcon, CheckCircle2, Circle, RefreshCw, Smartphone, MapPin, Hash, Loader2, DatabaseZap, Search } from 'lucide-react';
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

interface GroupedBySeccional {
  [seccional: string]: {
    seccionalName: string;
    totalVotos: number;
    totalVotaron: number;
    dirigentes: {
      [userName: string]: {
        userId: string;
        votos: VotoSeguroData[];
        votosEfectuados: number;
      }
    }
  }
}

export default function ReportesPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [totalCaptures, setTotalCaptures] = useState<number | null>(null);
  const [totalVotaronGlobal, setTotalVotaronGlobal] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
  const isPresidente = user?.role === 'Presidente';
  const isCoordinador = user?.role === 'Coordinador';
  const isDirigente = user?.role === 'Dirigente';
  const userSeccionales = useMemo(() => user?.seccionales || [], [user]);

  // 1. ESCUCHADOR EN TIEMPO REAL OPTIMIZADO POR ROL PARA ESTABILIDAD DE COSTOS
  const registeredQuery = useMemoFirebase(() => {
    if (!db || !user) return null;

    if (isDirigente) {
      // El Dirigente solo descarga sus propios votos seguros (sin límite bajo para garantizar carga completa)
      return query(
        collection(db, 'votos_confirmados'),
        where('registradoPor_id', '==', user.id),
        orderBy('APELLIDO', 'asc')
      );
    }

    // Coordinadores, Presidentes, Admins o PC Central descargan de manera fluida y sin límites.
    // Se remueve la llamada a 'limit' por completo, lo que permite traer 20,000 o más registros sin restricciones del servidor de Firebase.
    return query(
      collection(db, 'votos_confirmados'),
      orderBy('APELLIDO', 'asc')
    );
  }, [db, user, isDirigente, isCoordinador, isPresidente, userSeccionales, refreshKey]);

  const { data: rawList, isLoading } = useCollection<VotoSeguroData>(registeredQuery);

  // ESCUCHADOR EN TIEMPO REAL A LOS USUARIOS PARA JURISDICCIÓN DE OPERADORES
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'users'));
  }, [db, user]);

  const { data: allUsers } = useCollection<any>(usersQuery);

  const userSeccionalesMap = useMemo(() => {
    if (!allUsers || !userSeccionales.length) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    allUsers.forEach((u: any) => {
      const rawSecc = u.seccionales || (u.seccional ? [u.seccional] : []);
      const userSecs = rawSecc.map((s: any) => String(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(SECCIONAL|SECCION\.|SECCION|SECC\.|SECC|SEC\.|SEC)\s*/g, '').trim());
      const hasOverlap = userSecs.some((s: string) => userSeccionales.includes(s));
      if (hasOverlap) {
        map.set(u.id, userSecs);
      }
    });
    return map;
  }, [allUsers, userSeccionales]);

  // CONTEO GLOBAL DESDE EL SERVIDOR
  useEffect(() => {
    if (!db) return;
    getCountFromServer(collection(db, 'votos_confirmados')).then((snap: any) => {
        setTotalCaptures(snap.data().count);
    });
    getCountFromServer(query(collection(db, 'votos_confirmados'), where('estado_votacion', '==', 'Ya Votó'))).then((snap: any) => {
        setTotalVotaronGlobal(snap.data().count);
    });
  }, [db, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSyncETR = async () => {
    setIsSyncing(true);
    try {
        const response = await fetch('/api/etr/sync', {
            method: 'POST',
        });
        const data = await response.json();
        
        if (data.success && data.votedCedulas) {
            if (!db) throw new Error("No hay conexión a la base de datos local");
            
            const votedSet = new Set(data.votedCedulas.map(String));
            let updateCount = 0;
            let currentBatchSize = 0;
            let batch = writeBatch(db);
            const commitPromises = [];

            // Leer todos los votos confirmados locales
            const snap = await getDocs(collection(db, 'votos_confirmados'));
            snap.docs.forEach(docSnap => {
                const docData = docSnap.data();
                const cedula = String(docData.CEDULA);
                // Si la cédula local está en la lista de los que ya votaron de ETR
                if (votedSet.has(cedula) && docData.estado_votacion !== 'Ya Votó') {
                    batch.update(docSnap.ref, { estado_votacion: 'Ya Votó', updatedAt: new Date().toISOString() });
                    updateCount++;
                    currentBatchSize++;
                    
                    if (currentBatchSize >= 450) {
                        commitPromises.push(batch.commit());
                        batch = writeBatch(db);
                        currentBatchSize = 0;
                    }
                }
            });

            if (currentBatchSize > 0) {
                commitPromises.push(batch.commit());
            }

            await Promise.all(commitPromises);

            toast({
                title: 'Sincronización Exitosa',
                description: `Se conectó al ETR y se actualizaron ${updateCount} registros locales.`,
            });
            handleRefresh(); // Recargar datos
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
    } catch (error: any) {
        toast({
            title: 'Error de Sincronización',
            description: error.message || 'No se pudo conectar con ETR.',
            variant: 'destructive'
        });
    } finally {
        setIsSyncing(false);
    }
  };

  // 2. FILTRADO POR ROLES Y JURISDICCIÓN
  const filteredList = useMemo(() => {
    if (!rawList || !user) return [];
    
    // PC Central ve TODO
    if (isAdmin) return rawList;

    const normalize = (nameStr?: string) => String(nameStr || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const myNormalizedName = normalize(user.name);
    const isGuillermoMe = myNormalizedName.includes("GUILLERMO") && myNormalizedName.includes("FERNANDEZ");

    const isMyRegistration = (item: VotoSeguroData) => {
        if (item.registradoPor_id === user.id) return true;
        const itemRegName = normalize(item.registradoPor_nombre);
        if (isGuillermoMe && itemRegName.includes("GUILLERMO") && itemRegName.includes("FERNANDEZ")) return true;
        return itemRegName === myNormalizedName;
    };

    // Presidentes y Coordinadores ven su JURISDICCIÓN o sus propios registros (filtro cliente)
    if (isPresidente || isCoordinador) {
        return rawList.filter((item: VotoSeguroData) => {
            const itemSec = String(item.CODIGO_SEC || '');
            const isFromMySeccional = userSeccionales.includes(itemSec);
            
            if (isFromMySeccional) return true;
            if (isMyRegistration(item)) return true;

            const registrarSecs = item.registradoPor_id ? userSeccionalesMap.get(item.registradoPor_id) : null;
            if (registrarSecs) {
                // Si el usuario es exclusivo de mi seccional (no es multiseccional), veo sus votos foráneos.
                // Si es multiseccional, solo veo sus votos si cayeron en mi seccional (lo cual ya se filtró arriba con isFromMySeccional).
                if (registrarSecs.length === 1) {
                    return true;
                }
            }
            return false;
        });
    }

    if (isDirigente) {
        return rawList.filter((item: VotoSeguroData) => isMyRegistration(item));
    }

    return [];
  }, [rawList, user, isAdmin, isCoordinador, isPresidente, isDirigente, userSeccionales, userSeccionalesMap]);

  const searchedList = useMemo(() => {
    if (!searchQuery.trim()) return filteredList;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return filteredList.filter((item: VotoSeguroData) => {
      const fullname = `${item.NOMBRE || ''} ${item.APELLIDO || ''}`.toLowerCase();
      const cedula = String(item.CEDULA || '').toLowerCase();
      const dirigenteName = (item.registradoPor_nombre || '').toLowerCase();
      return fullname.includes(lowerQuery) || cedula.includes(lowerQuery) || dirigenteName.includes(lowerQuery);
    });
  }, [filteredList, searchQuery]);

  // 3. AGRUPAMIENTO POR USUARIO CON CÁLCULO DE PARTICIPACIÓN
  const groupedData = useMemo(() => {
    const groups: GroupedBySeccional = {};
    searchedList.forEach((voto: VotoSeguroData) => {
        let userName = voto.registradoPor_nombre || 'USUARIO DESCONOCIDO';
        const userId = voto.registradoPor_id || 'unknown';
        const itemSecc = String(voto.CODIGO_SEC || 'SIN SECCIONAL');
        const yaVoto = voto.estado_votacion === 'Ya Votó';

        // Normalizar el nombre para agrupar variaciones (removiendo acentos, espacios y convirtiendo a mayúsculas)
        const normalized = userName
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();
        
        // Si el nombre contiene GUILLERMO y FERNANDEZ, usar la forma estándar "GUILLERMO FERNANDEZ"
        if (normalized.includes("GUILLERMO") && normalized.includes("FERNANDEZ")) {
            userName = "GUILLERMO FERNANDEZ";
        } else if (normalized.includes("GUILLEFER")) {
            userName = "GUILLERMO FERNANDEZ";
        }

        if (!groups[itemSecc]) {
            groups[itemSecc] = { seccionalName: itemSecc, totalVotos: 0, totalVotaron: 0, dirigentes: {} };
        }
        
        if (!groups[itemSecc].dirigentes[userName]) {
            groups[itemSecc].dirigentes[userName] = { userId, votos: [], votosEfectuados: 0 };
        }

        groups[itemSecc].dirigentes[userName].votos.push(voto);
        groups[itemSecc].totalVotos += 1;
        if (yaVoto) {
            groups[itemSecc].dirigentes[userName].votosEfectuados += 1;
            groups[itemSecc].totalVotaron += 1;
        }
    });

    const sortedGroups: GroupedBySeccional = {};
    Object.keys(groups)
        .sort((a, b) => {
            const secA = parseInt(a.replace(/\D/g, ''), 10) || 999999;
            const secB = parseInt(b.replace(/\D/g, ''), 10) || 999999;
            if (secA !== secB) return secA - secB;
            return a.localeCompare(b);
        })
        .forEach(secKey => {
            const secGroup = groups[secKey];
            const sortedDirigentes: typeof secGroup.dirigentes = {};
            
            Object.keys(secGroup.dirigentes)
                .sort((a, b) => a.localeCompare(b))
                .forEach(dirKey => {
                    const dirGroup = secGroup.dirigentes[dirKey];
                    dirGroup.votos.sort((a,b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));
                    sortedDirigentes[dirKey] = dirGroup;
                });
                
            sortedGroups[secKey] = { ...secGroup, dirigentes: sortedDirigentes };
        });
        
    return sortedGroups;
  }, [searchedList]);

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
        <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><BookCheck className="h-8 w-8 text-primary" /> Reporte de Carga de Votos Seguros</h1><p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Control de participación real de votos seguros.</p></div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-4 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <CardTitle className="text-[11px] font-black uppercase">Resumen de Capturas</CardTitle>
                    <Badge className="bg-primary font-black text-[10px] uppercase tracking-widest px-3 py-1">
                        {totalCaptures !== null ? `${totalCaptures} CAPTURAS TOTALES` : (filteredList.length + ' CARGADAS')}
                    </Badge>
                    {totalVotaronGlobal !== null && totalCaptures !== null && (
                        <>
                            <Badge className="bg-green-600 font-black text-[10px] uppercase tracking-widest px-3 py-1 text-white">
                                {totalVotaronGlobal} YA VOTARON
                            </Badge>
                            <Badge className="bg-orange-500 font-black text-[10px] uppercase tracking-widest px-3 py-1 text-white">
                                {totalCaptures - totalVotaronGlobal} PENDIENTES
                            </Badge>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {isAdmin && (
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleSyncETR} 
                            disabled={isSyncing || isLoading}
                            className="h-8 gap-2 text-[10px] font-black uppercase bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                        >
                            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <DatabaseZap className="h-3 w-3" />}
                            Sincronizar ETR
                        </Button>
                    )}
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleRefresh} 
                        disabled={isLoading || isSyncing}
                        className="h-8 gap-2 text-[10px] font-black uppercase hover:bg-primary/5 text-primary"
                    >
                        <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                        Actualizar
                    </Button>
                </div>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar por cédula, nombre o dirigente..." 
                    className="pl-9 bg-white border-primary/20 focus-visible:ring-primary/30 h-10 text-sm font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : 
            Object.keys(groupedData).length > 0 ? (
                <div className="p-4">
                    <Accordion type="multiple" className="w-full space-y-4">
                        {Object.entries(groupedData).map(([seccional, seccionalData]) => {
                            const pendientesSecc = seccionalData.totalVotos - seccionalData.totalVotaron;
                            const numDirigentes = Object.keys(seccionalData.dirigentes).length;
                            
                            return (
                                <AccordionItem key={`sec-${seccional}`} value={`sec-${seccional}`} className="border-2 border-primary/20 rounded-2xl px-4 bg-muted/10 shadow-sm overflow-hidden">
                                    <AccordionTrigger className="hover:no-underline py-5">
                                        <div className="flex items-center gap-4 w-full">
                                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-md">
                                                <span className="font-black text-white text-xs">{seccional === 'SIN SECCIONAL' ? '-' : `S${seccional}`}</span>
                                            </div>
                                            <div className="flex flex-col flex-1 text-left">
                                                <span className="font-black text-lg uppercase text-slate-900 tracking-tight">{seccional === 'SIN SECCIONAL' ? 'SIN SECCIONAL' : `SECCIONAL ${seccional}`}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{numDirigentes} {numDirigentes === 1 ? 'Dirigente' : 'Dirigentes'}</span>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <Badge variant="outline" className="text-sm font-black bg-white px-3 py-1.5">{seccionalData.totalVotos} TOTAL</Badge>
                                                <Badge className="text-sm font-black bg-green-600 px-3 py-1.5">{seccionalData.totalVotaron} VOTARON</Badge>
                                                <Badge className="text-sm font-black bg-orange-500 text-white px-3 py-1.5">{pendientesSecc} PENDIENTES</Badge>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-4">
                                        <div className="space-y-3 pl-2 pr-1 border-l-2 border-primary/10 ml-5">
                                            <Accordion type="multiple" className="w-full space-y-2">
                                                {Object.entries(seccionalData.dirigentes).map(([userName, userData]) => {
                                                    const pendientes = userData.votos.length - userData.votosEfectuados;
                                                    return (
                                                        <AccordionItem key={`dir-${userName}-${seccional}`} value={`dir-${userName}-${seccional}`} className="border rounded-xl px-4 bg-white shadow-sm">
                                                            <AccordionTrigger className="hover:no-underline py-4">
                                                                <div className="flex items-center gap-3 w-full">
                                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/5"><UserIcon className="h-4 w-4 text-primary" /></div>
                                                                    <div className="flex items-center gap-2 flex-1 text-left">
                                                                        <span className="font-black text-xs uppercase text-slate-900">{userName}</span>
                                                                    </div>
                                                                    <div className="flex gap-2 shrink-0">
                                                                        <Badge variant="outline" className="text-[9px] font-black bg-slate-50">{userData.votos.length} TOTAL</Badge>
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
                                    </AccordionContent>
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

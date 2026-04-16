
"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, RefreshCw, Layers, Lock, ShieldCheck, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const GlobalMapDisplay = dynamic(() => import('@/components/GlobalMapDisplay'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center flex-col gap-2">
    <Loader2 className="animate-spin h-10 w-10 text-primary" />
    <p className="text-sm font-medium animate-pulse uppercase tracking-widest">Cargando Mapa Territorial...</p>
  </div>
});

interface ElectorUbicado {
    id: string;
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    CODIGO_SEC?: string; // Normalizado como string para compatibilidad con mapa
    LATITUD: number;
    LONGITUD: number;
    registradoPor_nombre?: string;
    ubicadoPor_id?: string;
    registradoPor_id?: string;
    estado_votacion?: string;
    LOCAL?: string;
    MESA?: string | number;
    ORDEN?: string | number;
}

interface UserFilter {
    id: string;
    name: string;
    role: string;
    seccional?: string | number;
}

export default function MapaGlobalPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [seccionales, setSeccionales] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<UserFilter[]>([]);
    
    const [selectedSeccional, setSelectedSeccional] = useState('ALL');
    const [selectedCoordinador, setSelectedCoordinador] = useState('ALL');
    const [selectedDirigente, setSelectedDirigente] = useState('ALL');
    
    const [refreshKey, setRefreshKey] = useState(0);
    const [isLoadingFilters, setIsLoadingFilters] = useState(true);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente';
    const isCoordinador = user?.role === 'Coordinador';
    const isDirigente = user?.role === 'Dirigente';

    const pointsQuery = useMemoFirebase(() => {
        if (!db) return null;
        // Solo traemos los que tienen coordenadas. Límite de 1000 para seguridad de costos.
        return query(collection(db, 'votos_confirmados'), limit(1000));
    }, [db, refreshKey]);

    const { data: rawPoints, isLoading: isLoadingPoints } = useCollection<ElectorUbicado>(pointsQuery);

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
        toast({ title: "Actualizando puntos...", description: "Cargando datos desde el servidor." });
    };

    useEffect(() => {
        const fetchMetadata = async () => {
            if (!db) return;
            setIsLoadingFilters(true);
            try {
                const sSnap = await getDocs(collection(db, 'seccionales'));
                const sList = sSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
                sList.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), undefined, { numeric: true }));
                setSeccionales(sList);

                const uSnap = await getDocs(query(collection(db, 'users'), orderBy('name', 'asc')));
                const uList = uSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserFilter));
                setAllUsers(uList);

            } catch (e) {
                console.error("Error fetching map filters:", e);
            } finally {
                setIsLoadingFilters(false);
            }
        };
        fetchMetadata();
        
        if (user) {
            if (isCoordinador || isDirigente) {
                setSelectedSeccional(String(user.seccional || 'ALL'));
            }
            if (isDirigente) {
                setSelectedDirigente(user.id);
            }
        }
    }, [db, user, isCoordinador, isDirigente]);

    const filteredCoordinadores = useMemo(() => {
        return allUsers.filter(u => 
            u.role === 'Coordinador' && 
            (selectedSeccional === 'ALL' || String(u.seccional || '') === String(selectedSeccional))
        );
    }, [allUsers, selectedSeccional]);

    const filteredDirigentes = useMemo(() => {
        let baseDirigentes = allUsers.filter(u => u.role === 'Dirigente');
        
        if (selectedSeccional !== 'ALL') {
            baseDirigentes = baseDirigentes.filter(u => String(u.seccional || '') === String(selectedSeccional));
        }
        
        if (selectedCoordinador !== 'ALL') {
            const coord = allUsers.find(u => u.id === selectedCoordinador);
            if (coord && coord.seccional) {
                baseDirigentes = baseDirigentes.filter(u => String(u.seccional || '') === String(coord.seccional));
            }
        }

        return baseDirigentes;
    }, [allUsers, selectedSeccional, selectedCoordinador]);

    const filteredMarkers = useMemo(() => {
        if (!rawPoints) return [];
        
        // Primero filtramos solo los que tienen coordenadas válidas
        const withCoords = rawPoints.filter(e => e.LATITUD && e.LONGITUD);

        return withCoords.filter(e => {
            if (isDirigente) return e.ubicadoPor_id === user?.id || e.registradoPor_id === user?.id;

            if (isCoordinador) {
                if (String(e.CODIGO_SEC || '') !== String(user?.seccional || '')) return false;
                if (selectedDirigente !== 'ALL') return e.ubicadoPor_id === selectedDirigente || e.registradoPor_id === selectedDirigente;
                return true;
            }

            if (isAdmin) {
                const matchSec = selectedSeccional === 'ALL' || String(e.CODIGO_SEC || '') === String(selectedSeccional);
                
                if (selectedDirigente !== 'ALL') {
                    return matchSec && (e.ubicadoPor_id === selectedDirigente || e.registradoPor_id === selectedDirigente);
                }
                
                if (selectedCoordinador !== 'ALL') {
                    const coord = allUsers.find(u => u.id === selectedCoordinador);
                    const coordSec = String(coord?.seccional || '');
                    return matchSec && String(e.CODIGO_SEC || '') === coordSec;
                }

                return matchSec;
            }

            return false;
        });
    }, [rawPoints, selectedSeccional, selectedCoordinador, selectedDirigente, user, isAdmin, isCoordinador, isDirigente, allUsers]);

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <Layers className="h-8 w-8 text-primary" />
                        Mapa Territorial Real-Time
                    </h1>
                    <div className="flex gap-2">
                        {isCoordinador && <Badge className="bg-blue-600 font-black uppercase text-[9px] py-1.5 px-3">COORDINACIÓN SECC {user?.seccional}</Badge>}
                        {isDirigente && <Badge variant="secondary" className="font-black uppercase text-[9px] py-1.5 px-3">MIS CARGAS GPS</Badge>}
                    </div>
                </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoadingPoints}
                        className="h-9 px-4 font-black uppercase border-primary/20 text-primary rounded-xl bg-white shadow-sm flex items-center gap-2"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isLoadingPoints && "animate-spin")} />
                        RECUPERAR DATOS
                    </Button>
                    {(isLoadingFilters || isLoadingPoints) && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden border-primary/10 shadow-2xl rounded-3xl bg-white">
                <CardHeader className="bg-slate-50/80 backdrop-blur-sm py-4 shrink-0 border-b z-10">
                    <div className="flex flex-wrap gap-4 items-center">
                        {isAdmin && (
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Jurisdicción (SECC)</Label>
                                <Select value={selectedSeccional} onValueChange={(val) => { setSelectedSeccional(val); setSelectedCoordinador('ALL'); setSelectedDirigente('ALL'); }}>
                                    <SelectTrigger className="h-9 w-44 text-xs font-bold bg-white">
                                        <SelectValue placeholder="Todas las SECC" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[1001]">
                                        <SelectItem value="ALL">TODAS LAS SECC</SelectItem>
                                        {seccionales.map(s => <SelectItem key={s.id} value={String(s.nombre)}>SECCIONAL {s.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {isAdmin && (
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">
                                    Responsable ({filteredCoordinadores.length} COORDINADORES)
                                </Label>
                                <Select value={selectedCoordinador} onValueChange={(val) => { setSelectedCoordinador(val); setSelectedDirigente('ALL'); }}>
                                    <SelectTrigger className="h-9 w-60 text-xs font-bold bg-white" disabled={isLoadingFilters}>
                                        <SelectValue placeholder={isLoadingFilters ? "Cargando..." : "Elegir Coordinador..."} />
                                    </SelectTrigger>
                                    <SelectContent className="z-[1001]">
                                        <SelectItem value="ALL">TODOS LOS COORDINADORES</SelectItem>
                                        {filteredCoordinadores.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {(isAdmin || isCoordinador) && (
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">
                                    Operador ({filteredDirigentes.length} DIRIGENTES)
                                </Label>
                                <Select value={selectedDirigente} onValueChange={setSelectedDirigente}>
                                    <SelectTrigger className="h-9 w-60 text-xs font-bold bg-white" disabled={isLoadingFilters}>
                                        <SelectValue placeholder={isLoadingFilters ? "Cargando..." : "Elegir Dirigente..."} />
                                    </SelectTrigger>
                                    <SelectContent className="z-[1001]">
                                        <SelectItem value="ALL">TODOS LOS DIRIGENTES</SelectItem>
                                        {filteredDirigentes.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {isDirigente && (
                            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-primary/10 shadow-sm">
                                <UserCircle className="h-5 w-5 text-primary" />
                                <span className="text-xs font-black uppercase tracking-widest">{user?.name}</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 relative">
                    <div className="absolute inset-0">
                        <GlobalMapDisplay electores={filteredMarkers} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, orderBy, getDoc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Elector as ElectorType, Seccional } from '@/types';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Vote, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { logAction } from '@/lib/audit';

interface Elector extends ElectorType {
  id: string;
  ORDEN: number;
  NOMBRE: string;
  APELLIDO: string;
  LOCAL?: string;
  MESA?: number;
  estado_votacion?: 'Pendiente' | 'Ya Votó';
  [key: string]: any;
}

export default function ControlVotacionPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();

    const [allSeccionales, setAllSeccionales] = useState<Seccional[]>([]);
    const [selectedSeccional, setSelectedSeccional] = useState<string | null>(null);
    const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
    const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
    
    const [electores, setElectores] = useState<Elector[]>([]);
    const [metadata, setMetadata] = useState<any>(null);

    const [isLoadingSeccionales, setIsLoadingSeccionales] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [isLoadingElectores, setIsLoadingElectores] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const locales = useMemo(() => metadata?.locales || [], [metadata]);
    
    const mesas = useMemo(() => {
        if (!selectedLocal || !metadata?.mesas_por_local) return [];
        const localData = metadata.mesas_por_local.find((item: any) => item.localName === selectedLocal);
        if (!localData) return [];
        const allMesasForLocal = localData.mesas;
        if (user?.role === 'Mesario' && user.mesas && user.mesas.length > 0) return allMesasForLocal.filter((m: number) => user.mesas!.includes(m));
        return allMesasForLocal;
    }, [metadata, selectedLocal, user]);

    const ordenes = useMemo(() => {
        if (!selectedLocal || selectedMesa === null || !metadata?.orden_por_mesa) return [];
        const localData = metadata.orden_por_mesa.find((item: any) => item.localName === selectedLocal);
        if (!localData) return [];
        const mesaData = localData.mesas.find((item: any) => item.mesaKey === String(selectedMesa));
        return mesaData ? mesaData.ordenes : [];
    }, [metadata, selectedLocal, selectedMesa]);

    const electoresMap = useMemo(() => {
        if (!electores) return new Map();
        return new Map(electores.map(e => [Number(e.ORDEN), e]));
    }, [electores]);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';

    const fetchAllSeccionales = useCallback(async () => {
        if (!isAdmin || !db) return;
        setIsLoadingSeccionales(true);
        try {
            const q = query(collection(db, 'seccionales'));
            const snapshot = await getDocs(q);
            const seccionalesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Seccional));
            seccionalesList.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), undefined, { numeric: true }));
            setAllSeccionales(seccionalesList);
        } catch (error) {
            toast({ title: 'Error', variant: 'destructive' });
        } finally { setIsLoadingSeccionales(false); }
    }, [isAdmin, db, toast]);
    
     useEffect(() => {
        if (isAdmin) fetchAllSeccionales();
        else if (user?.seccional) setSelectedSeccional(user.seccional);
    }, [isAdmin, user, fetchAllSeccionales]);

    const fetchMetadata = useCallback(async () => {
        const seccionalToQuery = isAdmin ? selectedSeccional : user?.seccional;
        if (!seccionalToQuery || !db) return;
        setIsLoadingMetadata(true);
        setMetadata(null); setSelectedLocal(null); setSelectedMesa(null); setElectores([]);
        try {
            const metaDocRef = doc(db, 'seccionales_metadata', seccionalToQuery);
            const metaDoc = await getDoc(metaDocRef);
            if (metaDoc.exists()) {
                const meta = metaDoc.data();
                setMetadata(meta);
                if (user?.role === 'Mesario' && user.local && (meta.locales || []).includes(user.local)) {
                    setSelectedLocal(user.local);
                     if (user.mesas && user.mesas.length === 1) {
                        const mesaToSelect = user.mesas[0];
                        const localData = meta.mesas_por_local.find((item: any) => item.localName === user.local);
                        if (localData && localData.mesas.includes(mesaToSelect)) setSelectedMesa(mesaToSelect);
                    }
                }
            }
        } catch (error) { toast({ title: "Error", variant: "destructive" }); } finally { setIsLoadingMetadata(false); }
    }, [selectedSeccional, db, toast, user, isAdmin]);
    
    useEffect(() => {
        const seccionalReady = (isAdmin && selectedSeccional) || (!isAdmin && user?.seccional);
        if (seccionalReady) fetchMetadata();
    }, [selectedSeccional, user, fetchMetadata, isAdmin]);

    useEffect(() => {
        const seccionalToQuery = isAdmin ? selectedSeccional : user?.seccional;
        if (!seccionalToQuery || !selectedLocal || selectedMesa === null || !db) {
            setElectores([]);
            return;
        }

        setIsLoadingElectores(true);
        
        // Optimizamos usando 'in' para traer tanto Number como String en una sola consulta
        const q = query(
            collection(db, 'sheet1'), 
            where('CODIGO_SEC', '==', seccionalToQuery), 
            where('LOCAL', '==', selectedLocal), 
            where('MESA', 'in', [selectedMesa, String(selectedMesa)])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(), 
                estado_votacion: doc.data().estado_votacion || 'Pendiente' 
            } as Elector));
            setElectores(list);
            setIsLoadingElectores(false);
        }, (error) => {
            console.error("Error in real-time control votacion:", error);
            setIsLoadingElectores(false);
            toast({ title: "Error de conexión", variant: "destructive" });
        });

        return () => unsubscribe();
    }, [selectedSeccional, selectedLocal, selectedMesa, db, toast, user, isAdmin]);

    const handleToggleVoto = (elector: Elector) => {
        if (isUpdating || !db || !user) return;
        setIsUpdating(true);
        const newStatus = elector.estado_votacion === 'Ya Votó' ? 'Pendiente' : 'Ya Votó';
        const electorRef = doc(db, 'sheet1', elector.id);
        const captureRef = doc(db, 'votos_confirmados', elector.id); // Sincronización con colección de capturas
        
        const dataToUpdate = { estado_votacion: newStatus };
        
        // Actualización dual: Padrón general y Colección de Votos Seguros
        Promise.all([
            updateDoc(electorRef, dataToUpdate),
            getDoc(captureRef).then(snap => {
                if (snap.exists()) return updateDoc(captureRef, dataToUpdate);
            }).catch(() => null) // Si no existe en capturas, ignorar silenciosamente
        ])
        .then(() => {
             setElectores(prev => prev.map(e => e.id === elector.id ? { ...e, estado_votacion: newStatus } : e));
             logAction(db, { userId: user.id, userName: user.name, module: 'CONTROL VOTACION', action: newStatus === 'Ya Votó' ? 'MARCÓ VOTO EFECTUADO' : 'RESTABLECIÓ VOTO', targetId: elector.id, targetName: `${elector.NOMBRE} ${elector.APELLIDO}` });
        })
        .catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: electorRef.path, operation: 'update', requestResourceData: dataToUpdate }));
        })
        .finally(() => setIsUpdating(false));
    };
    
    const isMesarioWithOneMesa = user?.role === 'Mesario' && user?.mesas?.length === 1;
    const seccionalToShow = (isAdmin ? selectedSeccional : user?.seccional) || '';

    if (!isAdmin && !user?.seccional) return <div className="p-10 text-center">No tienes SECC asignada.</div>;

    return (
        <div className="space-y-6">
            <div><h1 className="text-3xl font-bold">Control de Votación por Mesa</h1></div>
            <Card>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                    {isAdmin && (
                        <div className="space-y-2">
                            <Label>SECC</Label>
                            <Select onValueChange={setSelectedSeccional} value={selectedSeccional || ''}><SelectTrigger><SelectValue placeholder="Selecciona SECC" /></SelectTrigger><SelectContent>{allSeccionales.map(s => <SelectItem key={s.id} value={s.nombre}>SECC {s.nombre}</SelectItem>)}</SelectContent></Select>
                        </div>
                    )}
                    <div className="space-y-2"><Label>Local</Label><Select onValueChange={setSelectedLocal} disabled={user?.role === 'Mesario'} value={selectedLocal || ''}><SelectTrigger><SelectValue placeholder="Local" /></SelectTrigger><SelectContent>{locales.map((l:any) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Mesa</Label><Select onValueChange={(v) => setSelectedMesa(Number(v))} disabled={isMesarioWithOneMesa} value={selectedMesa ? String(selectedMesa) : ''}><SelectTrigger><SelectValue placeholder="Mesa" /></SelectTrigger><SelectContent>{mesas.map((m:any) => <SelectItem key={m} value={String(m)}>Mesa {m}</SelectItem>)}</SelectContent></Select></div>
                </CardContent>
            </Card>
            {selectedMesa !== null && (
                <Card><CardHeader><CardTitle>SECC {seccionalToShow}</CardTitle><CardDescription>{selectedLocal} | MESA {selectedMesa}</CardDescription></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 border-t border-l">
                        {ordenes.map((orden: number) => {
                            const elector = electoresMap.get(orden);
                            const haVotado = elector?.estado_votacion === 'Ya Votó';
                            return <Button key={orden} onClick={() => elector && handleToggleVoto(elector)} disabled={isLoadingElectores || isUpdating || !elector} className={cn("h-10 w-full p-0 font-bold rounded-none border-b border-r text-xs", haVotado ? "bg-green-500 text-white" : "bg-white")} variant="outline">{orden}</Button>
                        })}
                    </div>
                </CardContent></Card>
            )}
        </div>
    );
}

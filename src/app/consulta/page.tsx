
"use client";

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { collection, getDocs, query, where, doc, updateDoc, setDoc, deleteDoc, limit, orderBy } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Search, 
    Loader2, 
    Save, 
    Navigation, 
    FileSearch,
    UserCheck, 
    Lock, 
    History, 
    User as UserIcon, 
    Trash2, 
    Zap,
    Smartphone,
    MapPin,
    AlertCircle,
    Eye,
    Share2,
    MessageSquare,
    Users
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><Loader2 className="animate-spin" /></div>
});

interface PadronData {
    id: string; 
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    [key: string]: any; 
    observacion?: string;
    TELEFONO?: string;
    INSTITUCION?: string;
    CODIGO_SEC?: string;
    DIRECCION?: string;
    LOCAL?: string;
    registradoPor_id?: string;
    registradoPor_nombre?: string;
    LATITUD?: number;
    LONGITUD?: number;
}

const COLLECTION_PADRON = 'sheet1';
const COLLECTION_CAPTURAS = 'votos_confirmados';

export default function ConsultaPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<PadronData[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<PadronData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const userSeccionales = useMemo(() => {
        if (!user) return [];
        return user.seccionales || (user.seccional ? [user.seccional] : []);
    }, [user]);

    const [telefono, setTelefono] = useState('');
    const [institucion, setInstitucion] = useState('');
    const [manualLat, setManualLat] = useState('');
    const [manualLon, setManualLon] = useState('');
    const [isCapturingLocation, setIsCapturingLocation] = useState(false);
    
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [isRestrictedAlertOpen, setIsRestrictedAlertOpen] = useState(false);
    const [votoToDelete, setVotoToDelete] = useState<PadronData | null>(null);

    // ESTADOS Y HOOKS PARA DELEGACIÓN DE VOTOS SEGUROS
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
    const [isDelegating, setIsDelegating] = useState(false);

    // ESCUCHADOR EN TIEMPO REAL A LA COLECCIÓN DE CAPTURAS OPTIMIZADO POR ROL
    const registeredQuery = useMemoFirebase(() => {
        if (!db || !user) return null;

        const role = user.role;
        const isDirigente = role === 'Dirigente';

        if (isDirigente) {
            // El Dirigente solo descarga sus propios votos seguros (sin límite artificial bajo para poder ver sus 400+ votos)
            return query(
                collection(db, COLLECTION_CAPTURAS),
                where('registradoPor_id', '==', user.id),
                orderBy('APELLIDO', 'asc')
            );
        }

        // Coordinadores, Admins y Presidentes descargan todo de manera fluida y sin límites.
        // Se remueve la llamada a 'limit' por completo, lo que permite traer 20,000 o más registros sin restricciones del servidor de Firebase.
        return query(
            collection(db, COLLECTION_CAPTURAS),
            orderBy('APELLIDO', 'asc')
        );
    }, [db, user, userSeccionales, refreshKey]);

    const { data: rawList, isLoading: isLoadingList, error: listError } = useCollection<PadronData>(registeredQuery);

    // ESCUCHADOR EN TIEMPO REAL A LOS USUARIOS PARA JURISDICCIÓN DE OPERADORES
    const usersQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        return query(collection(db, 'users'));
    }, [db, user]);

    const { data: allUsers } = useCollection<any>(usersQuery);

    const seccionalUserIds = useMemo(() => {
        if (!allUsers || !userSeccionales.length) return new Set<string>();
        const ids = new Set<string>();
        allUsers.forEach(u => {
            const rawSecc = u.seccionales || (u.seccional ? [u.seccional] : []);
            const userSecs = rawSecc.map((s: any) => String(s).toUpperCase().replace('SECCIONAL', '').trim());
            const hasOverlap = userSecs.some((s: string) => userSeccionales.includes(s));
            if (hasOverlap) {
                ids.add(u.id);
            }
        });
        return ids;
    }, [allUsers, userSeccionales]);

    const operatorsInElectorSeccional = useMemo(() => {
        if (!selectedPerson || !allUsers) return [];
        const electorSec = String(selectedPerson.CODIGO_SEC || '');
        return allUsers.filter(u => {
            const rawSecc = u.seccionales || (u.seccional ? [u.seccional] : []);
            const userSecs = rawSecc.map((s: any) => String(s).toUpperCase().replace('SECCIONAL', '').trim());
            return userSecs.includes(electorSec) && u.id !== user?.id && (u.role === 'Dirigente' || u.role === 'Coordinador');
        });
    }, [selectedPerson, allUsers, user]);

    const selectedOperator = useMemo(() => {
        return operatorsInElectorSeccional.find(o => o.id === selectedOperatorId);
    }, [operatorsInElectorSeccional, selectedOperatorId]);

    const registeredList = useMemo(() => {
        if (!rawList || !user) return [];
        
        const role = user.role;
        const isAdmin = role === 'Super-Admin' || role === 'Presidente' || role === 'Admin';
        
        if (isAdmin) return rawList;

        const normalize = (nameStr: string) => String(nameStr || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const myNormalizedName = normalize(user.name);
        const isGuillermoMe = myNormalizedName.includes("GUILLERMO") && myNormalizedName.includes("FERNANDEZ");

        const isMyRegistration = (item: PadronData) => {
            if (item.registradoPor_id === user.id) return true;
            const itemRegName = normalize(item.registradoPor_nombre);
            if (isGuillermoMe && itemRegName.includes("GUILLERMO") && itemRegName.includes("FERNANDEZ")) return true;
            return itemRegName === myNormalizedName;
        };

        if (role === 'Coordinador') {
            return rawList.filter(item => {
                const itemSec = String(item.CODIGO_SEC || '');
                const isFromMySeccional = userSeccionales.includes(itemSec);
                const isRegisteredByMySeccionalUser = item.registradoPor_id && seccionalUserIds.has(item.registradoPor_id);
                return isFromMySeccional || isRegisteredByMySeccionalUser || isMyRegistration(item);
            });
        }

        if (role === 'Dirigente') {
            return rawList.filter(item => isMyRegistration(item));
        }

        return [];
    }, [rawList, user, userSeccionales, seccionalUserIds]);

    const groupedCaptures = useMemo(() => {
        const groups: Record<string, { seccional: string, votos: PadronData[] }> = {};
        if (!registeredList) return groups;
        
        registeredList.forEach(item => {
            let userName = item.registradoPor_nombre || 'USUARIO DESCONOCIDO';
            
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
            
            if (!groups[userName]) {
                groups[userName] = {
                    seccional: String(item.CODIGO_SEC || ''),
                    votos: []
                };
            }
            groups[userName].votos.push(item);
        });
        return groups;
    }, [registeredList]);

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const applyPhoneMask = (value: string) => {
        const cleanValue = value.replace(/\D/g, '').slice(0, 10);
        let formatted = cleanValue;
        if (cleanValue.length > 4 && cleanValue.length <= 7) formatted = `${cleanValue.slice(0, 4)}-${cleanValue.slice(4)}`;
        else if (cleanValue.length > 7) formatted = `${cleanValue.slice(0, 4)}-${cleanValue.slice(4, 7)}-${cleanValue.slice(7)}`;
        return formatted;
    };

    useEffect(() => {
        if (selectedPerson) {
            setTelefono(applyPhoneMask(selectedPerson.TELEFONO || ''));
            setInstitucion(selectedPerson.INSTITUCION || '');
            setManualLat(selectedPerson.LATITUD?.toString() || '');
            setManualLon(selectedPerson.LONGITUD?.toString() || '');
        }
    }, [selectedPerson]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim().toUpperCase();
        if (!term) return;

        setIsSearching(true);
        setSelectedPerson(null);
        setSearchResults([]);
        
        try {
            const resultsMap = new Map<string, PadronData>();
            const dataCollection = collection(db!, COLLECTION_PADRON);
            const isNumericSearch = /^\d+$/.test(term);

            let searchQueries = [];
            if (isNumericSearch) {
                searchQueries.push(getDocs(query(dataCollection, where('CEDULA', '==', Number(term)), limit(20))));
                searchQueries.push(getDocs(query(dataCollection, where('CEDULA', '==', term), limit(20))));
            } else {
                const words = term.split(' ').filter(w => w.length >= 3);
                if (words.length === 0) { setIsSearching(false); return; }
                words.forEach(w => {
                    searchQueries.push(getDocs(query(dataCollection, where('NOMBRE', '>=', w), where('NOMBRE', '<=', w + '\uf8ff'), limit(100))));
                    searchQueries.push(getDocs(query(dataCollection, where('APELLIDO', '>=', w), where('APELLIDO', '<=', w + '\uf8ff'), limit(100))));
                });
            }
            
            const snapshots = await Promise.all(searchQueries);
            snapshots.forEach(snapshot => snapshot.forEach(docSnap => {
                if (!resultsMap.has(docSnap.id)) resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PadronData);
            }));
            
            let foundResults = Array.from(resultsMap.values());
            
            // No se filtra por seccional para permitir búsqueda nacional.
            
            if (!isNumericSearch) {
                const words = term.split(' ').filter(w => w);
                foundResults = foundResults.filter(p => {
                    const full = `${p.NOMBRE || ''} ${p.APELLIDO || ''}`.toUpperCase();
                    return words.every(w => full.includes(w));
                });
            }
            foundResults.sort((a, b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));
            setSearchResults(foundResults);
            if (foundResults.length === 0) toast({ title: 'Sin resultados' });
            else if (foundResults.length === 1) setSelectedPerson(foundResults[0]);
        } catch (error) { toast({ title: 'Error de conexión', variant: 'destructive' }); } finally { setIsSearching(false); }
    };

    const handleLocationPick = (lat: number, lon: number) => {
        setManualLat(lat.toFixed(6));
        setManualLon(lon.toFixed(6));
        toast({ title: "Ubicación Fijada" });
    };

    const handleCaptureLocation = () => {
        if (!navigator.geolocation) return;
        setIsCapturingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { setManualLat(pos.coords.latitude.toString()); setManualLon(pos.coords.longitude.toString()); setIsCapturingLocation(false); },
            () => setIsCapturingLocation(false),
            { enableHighAccuracy: true }
        );
    };
    
    const handleSave = async () => {
        if (!selectedPerson || !user || !db) return;

        // VALIDACIÓN DE JURISDICCIÓN
        const role = user.role;
        const isAdmin = role === 'Super-Admin' || role === 'Admin' || role === 'Presidente';
        const electorSec = String(selectedPerson.CODIGO_SEC || '');

        if (!isAdmin && userSeccionales.length > 0 && !userSeccionales.includes(electorSec)) {
            setIsRestrictedAlertOpen(true);
            return;
        }

        setIsSaving(true);
        const dataToSave: any = {
            ...selectedPerson,
            observacion: "VOTO SEGURO",
            TELEFONO: telefono,
            INSTITUCION: institucion,
            registradoPor_id: user.id,
            registradoPor_nombre: user.name,
            updatedAt: new Date().toISOString()
        };

        if (manualLat && manualLon) {
            dataToSave.LATITUD = parseFloat(manualLat);
            dataToSave.LONGITUD = parseFloat(manualLon);
            dataToSave.ubicadoPor_id = user.id;
            dataToSave.ubicadoPor_nombre = user.name;
        }

        const capturaRef = doc(db, COLLECTION_CAPTURAS, selectedPerson.id);
        const padronRef = doc(db, COLLECTION_PADRON, selectedPerson.id);

        Promise.all([
            setDoc(capturaRef, dataToSave),
            updateDoc(padronRef, { observacion: "VOTO SEGURO", TELEFONO: telefono, INSTITUCION: institucion })
        ]).then(() => {
            logAction(db, { userId: user.id, userName: user.name, module: 'REGISTRO VOTOS', action: 'REGISTRÓ VOTO SEGURO', targetName: `${selectedPerson.NOMBRE} ${selectedPerson.APELLIDO}` });
            toast({ title: '¡Registro Exitoso!' });
            
            // Ya no hace falta setRefreshKey porque useCollection (listener) 
            // detecta el nuevo registro automáticamente sin costo de re-lectura total.

            // LIMPIAR CAMPOS PARA OTRA BUSQUEDA
            setSearchTerm(''); 
            setSearchResults([]); 
            setSelectedPerson(null); 
            setTelefono(''); 
            setInstitucion(''); 
            setManualLat(''); 
            setManualLon('');
        }).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: capturaRef.path, operation: 'create', requestResourceData: dataToSave }));
        }).finally(() => setIsSaving(false));
    };

    const handleDelegateSave = async () => {
        if (!selectedPerson || !selectedOperator || !user || !db) return;

        setIsDelegating(true);
        try {
            const dataToSave: any = {
                ...selectedPerson,
                observacion: "VOTO SEGURO",
                TELEFONO: telefono || '',
                INSTITUCION: institucion || '',
                registradoPor_id: selectedOperator.id,
                registradoPor_nombre: selectedOperator.name,
                delegadoPor_id: user.id,
                delegadoPor_nombre: user.name,
                updatedAt: new Date().toISOString()
            };

            if (manualLat && manualLon) {
                dataToSave.LATITUD = parseFloat(manualLat);
                dataToSave.LONGITUD = parseFloat(manualLon);
                dataToSave.ubicadoPor_id = user.id;
                dataToSave.ubicadoPor_nombre = user.name;
            }

            const capturaRef = doc(db, COLLECTION_CAPTURAS, selectedPerson.id);
            const padronRef = doc(db, COLLECTION_PADRON, selectedPerson.id);

            await Promise.all([
                setDoc(capturaRef, dataToSave),
                updateDoc(padronRef, { observacion: "VOTO SEGURO", TELEFONO: telefono || '', INSTITUCION: institucion || '' })
            ]);

            logAction(db, { 
                userId: user.id, 
                userName: user.name, 
                module: 'REGISTRO VOTOS', 
                action: 'DELEGÓ VOTO SEGURO', 
                targetName: `${selectedPerson.NOMBRE} ${selectedPerson.APELLIDO} asignado a ${selectedOperator.name}` 
            });

            toast({ title: '¡Delegación Exitosa!', description: `Voto asignado a ${selectedOperator.name}` });

            // Abrir WhatsApp de notificación para el operador
            const opPhone = selectedOperator.phone || selectedOperator.telefono || '';
            if (opPhone) {
                const cleanPhone = opPhone.replace(/\D/g, '');
                // Formato internacional paraguayo (5959xxxxxxx)
                const formattedPhone = cleanPhone.startsWith('09') ? '595' + cleanPhone.substring(1) : (cleanPhone.startsWith('9') ? '595' + cleanPhone : cleanPhone);
                
                const messageText = `¡Hola *${selectedOperator.name}*! Te saluda *${user.name}*. Acabo de captar a un elector para tu seccional y te lo acabo de asignar en el sistema: \n\n👤 *Elector:* ${selectedPerson.NOMBRE} ${selectedPerson.APELLIDO}\n🪪 *C.I.:* ${selectedPerson.CEDULA}\n📍 *Local:* ${selectedPerson.LOCAL || 'No especificado'}\n📱 *Teléfono:* ${telefono || 'No especificado'}\n\n¡Ya lo tienes en tu listado de Voto Seguro de ARKI! 💪🔴`;
                
                const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(messageText)}`;
                window.open(waUrl, '_blank');
            }

            // Limpiar campos
            setIsRestrictedAlertOpen(false);
            setSelectedOperatorId('');
            setSearchTerm('');
            setSearchResults([]);
            setSelectedPerson(null);
            setTelefono('');
            setInstitucion('');
            setManualLat('');
            setManualLon('');
        } catch (error: any) {
            console.error("Error delegando voto:", error);
            toast({ title: 'Error al delegar voto', variant: 'destructive' });
        } finally {
            setIsDelegating(false);
        }
    };

    const handleDeleteVoto = async () => {
        if (!votoToDelete || !db || !user) return;
        setIsDeleting(true);
        const capturaRef = doc(db, COLLECTION_CAPTURAS, votoToDelete.id);
        const padronRef = doc(db, COLLECTION_PADRON, votoToDelete.id);

        Promise.all([
            deleteDoc(capturaRef),
            updateDoc(padronRef, { observacion: null })
        ]).then(() => {
            logAction(db, { userId: user.id, userName: user.name, module: 'REGISTRO VOTOS', action: 'ELIMINÓ VOTO SEGURO', targetName: `${votoToDelete.NOMBRE}` });
            toast({ title: 'Marca eliminada' });
        }).finally(() => { setIsDeleting(false); setIsDeleteAlertOpen(false); setVotoToDelete(null); });
    };

    const renderCapturesTable = (items: PadronData[]) => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader><TableRow className="bg-muted/50 text-[10px] font-black uppercase"><TableHead className="w-[100px] text-center">Cédula</TableHead><TableHead>Elector</TableHead><TableHead className="text-center">SECC</TableHead><TableHead>Local / Mesa</TableHead><TableHead>Teléfono</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                <TableBody>
                    {items.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/20">
                            <TableCell className="font-mono text-[10px] text-center">{p.CEDULA}</TableCell>
                            <TableCell className="font-black text-[11px] uppercase">{p.NOMBRE} {p.APELLIDO}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="text-[9px]">SECC {p.CODIGO_SEC}</Badge></TableCell>
                            <TableCell className="text-[10px] uppercase">
                                <div>{p.LOCAL}</div>
                                <div className="text-primary font-bold">M: {p.MESA} / O: {p.ORDEN}</div>
                            </TableCell>
                            <TableCell className="text-[11px] font-bold text-green-700">{p.TELEFONO || '---'}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 text-primary" 
                                        onClick={() => { 
                                            setSelectedPerson(p); 
                                            window.scrollTo({ top: 0, behavior: 'smooth' }); 
                                        }}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => { setVotoToDelete(p); setIsDeleteAlertOpen(true); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><FileSearch className="h-8 w-8 text-primary" /> Registro de Votos Seguros</h1>
                    <div className="mt-2 space-y-1">
                        <p className="text-slate-900 font-black flex items-center gap-2 uppercase text-[11px] tracking-tight">
                            <UserIcon className="h-3.5 w-3.5 text-primary" /> Operador: {user?.name}
                        </p>
                        <p className="text-muted-foreground font-medium flex items-center gap-2 uppercase text-[10px] tracking-widest">
                            <Lock className="h-3 w-3" /> {user?.role} 
                            {userSeccionales.length > 0 && (
                                <>
                                    <span className="mx-1 opacity-30">|</span>
                                    <MapPin className="h-3 w-3 text-primary" /> Jurisdicción: SECC {userSeccionales.join(', ')}
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-black px-4 py-2 text-xs">{registeredList.length} CAPTURAS ACTIVAS</Badge>
            </div>

            {listError && (
                <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/20 flex items-center gap-3 text-destructive font-bold uppercase text-[10px]">
                    <AlertCircle className="h-5 w-5" />
                    Error técnico al cargar la lista. Puede faltar un índice en la base de datos.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm overflow-hidden"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-xs font-black uppercase">Buscador Padrón Nacional</CardTitle></CardHeader>
                        <CardContent className="pt-6"><form onSubmit={handleSearch} className="flex gap-2"><Input placeholder="CÉDULA O NOMBRE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 font-black uppercase h-11" /><Button type="submit" disabled={isSearching} className="h-11 px-4">{isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}</Button></form></CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-xs font-black uppercase">Coincidencias</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            {isSearching ? <div className="space-y-2"><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></div> : 
                            searchResults.length > 0 ? <RadioGroup onValueChange={(id) => setSelectedPerson(searchResults.find(p => p.id === id) || null)} value={selectedPerson?.id || ''}><div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                {searchResults.map(p => (<div key={p.id} className={cn("flex items-center space-x-3 border rounded-2xl p-4 cursor-pointer", selectedPerson?.id === p.id ? "border-primary bg-primary/[0.02]" : "border-slate-100")} onClick={() => setSelectedPerson(p)}><RadioGroupItem value={p.id} className="sr-only" /><div className="flex-1 text-left"><p className="font-black text-xs uppercase text-slate-900">{p.NOMBRE} {p.APELLIDO}</p><div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-muted-foreground font-bold uppercase">C.I. {p.CEDULA}</span><Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-black text-[9px] h-5 px-2 rounded-full ring-1 ring-primary/20">SECC {p.CODIGO_SEC}</Badge></div></div></div>))}</div></RadioGroup> : 
                            <div className="text-center py-12 opacity-20"><Zap className="h-12 w-12 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Esperando Búsqueda</p></div>}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="border-primary/10 shadow-lg overflow-hidden min-h-[500px]"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="flex items-center gap-3 font-black uppercase text-xs"><UserCheck className="h-4 w-4 text-primary" /> Ficha de Captura</CardTitle></CardHeader>
                        <CardContent className="pt-6">{selectedPerson ? (<div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-5 rounded-2xl border border-primary/10 text-xs">
                                    <div><Label className="text-[9px] uppercase font-black text-muted-foreground">Cédula</Label><p className="font-black text-sm">{selectedPerson.CEDULA}</p></div>
                                    <div><Label className="text-[9px] uppercase font-black text-muted-foreground">Elector</Label><p className="font-black text-sm uppercase">{selectedPerson.NOMBRE} {selectedPerson.APELLIDO}</p></div>
                                    <div className="sm:col-span-2"><Label className="text-[9px] uppercase font-black text-muted-foreground">Referencia</Label><p className="font-black uppercase">{selectedPerson.LOCAL} | M: {selectedPerson.MESA} / O: {selectedPerson.ORDEN}</p></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-5">
                                        <div className="space-y-2"><Label className="font-black text-[10px] uppercase">WhatsApp</Label><Input value={telefono} onChange={(e) => setTelefono(applyPhoneMask(e.target.value))} placeholder="0981-123-456" className="h-11 font-black text-lg" inputMode="numeric"/></div>
                                        <div className="space-y-2"><Label className="font-black text-[10px] uppercase">Institución</Label><Input value={institucion} onChange={(e) => setInstitucion(e.target.value.toUpperCase())} placeholder="COLEGIO, IPS..." className="h-11 font-black uppercase"/></div>
                                        <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase text-base bg-primary shadow-xl rounded-2xl">{isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />} GUARDAR VOTO SEGURO</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-[280px] border-2 rounded-3xl overflow-hidden shadow-inner"><MapPicker key={`picker-${selectedPerson.id}-${manualLat}-${manualLon}`} lat={manualLat ? parseFloat(manualLat) : null} lon={manualLon ? parseFloat(manualLon) : null} onLocationPick={handleLocationPick} /></div>
                                        <Button variant="secondary" className="w-full bg-red-600 text-white h-11 font-black rounded-xl text-xs uppercase" onClick={handleCaptureLocation} disabled={isCapturingLocation}><Navigation className="mr-2 h-4 w-4" /> CAPTURAR GPS</Button>
                                    </div>
                                </div></div>) : <div className="text-center text-muted-foreground py-32 border-2 border-dashed rounded-3xl opacity-30"><p className="font-black uppercase text-xs">Selecciona un ciudadano para iniciar captura</p></div>}</CardContent>
                    </Card>
                </div>
            </div>

            <Card className="border-primary/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between gap-4">
                    <CardTitle className="text-sm font-black uppercase">Registros en Jurisdicción</CardTitle>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleRefresh} 
                        disabled={isLoadingList}
                        className="h-8 gap-2 text-[10px] font-black uppercase hover:bg-primary/5 text-primary"
                    >
                        <Zap className={cn("h-3 w-3", isLoadingList && "animate-spin")} />
                        Actualizar
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoadingList ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : 
                    Object.keys(groupedCaptures).length > 0 ? <div className="p-4"><Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(groupedCaptures).sort(([a],[b]) => a.localeCompare(b)).map(([userName, data]) => (
                            <AccordionItem key={userName} value={userName} className="border rounded-xl px-4 bg-muted/5">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/5">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 text-left">
                                            <span className="font-black text-xs uppercase">{userName}</span>
                                            {data.seccional && (
                                                <div className="h-5 px-2 w-fit rounded-full bg-red-600 flex items-center justify-center text-[7px] font-black text-white shadow-sm ring-2 ring-white uppercase">
                                                    SECC {data.seccional}
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] font-black bg-white shrink-0">{data.votos.length} Votos</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4"><div className="border rounded-lg bg-white overflow-hidden shadow-sm">{renderCapturesTable(data.votos)}</div></AccordionContent>
                            </AccordionItem>))}
                    </Accordion></div> : <div className="text-center py-20 opacity-30"><History className="h-12 w-12 mx-auto mb-2" /><p className="font-black text-xs uppercase">No hay capturas registradas en esta zona</p></div>}
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿Eliminar Marca de Voto Seguro?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-black uppercase text-xs h-11 rounded-xl">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDeleteVoto} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-6 rounded-xl">ELIMINAR AHORA</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isRestrictedAlertOpen} onOpenChange={(open) => {
                setIsRestrictedAlertOpen(open);
                if (!open) setSelectedOperatorId('');
            }}>
                <AlertDialogContent className="rounded-[2.5rem] border border-red-100 bg-white p-8 max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300">
                    <AlertDialogHeader className="space-y-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100/50">
                            <Lock className="h-7 w-7 stroke-[2.5]" />
                        </div>
                        <div className="space-y-2 text-center">
                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-red-600">
                                Jurisdicción Restringida
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500 leading-relaxed">
                                Este elector pertenece a la <span className="font-bold text-red-600">Seccional {selectedPerson?.CODIGO_SEC}</span>. 
                                Solo puedes registrar de forma directa electores de tu(s) seccional(es) autorizada(s) ({userSeccionales.join(', ')}).
                            </AlertDialogDescription>
                        </div>
                    </AlertDialogHeader>

                    {operatorsInElectorSeccional.length > 0 ? (
                        <div className="my-6 p-5 border border-dashed rounded-3xl bg-slate-50 space-y-4">
                            <div className="space-y-1 text-left">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    ¿Deseas delegar este voto a un operador local?
                                </label>
                                <p className="text-[10px] font-medium text-slate-500 uppercase leading-snug">
                                    Selecciona un operador de la Seccional {selectedPerson?.CODIGO_SEC} para asignarle esta captura:
                                </p>
                            </div>
                            
                            <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                                <SelectTrigger className="h-12 w-full text-xs font-bold uppercase rounded-xl border-slate-200 bg-white">
                                    <SelectValue placeholder="Elegir Operador de Destino..." />
                                </SelectTrigger>
                                <SelectContent className="z-[2000]">
                                    {operatorsInElectorSeccional.map((op: any) => (
                                        <SelectItem key={op.id} value={op.id} className="text-xs uppercase font-bold">
                                            {op.name} ({op.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedOperator && (
                                <div className="p-4 border rounded-2xl bg-white space-y-3 shadow-sm animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
                                            <Users className="h-5 w-5" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="text-xs font-black uppercase leading-none text-slate-800">{selectedOperator.name}</p>
                                            <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">{selectedOperator.role} • SECCIONAL {selectedPerson?.CODIGO_SEC}</p>
                                        </div>
                                    </div>
                                    {selectedOperator.phone || selectedOperator.telefono ? (
                                        <div className="flex items-center gap-2 bg-green-50/50 border border-green-100/50 rounded-xl p-2 px-3 text-xs font-semibold text-green-700">
                                            <MessageSquare className="h-4 w-4 text-green-600 fill-green-600/10" />
                                            <span>WhatsApp: {selectedOperator.phone || selectedOperator.telefono}</span>
                                        </div>
                                    ) : (
                                        <p className="text-[9px] font-bold text-yellow-600 uppercase">⚠️ Sin número de teléfono registrado</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="my-6 p-6 rounded-3xl bg-slate-50 border border-slate-100 text-center space-y-2">
                            <Users className="h-8 w-8 text-slate-300 mx-auto" />
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                No hay operadores locales registrados en la Seccional {selectedPerson?.CODIGO_SEC}
                            </p>
                            <p className="text-[9px] font-medium text-slate-400 uppercase leading-snug">
                                No se puede realizar delegación automática en este momento.
                            </p>
                        </div>
                    )}

                    <AlertDialogFooter className="mt-8 flex flex-col sm:flex-col gap-3">
                        {selectedOperator ? (
                            <Button
                                onClick={handleDelegateSave}
                                disabled={isDelegating}
                                className="bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-widest h-12 w-full rounded-2xl shadow-lg shadow-green-600/10 hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 border-none"
                            >
                                {isDelegating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4 fill-white/10" />}
                                ASIGNAR VOTO Y NOTIFICAR POR WHATSAPP
                            </Button>
                        ) : null}
                        
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsRestrictedAlertOpen(false);
                                setSelectedOperatorId('');
                            }}
                            className="font-black text-xs uppercase tracking-widest h-12 w-full rounded-2xl text-slate-500 border border-slate-200"
                        >
                            {selectedOperator ? "CANCELAR" : "CERRAR"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

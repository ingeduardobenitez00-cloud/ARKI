'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, orderBy, limit, startAfter, getDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Loader2, 
    MessageSquare, 
    CheckCircle2,
    Smartphone,
    DatabaseZap,
    Cake,
    Filter,
    CalendarDays,
    Upload,
    Ticket,
    MapPin,
    Hash,
    UserCheck,
    Image as ImageIcon,
    Type,
    Save,
    Film,
    Download,
    Zap,
    Share2,
    Eye,
    PartyPopper,
    Users,
    Utensils,
    Footprints,
    Flag,
    Info,
    Vote
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import html2canvas from 'html2canvas';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface Elector {
    id: string;
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    TELEFONO?: string;
    LOCAL?: string;
    MESA?: string | number;
    ORDEN?: string | number;
    CODIGO_SEC?: string | number;
    FECHA_NACI?: string | number;
}

const EVENT_TEMPLATES = {
    REUNION: "¡Hola, {nombre}! 👋\n\nTe invitamos a participar de nuestra REUNIÓN política. Tu presencia es fundamental.\n\n¡Contamos con tu apoyo! 🔴🚀",
    CENA: "¡Hola, {nombre}! 👋\n\nTe invitamos a una CENA de confraternidad con el equipo. ¡No faltes!\n\n¡Contamos con tu apoyo! 🔴🚀",
    CAMINATA: "¡Hola, {nombre}! 👋\n\nEstaremos realizando una CAMINATA en tu zona. ¡Súmate al equipo del Arki!\n\n¡Contamos con tu apoyo! 🔴🚀",
    PEGATINA: "¡Hola, {nombre}! 👋\n\nGran jornada de PEGATINA. Vení a ponerle color a la ciudad.\n\n¡Contamos con tu apoyo! 🔴🚀",
    CUMPLEANOS: "¡Hola, {nombre}! 👋\n\nDesde el equipo de la Lista 2P te deseamos un ¡MUY FELIZ CUMPLEAÑOS! 🎂🎉\n\n¡Que pases un excelente día! 🔴🚀"
};

const MESES = [
    { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' }, { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' }, { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const DIAS = [
    { value: 'ALL', label: 'Todo el Mes' },
    ...Array.from({ length: 31 }, (_, i) => ({
        value: (i + 1).toString().padStart(2, '0'),
        label: (i + 1).toString()
    }))
];

const SETTINGS_COLLECTION = 'system_settings';
const FLYERS_COLLECTION = 'flyer_library';
const CHUNK_SIZE = 800 * 1024;

export default function DifusionPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [seccionales, setSeccionales] = useState<any[]>([]);
    const [selectedSeccional, setSelectedSeccional] = useState('');
    const [electores, setElectores] = useState<Elector[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    
    const [invitationTemplate, setInvitationTemplate] = useState(
        "¡Hola, {nombre}! 👋\n\nTe invitamos a participar de nuestras actividades políticas de la semana.\n\n¡Contamos con tu apoyo! 🔴🚀"
    );
    const [isBirthdayMode, setIsBirthdayMode] = useState(false);
    const [includeVotingData, setIncludeVotingData] = useState(false);
    const [birthdayMonth, setBirthdayMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
    const [birthdayDay, setBirthdayDay] = useState('ALL');

    const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
    const [tempPhone, setTempPhone] = useState('');
    const [isSavingPhone, setIsSavingPhone] = useState(false);

    const [currentFlyer, setCurrentFlyer] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSharingMedia, setIsSharingMedia] = useState<Record<string, boolean>>({});

    const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [newImageName, setNewImageName] = useState('');

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';

    const flyersQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, FLYERS_COLLECTION), orderBy('createdAt', 'desc'));
    }, [db]);

    const { data: availableFlyers } = useCollection(flyersQuery);

    const base64ToBlobUrl = useCallback((base64: string) => {
        if (!base64 || typeof base64 !== 'string') return '';
        try {
            const parts = base64.split(';base64,');
            if (parts.length !== 2) return base64;
            const mimeType = parts[0].split(':')[1];
            const byteCharacters = atob(parts[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            return URL.createObjectURL(blob);
        } catch (e) { 
            console.error("Error base64ToBlobUrl:", e);
            return base64; 
        }
    }, []);

    const fetchAndReconstructFlyer = useCallback(async (flyerId: string) => {
        if (!db) return null;
        try {
            const flyerRef = doc(db, FLYERS_COLLECTION, flyerId);
            const flyerSnap = await getDoc(flyerRef);
            if (!flyerSnap.exists()) return null;
            const flyerData = flyerSnap.data();
            
            if (flyerData.isChunked) {
                const chunksSnap = await getDocs(query(collection(db, FLYERS_COLLECTION, flyerId, 'chunks'), orderBy('__name__', 'asc')));
                const fullBase64 = chunksSnap.docs
                    .sort((a, b) => parseInt(a.id) - parseInt(b.id))
                    .map(d => d.data().data)
                    .join('');
                return { ...flyerData, id: flyerId, url: base64ToBlobUrl(fullBase64) };
            } else {
                const finalUrl = flyerData.url?.startsWith('data:') ? base64ToBlobUrl(flyerData.url) : flyerData.url;
                return { ...flyerData, id: flyerId, url: finalUrl };
            }
        } catch (e) {
            console.error("Error reconstructions:", e);
            return null;
        }
    }, [db, base64ToBlobUrl]);

    useEffect(() => {
        const fetchData = async () => {
            if (!db) return;
            try {
                const sSnap = await getDocs(collection(db, 'seccionales'));
                const list = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), undefined, { numeric: true }));
                setSeccionales(list);

                const settingsDoc = await getDoc(doc(db, SETTINGS_COLLECTION, 'global'));
                if (settingsDoc.exists() && settingsDoc.data().flyer_url && !currentFlyer) {
                    const globalVal = settingsDoc.data().flyer_url;
                    if (globalVal.startsWith('FLYER_ID:')) {
                        const id = globalVal.replace('FLYER_ID:', '');
                        const flyer = await fetchAndReconstructFlyer(id);
                        if (flyer) setCurrentFlyer(flyer);
                    } else {
                        const finalUrl = globalVal.startsWith('data:') ? base64ToBlobUrl(globalVal) : globalVal;
                        setCurrentFlyer({ id: 'GLOBAL', url: finalUrl, name: 'OFICIAL', type: 'image' });
                    }
                }
            } catch (e) {}
        };
        fetchData();
        
        const saved = sessionStorage.getItem('wa_processed_ids');
        if (saved) { try { setProcessedIds(new Set(JSON.parse(saved))); } catch (e) {} }

        if (user && !isAdmin && user.seccional) { setSelectedSeccional(user.seccional); }
    }, [db, user, isAdmin, fetchAndReconstructFlyer, base64ToBlobUrl]);

    const handleApplyTemplate = (type: keyof typeof EVENT_TEMPLATES) => {
        setInvitationTemplate(EVENT_TEMPLATES[type]);
        if (type === 'CUMPLEANOS') {
            setIsBirthdayMode(true);
        } else {
            setIsBirthdayMode(false);
        }
        toast({ title: `Plantilla de ${type} cargada` });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setNewImageName(file.name.split('.')[0].toUpperCase());
        setIsNameDialogOpen(true);
    };

    const confirmUpload = async () => {
        if (!pendingFile || !db || !user || !newImageName.trim()) return;
        setIsUploading(true);
        setIsNameDialogOpen(false);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            const fileType = pendingFile.type.startsWith('video/') ? 'video' : 'image';
            const chunks: string[] = [];
            for (let i = 0; i < base64String.length; i += CHUNK_SIZE) chunks.push(base64String.substring(i, i + CHUNK_SIZE));
            const isChunked = chunks.length > 1;
            const flyerData = {
                name: newImageName.toUpperCase(),
                url: isChunked ? null : base64String,
                type: fileType,
                isChunked: isChunked,
                createdAt: serverTimestamp(),
                createdBy: user.name
            };
            try {
                const docRef = await addDoc(collection(db, FLYERS_COLLECTION), flyerData);
                if (isChunked) {
                    for (let i = 0; i < chunks.length; i++) {
                        await setDoc(doc(db, FLYERS_COLLECTION, docRef.id, 'chunks', i.toString().padStart(3, '0')), { data: chunks[i] });
                    }
                }
                toast({ title: "¡Multimedia Guardada!" });
                const newFlyer = await fetchAndReconstructFlyer(docRef.id);
                if (newFlyer) setCurrentFlyer(newFlyer);
            } catch (e) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: FLYERS_COLLECTION, operation: 'create', requestResourceData: flyerData }));
            } finally {
                setIsUploading(false);
                setPendingFile(null);
            }
        };
        reader.readAsDataURL(pendingFile);
    };

    const handleSelectFlyer = async (id: string) => {
        setIsLoading(true);
        const flyer = await fetchAndReconstructFlyer(id);
        if (flyer) {
            setCurrentFlyer(flyer);
        }
        setIsLoading(false);
    };

    const getBirthDateParts = (fecha: any) => {
        if (!fecha) return null;
        try {
            const s = String(fecha).trim();
            if (!isNaN(Number(s)) && Number(s) > 10000) {
                const dt = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
                return { month: (dt.getUTCMonth() + 1).toString().padStart(2, '0'), day: dt.getUTCDate().toString().padStart(2, '0') };
            }
            const p = s.split(/[-/.\s]+/);
            if (p.length >= 2) {
                let day = p[0], month = p[1];
                if (p[0].length === 4) { month = p[1]; day = p[2] || '01'; }
                const cleanDay = day.replace(/\D/g, '').padStart(2, '0');
                const cleanMonth = month.replace(/\D/g, '').padStart(2, '0');
                return { month: cleanMonth, day: cleanDay };
            }
        } catch (e) {}
        return null;
    };

    const handleSearch = async () => {
        if (!db || isLoading || !selectedSeccional) { toast({ title: 'Selecciona una seccional' }); return; }
        setIsLoading(true);
        setElectores([]);
        try {
            const results: Elector[] = [];
            const dataCol = collection(db, 'sheet1');
            const scanLote = async (val: string | number) => {
                let lastDoc = null;
                let hasMore = true;
                while (hasMore && results.length < 5000) {
                    let q = query(dataCol, where('CODIGO_SEC', '==', val), limit(500));
                    if (lastDoc) q = query(q, startAfter(lastDoc));
                    const snap = await getDocs(q);
                    if (snap.empty) break;
                    snap.docs.forEach(docSnap => {
                        const data = docSnap.data() as Elector;
                        const phone = String(data.TELEFONO || '').trim();
                        if (!phone || phone.length < 6) return;
                        if (isBirthdayMode) {
                            const parts = getBirthDateParts(data.FECHA_NACI);
                            if (!parts || parts.month !== birthdayMonth || (birthdayDay !== 'ALL' && parts.day !== birthdayDay)) return;
                        }
                        results.push({ id: docSnap.id, ...data });
                    });
                    lastDoc = snap.docs[snap.docs.length - 1];
                    if (snap.docs.length < 500) hasMore = false;
                }
            };
            await Promise.all([scanLote(selectedSeccional), scanLote(Number(selectedSeccional))]);
            setElectores(results);
            toast({ title: 'Escaneo Finalizado', description: `Se hallaron ${results.length} contactos.` });
        } catch (error) { toast({ title: 'Error de conexión', variant: 'destructive' }); } finally { setIsLoading(false); }
    };

    const handleSendWhatsApp = (p: Elector) => {
        if (!p.TELEFONO || !user) return;
        let msg = invitationTemplate.replace(/{nombre}/g, `${p.NOMBRE} ${p.APELLIDO}`.trim());
        
        if (includeVotingData) {
            msg += `\n\n📍 *TU LUGAR DE VOTACIÓN:*\n🏛️ LOCAL: ${p.LOCAL || '---'}\n🗳️ MESA: ${p.MESA || '---'}\n🔢 ORDEN: ${p.ORDEN || '---'}`;
        }

        const phone = String(p.TELEFONO).replace(/\D/g, '');
        const finalPhone = phone.startsWith('595') ? phone : `595${phone.replace(/^0/, '')}`;
        const nextSet = new Set(processedIds); nextSet.add(p.id); setProcessedIds(nextSet);
        sessionStorage.setItem('wa_processed_ids', JSON.stringify(Array.from(nextSet)));
        logAction(db, { userId: user.id, userName: user.name, module: 'DIFUSION', action: 'ENVIÓ WHATSAPP', targetName: `${p.NOMBRE} ${p.APELLIDO}` });
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleShareMediaDirect = async (p: Elector) => {
        if (!p.TELEFONO || !currentFlyer || !user) return;
        const personId = p.id;
        setIsSharingMedia(prev => ({ ...prev, [personId]: true }));
        let msg = invitationTemplate.replace(/{nombre}/g, `${p.NOMBRE} ${p.APELLIDO}`.trim());
        
        if (includeVotingData) {
            msg += `\n\n📍 *TU LUGAR DE VOTACIÓN:*\n🏛️ LOCAL: ${p.LOCAL || '---'}\n🗳️ MESA: ${p.MESA || '---'}\n🔢 ORDEN: ${p.ORDEN || '---'}`;
        }

        try {
            const response = await fetch(currentFlyer.url);
            const blob = await response.blob();
            const extension = currentFlyer.type === 'video' ? 'mp4' : 'jpg';
            const file = new File([blob], `${currentFlyer.name}.${extension}`, { type: blob.type });
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], text: msg });
                logAction(db!, { userId: user.id, userName: user.name, module: 'DIFUSION', action: `COMPARTIÓ ${currentFlyer.type.toUpperCase()}`, targetName: `${p.NOMBRE} ${p.APELLIDO}` });
            } else {
                const link = document.createElement('a'); link.href = currentFlyer.url; link.download = `${currentFlyer.name}.${extension}`; link.click();
                handleSendWhatsApp(p);
            }
        } catch (e) { toast({ title: "Error al compartir", variant: "destructive" }); } finally { setIsSharingMedia(prev => ({ ...prev, [personId]: false })); }
    };

    const savePhoneEdit = () => {
        if (!editingPhoneId || !db || !user) return;
        setIsSavingPhone(true);
        const data = { TELEFONO: tempPhone };
        updateDoc(doc(db, 'sheet1', editingPhoneId), data)
            .then(() => {
                setElectores(prev => prev.map(e => e.id === editingPhoneId ? { ...e, TELEFONO: tempPhone } : e));
                toast({ title: 'Teléfono Actualizado' });
            })
            .catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `sheet1/${editingPhoneId}`, operation: 'update', requestResourceData: data }));
            })
            .finally(() => { setIsSavingPhone(false); setEditingPhoneId(null); });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><MessageSquare className="h-8 w-8 text-primary" /> Difusión Estratégica</h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Gestión de campañas masivas con fragmentación multimedia.</p>
                </div>
                {(isUploading || isLoading) && <Badge className="bg-primary animate-pulse h-9 px-4 text-xs font-black uppercase"><Zap className="h-4 w-4 mr-2 fill-white" /> PROCESANDO...</Badge>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 pb-3 border-b">
                            <CardTitle className="text-[11px] font-black uppercase flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Panel de Campaña</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-4">
                            <div className="space-y-3">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Accesos Rápidos</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('REUNION')} className="h-10 text-[10px] font-black uppercase flex items-center gap-2 justify-start px-3"><Users className="h-4 w-4 text-slate-500" /> REUNIÓN</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CENA')} className="h-10 text-[10px] font-black uppercase flex items-center gap-2 justify-start px-3"><Utensils className="h-4 w-4 text-slate-500" /> CENA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CAMINATA')} className="h-10 text-[10px] font-black uppercase flex items-center gap-2 justify-start px-3"><Footprints className="h-4 w-4 text-slate-500" /> CAMINATA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('PEGATINA')} className="h-10 text-[10px] font-black uppercase flex items-center gap-2 justify-start px-3"><Flag className="h-4 w-4 text-slate-500" /> PEGATINA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CUMPLEANOS')} className={cn("h-10 text-[10px] font-black uppercase flex items-center gap-2 justify-start px-3 col-span-2", isBirthdayMode && "bg-primary/10 border-primary text-primary")}><Cake className={cn("h-4 w-4", isBirthdayMode ? "text-primary" : "text-slate-500")} /> MODO CUMPLEAÑOS</Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase">Mensaje Personalizado</Label>
                                <Textarea 
                                    value={invitationTemplate} 
                                    onChange={(e) => setInvitationTemplate(e.target.value)} 
                                    className="min-h-[120px] text-xs font-bold border-primary/10" 
                                    placeholder="Usa {nombre} para personalizar..." 
                                />
                            </div>

                            <div className="space-y-3 p-3 border rounded-2xl bg-muted/20">
                                <Label className="text-[10px] font-black uppercase flex items-center gap-3"><ImageIcon className="h-3 w-3" /> Multimedia Fragmentada</Label>
                                {currentFlyer && (
                                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-primary/10 bg-black/5 flex items-center justify-center group">
                                        {currentFlyer.type === 'video' ? <Film className="h-8 w-8 text-primary/40" /> : <img src={currentFlyer.url} alt="Preview" className="w-full h-full object-contain" />}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Badge variant="secondary" className="font-black text-[8px]">{currentFlyer.name}</Badge>
                                        </div>
                                    </div>
                                )}
                                <Select value={currentFlyer?.id || ''} onValueChange={handleSelectFlyer}>
                                    <SelectTrigger className="h-9 text-[10px] font-bold rounded-lg"><SelectValue placeholder="Elegir recurso..." /></SelectTrigger>
                                    <SelectContent>{availableFlyers?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Label htmlFor="dif-upload" className="cursor-pointer block">
                                    <div className="h-10 border-2 border-dashed border-primary/20 rounded-lg flex items-center justify-center text-[10px] font-black hover:bg-primary/5 transition-colors">
                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4 mr-2 text-primary"/>} CARGAR MULTIMEDIA
                                    </div>
                                </Label>
                                <input id="dif-upload" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
                            </div>

                            <div className="space-y-4 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> Incluir Datos de Mesa</Label>
                                    <Switch checked={includeVotingData} onCheckedChange={setIncludeVotingData} className="data-[state=checked]:bg-blue-600" />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-2"><Cake className="h-3.5 w-3.5 text-primary" /> Segmentar Fecha</Label>
                                    <Switch checked={isBirthdayMode} onCheckedChange={(val) => { setIsBirthdayMode(val); if(val) setInvitationTemplate(EVENT_TEMPLATES.CUMPLEANOS); }} />
                                </div>

                                {isBirthdayMode && (
                                    <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase ml-1">Mes</Label>
                                            <Select value={birthdayMonth} onValueChange={setBirthdayMonth}>
                                                <SelectTrigger className="h-8 text-[9px] font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent>{MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase ml-1">Día</Label>
                                            <Select value={birthdayDay} onValueChange={setBirthdayDay}>
                                                <SelectTrigger className="h-8 text-[9px] font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent>{DIAS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase ml-1">Jurisdicción de Búsqueda</Label>
                                    <Select value={selectedSeccional} onValueChange={setSelectedSeccional} disabled={!isAdmin && !!user?.seccional}>
                                        <SelectTrigger className="h-11 font-bold text-xs rounded-xl border-primary/10"><SelectValue placeholder="Elegir Seccional..." /></SelectTrigger>
                                        <SelectContent>{seccionales.map(s => <SelectItem key={s.id} value={String(s.nombre)}>Seccional {s.nombre}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>

                                <Button className="w-full font-black h-14 text-sm uppercase shadow-xl rounded-2xl active:scale-95 transition-all" onClick={handleSearch} disabled={isLoading || !selectedSeccional}>
                                    {isLoading ? <Loader2 className="animate-spin mr-3 h-5 w-5" /> : <DatabaseZap className="mr-3 h-5 w-5" />} 
                                    ESCANEAR PADRÓN
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3">
                    <Card className="overflow-hidden border-primary/10 shadow-lg min-h-[600px] rounded-2xl">
                        <Table>
                            <TableHeader><TableRow className="bg-muted/50 text-[10px] font-black uppercase"><TableHead className="pl-6">Elector / Identidad</TableHead><TableHead>WhatsApp (Clic para Editar)</TableHead><TableHead className="text-right pr-6">Acciones Estratégicas</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? Array.from({ length: 10 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={3} className="px-6 py-4"><Skeleton className="h-12 w-full rounded-lg" /></TableCell></TableRow>)) :
                                electores.length > 0 ? electores.map(p => (
                                    <TableRow key={p.id} className={cn("transition-colors", processedIds.has(p.id) ? "bg-green-50/50" : "hover:bg-muted/20")}>
                                        <TableCell className="py-4 pl-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-xs uppercase tracking-tight text-slate-900">{p.NOMBRE} {p.APELLIDO}</span>
                                                <span className="text-[9px] text-muted-foreground font-black uppercase">C.I. {p.CEDULA} • SECC {p.CODIGO_SEC}</span>
                                                {includeVotingData && (
                                                    <span className="text-[8px] text-blue-600 font-bold uppercase mt-0.5">
                                                        Mesa: {p.MESA} / Orden: {p.ORDEN}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {editingPhoneId === p.id ? (
                                                <div className="flex gap-1 animate-in zoom-in-95"><Input value={tempPhone} onChange={(e) => setTempPhone(e.target.value)} className="h-9 text-xs font-black w-40" autoFocus onBlur={savePhoneEdit} onKeyDown={(e) => e.key === 'Enter' && savePhoneEdit()} /><Button size="icon" className="h-9 w-9 rounded-lg" onClick={savePhoneEdit} disabled={isSavingPhone}><CheckCircle2 className="h-4 w-4" /></Button></div>
                                            ) : (
                                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setEditingPhoneId(p.id); setTempPhone(p.TELEFONO || ''); }}>
                                                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    <span className="text-xs font-black text-green-700 underline decoration-dotted underline-offset-4">{p.TELEFONO}</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-2">
                                                {currentFlyer && (
                                                    <Button size="sm" variant="secondary" className="h-9 px-4 text-[10px] font-black bg-blue-600 text-white hover:bg-blue-700 shadow-md rounded-xl" onClick={() => handleShareMediaDirect(p)} disabled={isSharingMedia[p.id]}>
                                                        {isSharingMedia[p.id] ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Share2 className="mr-2 h-3.5 w-3.5" />} 
                                                        MULTIMEDIA
                                                    </Button>
                                                )}
                                                <Button size="sm" onClick={() => handleSendWhatsApp(p)} className={cn("h-9 px-5 text-[10px] font-black rounded-xl shadow-md transition-all", processedIds.has(p.id) ? "bg-slate-800" : "bg-green-500 hover:bg-green-600")}>
                                                    {processedIds.has(p.id) ? 'RE-ENVIAR' : 'ENVIAR WHATSAPP'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={3} className="h-96 text-center opacity-20"><Filter className="h-20 w-20 mx-auto mb-4 text-primary" /><p className="font-black text-sm uppercase tracking-[0.3em]">Esperando Selección de Seccional</p><p className="text-[10px] font-bold uppercase mt-2">El sistema escaneará solo los electores con teléfono cargado.</p></TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>

            <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <div className="p-6">
                        <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-6"><Type className="h-6 w-6 text-primary" /> Identificar Multimedia</h2>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre del Recurso</Label>
                                <Input value={newImageName} onChange={(e) => setNewImageName(e.target.value.toUpperCase())} className="font-bold uppercase h-12 rounded-xl" autoFocus />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={() => setIsNameDialogOpen(false)} className="font-black uppercase text-xs h-11 rounded-xl">CANCELAR</Button>
                                <Button onClick={confirmUpload} disabled={!newImageName.trim() || isUploading} className="font-black uppercase text-xs h-11 px-8 rounded-xl shadow-lg">
                                    {isUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} GUARDAR EN BIBLIOTECA
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="text-center pt-10 opacity-40">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900">
                    SISTEMA DE GESTIÓN ESTRATÉGICA - LISTA 2P OPCION 2
                </p>
            </div>
        </div>
    );
}

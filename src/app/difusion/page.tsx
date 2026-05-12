'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, orderBy, limit, startAfter, getDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollectionOnce } from '@/firebase/firestore/use-collection-once';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
    Search,
    Loader2, 
    MessageSquare, 
    CheckCircle2,
    Smartphone,
    DatabaseZap,
    Cake,
    Filter,
    Upload,
    MapPin,
    Image as ImageIcon,
    Type,
    Save,
    Film,
    Zap,
    Users,
    Utensils,
    Footprints,
    Flag,
    Share2,
    CheckCircle,
    X,
    ShieldAlert,
    Check,
    ChevronsUpDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface Elector {
    id: string;
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    TELEFONO?: string;
    TELEFONO_MIGRADO?: string;
    LOCAL?: string;
    MESA?: string | number;
    ORDEN?: string | number;
    CODIGO_SEC?: string | number;
    FECHA_NACI?: string | number;
}

const EVENT_TEMPLATES = {
    REUNION: "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\nTe invitamos a participar de nuestra gran REUNIÓN política. Tu presencia es fundamental.\n\n¡Contamos con tu apoyo! 🚀",
    CENA: "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\nTe invitamos a compartir una CENA de confraternidad con todo el equipo. ¡Será un gusto conversar contigo!\n\n¡Contamos con tu apoyo! 🚀",
    CAMINATA: "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\nEstaremos realizando una gran CAMINATA en tu zona. ¡Súmate a la marea roja para conocernos mejor!\n\n¡Contamos con tu apoyo! 🚀",
    PEGATINA: "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\nGran jornada de PEGATINA en la ciudad. ¡Vení a ponerle color y alegría a nuestro proyecto!\n\n¡Contamos con tu apoyo! 🚀",
    CUMPLEANOS: "¡Hola, {nombre}! 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\n¡Hoy es un día especial! Desde el equipo de la Lista 2P te deseamos un ¡MUY FELIZ CUMPLEAÑOS! 🎂🎉 Que pases un excelente día. ¡Un gran abrazo! 🚀"
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

const formatParaguayPhone = (phone: string): string => {
    let clean = String(phone).replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length >= 9) {
        clean = clean.slice(-9);
    } else {
        clean = clean.replace(/^0+/, '');
    }
    return `595${clean}`;
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

const SETTINGS_COLLECTION = 'system_settings';
const FLYERS_COLLECTION = 'flyer_library';
const CHUNK_SIZE = 800 * 1024;

export default function DifusionPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [activeTab, setActiveTab] = useState<'padron' | 'votos'>('padron');
    const [seccionales, setSeccionales] = useState<any[]>([]);
    const [selectedSeccional, setSelectedSeccional] = useState('');
    const [jurisdiccionOpen, setJurisdiccionOpen] = useState(false);
    const [selectedOperatorFilter, setSelectedOperatorFilter] = useState<string>('ALL');
    const [electores, setElectores] = useState<Elector[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    
    const [invitationTemplate, setInvitationTemplate] = useState(
        "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\nTe invitamos a participar de nuestras actividades de la semana.\n\n¡Contamos con tu apoyo! 🚀"
    );
    const [isBirthdayMode, setIsBirthdayMode] = useState(false);
    const [includeVotingData, setIncludeVotingData] = useState(false);
    const [birthdayMonth, setBirthdayMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
    const [birthdayDay, setBirthdayDay] = useState('ALL');

    const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<'TELEFONO' | 'TELEFONO_MIGRADO' | null>(null);
    const [tempPhone, setTempPhone] = useState('');
    const [isSavingPhone, setIsSavingPhone] = useState(false);

    const [currentFlyer, setCurrentFlyer] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSharingMedia, setIsSharingMedia] = useState<Record<string, boolean>>({});

    const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [newImageName, setNewImageName] = useState('');

    // Mobile Batch Assistant State
    const [batchSize, setBatchSize] = useState<number>(5);
    const [isBatchActive, setIsBatchActive] = useState(false);
    const [batchSentCount, setBatchSentCount] = useState(0);
    const [showBatchCompletedAlert, setShowBatchCompletedAlert] = useState(false);

    // Búsqueda unitaria en el Sidebar
    const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
    const [sidebarSearchResults, setSidebarSearchResults] = useState<Elector[]>([]);
    const [isSidebarSearching, setIsSidebarSearching] = useState(false);
    const [selectedSidebarElector, setSelectedSidebarElector] = useState<Elector | null>(null);
    const [sidebarPhone, setSidebarPhone] = useState('');
    const [isSavingSidebarPhone, setIsSavingSidebarPhone] = useState(false);
    const [sidebarMessage, setSidebarMessage] = useState('');
    const [sidebarFlyerId, setSidebarFlyerId] = useState('NONE');
    const [sidebarFlyer, setSidebarFlyer] = useState<any>(null);
    const [isSidebarFlyerLoading, setIsSidebarFlyerLoading] = useState(false);
    const [sidebarBaseTemplate, setSidebarBaseTemplate] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sidebar_base_template') || 
                "¡Hola, {nombre}! 👋 Te saluda El Arki Sotomayor.\n\nEste domingo 7 de junio, ¡queremos que vos seas el protagonista del cambio transformemos Asuncion juntos! Te invito a que nos sumemos para cambiar Asunción juntos. Con Camilo Pérez Intendente Lista 2 y El Arki Sotomayor Concejal Lista 2P opcion 2, el cambio real empieza con tu voto. ¡Contamos con vos!";
        }
        return "¡Hola, {nombre}! 👋 Te saluda El Arki Sotomayor.\n\nEste domingo 7 de junio, ¡queremos que vos seas el protagonista del cambio transformemos Asuncion juntos! Te invito a que nos sumemos para cambiar Asunción juntos. Con Camilo Pérez Intendente Lista 2 y El Arki Sotomayor Concejal Lista 2P opcion 2, el cambio real empieza con tu voto. ¡Contamos con vos!";
    });

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';

    // Spintax Resolver to dynamically randomize manual mobile templates
    const resolveSpintax = useCallback((text: string) => {
        return text.replace(/\{([^{}]+)\}/g, (match, options) => {
            if (options.includes('|')) {
                const choices = options.split('|');
                return choices[Math.floor(Math.random() * choices.length)];
            }
            return match; // Keep standard placeholders like {nombre}
        });
    }, []);

    // Firestore Votos query by Role
    const registeredVotosQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        const isDirigente = user.role === 'Dirigente';
        if (isDirigente) {
            return query(
                collection(db, 'votos_confirmados'),
                where('registradoPor_id', '==', user.id),
                orderBy('APELLIDO', 'asc')
            );
        }
        return query(
            collection(db, 'votos_confirmados'),
            orderBy('APELLIDO', 'asc')
        );
    }, [db, user]);

    const { data: votosList, isLoading: isLoadingVotos } = useCollection<any>(registeredVotosQuery);

    const flyersQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, FLYERS_COLLECTION), orderBy('createdAt', 'desc'));
    }, [db]);

    const { data: availableFlyers } = useCollectionOnce(flyersQuery);

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
            console.error(e);
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
            console.error(e);
            return null;
        }
    }, [db, base64ToBlobUrl]);

    const filteredVotosList = useMemo(() => {
        if (!votosList || !user) return [];
        const isPresidente = user.role === 'Presidente';
        const isCoordinador = user.role === 'Coordinador';
        const userSeccionales = user.seccionales || [];

        let list = votosList;
        if (isPresidente || isCoordinador) {
            list = votosList.filter(item => {
                const itemSec = String(item.CODIGO_SEC || '');
                return userSeccionales.includes(itemSec) || item.registradoPor_id === user.id;
            });
        }

        if (selectedSeccional && selectedSeccional !== 'ALL') {
            list = list.filter(item => String(item.CODIGO_SEC || '').toUpperCase() === selectedSeccional.toUpperCase());
        }

        if (isBirthdayMode) {
            list = list.filter(item => {
                const parts = getBirthDateParts(item.FECHA_NACI);
                if (!parts) return false;
                return parts.month === birthdayMonth && (birthdayDay === 'ALL' || parts.day === birthdayDay);
            });
        }

        if (selectedOperatorFilter && selectedOperatorFilter !== 'ALL') {
            list = list.filter(item => (item.registradoPor_id || 'unknown') === selectedOperatorFilter);
        }

        const sortedList = [...list];
        sortedList.sort((a, b) => String(a.APELLIDO || '').localeCompare(String(b.APELLIDO || ''), undefined, { numeric: true }));
        return sortedList;
    }, [votosList, user, selectedSeccional, isBirthdayMode, birthdayMonth, birthdayDay, selectedOperatorFilter]);

    const registeredOperators = useMemo(() => {
        if (!votosList) return [];
        const map = new Map<string, string>();
        votosList.forEach(item => {
            const id = item.registradoPor_id || 'unknown';
            const name = item.registradoPor_nombre || 'Desconocido';
            if (!map.has(id)) {
                map.set(id, name);
            }
        });
        const list = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }, [votosList]);

    useEffect(() => {
        const fetchData = async () => {
            if (!db) return;
            try {
                const sSnap = await getDocs(collection(db, 'seccionales'));
                const list = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                list.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), undefined, { numeric: true }));
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

    useEffect(() => {
        const loadSidebarFlyer = async () => {
            if (sidebarFlyerId === 'NONE' || !sidebarFlyerId) {
                setSidebarFlyer(null);
                return;
            }
            setIsSidebarFlyerLoading(true);
            try {
                const flyer = await fetchAndReconstructFlyer(sidebarFlyerId);
                setSidebarFlyer(flyer);
            } catch (e) {
                console.error("Error cargando folleto de barra lateral:", e);
                setSidebarFlyer(null);
            } finally {
                setIsSidebarFlyerLoading(false);
            }
        };
        loadSidebarFlyer();
    }, [sidebarFlyerId, fetchAndReconstructFlyer]);

    const handleApplyTemplate = (type: keyof typeof EVENT_TEMPLATES) => {
        setInvitationTemplate(EVENT_TEMPLATES[type]);
        setIsBirthdayMode(type === 'CUMPLEANOS');
        toast({ title: `Plantilla de ${type} cargada` });
    };

    const handleSearch = async () => {
        if (!db || isLoading || !selectedSeccional) { toast({ title: 'Selecciona una seccional' }); return; }
        setIsLoading(true);
        setElectores([]);
        setIsBatchActive(false);
        setBatchSentCount(0);
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
                        const phoneMig = String(data.TELEFONO_MIGRADO || '').trim();
                        if ((!phone || phone.length < 6) && (!phoneMig || phoneMig.length < 6)) return;
                        if (isBirthdayMode) {
                            const parts = getBirthDateParts(data.FECHA_NACI);
                            if (!parts || parts.month !== birthdayMonth || (birthdayDay !== 'ALL' && parts.day !== birthdayDay)) return;
                        }
                        const { id, ...rest } = data as any;
                        results.push({ ...rest, id: docSnap.id });
                    });
                    lastDoc = snap.docs[snap.docs.length - 1];
                    if (snap.docs.length < 500) hasMore = false;
                }
            };
            await Promise.all([scanLote(selectedSeccional), scanLote(Number(selectedSeccional))]);
            const uniqueResultsMap = new Map<string, Elector>();
            results.forEach(item => uniqueResultsMap.set(item.id, item));
            const sortedResults = Array.from(uniqueResultsMap.values());
            sortedResults.sort((a, b) => String(a.APELLIDO || '').localeCompare(String(b.APELLIDO || ''), undefined, { numeric: true }));
            setElectores(sortedResults);
            toast({ title: 'Escaneo Finalizado', description: `Se hallaron ${sortedResults.length} contactos.` });
        } catch (error) { toast({ title: 'Error de conexión', variant: 'destructive' }); } finally { setIsLoading(false); }
    };

    // Active Queue list shorthand
    const activeQueue = useMemo(() => {
        return activeTab === 'padron' ? electores : filteredVotosList;
    }, [activeTab, electores, filteredVotosList]);

    // Computed: The absolute next unprocessed contact in the queue list
    const nextElectorToProcess = useMemo(() => {
        return activeQueue.find(e => !processedIds.has(e.id));
    }, [activeQueue, processedIds]);

    // Formats, records local logs, and issues native api.whatsapp.com redirect
    const handleSendWhatsApp = (p: Elector, targetPhone: string) => {
        if (!targetPhone || !user) return;
        let msg = resolveSpintax(invitationTemplate);
        msg = msg.replace(/{nombre}/g, `${p.NOMBRE} ${p.APELLIDO}`.trim())
                 .replace(/\[NOMBRE\]/g, `${p.NOMBRE} ${p.APELLIDO}`.trim())
                 .replace(/\[LOCAL\]/g, String(p.LOCAL || '---'))
                 .replace(/\[MESA\]/g, String(p.MESA || '---'))
                 .replace(/\[ORDEN\]/g, String(p.ORDEN || '---'));
        
        if (includeVotingData) {
            msg += `\n\n📍 *TU LUGAR DE VOTACIÓN:*\n🏛️ LOCAL: ${p.LOCAL || '---'}\n🗳️ MESA: ${p.MESA || '---'}\n🔢 ORDEN: ${p.ORDEN || '---'}`;
        }

        const finalPhone = formatParaguayPhone(targetPhone);
        const nextSet = new Set(processedIds);
        nextSet.add(p.id);
        setProcessedIds(nextSet);
        sessionStorage.setItem('wa_processed_ids', JSON.stringify(Array.from(nextSet)));
        
        if (db) {
            logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'DIFUSION',
                action: 'ENVIÓ MANUAL MOVIL',
                targetName: `${p.NOMBRE} ${p.APELLIDO} (${targetPhone})`
            });
        }
        
        // Deep link perfect for native WhatsApp application launch on Android / iOS!
        window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(msg)}`, '_blank');
    };

    // Invokes native Android / iOS share sheets for media sending
    const handleShareMediaDirect = async (p: Elector, targetPhone: string): Promise<boolean> => {
        if (!targetPhone || !currentFlyer || !user) return false;
        const personId = p.id;
        setIsSharingMedia(prev => ({ ...prev, [personId]: true }));

        let msg = resolveSpintax(invitationTemplate);
        msg = msg.replace(/{nombre}/g, `${p.NOMBRE} ${p.APELLIDO}`.trim())
                 .replace(/\[NOMBRE\]/g, `${p.NOMBRE} ${p.APELLIDO}`.trim())
                 .replace(/\[LOCAL\]/g, String(p.LOCAL || '---'))
                 .replace(/\[MESA\]/g, String(p.MESA || '---'))
                 .replace(/\[ORDEN\]/g, String(p.ORDEN || '---'));
        
        if (includeVotingData) {
            msg += `\n\n📍 *TU LUGAR DE VOTACIÓN:*\n🏛️ LOCAL: ${p.LOCAL || '---'}\n🗳️ MESA: ${p.MESA || '---'}\n🔢 ORDEN: ${p.ORDEN || '---'}`;
        }

        try {
            const response = await fetch(currentFlyer.url);
            const blob = await response.blob();
            const extension = currentFlyer.type === 'video' ? 'mp4' : 'jpg';
            const file = new File([blob], `${currentFlyer.name}.${extension}`, { type: blob.type });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                // Native mobile share popup trigger! Perfect for cellphones!
                await navigator.share({
                    files: [file],
                    text: msg
                });
                
                const nextSet = new Set(processedIds);
                nextSet.add(p.id);
                setProcessedIds(nextSet);
                sessionStorage.setItem('wa_processed_ids', JSON.stringify(Array.from(nextSet)));

                logAction(db!, { 
                    userId: user.id, 
                    userName: user.name, 
                    module: 'DIFUSION', 
                    action: `COMPARTIÓ NATIVO ${currentFlyer.type.toUpperCase()}`, 
                    targetName: `${p.NOMBRE} ${p.APELLIDO}` 
                });
                return true;
            } else {
                // Fallback for PC/older systems: download media and launch WhatsApp chat
                const link = document.createElement('a');
                link.href = currentFlyer.url;
                link.download = `${currentFlyer.name}.${extension}`;
                link.click();
                handleSendWhatsApp(p, targetPhone);
                return true;
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Acción cancelada o no soportada", variant: "default" });
            return false;
        } finally {
            setIsSharingMedia(prev => ({ ...prev, [personId]: false }));
        }
    };

    // Sequential batch sender trigger!
    const handleTriggerNextAssistant = async () => {
        if (!nextElectorToProcess) {
            toast({ title: 'No hay más electores pendientes.' });
            setIsBatchActive(false);
            return;
        }

        const p = nextElectorToProcess;
        // Prefer manual registered phone first, fallback to Excel migrated
        const targetPhone = p.TELEFONO || p.TELEFONO_MIGRADO || '';
        
        if (!targetPhone || targetPhone.trim().length < 6) {
            // No phone, skip this contact by adding to processed list automatically
            const nextSet = new Set(processedIds);
            nextSet.add(p.id);
            setProcessedIds(nextSet);
            sessionStorage.setItem('wa_processed_ids', JSON.stringify(Array.from(nextSet)));
            toast({ title: `Omitido ${p.NOMBRE} (Sin Teléfono)` });
            return;
        }

        // If media flyer is selected, use navigator.share trigger
        if (currentFlyer) {
            const shared = await handleShareMediaDirect(p, targetPhone);
            if (shared) {
                const nextCount = batchSentCount + 1;
                setBatchSentCount(nextCount);
                if (nextCount >= batchSize) {
                    setIsBatchActive(false);
                    setShowBatchCompletedAlert(true);
                }
            }
        } else {
            // Text only prefilled redirect trigger
            handleSendWhatsApp(p, targetPhone);
            const nextCount = batchSentCount + 1;
            setBatchSentCount(nextCount);
            if (nextCount >= batchSize) {
                setIsBatchActive(false);
                setShowBatchCompletedAlert(true);
            }
        }
    };

    const savePhoneEdit = (phoneType: 'TELEFONO' | 'TELEFONO_MIGRADO') => {
        if (!editingPhoneId || !db || !user) return;
        setIsSavingPhone(true);
        const data = { [phoneType]: tempPhone };
        const collectionName = activeTab === 'padron' ? 'sheet1' : 'votos_confirmados';
        updateDoc(doc(db, collectionName, editingPhoneId), data)
            .then(() => {
                if (activeTab === 'padron') {
                    setElectores(prev => prev.map(e => e.id === editingPhoneId ? { ...e, [phoneType]: tempPhone } : e));
                }
                toast({ title: 'Teléfono Actualizado' });
            })
            .catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${collectionName}/${editingPhoneId}`, operation: 'update', requestResourceData: data }));
            })
            .finally(() => { setIsSavingPhone(false); setEditingPhoneId(null); setEditingField(null); });
    };

    // Background files library uploads
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

    // Traer el nombre de pila y el primer apellido
    const getFormattedSidebarName = (e: Elector) => {
        const firstName = e.NOMBRE ? e.NOMBRE.trim() : '';
        const firstSurname = e.APELLIDO ? e.APELLIDO.trim().split(' ')[0] : '';
        return `${firstName} ${firstSurname}`.trim();
    };

    // Generar el mensaje individual dinámico basado en la plantilla base
    const generateSidebarMessage = (e: Elector, templateStr: string) => {
        const displayName = getFormattedSidebarName(e);
        let msg = templateStr
            .replace(/{nombre}/g, displayName)
            .replace(/\[NOMBRE\]/g, displayName)
            .replace(/\[LOCAL\]/g, String(e.LOCAL || '---'))
            .replace(/\[MESA\]/g, String(e.MESA || '---'))
            .replace(/\[ORDEN\]/g, String(e.ORDEN || '---'));
            
        // Autocompletar datos electorales al final si no existen placeholders en la plantilla
        const hasVotingPlaceholders = templateStr.includes('[LOCAL]') || templateStr.includes('[MESA]') || templateStr.includes('[ORDEN]');
        if (!hasVotingPlaceholders) {
            msg += `\n\n📍 *TU LUGAR DE VOTACIÓN:*\n🏛️ LOCAL: ${e.LOCAL || '---'}\n🗳️ MESA: ${e.MESA || '---'}\n🔢 ORDEN: ${e.ORDEN || '---'}`;
        }
        return msg;
    };

    // Guardar los cambios realizados en el mensaje como la nueva plantilla base con placeholders
    const handleSaveBaseTemplate = () => {
        let templateToSave = sidebarMessage;
        
        if (selectedSidebarElector) {
            const displayName = getFormattedSidebarName(selectedSidebarElector);
            
            // Reemplazar el nombre específico de vuelta al placeholder {nombre} (case-insensitive)
            if (displayName) {
                const escapedName = displayName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                templateToSave = templateToSave.replace(new RegExp(escapedName, 'gi'), '{nombre}');
            }
            if (selectedSidebarElector.LOCAL) {
                const escapedLocal = selectedSidebarElector.LOCAL.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                templateToSave = templateToSave.replace(new RegExp(escapedLocal, 'gi'), '[LOCAL]');
            }
            if (selectedSidebarElector.MESA) {
                // Para evitar falsos positivos con dígitos solos, reemplazamos solo palabras enteras si aplica, pero aquí
                // asumimos que el usuario edita el formato general.
                templateToSave = templateToSave.replace(new RegExp(String(selectedSidebarElector.MESA), 'g'), '[MESA]');
            }
            if (selectedSidebarElector.ORDEN) {
                templateToSave = templateToSave.replace(new RegExp(String(selectedSidebarElector.ORDEN), 'g'), '[ORDEN]');
            }
        }
        
        setSidebarBaseTemplate(templateToSave);
        localStorage.setItem('sidebar_base_template', templateToSave);
        toast({ title: 'Plantilla Base Guardada', description: 'Las próximas búsquedas usarán este formato.' });
    };

    // Funciones para búsqueda unitaria en Sidebar
    const handleSidebarSearch = async () => {
        const term = sidebarSearchTerm.trim().toUpperCase();
        if (!term) return;

        setIsSidebarSearching(true);
        setSelectedSidebarElector(null);
        setSidebarSearchResults([]);

        try {
            const resultsMap = new Map<string, Elector>();
            const dataCol = collection(db!, 'sheet1');
            const isNumericSearch = /^\d+$/.test(term);

            let searchQueries = [];
            if (isNumericSearch) {
                searchQueries.push(getDocs(query(dataCol, where('CEDULA', '==', Number(term)), limit(20))));
                searchQueries.push(getDocs(query(dataCol, where('CEDULA', '==', term), limit(20))));
            } else {
                const words = term.split(' ').filter(w => w.length >= 3);
                if (words.length === 0) { 
                    toast({ title: 'Ingresa al menos 3 letras' });
                    setIsSidebarSearching(false); 
                    return; 
                }
                words.forEach(w => {
                    searchQueries.push(getDocs(query(dataCol, where('NOMBRE', '>=', w), where('NOMBRE', '<=', w + '\uf8ff'), limit(50))));
                    searchQueries.push(getDocs(query(dataCol, where('APELLIDO', '>=', w), where('APELLIDO', '<=', w + '\uf8ff'), limit(50))));
                });
            }

            const snapshots = await Promise.all(searchQueries);
            snapshots.forEach(snapshot => snapshot.forEach(docSnap => {
                if (!resultsMap.has(docSnap.id)) {
                    resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Elector);
                }
            }));

            let foundResults = Array.from(resultsMap.values());

            if (!isNumericSearch) {
                const words = term.split(' ').filter(w => w);
                foundResults = foundResults.filter(p => {
                    const full = `${p.NOMBRE || ''} ${p.APELLIDO || ''}`.toUpperCase();
                    return words.every(w => full.includes(w));
                });
            }

            foundResults.sort((a, b) => String(a.APELLIDO || '').localeCompare(String(b.APELLIDO || ''), undefined, { numeric: true }));
            setSidebarSearchResults(foundResults);
            
            if (foundResults.length === 0) {
                toast({ title: 'Sin resultados' });
            } else {
                toast({ title: 'Elector encontrado', description: `Se encontraron ${foundResults.length} coincidencias.` });
                if (foundResults.length === 1) {
                    const e = foundResults[0];
                    setSelectedSidebarElector(e);
                    setSidebarPhone(e.TELEFONO || e.TELEFONO_MIGRADO || '');
                    setSidebarFlyerId(currentFlyer?.id || 'NONE');
                    setSidebarMessage(generateSidebarMessage(e, sidebarBaseTemplate));
                }
            }
        } catch (error) {
            console.error("Error en búsqueda de sidebar:", error);
            toast({ title: 'Error de conexión', variant: 'destructive' });
        } finally {
            setIsSidebarSearching(false);
        }
    };

    const handleSaveSidebarPhone = async () => {
        if (!selectedSidebarElector || !db || !user) return;
        setIsSavingSidebarPhone(true);
        const data = { TELEFONO: sidebarPhone };
        try {
            await updateDoc(doc(db, 'sheet1', selectedSidebarElector.id), data);
            
            // Actualizar estado en resultados de búsqueda local
            setSidebarSearchResults(prev => prev.map(e => e.id === selectedSidebarElector.id ? { ...e, TELEFONO: sidebarPhone } : e));
            setSelectedSidebarElector(prev => prev ? { ...prev, TELEFONO: sidebarPhone } : null);
            
            // Sincronizar también con la lista principal por si acaso está el elector ahí
            setElectores(prev => prev.map(e => e.id === selectedSidebarElector.id ? { ...e, TELEFONO: sidebarPhone } : e));
            
            toast({ title: 'Teléfono guardado con éxito' });
        } catch (error) {
            console.error("Error guardando teléfono:", error);
            toast({ title: 'Error al actualizar teléfono', variant: 'destructive' });
        } finally {
            setIsSavingSidebarPhone(false);
        }
    };

    const handleSendSidebarWhatsApp = (p: Elector, targetPhone: string) => {
        if (!targetPhone || !user) return;
        const finalPhone = formatParaguayPhone(targetPhone);
        
        // Agregar a procesados/historial
        const nextSet = new Set(processedIds);
        nextSet.add(p.id);
        setProcessedIds(nextSet);
        sessionStorage.setItem('wa_processed_ids', JSON.stringify(Array.from(nextSet)));
        
        if (db) {
            logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'DIFUSION_INDIVIDUAL',
                action: 'ENVIÓ MENSAJE INDIVIDUAL',
                targetName: `${p.NOMBRE} ${p.APELLIDO} (${targetPhone})`
            });
        }
        
        window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(sidebarMessage)}`, '_blank');
    };

    const handleShareSidebarMedia = async (p: Elector, targetPhone: string) => {
        if (!targetPhone || !user) return;
        
        if (sidebarFlyerId === 'NONE') {
            handleSendSidebarWhatsApp(p, targetPhone);
            return;
        }

        const personId = p.id;
        setIsSharingMedia(prev => ({ ...prev, [personId]: true }));

        try {
            const flyer = sidebarFlyer || await fetchAndReconstructFlyer(sidebarFlyerId);
            if (!flyer) {
                toast({ title: "No se pudo cargar la imagen", variant: "destructive" });
                setIsSharingMedia(prev => ({ ...prev, [personId]: false }));
                return;
            }

            const response = await fetch(flyer.url);
            const blob = await response.blob();
            const extension = flyer.type === 'video' ? 'mp4' : 'jpg';
            const file = new File([blob], `${flyer.name}.${extension}`, { type: blob.type });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    text: sidebarMessage
                });
                
                // Agregar a procesados/historial
                const nextSet = new Set(processedIds);
                nextSet.add(p.id);
                setProcessedIds(nextSet);
                sessionStorage.setItem('wa_processed_ids', JSON.stringify(Array.from(nextSet)));
                
                logAction(db!, { 
                    userId: user.id, 
                    userName: user.name, 
                    module: 'DIFUSION_INDIVIDUAL', 
                    action: `COMPARTIÓ INDIVIDUAL ${flyer.type.toUpperCase()}`, 
                    targetName: `${p.NOMBRE} ${p.APELLIDO}` 
                });
            } else {
                toast({ 
                    title: "📥 Folleto Descargado", 
                    description: "Se ha descargado el folleto automáticamente. Por favor, pégalo (Ctrl+V) o adjúntalo en el chat de WhatsApp que se abrirá.",
                    duration: 7000
                });
                const link = document.createElement('a');
                link.href = flyer.url;
                link.download = `${flyer.name}.${extension}`;
                link.click();
                handleSendSidebarWhatsApp(p, targetPhone);
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Acción cancelada o no soportada" });
        } finally {
            setIsSharingMedia(prev => ({ ...prev, [personId]: false }));
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 pb-24">
            
            {/* Elegant Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <MessageSquare className="h-7 w-7 sm:h-8 sm:w-8 text-primary animate-pulse" /> Difusión Estratégica Móvil
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[9px] sm:text-[10px] tracking-widest mt-1">
                        Campañas por lotes de un toque optimizadas para operadores trabajando desde celulares.
                    </p>
                </div>
                {isBatchActive && (
                    <Badge className="bg-green-600 animate-pulse h-9 px-4 text-xs font-black uppercase flex items-center gap-2">
                        <Zap className="h-4 w-4 mr-1 fill-white" /> ASISTENTE ACTIVO
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Configuration Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                    
                    {/* NEW Mobile Batch Control Widget */}
                    <Card className="border-primary/15 shadow-md overflow-hidden bg-slate-900 text-white rounded-2xl">
                        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase flex items-center gap-2 text-primary">
                                <Zap className="h-4 w-4 text-primary fill-primary animate-bounce" /> Asistente de Lotes
                            </h3>
                        </div>
                        <CardContent className="space-y-4 pt-4">
                            
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Tamaño del Lote</Label>
                                <Select value={String(batchSize)} onValueChange={(val) => setBatchSize(Number(val))}>
                                    <SelectTrigger className="h-10 text-xs font-black rounded-xl bg-slate-950 border-slate-800 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="5" className="font-black text-xs">Lotes de 5 personas</SelectItem>
                                        <SelectItem value="10" className="font-black text-xs">Lotes de 10 personas</SelectItem>
                                        <SelectItem value="20" className="font-black text-xs">Lotes de 20 personas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Historial de Envío de Sesión</p>
                                <h4 className="text-2xl font-black text-white">{processedIds.size}</h4>
                                <p className="text-[8px] font-bold text-slate-500 uppercase">CONTACTOS TOTALES EN COLA: {activeQueue.length}</p>
                            </div>

                            {!isBatchActive ? (
                                <Button 
                                    onClick={() => {
                                        if (activeQueue.length === 0) {
                                            toast({ title: "Lista de contactos vacía", description: "Busca contactos de la seccional primero." });
                                            return;
                                        }
                                        setBatchSentCount(0);
                                        setIsBatchActive(true);
                                        toast({ title: "Asistente Iniciado", description: `Enviando en lotes de ${batchSize} personas.` });
                                    }}
                                    className="w-full h-11 text-[11px] font-black uppercase bg-primary hover:bg-primary/95 text-white rounded-xl flex items-center justify-center gap-2"
                                >
                                    <Zap className="h-4 w-4 fill-white" /> Iniciar Asistente Móvil
                                </Button>
                            ) : (
                                <Button 
                                    onClick={() => setIsBatchActive(false)}
                                    className="w-full h-11 text-[11px] font-black uppercase bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl flex items-center justify-center gap-2"
                                >
                                    <X className="h-4 w-4" /> Desactivar Asistente
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* NUEVO: Buscador Unitario de Elector */}
                    <Card className="border-primary/15 shadow-md overflow-hidden rounded-2xl bg-white border border-slate-100">
                        <div className="bg-slate-50 p-4 border-b flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase flex items-center gap-2 text-primary">
                                <Search className="h-4 w-4 text-primary" /> Enviar Datos Individuales
                            </h3>
                        </div>
                        <CardContent className="space-y-4 pt-4">
                            <div className="flex gap-1.5">
                                <Input 
                                    placeholder="CÉDULA O NOMBRE..." 
                                    value={sidebarSearchTerm} 
                                    onChange={(e) => setSidebarSearchTerm(e.target.value)} 
                                    className="h-10 text-xs font-black uppercase"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSidebarSearch()}
                                />
                                <Button 
                                    onClick={handleSidebarSearch} 
                                    disabled={isSidebarSearching} 
                                    className="h-10 px-3 bg-primary hover:bg-primary/90 text-white"
                                >
                                    {isSidebarSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>

                            {/* Resultados de búsqueda en el sidebar */}
                            {sidebarSearchResults.length > 0 && (
                                <div className="space-y-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                        {sidebarSearchResults.map(e => {
                                            const isSelected = selectedSidebarElector?.id === e.id;
                                            return (
                                                <div 
                                                    key={e.id} 
                                                    onClick={() => {
                                                        setSelectedSidebarElector(e);
                                                        setSidebarPhone(e.TELEFONO || e.TELEFONO_MIGRADO || '');
                                                        setSidebarFlyerId(currentFlyer?.id || 'NONE');
                                                        setSidebarMessage(generateSidebarMessage(e, sidebarBaseTemplate));
                                                    }}
                                                    className={cn(
                                                        "p-2 rounded-lg border text-left cursor-pointer transition-all",
                                                        isSelected 
                                                            ? "bg-primary/5 border-primary" 
                                                            : "bg-white border-slate-100 hover:border-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <p className="text-[10px] font-black uppercase leading-tight text-slate-950 truncate">
                                                            {e.NOMBRE} {e.APELLIDO}
                                                        </p>
                                                        {processedIds.has(e.id) && (
                                                            <Badge className="h-4 px-1 text-[7px] font-black uppercase bg-green-500 hover:bg-green-600 text-white rounded flex items-center gap-0.5 shrink-0">
                                                                <CheckCircle className="h-2.5 w-2.5 text-white fill-white" /> ENVIADO
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-[8px] font-bold uppercase text-slate-500 mt-0.5">
                                                        C.I. {e.CEDULA} • SECC {e.CODIGO_SEC}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {selectedSidebarElector && (
                                        <div className="border-t pt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {/* Detalles del elector */}
                                            <div className="text-left text-[9px] uppercase font-bold text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 space-y-1">
                                                <div className="flex items-center justify-between gap-1.5">
                                                    <p className="font-extrabold text-[10px] text-primary truncate">{selectedSidebarElector.NOMBRE} {selectedSidebarElector.APELLIDO}</p>
                                                    {processedIds.has(selectedSidebarElector.id) && (
                                                        <Badge className="h-4.5 px-1.5 text-[7px] font-black uppercase bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center gap-0.5 shrink-0">
                                                            <CheckCircle className="h-2.5 w-2.5 text-white fill-white animate-bounce" /> ENVIADO
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p>🏛️ Local: <span className="font-extrabold text-slate-900">{selectedSidebarElector.LOCAL || '---'}</span></p>
                                                <p>🗳️ Mesa: <span className="font-extrabold text-slate-900">{selectedSidebarElector.MESA || '---'}</span> / Orden: <span className="font-extrabold text-slate-900">{selectedSidebarElector.ORDEN || '---'}</span></p>
                                            </div>

                                            {/* Campo editable de teléfono */}
                                            <div className="space-y-1 text-left">
                                                <Label className="text-[8px] font-black uppercase text-slate-400">Número de WhatsApp</Label>
                                                <div className="flex gap-1">
                                                    <Input 
                                                        value={sidebarPhone} 
                                                        onChange={(e) => setSidebarPhone(e.target.value)} 
                                                        placeholder="09xx-xxx-xxx" 
                                                        className="h-9 text-xs font-black"
                                                    />
                                                    <Button 
                                                        size="sm" 
                                                        onClick={handleSaveSidebarPhone} 
                                                        disabled={isSavingSidebarPhone}
                                                        className="h-9 px-2 bg-slate-800 hover:bg-slate-700 text-white"
                                                    >
                                                        {isSavingSidebarPhone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Selección de Flyer Individual */}
                                            <div className="space-y-1.5 text-left">
                                                <Label className="text-[8px] font-black uppercase text-slate-400">Folleto Multimedia</Label>
                                                
                                                {/* Previsualización del folleto individual */}
                                                {sidebarFlyerId !== 'NONE' && (
                                                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-primary/10 bg-slate-100 flex items-center justify-center animate-in zoom-in-95 duration-200">
                                                        {isSidebarFlyerLoading ? (
                                                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                                        ) : sidebarFlyer ? (
                                                            sidebarFlyer.type === 'video' ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Film className="h-6 w-6 text-primary" />
                                                                    <span className="text-[9px] font-black uppercase text-slate-500">Video: {sidebarFlyer.name}</span>
                                                                </div>
                                                            ) : (
                                                                <img src={sidebarFlyer.url} alt="Vista previa" className="w-full h-full object-contain" />
                                                            )
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-red-500 uppercase">⚠️ Error al cargar recurso</span>
                                                        )}
                                                    </div>
                                                )}

                                                <Select value={sidebarFlyerId} onValueChange={setSidebarFlyerId}>
                                                    <SelectTrigger className="h-9 text-[10px] font-bold rounded-xl bg-white border-primary/10">
                                                        <SelectValue placeholder="Sin folleto (Solo Texto)" />
                                                    </SelectTrigger>
                                                    <SelectContent className="z-[2000]">
                                                        <SelectItem value="NONE" className="text-xs font-bold uppercase text-slate-400">Sin folleto (Solo Texto)</SelectItem>
                                                        {availableFlyers?.map(f => (
                                                            <SelectItem key={f.id} value={f.id} className="text-xs font-bold uppercase">
                                                                {f.name} ({f.type === 'video' ? '📽️' : '🖼️'})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Texto del mensaje personalizado */}
                                            <div className="space-y-1 text-left">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[8px] font-black uppercase text-slate-400">Texto Personalizado</Label>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={handleSaveBaseTemplate}
                                                        className="h-5 px-1.5 text-[8px] font-black uppercase text-primary hover:text-primary hover:bg-primary/5 flex items-center gap-1"
                                                    >
                                                        <Save className="h-2.5 w-2.5" /> Guardar como Base
                                                    </Button>
                                                </div>
                                                <Textarea 
                                                    value={sidebarMessage} 
                                                    onChange={(e) => setSidebarMessage(e.target.value)} 
                                                    className="min-h-[100px] text-[11px] font-bold border-primary/10 rounded-xl bg-white" 
                                                    placeholder="Escribe un mensaje..." 
                                                />
                                            </div>

                                            {/* Botones de acción independiente */}
                                            <div className="flex flex-col gap-1.5">
                                                {sidebarPhone.trim().length >= 6 ? (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => {
                                                            if (sidebarFlyerId !== 'NONE') {
                                                                handleShareSidebarMedia(selectedSidebarElector, sidebarPhone);
                                                            } else {
                                                                handleSendSidebarWhatsApp(selectedSidebarElector, sidebarPhone);
                                                            }
                                                        }}
                                                        disabled={isSharingMedia[selectedSidebarElector.id]}
                                                        className={cn(
                                                            "h-10 text-[10px] font-black rounded-xl shadow-sm uppercase flex items-center justify-center gap-1.5 text-white transition-all",
                                                            sidebarFlyerId !== 'NONE' 
                                                                ? "bg-indigo-600 hover:bg-indigo-700" 
                                                                : "bg-green-500 hover:bg-green-600"
                                                        )}
                                                    >
                                                        {isSharingMedia[selectedSidebarElector.id] ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <MessageSquare className={cn("h-4 w-4 fill-white", sidebarFlyerId !== 'NONE' ? "text-indigo-600" : "text-green-500")} />
                                                        )}
                                                        {isSharingMedia[selectedSidebarElector.id] 
                                                            ? 'ENVIANDO...' 
                                                            : sidebarFlyerId !== 'NONE' 
                                                                ? 'ENVIAR DATOS + FOLLETO' 
                                                                : 'ENVIAR DATOS (SOLO TEXTO)'}
                                                    </Button>
                                                ) : (
                                                    <p className="text-[8px] font-bold text-red-500 uppercase text-center py-1">⚠️ Registra un teléfono para enviar</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {sidebarSearchTerm && sidebarSearchResults.length === 0 && !isSidebarSearching && (
                                <p className="text-[9px] font-bold text-slate-400 uppercase text-center py-2">Sin coincidencias para la búsqueda</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-md overflow-hidden rounded-2xl">
                        <CardHeader className="bg-muted/30 pb-3 border-b">
                            <CardTitle className="text-[11px] font-black uppercase flex items-center gap-2">
                                <Filter className="h-4 w-4 text-primary" /> Filtros y Contenidos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-4">
                            
                            {/* Fast template buttons */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Plantillas Rápidas</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('REUNION')} className="h-10 text-[9px] font-black uppercase flex items-center gap-1.5 justify-start px-2"><Users className="h-4 w-4 text-slate-500" /> REUNIÓN</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CENA')} className="h-10 text-[9px] font-black uppercase flex items-center gap-1.5 justify-start px-2"><Utensils className="h-4 w-4 text-slate-500" /> CENA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CAMINATA')} className="h-10 text-[9px] font-black uppercase flex items-center gap-1.5 justify-start px-2"><Footprints className="h-4 w-4 text-slate-500" /> CAMINATA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('PEGATINA')} className="h-10 text-[9px] font-black uppercase flex items-center gap-1.5 justify-start px-2"><Flag className="h-4 w-4 text-slate-500" /> PEGATINA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CUMPLEANOS')} className={cn("h-10 text-[9px] font-black uppercase flex items-center gap-1.5 justify-start px-2 col-span-2", isBirthdayMode && "bg-primary/10 border-primary text-primary")}><Cake className={cn("h-4 w-4", isBirthdayMode ? "text-primary" : "text-slate-500")} /> MODO CUMPLEAÑOS</Button>
                                </div>
                            </div>

                            {/* Invitation Template */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase">Mensaje Personalizado (con Spintax)</Label>
                                <Textarea 
                                    value={invitationTemplate} 
                                    onChange={(e) => setInvitationTemplate(e.target.value)} 
                                    className="min-h-[110px] text-xs font-bold border-primary/10 rounded-xl" 
                                    placeholder="Usa {nombre} para personalizar..." 
                                />
                                <span className="text-[8px] text-muted-foreground font-semibold uppercase block leading-tight">
                                    Coloca saludos dinámicos entre llaves (ej. <code className="text-primary font-black">&#123;¡Hola!|Buenas&#125;</code>) para rotar los mensajes de forma aleatoria.
                                </span>
                            </div>

                            {/* Include voting data toggle */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <Label className="text-[10px] font-black uppercase flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> Incluir Datos de Mesa</Label>
                                <Switch checked={includeVotingData} onCheckedChange={setIncludeVotingData} />
                            </div>

                            {/* Flyer library */}
                            <div className="space-y-3 p-3 border rounded-2xl bg-muted/20">
                                <Label className="text-[10px] font-black uppercase flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-primary" /> Multimedia Oficial</Label>
                                {currentFlyer && (
                                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-primary/10 bg-black/5 flex items-center justify-center group">
                                        {currentFlyer.type === 'video' ? <Film className="h-8 w-8 text-primary/40" /> : <img src={currentFlyer.url} alt="Preview" className="w-full h-full object-contain" />}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Badge variant="secondary" className="font-black text-[8px]">{currentFlyer.name}</Badge>
                                        </div>
                                    </div>
                                )}
                                <Select value={currentFlyer?.id || ''} onValueChange={handleSelectFlyer}>
                                    <SelectTrigger className="h-10 text-[10px] font-bold rounded-xl"><SelectValue placeholder="Elegir recurso..." /></SelectTrigger>
                                    <SelectContent>{availableFlyers?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Label htmlFor="dif-upload" className="cursor-pointer block">
                                    <div className="h-10 border border-dashed border-primary/30 rounded-xl flex items-center justify-center text-[10px] font-black hover:bg-primary/5 transition-colors text-primary">
                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5"/>} SUBIR ARCHIVO
                                    </div>
                                </Label>
                                <input id="dif-upload" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
                            </div>

                            {/* Search segment and triggers */}
                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-2"><Cake className="h-3.5 w-3.5 text-primary" /> Segmentar Cumpleaños</Label>
                                    <Switch checked={isBirthdayMode} onCheckedChange={(val) => { setIsBirthdayMode(val); if(val) setInvitationTemplate(EVENT_TEMPLATES.CUMPLEANOS); }} />
                                </div>

                                {isBirthdayMode && (
                                    <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase ml-1">Mes</Label>
                                            <Select value={birthdayMonth} onValueChange={setBirthdayMonth}>
                                                <SelectTrigger className="h-9 text-[10px] font-bold rounded-lg"><SelectValue /></SelectTrigger>
                                                <SelectContent>{MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase ml-1">Día</Label>
                                            <Select value={birthdayDay} onValueChange={setBirthdayDay}>
                                                <SelectTrigger className="h-9 text-[10px] font-bold rounded-lg"><SelectValue /></SelectTrigger>
                                                <SelectContent>{DIAS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1 flex flex-col">
                                    <Label className="text-[10px] font-black uppercase ml-1">Jurisdicción de Búsqueda</Label>
                                    <Popover open={jurisdiccionOpen} onOpenChange={setJurisdiccionOpen}>
                                        <PopoverTrigger asChild disabled={!isAdmin && !!user?.seccional}>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={jurisdiccionOpen}
                                                className="justify-between w-full font-bold text-xs h-11 rounded-xl border-primary/10 bg-white"
                                            >
                                                <span className="truncate">
                                                    {selectedSeccional === "ALL"
                                                        ? "Todas las Seccionales"
                                                        : selectedSeccional
                                                            ? `Seccional ${selectedSeccional}`
                                                            : "Elegir Seccional..."}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                            <Command>
                                                <CommandInput placeholder="Buscar Seccional..." />
                                                <CommandList>
                                                    <CommandEmpty>No se encontró la seccional</CommandEmpty>
                                                    <CommandGroup>
                                                        {isAdmin && (
                                                            <CommandItem
                                                                value="Todas las Seccionales"
                                                                onSelect={() => {
                                                                    setSelectedSeccional("ALL");
                                                                    setJurisdiccionOpen(false);
                                                                }}
                                                                className="flex items-center justify-between animate-none"
                                                            >
                                                                <span>Todas las Seccionales</span>
                                                                <Check
                                                                    className={cn(
                                                                        "h-4 w-4",
                                                                        selectedSeccional === "ALL" ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                            </CommandItem>
                                                        )}
                                                        {seccionales.map((s) => (
                                                            <CommandItem
                                                                key={s.id}
                                                                value={`Seccional ${s.nombre}`}
                                                                onSelect={() => {
                                                                    setSelectedSeccional(String(s.nombre));
                                                                    setJurisdiccionOpen(false);
                                                                }}
                                                                className="flex items-center justify-between"
                                                            >
                                                                <span>Seccional {s.nombre}</span>
                                                                <Check
                                                                    className={cn(
                                                                        "h-4 w-4",
                                                                        selectedSeccional === String(s.nombre) ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {activeTab === 'votos' && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Label className="text-[10px] font-black uppercase ml-1 text-primary">Cargado Por (Registrador)</Label>
                                        <Select value={selectedOperatorFilter} onValueChange={setSelectedOperatorFilter}>
                                            <SelectTrigger className="h-11 font-bold text-xs rounded-xl border-primary/30"><SelectValue placeholder="Todos los operadores..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">Todos los operadores</SelectItem>
                                                {registeredOperators.map(op => (
                                                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <Button className="w-full font-black h-13 text-xs uppercase shadow-md rounded-xl bg-primary hover:bg-primary/90 text-white" onClick={handleSearch} disabled={isLoading || !selectedSeccional || selectedSeccional === 'ALL'}>
                                    {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <DatabaseZap className="mr-2 h-4 w-4" />} 
                                    BUSCAR EN PADRÓN
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Queue / Electores Table Area */}
                <div className="lg:col-span-3 space-y-4">
                    
                    {/* Tabs Switcher */}
                    <div className="flex bg-muted/40 p-1 rounded-2xl border border-primary/5 shadow-inner">
                        <button 
                            className={cn(
                                "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-xl",
                                activeTab === 'padron' 
                                    ? "bg-primary text-white shadow-md scale-[1.01]" 
                                    : "text-muted-foreground hover:text-slate-800 hover:bg-muted/50"
                            )}
                            onClick={() => setActiveTab('padron')}
                        >
                            🔍 Padrón General ({electores.length})
                        </button>
                        <button 
                            className={cn(
                                "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-xl",
                                activeTab === 'votos' 
                                    ? "bg-primary text-white shadow-md scale-[1.01]" 
                                    : "text-muted-foreground hover:text-slate-800 hover:bg-muted/50"
                            )}
                            onClick={() => setActiveTab('votos')}
                        >
                            🎯 Votos Seguros ({filteredVotosList.length})
                        </button>
                    </div>

                    {/* Table */}
                    <Card className="overflow-hidden border-primary/10 shadow-lg min-h-[550px] rounded-2xl">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 text-[10px] font-black uppercase">
                                        <TableHead className="pl-4 sm:pl-6">Elector / Identidad</TableHead>
                                        <TableHead>WhatsApp Registrado</TableHead>
                                        <TableHead>WhatsApp Migrado</TableHead>
                                        <TableHead className="text-right pr-4 sm:pr-6">Acción Individual</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {((activeTab === 'padron' && isLoading) || (activeTab === 'votos' && isLoadingVotos)) ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={4} className="px-6 py-4">
                                                    <Skeleton className="h-12 w-full rounded-lg" />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        activeQueue.length > 0 ? (
                                            activeQueue.map((p, index) => {
                                                const isSent = processedIds.has(p.id);
                                                const hasPhone = String(p.TELEFONO || '').trim().length >= 6;
                                                const hasPhoneMig = String(p.TELEFONO_MIGRADO || '').trim().length >= 6;

                                                return (
                                                    <TableRow 
                                                        key={p.id} 
                                                        className={cn(
                                                            "transition-all duration-150 border-l-4", 
                                                            isSent 
                                                                ? "bg-emerald-50/70 border-l-emerald-500 hover:bg-emerald-50 text-slate-600 shadow-sm" 
                                                                : "border-l-transparent hover:bg-muted/20"
                                                        )}
                                                    >
                                                        <TableCell className="py-4 pl-4 sm:pl-6">
                                                            <div className="flex flex-col">
                                                                <span className={cn(
                                                                    "text-xs uppercase font-black flex items-center gap-1.5",
                                                                    isSent ? "text-slate-700" : "text-slate-800"
                                                                )}>
                                                                    {p.NOMBRE} {p.APELLIDO}
                                                                    {isSent && (
                                                                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 font-black text-[8px] py-0.5 px-2 rounded-full uppercase flex items-center gap-1 animate-pulse">
                                                                            <CheckCircle className="h-2.5 w-2.5 fill-white text-emerald-600" /> ENVIADO
                                                                        </Badge>
                                                                    )}
                                                                </span>
                                                                <span className="text-[9px] text-muted-foreground font-black uppercase">C.I. {p.CEDULA} • SECC {p.CODIGO_SEC}</span>
                                                                {includeVotingData && (
                                                                    <span className="text-[8px] text-blue-600 font-bold uppercase mt-0.5">
                                                                        Mesa: {p.MESA} / Orden: {p.ORDEN}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingPhoneId === p.id && editingField === 'TELEFONO' ? (
                                                                <div className="flex gap-1 animate-in zoom-in-95">
                                                                    <Input 
                                                                        value={tempPhone} 
                                                                        onChange={(e) => setTempPhone(e.target.value)} 
                                                                        className="h-9 text-xs font-black w-36 sm:w-40" 
                                                                        autoFocus 
                                                                        onBlur={() => savePhoneEdit('TELEFONO')} 
                                                                        onKeyDown={(e) => e.key === 'Enter' && savePhoneEdit('TELEFONO')} 
                                                                    />
                                                                    <Button size="icon" className="h-9 w-9 rounded-lg" onClick={() => savePhoneEdit('TELEFONO')} disabled={isSavingPhone}>
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setEditingPhoneId(p.id); setEditingField('TELEFONO'); setTempPhone(p.TELEFONO || ''); }}>
                                                                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                    {hasPhone ? (
                                                                        <span className="text-xs font-black text-green-700 underline decoration-dotted underline-offset-4">{p.TELEFONO}</span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider italic">Agregar número</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingPhoneId === p.id && editingField === 'TELEFONO_MIGRADO' ? (
                                                                <div className="flex gap-1 animate-in zoom-in-95">
                                                                    <Input 
                                                                        value={tempPhone} 
                                                                        onChange={(e) => setTempPhone(e.target.value)} 
                                                                        className="h-9 text-xs font-black w-36 sm:w-40" 
                                                                        autoFocus 
                                                                        onBlur={() => savePhoneEdit('TELEFONO_MIGRADO')} 
                                                                        onKeyDown={(e) => e.key === 'Enter' && savePhoneEdit('TELEFONO_MIGRADO')} 
                                                                    />
                                                                    <Button size="icon" className="h-9 w-9 rounded-lg" onClick={() => savePhoneEdit('TELEFONO_MIGRADO')} disabled={isSavingPhone}>
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setEditingPhoneId(p.id); setEditingField('TELEFONO_MIGRADO'); setTempPhone(p.TELEFONO_MIGRADO || ''); }}>
                                                                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                    {hasPhoneMig ? (
                                                                        <span className="text-xs font-black text-blue-700 underline decoration-dotted underline-offset-4">{p.TELEFONO_MIGRADO}</span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider italic">Sin migrar</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-4 sm:pr-6">
                                                            <div className="flex justify-end items-center gap-1.5 sm:gap-2">
                                                                
                                                                {/* Native Share button (downloads flyer & opens Android/iOS native sharing sheet) */}
                                                                {currentFlyer && (hasPhone || hasPhoneMig) && (
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleShareMediaDirect(p, hasPhone ? p.TELEFONO! : p.TELEFONO_MIGRADO!)}
                                                                        className="h-8 px-2 text-[9px] font-black rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white uppercase flex items-center gap-1 shadow-sm"
                                                                        disabled={isSharingMedia[p.id]}
                                                                    >
                                                                        {isSharingMedia[p.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                                                                        {isSharingMedia[p.id] ? 'COMPARTIENDO...' : 'COMPARTIR'}
                                                                    </Button>
                                                                )}

                                                                {/* Standard deep-linked fast message to registered TELEFONO */}
                                                                {hasPhone && (
                                                                    <Button 
                                                                        size="sm" 
                                                                        onClick={() => handleSendWhatsApp(p, p.TELEFONO!)} 
                                                                        className="h-8 px-2 text-[9px] font-black rounded-lg bg-green-500 hover:bg-green-600 shadow-sm uppercase flex items-center gap-1 text-white"
                                                                    >
                                                                        <MessageSquare className="h-3 w-3 fill-white" /> REGIST.
                                                                    </Button>
                                                                )}

                                                                {/* Standard deep-linked fast message to migrated Excel TELEFONO */}
                                                                {hasPhoneMig && (
                                                                    <Button 
                                                                        size="sm" 
                                                                        onClick={() => handleSendWhatsApp(p, p.TELEFONO_MIGRADO!)} 
                                                                        className="h-8 px-2 text-[9px] font-black rounded-lg bg-sky-600 hover:bg-sky-700 shadow-sm uppercase flex items-center gap-1 text-white"
                                                                    >
                                                                        <MessageSquare className="h-3 w-3 fill-white" /> MIGRAD.
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-96 text-center opacity-20">
                                                    <Filter className="h-20 w-20 mx-auto mb-4 text-primary" />
                                                    <p className="font-black text-sm uppercase tracking-[0.3em]">
                                                        {activeTab === 'padron' ? 'Esperando Selección de Seccional' : 'Sin Votos Seguros Registrados'}
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase mt-2">
                                                        {activeTab === 'padron' ? 'El sistema escaneará los electores de la seccional elegida.' : 'Comienza a cargar votos seguros desde el verificador.'}
                                                    </p>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </div>

            {/* STICKY FLOATING BOTTOM BATCH ASSISTANT FOR CELLPHONES (THUMB FRIENDLY) */}
            {isBatchActive && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[94%] max-w-sm bg-slate-900 border border-slate-800 text-white p-4 rounded-3xl shadow-2xl z-50 flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-primary">Asistente Móvil de Lote</h4>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-full text-slate-400 hover:text-white"
                            onClick={() => setIsBatchActive(false)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-black uppercase text-slate-300">
                        <span>Lote actual:</span>
                        <span className="text-green-400">{batchSentCount} de {batchSize} enviados</span>
                    </div>

                    {/* Progress visual line */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(batchSentCount / batchSize) * 100}%` }} />
                    </div>

                    {nextElectorToProcess ? (
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 flex flex-col gap-0.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Siguiente a Enviar:</span>
                            <span className="text-xs font-black text-white uppercase truncate">
                                {nextElectorToProcess.NOMBRE} {nextElectorToProcess.APELLIDO}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase truncate">
                                Tel: {nextElectorToProcess.TELEFONO || nextElectorToProcess.TELEFONO_MIGRADO || 'Sin Número'}
                            </span>
                        </div>
                    ) : (
                        <div className="bg-slate-950 p-2 text-center rounded-xl border border-slate-800 text-xs font-black text-slate-400 uppercase">
                            ¡Cola finalizada! No hay más pendientes
                        </div>
                    )}

                    <Button
                        onClick={handleTriggerNextAssistant}
                        disabled={!nextElectorToProcess}
                        className="h-12 w-full font-black text-xs uppercase bg-green-600 hover:bg-green-700 text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg"
                    >
                        {currentFlyer ? <Share2 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4 fill-white" />}
                        {currentFlyer ? 'COMPARTIR MULTIMEDIA' : 'DISPARAR WHATSAPP'}
                    </Button>
                </div>
            )}

            {/* Media Upload Identifying Name Dialog */}
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

            {/* NEW BATCH COMPLETED ANTI-BAN PROTECTION POPUP */}
            <Dialog open={showBatchCompletedAlert} onOpenChange={setShowBatchCompletedAlert}>
                <DialogContent className="sm:max-w-md rounded-3xl border-slate-800 bg-slate-950 text-white shadow-2xl">
                    <div className="p-6 text-center space-y-5">
                        <div className="mx-auto h-16 w-16 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 animate-bounce" />
                        </div>
                        
                        <div className="space-y-1">
                            <h3 className="text-xl font-black uppercase tracking-tight text-white">¡Lote Completado! 🚀</h3>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Enviados {batchSentCount} de {batchSize} contactos</p>
                        </div>

                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left space-y-2">
                            <Label className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                                <ShieldAlert className="h-4 w-4 text-amber-400 animate-pulse" /> PAUSA DE SEGURIDAD (ANTI-BAN)
                            </Label>
                            <p className="text-[9px] font-bold uppercase text-slate-300 leading-relaxed">
                                Te sugerimos **esperar 30 segundos** antes de iniciar el próximo lote. Esto enfría el volumen de tráfico de tu chip y hace que WhatsApp registre tu actividad como un comportamiento humano natural, protegiendo tu línea contra bloqueos automáticos.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            <Button 
                                onClick={() => {
                                    setBatchSentCount(0);
                                    setIsBatchActive(true);
                                    setShowBatchCompletedAlert(false);
                                }}
                                className="h-12 text-xs font-black uppercase bg-primary hover:bg-primary/95 text-white rounded-2xl w-full"
                            >
                                Iniciar Siguiente Lote 🔴
                            </Button>
                            <Button 
                                variant="ghost" 
                                onClick={() => setShowBatchCompletedAlert(false)}
                                className="h-10 text-xs font-black uppercase text-slate-400 hover:text-white rounded-xl"
                            >
                                Cerrar Asistente
                            </Button>
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

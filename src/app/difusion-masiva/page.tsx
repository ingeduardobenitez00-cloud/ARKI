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
import { 
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
    Play,
    Pause,
    RotateCcw,
    Volume2,
    VolumeX,
    Sparkles,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { Checkbox } from '@/components/ui/checkbox';
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
    DIFUNDIDO?: boolean;
    difundidoAt?: string;
    difundidoBy?: string;
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

export default function DifusionMasivaPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [activeTab, setActiveTab] = useState<'padron' | 'votos'>('padron');
    const [seccionales, setSeccionales] = useState<any[]>([]);
    const [selectedSeccional, setSelectedSeccional] = useState('');
    const [selectedOperatorFilter, setSelectedOperatorFilter] = useState<string>('ALL');
    const [electores, setElectores] = useState<Elector[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Co-Pilot State
    const [isCoPilotRunning, setIsCoPilotRunning] = useState(false);
    const [coPilotDelay, setCoPilotDelay] = useState(15); // delay in seconds
    const [useSpintax, setUseSpintax] = useState(true);
    const [useVariability, setUseVariability] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [coPilotIndex, setCoPilotIndex] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    const [selectedElectorIds, setSelectedElectorIds] = useState<Set<string>>(new Set());
    const [phonePreference, setPhonePreference] = useState<'REGISTRADO' | 'MIGRADO' | 'INTELIGENTE'>('INTELIGENTE');

    const [invitationTemplate, setInvitationTemplate] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('difusion_invitation_template') || 
                "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\nTe invitamos a participar de nuestras actividades de la semana.\n\n¡Contamos con tu apoyo! 🚀";
        }
        return "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 2P Opción 2. 🔴\n\nTe invitamos a participar de nuestras actividades de la semana.\n\n¡Contamos con tu apoyo! 🚀";
    });
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
    const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [newImageName, setNewImageName] = useState('');

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';

    // Real-time beep generator via Web Audio API (zero external assets dependency!)
    const playBeep = useCallback(() => {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime); // Pitch A5
            gain.gain.setValueAtTime(0.08, ctx.currentTime); // Volume
            osc.start();
            osc.stop(ctx.currentTime + 0.15); // Play for 150ms
        } catch (e) {
            console.error("Audio beep error:", e);
        }
    }, [soundEnabled]);

    // Spintax Resolver: {A|B|C} -> Pick randomly
    const resolveSpintax = useCallback((text: string) => {
        if (!useSpintax) {
            // Remove brackets keeping the first option
            return text.replace(/\{([^{}]+)\}/g, (match, options) => {
                return options.split('|')[0] || '';
            });
        }
        return text.replace(/\{([^{}]+)\}/g, (match, options) => {
            if (options.includes('|')) {
                const choices = options.split('|');
                return choices[Math.floor(Math.random() * choices.length)];
            }
            return match; // Simple variable like {nombre}
        });
    }, [useSpintax]);

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

        return list;
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
        
        const saved = sessionStorage.getItem('wa_copilot_processed_ids');
        if (saved) { try { setProcessedIds(new Set(JSON.parse(saved))); } catch (e) {} }

        if (user && !isAdmin && user.seccional) { setSelectedSeccional(user.seccional); }
    }, [db, user, isAdmin, fetchAndReconstructFlyer, base64ToBlobUrl]);

    // Active queue reference based on tab
    const queue = useMemo(() => {
        return activeTab === 'padron' ? electores : filteredVotosList;
    }, [activeTab, electores, filteredVotosList]);

    useEffect(() => {
        if (queue && queue.length > 0) {
            setSelectedElectorIds(new Set(queue.map(e => e.id)));
        } else {
            setSelectedElectorIds(new Set());
        }
    }, [queue]);

    const toggleSelectAll = () => {
        if (selectedElectorIds.size === queue.length) {
            setSelectedElectorIds(new Set());
        } else {
            setSelectedElectorIds(new Set(queue.map(e => e.id)));
        }
    };

    const toggleSelectRow = (id: string) => {
        const next = new Set(selectedElectorIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedElectorIds(next);
    };

    const handleApplyTemplate = (type: keyof typeof EVENT_TEMPLATES) => {
        setInvitationTemplate(EVENT_TEMPLATES[type]);
        localStorage.setItem('difusion_invitation_template', EVENT_TEMPLATES[type]);
        setIsBirthdayMode(type === 'CUMPLEANOS');
        toast({ title: `Plantilla de ${type} cargada` });
    };


    const handleSearch = async () => {
        if (!db || isLoading || !selectedSeccional) { toast({ title: 'Selecciona una seccional' }); return; }
        setIsLoading(true);
        setElectores([]);
        setIsCoPilotRunning(false);
        setCoPilotIndex(0);
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
            setElectores(results);
            toast({ title: 'Escaneo Finalizado', description: `Se hallaron ${results.length} contactos.` });
        } catch (error) { toast({ title: 'Error de conexión', variant: 'destructive' }); } finally { setIsLoading(false); }
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

    // Unified clipboard copy mechanism (Packs flyer image + custom caption together!)
    const copyToClipboard = async (text: string, flyerUrl?: string): Promise<boolean> => {
        try {
            if (flyerUrl) {
                const response = await fetch(flyerUrl);
                const blob = await response.blob();
                const data = [
                    new ClipboardItem({
                        [blob.type]: blob,
                        'text/plain': new Blob([text], { type: 'text/plain' })
                    })
                ];
                await navigator.clipboard.write(data);
                return true;
            } else {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {
            console.warn("ClipboardItem payload failed, fallback to text-only:", e);
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.error("Clipboard blocked:", err);
                return false;
            }
        }
    };

    // Main step driver of the campaign loop
    const runCoPilotStep = useCallback(async (index: number) => {
        if (index >= queue.length) {
            setIsCoPilotRunning(false);
            toast({ title: '¡Campaña Finalizada!', description: 'Se ha completado el envío masivo.' });
            return;
        }

        const p = queue[index];
        // If not checked, skip immediately to the next one
        if (!selectedElectorIds.has(p.id)) {
            setCoPilotIndex(index + 1);
            return;
        }

        // If already processed or sent in database, skip immediately to the next one
        if (processedIds.has(p.id) || p.DIFUNDIDO) {
            setCoPilotIndex(index + 1);
            return;
        }

        // Get target phone number based on strategy preference
        let targetPhone = '';
        if (phonePreference === 'REGISTRADO') {
            targetPhone = p.TELEFONO || '';
        } else if (phonePreference === 'MIGRADO') {
            targetPhone = p.TELEFONO_MIGRADO || '';
        } else {
            // Inteligente: prefer registered manual phone, fallback to Excel migrated
            targetPhone = p.TELEFONO || p.TELEFONO_MIGRADO || '';
        }

        if (!targetPhone || targetPhone.trim().length < 6) {
            // Skip contact without valid number
            setCoPilotIndex(index + 1);
            return;
        }

        // 1. Generate customized text with Spintax
        let msg = resolveSpintax(invitationTemplate);
        msg = msg.replace(/{nombre}/g, `${p.NOMBRE} ${p.APELLIDO}`.trim())
                 .replace(/\[NOMBRE\]/g, `${p.NOMBRE} ${p.APELLIDO}`.trim())
                 .replace(/\[LOCAL\]/g, String(p.LOCAL || '---'))
                 .replace(/\[MESA\]/g, String(p.MESA || '---'))
                 .replace(/\[ORDEN\]/g, String(p.ORDEN || '---'));
        
        if (includeVotingData) {
            msg += `\n\n📍 *TU LUGAR DE VOTACIÓN:*\n🏛️ LOCAL: ${p.LOCAL || '---'}\n🗳️ MESA: ${p.MESA || '---'}\n🔢 ORDEN: ${p.ORDEN || '---'}`;
        }

        // 2. Play warning alert audio beep
        playBeep();

        // 3. Load payload to clipboard (Text message only)
        const copied = await copyToClipboard(msg);
        if (copied) {
            toast({ 
                title: `Portapapeles Cargado: ${p.NOMBRE}`, 
                description: 'Texto copiado al portapapeles.',
                variant: 'default'
            });
        }

        // 4. Open/Refresh WhatsApp Web tab using named Window Reuse strategy (zero clutter!)
        const finalPhone = formatParaguayPhone(targetPhone);
        const captionParam = msg ? `&text=${encodeURIComponent(msg)}` : '';
        const autoSendParam = '&arki_auto_send=true';
        window.open(`https://web.whatsapp.com/send?phone=${finalPhone}${captionParam}${autoSendParam}`, 'arki_co_pilot_tab');

        // 5. Mark as processed & sync local log
        const nextProcessed = new Set(processedIds);
        nextProcessed.add(p.id);
        setProcessedIds(nextProcessed);
        sessionStorage.setItem('wa_copilot_processed_ids', JSON.stringify(Array.from(nextProcessed)));

        // Update local list state so it syncs immediately
        const nowStr = new Date().toISOString();
        if (activeTab === 'padron') {
            setElectores(prev => prev.map(e => e.id === p.id ? { ...e, DIFUNDIDO: true, difundidoAt: nowStr, difundidoBy: user.name } : e));
        }

        // Update Firestore permanently!
        if (db) {
            const collectionName = activeTab === 'padron' ? 'sheet1' : 'votos_confirmados';
            const electorRef = doc(db, collectionName, p.id);
            updateDoc(electorRef, {
                DIFUNDIDO: true,
                difundidoAt: nowStr,
                difundidoBy: user.name
            }).catch(e => console.error("Error updating DIFUNDIDO in Firestore:", e));
        }

        // Audit log action
        if (db && user) {
            logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'CO_PILOTO_MASIVO',
                action: 'ENVIÓ AUTO_PILOTO',
                targetName: `${p.NOMBRE} ${p.APELLIDO} (${targetPhone})`
            });
        }

        // 6. Compute next step delay with anti-ban random variability
        let actualDelay = coPilotDelay;
        if (useVariability) {
            const randomVar = Math.floor(Math.random() * 7) - 3; // +/- 3 seconds random shift
            actualDelay = Math.max(10, coPilotDelay + randomVar); // clamp to min 10s delay
        }

        setCountdown(actualDelay);

        // 7. Setup ticking visual timer
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // 8. Schedule the next contact
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setCoPilotIndex(prev => prev + 1);
        }, actualDelay * 1000);

    }, [queue, processedIds, selectedElectorIds, coPilotDelay, useVariability, phonePreference, invitationTemplate, includeVotingData, playBeep, resolveSpintax, db, user]);

    // Handle play / pause trigger
    useEffect(() => {
        if (isCoPilotRunning) {
            runCoPilotStep(coPilotIndex);
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [isCoPilotRunning, coPilotIndex, runCoPilotStep]);

    const handleResetCampaign = () => {
        setIsCoPilotRunning(false);
        setCoPilotIndex(0);
        setProcessedIds(new Set());
        sessionStorage.removeItem('wa_copilot_processed_ids');
        toast({ title: 'Campaña Reiniciada', description: 'Se limpió el historial de envíos de esta sesión.' });
    };

    const handleDirectSend = (p: Elector, targetPhone: string) => {
        if (!targetPhone || !user) return;

        const isAlreadySent = processedIds.has(p.id) || p.DIFUNDIDO;
        if (isAlreadySent) {
            const confirmRes = window.confirm(`Ya enviaste mensaje a este elector (${p.NOMBRE} ${p.APELLIDO}). ¿Deseas escribirle de vuelta?`);
            if (!confirmRes) return;
        }

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
        sessionStorage.setItem('wa_copilot_processed_ids', JSON.stringify(Array.from(nextSet)));

        // Update local list state so it syncs immediately
        const nowStr = new Date().toISOString();
        if (activeTab === 'padron') {
            setElectores(prev => prev.map(e => e.id === p.id ? { ...e, DIFUNDIDO: true, difundidoAt: nowStr, difundidoBy: user.name } : e));
        }

        // Update Firestore permanently!
        if (db) {
            const collectionName = activeTab === 'padron' ? 'sheet1' : 'votos_confirmados';
            const electorRef = doc(db, collectionName, p.id);
            updateDoc(electorRef, {
                DIFUNDIDO: true,
                difundidoAt: nowStr,
                difundidoBy: user.name
            }).catch(e => console.error("Error updating DIFUNDIDO in Firestore:", e));
        }
        
        if (db) {
            logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'CO_PILOTO_MASIVO',
                action: 'ENVIÓ DIRECTO',
                targetName: `${p.NOMBRE} ${p.APELLIDO} (${targetPhone})`
            });
        }
        
        window.open(`https://web.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(msg)}&arki_auto_send=true`, 'arki_co_pilot_tab');
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

    // Calculate progress stats for the dashboard widget
    const progressPercent = useMemo(() => {
        if (queue.length === 0) return 0;
        const sentInQueue = queue.filter(e => processedIds.has(e.id)).length;
        return Math.round((sentInQueue / queue.length) * 100);
    }, [queue, processedIds]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-primary animate-pulse" /> Co-Piloto Masivo Anti-Ban
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                        Campañas seguras en piloto automático emulando comportamiento humano orgánico.
                    </p>
                </div>
                {isCoPilotRunning && (
                    <Badge className="bg-green-600 animate-pulse h-9 px-4 text-xs font-black uppercase flex items-center gap-2">
                        <Zap className="h-4 w-4 mr-1 fill-white" /> CO-PILOTO ACTIVO
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Panel de Configuración de Campaña & Dashboard */}
                <div className="lg:col-span-1 space-y-4">
                    
                    {/* Panel del Co-Piloto Masivo Dashboard Gauges */}
                    <Card className="border-primary/10 shadow-lg overflow-hidden bg-slate-900 text-white rounded-2xl">
                        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase flex items-center gap-2 text-primary">
                                <Zap className="h-4 w-4 text-primary fill-primary" /> Campaña Auto-Piloto
                            </h3>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 rounded-full text-slate-400 hover:text-white"
                                onClick={() => setSoundEnabled(!soundEnabled)}
                            >
                                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-destructive" />}
                            </Button>
                        </div>
                        <CardContent className="space-y-4 pt-4">
                            
                            {/* Visual Progress Gauge */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Progreso General</span>
                                    <span>{progressPercent}%</span>
                                </div>
                                <Progress value={progressPercent} className="h-3 bg-slate-800" />
                                <div className="flex justify-between text-[9px] font-black text-slate-400">
                                    <span>CONTACTOS: {queue.length}</span>
                                    <span>ENVIADOS: {queue.filter(e => processedIds.has(e.id)).length}</span>
                                </div>
                            </div>

                            {/* Active Countdown Widget */}
                            {isCoPilotRunning && (
                                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1 animate-pulse">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-primary">Próximo Elector en Cola</p>
                                    <h3 className="text-3xl font-black">{countdown}s</h3>
                                    <p className="text-[8px] text-slate-500 font-bold uppercase truncate">
                                        Procesando: {queue[coPilotIndex]?.NOMBRE} {queue[coPilotIndex]?.APELLIDO}
                                    </p>
                                </div>
                            )}

                            {/* Automation Action Controls */}
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                {isCoPilotRunning ? (
                                    <Button 
                                        onClick={() => setIsCoPilotRunning(false)} 
                                        className="h-11 text-[10px] font-black uppercase bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-1.5 rounded-xl col-span-2"
                                    >
                                        <Pause className="h-4 w-4" /> PAUSAR
                                    </Button>
                                ) : (
                                    <Button 
                                        onClick={() => {
                                            if (queue.length === 0) {
                                                toast({ title: 'Cola de contactos vacía', description: 'Por favor, escanea o carga contactos primero.' });
                                                return;
                                            }
                                            setIsCoPilotRunning(true);
                                        }} 
                                        className="h-11 text-[10px] font-black uppercase bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1.5 rounded-xl col-span-2"
                                    >
                                        <Play className="h-4 w-4" /> INICIAR
                                    </Button>
                                )}
                                <Button 
                                    onClick={handleResetCampaign} 
                                    variant="outline" 
                                    className="h-11 text-[10px] font-black uppercase border-slate-800 hover:bg-slate-800 hover:text-white flex items-center justify-center gap-1.5 rounded-xl text-white"
                                >
                                    <RotateCcw className="h-4 w-4" /> REINIC.
                                </Button>
                            </div>

                            {/* Informational Instructions Alert */}
                            <div className="p-3 bg-blue-950/40 border border-blue-900/30 rounded-xl flex gap-2">
                                <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-1 text-slate-300">
                                    <h4 className="text-[9px] font-black uppercase tracking-wider text-blue-400">Instrucciones de Uso</h4>
                                    <p className="text-[8px] font-medium leading-relaxed uppercase">
                                        1. Ten WhatsApp Web abierto a un lado.<br/>
                                        2. El Co-Piloto cargará el texto y enviará automáticamente el mensaje usando la extensión.<br/>
                                        3. El Co-Piloto pasará automáticamente al siguiente en cola sin que debas hacer nada más.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Campaign Settings & Config Panel */}
                    <Card className="border-primary/10 shadow-sm overflow-hidden rounded-2xl">
                        <div className="bg-muted/30 p-4 border-b font-black text-xs uppercase flex items-center gap-2">
                            <Type className="h-4 w-4 text-primary" /> Ajustes del Co-Piloto
                        </div>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Accesos Rápidos</Label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('REUNION')} className="h-9 text-[9px] font-black uppercase flex items-center gap-1 justify-start px-2"><Users className="h-3.5 w-3.5 text-slate-500" /> REUNIÓN</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CENA')} className="h-9 text-[9px] font-black uppercase flex items-center gap-1 justify-start px-2"><Utensils className="h-3.5 w-3.5 text-slate-500" /> CENA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CAMINATA')} className="h-9 text-[9px] font-black uppercase flex items-center gap-1 justify-start px-2"><Footprints className="h-3.5 w-3.5 text-slate-500" /> CAMINATA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('PEGATINA')} className="h-9 text-[9px] font-black uppercase flex items-center gap-1 justify-start px-2"><Flag className="h-3.5 w-3.5 text-slate-500" /> PEGATINA</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CUMPLEANOS')} className={cn("h-9 text-[9px] font-black uppercase flex items-center gap-1 justify-start px-2 col-span-2", isBirthdayMode && "bg-primary/10 border-primary text-primary")}><Cake className={cn("h-3.5 w-3.5", isBirthdayMode ? "text-primary" : "text-slate-500")} /> CUMPLEAÑOS</Button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase">Mensaje Personalizado (con Spintax)</Label>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => {
                                            localStorage.setItem('difusion_invitation_template', invitationTemplate);
                                            toast({ title: 'Plantilla Guardada', description: 'Tu mensaje ha sido guardado para la próxima vez.' });
                                        }}
                                        className="h-5 px-1.5 text-[8px] font-black uppercase text-primary hover:text-primary hover:bg-primary/5 flex items-center gap-1"
                                    >
                                        <Save className="h-2.5 w-2.5" /> Guardar
                                    </Button>
                                </div>
                                <Textarea 
                                    value={invitationTemplate} 
                                    onChange={(e) => setInvitationTemplate(e.target.value)} 
                                    className="min-h-[110px] text-xs font-bold border-primary/10" 
                                    placeholder="Usa {nombre} para el elector y {saludo1|saludo2} para variaciones..." 
                                />
                            </div>

                            {/* Spintax and Variability switches */}
                            <div className="space-y-3 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /> Saludos Variados (Spintax)</Label>
                                    <Switch checked={useSpintax} onCheckedChange={setUseSpintax} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-2"><ClockIcon className="h-3.5 w-3.5 text-primary" /> Intervalos variables (+/- 3s)</Label>
                                    <Switch checked={useVariability} onCheckedChange={setUseVariability} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> Incluir Datos de Mesa</Label>
                                    <Switch checked={includeVotingData} onCheckedChange={setIncludeVotingData} />
                                </div>
                            </div>

                            {/* Safety Delay Slider */}
                            <div className="space-y-2 pt-2 border-t">
                                <div className="flex justify-between text-[10px] font-black uppercase">
                                    <span>Delay de Seguridad (Segs)</span>
                                    <span className="text-primary">{coPilotDelay} segundos</span>
                                </div>
                                <Slider 
                                    value={[coPilotDelay]} 
                                    onValueChange={(val) => setCoPilotDelay(val[0])} 
                                    min={10} 
                                    max={45} 
                                    step={1} 
                                    className="py-1"
                                />
                                <span className="text-[8px] text-muted-foreground font-semibold uppercase block">
                                    Un mayor tiempo de delay reduce drásticamente el riesgo de detección por WhatsApp.
                                </span>
                            </div>

                            {/* Phone target strategy select */}
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase ml-1">Estrategia de Contacto</Label>
                                <Select value={phonePreference} onValueChange={(val: any) => setPhonePreference(val)}>
                                    <SelectTrigger className="h-9 text-xs font-bold rounded-xl border-primary/10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INTELIGENTE">Inteligente (Manual &gt; Excel)</SelectItem>
                                        <SelectItem value="REGISTRADO">Solo Números Registrados</SelectItem>
                                        <SelectItem value="MIGRADO">Solo Números Migrados (Excel)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Multimedia removed to ensure reliable text bulk-sending */}

                            {/* Search Trigger Panel */}
                            <div className="space-y-3 pt-2 border-t">
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
                                        <SelectTrigger className="h-10 font-bold text-xs rounded-xl border-primary/10"><SelectValue placeholder="Elegir Seccional..." /></SelectTrigger>
                                        <SelectContent>
                                            {isAdmin && (
                                                <SelectItem value="ALL">Todas las Seccionales</SelectItem>
                                            )}
                                            {seccionales.map(s => <SelectItem key={s.id} value={String(s.nombre)}>Seccional {s.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {activeTab === 'votos' && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Label className="text-[10px] font-black uppercase ml-1 text-primary">Cargado Por (Registrador)</Label>
                                        <Select value={selectedOperatorFilter} onValueChange={setSelectedOperatorFilter}>
                                            <SelectTrigger className="h-10 font-bold text-xs rounded-xl border-primary/30"><SelectValue placeholder="Todos los operadores..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">Todos los operadores</SelectItem>
                                                {registeredOperators.map(op => (
                                                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <Button className="w-full font-black h-12 text-xs uppercase shadow-md rounded-xl" onClick={handleSearch} disabled={isLoading || !selectedSeccional || selectedSeccional === 'ALL'}>
                                    {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <DatabaseZap className="mr-2 h-4 w-4" />} 
                                    BUSCAR EN PADRÓN
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabla Derecha de Cola de Contactos */}
                <div className="lg:col-span-3 space-y-4">
                    
                    {/* Tabs switcher */}
                    <div className="flex bg-muted/40 p-1 rounded-2xl border border-primary/5 shadow-inner">
                        <button 
                            className={cn(
                                "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-xl",
                                activeTab === 'padron' 
                                    ? "bg-primary text-white shadow-md scale-[1.02]" 
                                    : "text-muted-foreground hover:text-slate-800 hover:bg-muted/50"
                            )}
                            onClick={() => {
                                setActiveTab('padron');
                                setIsCoPilotRunning(false);
                                setCoPilotIndex(0);
                            }}
                        >
                            🔍 Padrón General ({electores.length})
                        </button>
                        <button 
                            className={cn(
                                "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-xl",
                                activeTab === 'votos' 
                                    ? "bg-primary text-white shadow-md scale-[1.02]" 
                                    : "text-muted-foreground hover:text-slate-800 hover:bg-muted/50"
                            )}
                            onClick={() => {
                                setActiveTab('votos');
                                setIsCoPilotRunning(false);
                                setCoPilotIndex(0);
                            }}
                        >
                            🎯 Votos Seguros ({filteredVotosList.length})
                        </button>
                    </div>

                    {/* Table showing active Queue queue */}
                    <Card className="overflow-hidden border-primary/10 shadow-lg min-h-[600px] rounded-2xl">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 text-[10px] font-black uppercase">
                                    <TableHead className="w-[50px] pl-4">
                                        <Checkbox 
                                            checked={queue.length > 0 && selectedElectorIds.size === queue.length} 
                                            onCheckedChange={toggleSelectAll} 
                                            className="border-slate-300"
                                        />
                                    </TableHead>
                                    <TableHead className="pl-2 w-[120px]">Difusión</TableHead>
                                    <TableHead>Elector / Identidad</TableHead>
                                    <TableHead>WhatsApp Registrado</TableHead>
                                    <TableHead>WhatsApp Migrado</TableHead>
                                    <TableHead className="text-right pr-6">Acción Manual</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {((activeTab === 'padron' && isLoading) || (activeTab === 'votos' && isLoadingVotos)) ? (
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={6} className="px-6 py-4">
                                                <Skeleton className="h-12 w-full rounded-lg" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    queue.length > 0 ? (
                                        queue.map((p, index) => {
                                            const isCurrentlyProcessing = isCoPilotRunning && coPilotIndex === index;
                                            const isSent = processedIds.has(p.id) || p.DIFUNDIDO;
                                            const hasPhone = String(p.TELEFONO || '').trim().length >= 6;
                                            const hasPhoneMig = String(p.TELEFONO_MIGRADO || '').trim().length >= 6;

                                            return (
                                                <TableRow 
                                                    key={p.id} 
                                                    className={cn(
                                                        "transition-all duration-300", 
                                                        isCurrentlyProcessing && "bg-primary/10 border-l-4 border-primary shadow-md font-black animate-pulse",
                                                        isSent ? "bg-green-50/40 text-slate-500" : "hover:bg-muted/20"
                                                    )}
                                                >
                                                    {/* Checkbox selector */}
                                                    <TableCell className="pl-4 py-4">
                                                        <Checkbox 
                                                            checked={selectedElectorIds.has(p.id)} 
                                                            onCheckedChange={() => toggleSelectRow(p.id)} 
                                                            className={cn("transition-colors", isSent && "opacity-50")}
                                                        />
                                                    </TableCell>
                                                    {/* Queue state indicator */}
                                                    <TableCell className="pl-2 py-4">
                                                        {isCurrentlyProcessing ? (
                                                            <Badge className="bg-primary hover:bg-primary font-black text-[9px] animate-bounce">ACTIVO</Badge>
                                                        ) : isSent ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 font-black text-[8px] py-0.5 px-2 rounded-full uppercase flex items-center gap-1 w-fit animate-pulse">
                                                                    <CheckCircle className="h-2.5 w-2.5 fill-white text-emerald-600" /> ENVIADO
                                                                </Badge>
                                                                {p.difundidoBy && (
                                                                    <span className="text-[7px] text-muted-foreground font-black uppercase ml-1">
                                                                        Por: {p.difundidoBy} {p.difundidoAt ? `• ${new Date(p.difundidoAt).toLocaleDateString()}` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 animate-none">
                                                                <Badge variant="secondary" className="bg-slate-200 text-slate-500 hover:bg-slate-200 font-black text-[8px] py-0.5 px-2 rounded-full uppercase flex items-center gap-1 w-fit">
                                                                    PENDIENTE
                                                                </Badge>
                                                                <span className="text-[10px] font-black text-muted-foreground">#{index + 1}</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className={cn("text-xs uppercase tracking-tight", isCurrentlyProcessing ? "font-black text-slate-900" : "font-bold text-slate-800")}>
                                                                {p.NOMBRE} {p.APELLIDO}
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
                                                                    className="h-9 text-xs font-black w-40" 
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
                                                                    className="h-9 text-xs font-black w-40" 
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
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end gap-1.5">
                                                            {/* Direct wa.me prefilled send button for TELEFONO */}
                                                            <Button 
                                                                size="sm" 
                                                                variant="default" 
                                                                className="bg-green-600 hover:bg-green-700 text-white font-black text-[9px] h-8 px-2.5 rounded-lg flex items-center gap-1 shadow-sm uppercase"
                                                                onClick={() => handleDirectSend(p, p.TELEFONO || '')}
                                                                disabled={!hasPhone}
                                                            >
                                                                <MessageSquare className="h-3 w-3" /> REGIST.
                                                            </Button>

                                                            {/* Direct wa.me prefilled send button for TELEFONO_MIGRADO */}
                                                            <Button 
                                                                size="sm" 
                                                                variant="default" 
                                                                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] h-8 px-2.5 rounded-lg flex items-center gap-1 shadow-sm uppercase"
                                                                onClick={() => handleDirectSend(p, p.TELEFONO_MIGRADO || '')}
                                                                disabled={!hasPhoneMig}
                                                            >
                                                                <MessageSquare className="h-3 w-3" /> MIGRAD.
                                                            </Button>

                                                            {/* Jump and prioritize directly to this elector */}
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                onClick={() => {
                                                                    setCoPilotIndex(index);
                                                                    setIsCoPilotRunning(true);
                                                                }}
                                                                className={cn("h-8 text-[9px] font-black rounded-lg uppercase shadow-sm border-slate-200 text-slate-800 hover:bg-slate-50", isCurrentlyProcessing && "bg-primary text-white border-primary hover:bg-primary")}
                                                            >
                                                                {isCurrentlyProcessing ? 'PROCESANDO...' : 'ENVIAR CO-PILOTO'}
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-96 text-center opacity-20">
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
                    </Card>
                </div>
            </div>



            <div className="text-center pt-10 opacity-40">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900">
                    SISTEMA DE GESTIÓN ESTRATÉGICA - LISTA 2P OPCION 2
                </p>
            </div>
        </div>
    );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

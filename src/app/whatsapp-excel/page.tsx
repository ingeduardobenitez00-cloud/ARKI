'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { collection, addDoc, doc, updateDoc, arrayUnion, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    FileSpreadsheet, Upload, Play, Pause, RotateCcw, Volume2, VolumeX, Zap, Settings, MessageSquare, AlertCircle, ArrowLeft, Trash2, List, Save, Loader2, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useCollection } from '@/firebase/firestore/use-collection';

interface ExcelRow {
    _id: string; // Internal unique ID for tracking
    [key: string]: any;
}

interface WhatsappExcelCampaign {
    id: string;
    name: string;
    fileName: string;
    createdAt: any;
    createdBy: {
        id: string;
        name: string;
    };
    columns: string[];
    nameCol: string;
    phoneCol: string;
    template: string;
    data: string; // Stringified array of ExcelRow
    processedIds: string[];
}

const EVENT_TEMPLATES = {
    REUNION: "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe invitamos a participar de nuestra gran REUNIÓN. Tu presencia es fundamental.\n\n¡Contamos con tu apoyo! 🚀",
    GENERAL: "{¡Hola!|¡Buenas!|Saludos} {nombre} 👋\n\nTe saluda El Arki Sotomayor, Candidato a Concejal por la Lista 1 Opción 5. 🔴\n\nTe invitamos a sumarte a nuestro equipo.\n\n¡Contamos con tu apoyo! 🚀"
};

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

export default function WhatsappExcelPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();

    // -- Firestore Campaigns --
    const campaignsQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'whatsapp_excel_campaigns'), orderBy('createdAt', 'desc'));
    }, [db]);
    const { data: campaigns, isLoading: isLoadingCampaigns } = useCollection<WhatsappExcelCampaign>(campaignsQuery);

    const [selectedCampaign, setSelectedCampaign] = useState<WhatsappExcelCampaign | null>(null);

    // -- Uploading State --
    const [pendingCampaignData, setPendingCampaignData] = useState<ExcelRow[] | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [campaignNameInput, setCampaignNameInput] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [nameCol, setNameCol] = useState<string>('');
    const [phoneCol, setPhoneCol] = useState<string>('');
    const [isSavingCampaign, setIsSavingCampaign] = useState(false);

    // -- Execution State (Active Campaign) --
    const [data, setData] = useState<ExcelRow[]>([]);
    const [invitationTemplate, setInvitationTemplate] = useState(EVENT_TEMPLATES.GENERAL);
    const [isCoPilotRunning, setIsCoPilotRunning] = useState(false);
    const [coPilotDelay, setCoPilotDelay] = useState(15); 
    const [useSpintax, setUseSpintax] = useState(true);
    const [useVariability, setUseVariability] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    
    const [coPilotIndex, setCoPilotIndex] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Helper: Beep sound
    const playBeep = useCallback(() => {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {
            console.error("Audio beep error:", e);
        }
    }, [soundEnabled]);

    // Spintax Resolver
    const resolveSpintax = useCallback((text: string) => {
        if (!useSpintax) {
            return text.replace(/\{([^{}]+)\}/g, (match, options) => {
                return options.split('|')[0] || '';
            });
        }
        return text.replace(/\{([^{}]+)\}/g, (match, options) => {
            if (options.includes('|')) {
                const choices = options.split('|');
                return choices[Math.floor(Math.random() * choices.length)];
            }
            return match; 
        });
    }, [useSpintax]);

    // Handle File Upload (Prep for Saving)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setCampaignNameInput(file.name.replace(/\.[^/.]+$/, ""));

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
                
                if (jsonData.length === 0) {
                    toast({ title: 'El archivo está vacío', variant: 'destructive' });
                    return;
                }

                const cols = Object.keys(jsonData[0]);
                setColumns(cols);

                let bestName = cols.find(c => c.toUpperCase().includes('NOMBRE')) || cols[0];
                let bestPhone = cols.find(c => c.toUpperCase().includes('TELEFONO') || c.toUpperCase().includes('CELULAR') || c.toUpperCase().includes('TEL')) || cols[1] || cols[0];
                
                setNameCol(bestName);
                setPhoneCol(bestPhone);

                const formattedData = jsonData.map((row, idx) => ({
                    ...row,
                    _id: `row_${idx}_${Date.now()}`
                }));

                setPendingCampaignData(formattedData);
                toast({ title: 'Archivo procesado', description: `Se encontraron ${formattedData.length} registros.` });
            } catch (error) {
                console.error(error);
                toast({ title: 'Error al leer el archivo', description: 'Asegúrate de que sea un Excel o CSV válido.', variant: 'destructive' });
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveCampaign = async () => {
        if (!db || !user || !pendingCampaignData) return;
        setIsSavingCampaign(true);
        try {
            const newDoc = {
                name: campaignNameInput || fileName || 'Campaña Excel',
                fileName: fileName || '',
                createdAt: serverTimestamp(),
                createdBy: { id: user.id, name: user.name },
                columns,
                nameCol,
                phoneCol,
                template: EVENT_TEMPLATES.GENERAL,
                data: JSON.stringify(pendingCampaignData),
                processedIds: []
            };
            
            await addDoc(collection(db, 'whatsapp_excel_campaigns'), newDoc);
            toast({ title: 'Campaña Guardada', description: 'Ya puedes seleccionarla en la lista para iniciar los envíos.' });
            
            setPendingCampaignData(null);
            setFileName(null);
            setCampaignNameInput('');
            
        } catch (e) {
            console.error(e);
            toast({ title: 'Error al guardar', variant: 'destructive' });
        } finally {
            setIsSavingCampaign(false);
        }
    };

    const handleSelectCampaign = (camp: WhatsappExcelCampaign) => {
        setSelectedCampaign(camp);
        
        setColumns(camp.columns || []);
        setNameCol(camp.nameCol || '');
        setPhoneCol(camp.phoneCol || '');
        setInvitationTemplate(camp.template || EVENT_TEMPLATES.GENERAL);
        
        try {
            const parsedData = JSON.parse(camp.data || '[]');
            setData(parsedData);
            setSelectedIds(new Set(parsedData.map((r: any) => r._id)));
        } catch (e) {
            console.error(e);
            toast({ title: 'Error leyendo datos de campaña', variant: 'destructive' });
            setData([]);
        }
        
        setProcessedIds(new Set(camp.processedIds || []));
        setCoPilotIndex(0);
        setIsCoPilotRunning(false);
    };

    const handleCloseCampaign = () => {
        setSelectedCampaign(null);
        setData([]);
        setProcessedIds(new Set());
        setSelectedIds(new Set());
        setIsCoPilotRunning(false);
        
        if (timerRef.current) clearTimeout(timerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
    };

    const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de eliminar esta campaña de forma permanente?')) return;
        try {
            await deleteDoc(doc(db!, 'whatsapp_excel_campaigns', id));
            toast({ title: 'Campaña Eliminada' });
            if (selectedCampaign?.id === id) {
                handleCloseCampaign();
            }
        } catch (err) {
            toast({ title: 'Error al eliminar', variant: 'destructive' });
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === data.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.map(d => d._id)));
        }
    };

    const toggleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error("Clipboard blocked:", err);
            return false;
        }
    };

    // Main Co-Pilot Step
    const runCoPilotStep = useCallback(async (index: number) => {
        if (index >= data.length) {
            setIsCoPilotRunning(false);
            toast({ title: '¡Campaña Finalizada!', description: 'Se ha completado el envío masivo.' });
            return;
        }

        const row = data[index];
        const id = row._id;

        if (!selectedIds.has(id) || processedIds.has(id)) {
            setCoPilotIndex(index + 1);
            return;
        }

        const targetPhone = String(row[phoneCol] || '').trim();
        const contactName = String(row[nameCol] || '').trim();

        if (!targetPhone || targetPhone.length < 6) {
            setCoPilotIndex(index + 1);
            return;
        }

        let msg = resolveSpintax(invitationTemplate);
        msg = msg.replace(/{nombre}/gi, contactName).replace(/\[NOMBRE\]/gi, contactName);
        columns.forEach(col => {
            const regex = new RegExp(`{${col}}`, 'gi');
            msg = msg.replace(regex, String(row[col] || ''));
        });

        playBeep();
        const copied = await copyToClipboard(msg);
        if (copied) {
            toast({ title: `Preparando: ${contactName}`, description: 'Texto copiado.' });
        }

        const finalPhone = formatParaguayPhone(targetPhone);
        const captionParam = msg ? `&text=${encodeURIComponent(msg)}` : '';
        const autoSendParam = '&arki_auto_send=true';
        window.location.href = `whatsapp://send?phone=${finalPhone}${captionParam}`;

        // Mark as processed & sync to Firestore
        const nextProcessed = new Set(processedIds);
        nextProcessed.add(id);
        setProcessedIds(nextProcessed);

        if (db && selectedCampaign) {
            updateDoc(doc(db, 'whatsapp_excel_campaigns', selectedCampaign.id), {
                processedIds: arrayUnion(id),
                template: invitationTemplate // Also sync template used
            }).catch(e => console.error("Error updating campaign progress", e));
        }

        if (db && user) {
            logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'DIFUSION_EXCEL',
                action: 'ENVIÓ EXCEL_AUTO',
                targetName: `${contactName} (${targetPhone})`
            });
        }

        let actualDelay = coPilotDelay;
        if (useVariability) {
            const randomVar = Math.floor(Math.random() * 7) - 3;
            actualDelay = Math.max(10, coPilotDelay + randomVar);
        }

        setCountdown(actualDelay);
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

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setCoPilotIndex(prev => prev + 1);
        }, actualDelay * 1000);

    }, [data, processedIds, selectedIds, coPilotDelay, useVariability, phoneCol, nameCol, invitationTemplate, columns, playBeep, resolveSpintax, db, user, selectedCampaign]);

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

    const handleResetCampaignProgress = async () => {
        if (!selectedCampaign || !db) return;
        setIsCoPilotRunning(false);
        setCoPilotIndex(0);
        setProcessedIds(new Set());
        try {
            await updateDoc(doc(db, 'whatsapp_excel_campaigns', selectedCampaign.id), {
                processedIds: []
            });
            toast({ title: 'Historial Reiniciado', description: 'Se limpió el historial de envíos. Empezarás de cero.' });
        } catch (e) {
            toast({ title: 'Error al reiniciar', variant: 'destructive' });
        }
    };

    const handleSaveTemplate = async () => {
        if (!selectedCampaign || !db) return;
        try {
            await updateDoc(doc(db, 'whatsapp_excel_campaigns', selectedCampaign.id), {
                template: invitationTemplate
            });
            toast({ title: 'Texto Guardado', description: 'El mensaje se ha guardado para esta campaña.' });
        } catch (e) {
            toast({ title: 'Error al guardar', variant: 'destructive' });
        }
    };

    const progressPercent = useMemo(() => {
        if (data.length === 0) return 0;
        const totalSelected = selectedIds.size;
        if (totalSelected === 0) return 0;
        let sentCount = 0;
        processedIds.forEach(id => {
            if (selectedIds.has(id)) sentCount++;
        });
        return Math.round((sentCount / totalSelected) * 100);
    }, [data, processedIds, selectedIds]);

    const handleSendIndividual = async (row: ExcelRow) => {
        const id = row._id;
        const targetPhone = String(row[phoneCol] || '').trim();
        const contactName = String(row[nameCol] || '').trim();

        if (!targetPhone || targetPhone.length < 6) {
            toast({ title: 'Número inválido', description: 'El contacto no tiene un número válido.', variant: 'destructive' });
            return;
        }

        let msg = resolveSpintax(invitationTemplate);
        msg = msg.replace(/{nombre}/gi, contactName).replace(/\[NOMBRE\]/gi, contactName);
        columns.forEach(col => {
            const regex = new RegExp(`{${col}}`, 'gi');
            msg = msg.replace(regex, String(row[col] || ''));
        });

        const copied = await copyToClipboard(msg);
        if (copied) {
            toast({ title: `Preparando: ${contactName}`, description: 'Texto copiado.' });
        }

        const finalPhone = formatParaguayPhone(targetPhone);
        const captionParam = msg ? `&text=${encodeURIComponent(msg)}` : '';
        
        window.open(`https://api.whatsapp.com/send?phone=${finalPhone}${captionParam}`, '_blank');

        // Mark as processed & sync to Firestore
        const nextProcessed = new Set(processedIds);
        nextProcessed.add(id);
        setProcessedIds(nextProcessed);

        if (db && selectedCampaign) {
            updateDoc(doc(db, 'whatsapp_excel_campaigns', selectedCampaign.id), {
                processedIds: arrayUnion(id),
                template: invitationTemplate
            }).catch(e => console.error("Error updating campaign progress", e));
        }

        if (db && user) {
            logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'DIFUSION_EXCEL',
                action: 'ENVIÓ EXCEL_INDIVIDUAL',
                targetName: `${contactName} (${targetPhone})`
            });
        }
    };


    
    // --- RENDER VIEW 1: Campaign Selector / Uploader ---
    if (!selectedCampaign) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-primary" /> Campañas WhatsApp Excel
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                        Sube archivos Excel para guardarlos de forma permanente y enviar mensajes masivos a tu ritmo.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Upload New Campaign */}
                    <Card className="border-primary/10 shadow-lg bg-white h-fit">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                                <Upload className="h-4 w-4 text-primary" /> Crear Nueva Campaña
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="grid w-full gap-1.5">
                                <Label htmlFor="excel-file" className="text-xs uppercase text-slate-500 font-bold mb-1">Archivo Excel / CSV</Label>
                                <Input id="excel-file" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="cursor-pointer file:text-primary file:font-bold file:bg-primary/10 file:border-0 file:rounded file:px-3 file:py-1 file:mr-3" />
                                {fileName && <p className="text-[10px] text-primary font-medium mt-1 truncate">{fileName}</p>}
                            </div>
                            
                            {pendingCampaignData && columns.length > 0 && (
                                <div className="space-y-3 pt-3 border-t animate-in fade-in zoom-in duration-300">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs uppercase text-slate-500 font-bold">Nombre de la Campaña</Label>
                                        <Input value={campaignNameInput} onChange={e => setCampaignNameInput(e.target.value)} placeholder="Ej: Invitaciones Evento" className="font-bold" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-slate-500 font-bold">Col. Nombre</Label>
                                            <Select value={nameCol} onValueChange={setNameCol}>
                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                                                <SelectContent>{columns.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-slate-500 font-bold">Col. Teléfono</Label>
                                            <Select value={phoneCol} onValueChange={setPhoneCol}>
                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                                                <SelectContent>{columns.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                    <Button onClick={handleSaveCampaign} disabled={isSavingCampaign || !campaignNameInput} className="w-full mt-2 font-black uppercase tracking-widest text-xs h-11 bg-primary text-primary-foreground shadow-md hover:scale-[1.02] transition-transform">
                                        {isSavingCampaign ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Guardar y Continuar
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Campaigns List */}
                    <Card className="border-primary/10 shadow-sm lg:col-span-2 flex flex-col h-full min-h-[400px]">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-800">
                                <List className="h-5 w-5 text-primary" /> Tus Campañas Guardadas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-0">
                            {isLoadingCampaigns ? (
                                <div className="p-4 space-y-3">
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                </div>
                            ) : campaigns && campaigns.length > 0 ? (
                                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                    {campaigns.map(camp => {
                                        const date = camp.createdAt?.toDate ? camp.createdAt.toDate() : new Date();
                                        const parsedData = (() => { try { return JSON.parse(camp.data || '[]'); } catch(e){return [];} })();
                                        const total = parsedData.length;
                                        const sentCount = (camp.processedIds || []).length;
                                        const perc = total > 0 ? Math.round((sentCount / total) * 100) : 0;
                                        const isCompleted = perc === 100 && total > 0;

                                        return (
                                            <div key={camp.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 group">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-black text-sm uppercase truncate text-slate-900">{camp.name}</h4>
                                                        {isCompleted && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] uppercase font-black px-1.5 py-0">Completado</Badge>}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date.toLocaleDateString()}</span>
                                                        <span className="flex items-center gap-1 truncate"><Upload className="h-3 w-3" /> {camp.fileName}</span>
                                                    </div>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <Progress value={perc} className="h-1.5 w-32 bg-slate-200" />
                                                        <span className="text-[10px] font-black text-slate-400">{sentCount} / {total}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={(e) => handleDeleteCampaign(camp.id, e)} className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button onClick={() => handleSelectCampaign(camp)} className="h-9 font-black uppercase text-[10px] bg-slate-900 text-white hover:bg-slate-800 shadow-sm">
                                                        <Play className="h-3.5 w-3.5 mr-2" /> {perc > 0 && !isCompleted ? 'Retomar' : 'Abrir'}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-full min-h-[300px] flex flex-col items-center justify-center opacity-30 text-center p-6">
                                    <FileSpreadsheet className="h-16 w-16 mb-4" />
                                    <p className="font-black uppercase text-xs">No tienes campañas guardadas.</p>
                                    <p className="text-[10px] font-bold mt-1">Sube un Excel para comenzar.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // --- RENDER VIEW 2: Active Campaign ---
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={handleCloseCampaign} className="h-10 w-10 bg-white border shadow-sm rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                            {selectedCampaign.name}
                        </h1>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                            {selectedCampaign.fileName} • {data.length} registros
                        </p>
                    </div>
                </div>
                {isCoPilotRunning && (
                    <Badge className="bg-green-600 animate-pulse h-9 px-4 text-xs font-black uppercase flex items-center gap-2">
                        <Zap className="h-4 w-4 mr-1 fill-white" /> CO-PILOTO ACTIVO
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* CONFIGURATION PANEL */}
                <div className="lg:col-span-1 space-y-4">
                    
                    {/* Dashboard Auto-Piloto */}
                    <Card className="border-primary/10 shadow-lg overflow-hidden bg-slate-900 text-white rounded-2xl">
                        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase flex items-center gap-2 text-primary">
                                <Zap className="h-4 w-4 text-primary fill-primary" /> Auto-Piloto Excel
                            </h3>
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-slate-400 hover:text-white" onClick={() => setSoundEnabled(!soundEnabled)}>
                                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-destructive" />}
                            </Button>
                        </div>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <span>Progreso Guardado</span>
                                    <span className="text-white">{progressPercent}%</span>
                                </div>
                                <Progress value={progressPercent} className="h-2 bg-slate-800" />
                                <div className="flex justify-between text-[9px] text-slate-500 font-medium">
                                    <span>Enviados: {processedIds.size}</span>
                                    <span>Total: {selectedIds.size}</span>
                                </div>
                            </div>

                            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 relative overflow-hidden">
                                {isCoPilotRunning && <div className="absolute inset-0 bg-primary/5 animate-pulse" />}
                                <div className="flex flex-col items-center justify-center space-y-1 relative z-10">
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                                        {isCoPilotRunning ? 'PRÓXIMO ENVÍO EN' : 'SISTEMA EN ESPERA'}
                                    </p>
                                    <div className="text-4xl font-black text-white tabular-nums tracking-tighter">
                                        {countdown} <span className="text-lg text-slate-500">seg</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                                {!isCoPilotRunning ? (
                                    <Button 
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-black uppercase text-xs shadow-lg shadow-green-900/20 col-span-2" 
                                        onClick={() => setIsCoPilotRunning(true)}
                                        disabled={selectedIds.size === 0 || !phoneCol || !nameCol}
                                    >
                                        <Play className="h-4 w-4 mr-2" /> Iniciar
                                    </Button>
                                ) : (
                                    <Button 
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs col-span-2" 
                                        onClick={() => setIsCoPilotRunning(false)}
                                    >
                                        <Pause className="h-4 w-4 mr-2" /> Pausar
                                    </Button>
                                )}
                                <Button 
                                    variant="outline"
                                    className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-black uppercase text-[10px] col-span-2" 
                                    onClick={handleResetCampaignProgress}
                                    disabled={isCoPilotRunning}
                                >
                                    <RotateCcw className="h-3 w-3 mr-2" /> Reiniciar Historial
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configuración */}
                    <Card className="border-slate-200">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-700">
                                <Settings className="h-4 w-4" /> Configuración Anti-Ban
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-5">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[11px] font-bold uppercase text-slate-600">Intervalo (segundos)</Label>
                                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{coPilotDelay}s</span>
                                </div>
                                <Slider value={[coPilotDelay]} onValueChange={v => setCoPilotDelay(v[0])} max={60} min={5} step={1} disabled={isCoPilotRunning} />
                                <p className="text-[9px] text-slate-400">Tiempo de espera entre cada mensaje enviado.</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-[11px] font-bold uppercase text-slate-600">Variabilidad</Label>
                                    <p className="text-[9px] text-slate-400 max-w-[200px]">Suma o resta +/- 3s</p>
                                </div>
                                <Switch checked={useVariability} onCheckedChange={setUseVariability} disabled={isCoPilotRunning} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-[11px] font-bold uppercase text-slate-600">Usar Spintax</Label>
                                    <p className="text-[9px] text-slate-400 max-w-[200px]">Variaciones {"{A|B}"}</p>
                                </div>
                                <Switch checked={useSpintax} onCheckedChange={setUseSpintax} disabled={isCoPilotRunning} />
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* MAIN CONTENT */}
                <div className="lg:col-span-3 space-y-6">
                    
                    {/* Mensaje Template */}
                    <Card className="border-slate-200">
                        <CardHeader className="pb-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-800">
                                <MessageSquare className="h-5 w-5 text-primary" /> Redacta el Mensaje
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex gap-2 mb-2">
                                <Button size="sm" variant="outline" onClick={() => setInvitationTemplate(EVENT_TEMPLATES.GENERAL)} className="text-[10px] uppercase font-bold h-7">
                                    Plantilla General
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setInvitationTemplate(EVENT_TEMPLATES.REUNION)} className="text-[10px] uppercase font-bold h-7">
                                    Plantilla Reunión
                                </Button>
                            </div>
                            <Textarea 
                                className="min-h-[160px] font-mono text-xs resize-y shadow-inner bg-slate-50/50" 
                                placeholder="Escribe el mensaje aquí..."
                                value={invitationTemplate}
                                onChange={(e) => setInvitationTemplate(e.target.value)}
                                disabled={isCoPilotRunning}
                            />
                            <Button 
                                onClick={handleSaveTemplate}
                                disabled={isCoPilotRunning || !invitationTemplate.trim()}
                                variant="secondary" 
                                className="w-full text-[10px] font-black uppercase shadow-sm h-9"
                            >
                                <Save className="h-3.5 w-3.5 mr-2" /> Guardar Texto Actual
                            </Button>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-[10px] text-blue-800 space-y-1">
                                <p className="font-bold uppercase flex items-center gap-1 mb-2"><AlertCircle className="h-3 w-3" /> Variables Disponibles</p>
                                <ul className="list-disc pl-4 space-y-0.5 font-medium">
                                    <li>Usa <strong>{`{nombre}`}</strong> para insertar el nombre.</li>
                                    <li>Usa el formato <strong>{`{Columna}`}</strong> para usar cualquier columna del Excel (ej. {`{Mesa}`}).</li>
                                    <li>Usa Spintax para variar el saludo: <strong>{`{Hola|Qué tal|Saludos}`}</strong>.</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Data Table */}
                    <Card className="border-slate-200">
                        <CardHeader className="pb-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-800">
                                <List className="h-5 w-5 text-primary" /> Contactos a Enviar ({selectedIds.size})
                            </CardTitle>
                        </CardHeader>
                        <div className="overflow-x-auto max-h-[500px]">
                            <Table>
                                <TableHeader className="bg-slate-100 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-[50px] text-center">
                                            <Checkbox 
                                                checked={selectedIds.size === data.length && data.length > 0} 
                                                onCheckedChange={toggleSelectAll}
                                                disabled={isCoPilotRunning || data.length === 0}
                                            />
                                        </TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Estado</TableHead>
                                        {columns.slice(0, 5).map(col => (
                                            <TableHead key={col} className="font-bold text-[10px] uppercase tracking-wider">{col}</TableHead>
                                        ))}
                                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground uppercase text-xs font-medium">
                                                No hay datos para mostrar.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.map((row, idx) => {
                                            const isSent = processedIds.has(row._id);
                                            const isSelected = selectedIds.has(row._id);
                                            const isCurrent = isCoPilotRunning && idx === coPilotIndex;

                                            return (
                                                <TableRow key={row._id} className={cn(isSent && "bg-green-50/50", isCurrent && "bg-primary/5 border-l-2 border-primary")}>
                                                    <TableCell className="text-center">
                                                        <Checkbox 
                                                            checked={isSelected} 
                                                            onCheckedChange={() => toggleSelectRow(row._id)}
                                                            disabled={isCoPilotRunning}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {isSent ? (
                                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 uppercase text-[9px] font-black tracking-wider">Enviado</Badge>
                                                        ) : isCurrent ? (
                                                            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 uppercase text-[9px] font-black tracking-wider animate-pulse">En proceso...</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-slate-400 uppercase text-[9px] font-medium">Pendiente</Badge>
                                                        )}
                                                    </TableCell>
                                                    {columns.slice(0, 5).map(col => (
                                                        <TableCell key={col} className="text-xs font-medium">
                                                            {String(row[col] || '')}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[10px] font-bold text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                                            onClick={() => handleSendIndividual(row)}
                                                            disabled={isCoPilotRunning}
                                                        >
                                                            <MessageSquare className="h-3 w-3 mr-1" /> Enviar
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

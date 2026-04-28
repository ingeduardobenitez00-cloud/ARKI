"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, doc, getDoc, getDocs, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { QRScanner } from '@/components/electoral/QRScanner';
import { IntendenteForm } from '@/components/electoral/IntendenteForm';
import { JuntaForm } from '@/components/electoral/JuntaForm';
import { useToast } from '@/hooks/use-toast';
import { Loader2, QrCode, ClipboardCheck, History, X, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { updateElectoralTotals } from '@/services/electoral-service';

export default function EscanerActasPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();

    // Selection State
    const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
    const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
    const [activeModule, setActiveModule] = useState<'intendencia' | 'junta' | null>(null);
    const [pendingQRData, setPendingQRData] = useState<any>(null);

    // Data State
    const [selectedSeccional, setSelectedSeccional] = useState<string | null>(null);
    const [allMetadata, setAllMetadata] = useState<Record<string, any>>({});
    const [mesasStatus, setMesasStatus] = useState<Record<string, any>>({});
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';

    // Fetch Metadata
    useEffect(() => {
        if (!db) return;

        if (isAdmin) {
            getDocs(collection(db, 'seccionales_metadata')).then(snap => {
                const combinedData: Record<string, any> = {};
                snap.docs.forEach(docSnap => {
                    combinedData[docSnap.id] = docSnap.data();
                });
                setAllMetadata(combinedData);
            });
        } else {
            const seccionalToQuery = user?.seccional;
            if (!seccionalToQuery) return;

            const metaDocRef = doc(db, 'seccionales_metadata', seccionalToQuery);
            getDoc(metaDocRef).then(snap => {
                if (snap.exists()) {
                    setAllMetadata({ [seccionalToQuery]: snap.data() });
                    setSelectedSeccional(seccionalToQuery);
                }
            });
        }
    }, [isAdmin, user, db]);

    // Fetch Mesas Progress Status real-time
    useEffect(() => {
        if (!db || !selectedLocal) return;

        const q = query(
            collection(db, 'seguimiento_resultados'),
            where('local', '==', selectedLocal)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const status: Record<string, any> = {};
            snapshot.docs.forEach(doc => {
                status[doc.id.split('_').pop()!] = doc.data(); // docId is localId_mesaNo
            });
            setMesasStatus(status);
        });

        return () => unsubscribe();
    }, [db, selectedLocal]);

    const allSeccionalesList = useMemo(() => Object.keys(allMetadata).sort((a,b)=>a.localeCompare(b, undefined, {numeric: true})), [allMetadata]);
    const locales = useMemo(() => {
        if (!selectedSeccional) return [];
        return allMetadata[selectedSeccional]?.locales || [];
    }, [allMetadata, selectedSeccional]);

    const currentLocalMesas = useMemo(() => {
        if (!selectedLocal || !selectedSeccional) return [];
        const localData = allMetadata[selectedSeccional]?.mesas_por_local?.find((l: any) => l.localName === selectedLocal);
        return localData?.mesas || [];
    }, [allMetadata, selectedSeccional, selectedLocal]);

    const [qrInitialData, setQrInitialData] = useState<any>(null);
    const isProcessingQR = useRef(false);

    // MSA Binary QR Parser (provisional - ~15% confidence on vote totals)
    const parseMSABinaryQR = (hexStr: string): any | null => {
        try {
            const bytes = new Uint8Array(hexStr.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
            
            // Find zlib magic bytes 0x78 0x9C
            let zlibPos = -1;
            for (let i = 0; i < bytes.length - 1; i++) {
                if (bytes[i] === 0x78 && bytes[i + 1] === 0x9C) { zlibPos = i; break; }
            }
            if (zlibPos < 0) return null;

            const headerLen = zlibPos;
            const header = Array.from(bytes.slice(0, headerLen));

            // Module type detection from header bytes [11-14] (new 15-byte format)
            // Group A: [92, 181, 154, 129] = 0x5CB59A81
            // Group B: [255, 53, 167, 218] = 0xFF35A7DA
            let moduleType = 'junta';
            if (headerLen === 15) {
                const sig = header.slice(11, 15).join(',');
                const sigA = [92, 181, 154, 129].join(',');
                moduleType = sig === sigA ? 'junta' : 'intendencia';
            }

            // Mesa number: header[6] in new format (provisional)
            const mesaNum = headerLen === 15 ? header[6] : (header[3] || 0);

            // Decompress zlib block using pako (available in browser)
            let decompressed: number[] = [];
            try {
                // Use native DecompressionStream if available
                const zlibData = bytes.slice(zlibPos);
                // Fallback: try to read zlib stored block
                // zlib stored block: 78 9C <flag=01> <len_lo> <len_hi> <nlen_lo> <nlen_hi> <data...>
                if (zlibData[2] === 0x01) {
                    const dataLen = zlibData[3] | (zlibData[4] << 8);
                    decompressed = Array.from(zlibData.slice(5, 5 + dataLen));
                }
            } catch {}

            // Best-effort vote extraction from decompressed block (provisional mapping)
            // Based on reverse engineering of ANR 2026 internals acta sample
            const provisional = true;
            const extraVals: Record<string, number> = {};
            const voteVals: Record<string, number> = {};

            if (decompressed.length >= 6) {
                // Header: dec[0-1]=0,0; dec[2]=format; dec[3]=0; dec[4-5]=district codes
                // Vote data occurs from dec[6] onwards in short-form actas
                const votePart = decompressed.slice(6);
                // Try to read individual list totals at sequential byte positions
                votePart.forEach((v, i) => {
                    if (v > 0 && v < 500 && i < 20) {
                        voteVals[`pos_${i}`] = v;
                    }
                });
                // NUL/BLC from header in old format
                if (headerLen === 22) {
                    extraVals.nulos = header[7] || 0;
                }
            }

            return {
                moduleType,
                provisional,
                raw: { mesa: mesaNum.toString(), local: 'Desconocido (binario MSA)' },
                extra: { nulos: extraVals.nulos || 0, blancos: 0, total_general: 0 },
                votes: {},
                provisionalVotes: voteVals,
                rawText: hexStr,
            };
        } catch (e) {
            console.error('MSA binary parse error:', e);
            return null;
        }
    };

    const handleQRResult = (text: string) => {
        if (isProcessingQR.current) return;
        
        try {
            isProcessingQR.current = true;

            // ── MSA Binary Format (REC <hex>) ──────────────────────────────
            const recMatch = text.trim().match(/^REC\s+([0-9A-Fa-f]+)$/);
            if (recMatch) {
                const parsed = parseMSABinaryQR(recMatch[1]);
                if (parsed) {
                    parsed.rawText = text;
                    setPendingQRData(parsed);
                    setIsScannerOpen(false);
                    return;
                }
            }

            // ── Legacy text pipe-delimited format ──────────────────────────
            const parts = text.split('|');
            const data: any = { rawText: text, votes: {}, extra: { nulos: 0, blancos: 0, total_general: 0 }, raw: { local: '', mesa: '' } };
            
            const mesaPart = parts.find(p => p.includes('MESA:'))?.split(':')[1];
            const typePart = parts.find(p => p.includes('TIPO:'))?.split(':')[1];
            const localPart = parts.find(p => p.includes('LOCAL:'))?.split(':')[1];

            data.raw.local = localPart || 'Desconocido';
            data.raw.mesa = mesaPart || 'Desconocida';
            data.moduleType = typePart?.toLowerCase().includes('inten') ? 'intendencia' : 'junta';

            const votesPart = parts.find(p => p.includes('VOTOS:'))?.split(':')[1];
            if (votesPart) {
                votesPart.split(';').forEach(pair => {
                    const [key, val] = pair.split('=');
                    const numVal = parseInt(val) || 0;
                    if (key.startsWith('L')) {
                        const listId = `list_${key.substring(1)}`;
                        data.votes[listId] = data.moduleType === 'intendencia' ? numVal : { 1: numVal };
                    } else if (key === 'N') data.extra.nulos = numVal;
                    else if (key === 'B') data.extra.blancos = numVal;
                    else if (key === 'T') data.extra.total_general = numVal;
                });
            }

            setPendingQRData(data);
            setIsScannerOpen(false);

        } catch (e) {
            console.error("QR Error:", e);
            toast({ title: "Error en QR", description: "Formato no reconocido", variant: "destructive" });
            isProcessingQR.current = false;
        }
    };

    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSaveResult = async (data: any) => {
        if (!db || !selectedLocal || !selectedMesa || !activeModule) return;
        setIsSaving(true);
        try {
            const docId = `${selectedLocal.replace(/\s+/g, '_')}_${selectedMesa}`;
            const resultRef = doc(db, `actas_${activeModule}`, docId);
            const statusRef = doc(db, 'seguimiento_resultados', docId);

            await setDoc(resultRef, {
                ...data,
                mesa: selectedMesa,
                local: selectedLocal,
                cargadoPor: user?.name,
                cargadoAt: serverTimestamp()
            });

            await setDoc(statusRef, {
                local: selectedLocal,
                mesa: selectedMesa,
                [`${activeModule}_cargado`]: true,
                last_updated: serverTimestamp()
            }, { merge: true });

            await updateElectoralTotals(db, data, activeModule === 'intendencia' ? 'Intendente' : 'Junta');

            setSaveSuccess(true);
            toast({ title: "Éxito", description: "Resultado guardado correctamente" });
            
            // Smooth transition: Wait 1.5s before clearing to allow user to see success
            setTimeout(() => {
                setSaveSuccess(false);
                setActiveModule(null);
                setQrInitialData(null);
            }, 1500);

        } catch (e) {
            toast({ title: "Error", description: "No se pudo guardar el resultado", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Carga de Resultados Electores</h1>
                    <p className="text-muted-foreground">Escanea el código QR de las actas oficiales TREP</p>
                </div>
                <Button 
                    size="lg" 
                    className="w-full md:w-auto font-bold" 
                    onClick={() => setIsScannerOpen(!isScannerOpen)}
                    variant={isScannerOpen ? "destructive" : "default"}
                    disabled={!selectedMesa}
                    title={!selectedMesa ? "Selecciona una mesa primero" : "Abrir Escáner QR"}
                >
                    {isScannerOpen ? <X className="mr-2" /> : <QrCode className="mr-2" />}
                    {isScannerOpen ? "Cerrar Escáner" : "Abrir Escáner QR"}
                </Button>
            </div>

            {isScannerOpen && (
                <div className="animate-in fade-in slide-in-from-top-4">
                    <QRScanner onResult={handleQRResult} />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Selection & Progress List */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ClipboardCheck className="w-4 h-4" />
                                Configuración de Mesa
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isAdmin && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground">Seccional</label>
                                    <Select onValueChange={(v) => { setSelectedSeccional(v); setSelectedLocal(null); setSelectedMesa(null); }} value={selectedSeccional || ''}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona SECC" /></SelectTrigger>
                                        <SelectContent>
                                            {allSeccionalesList.map((s) => (
                                                <SelectItem key={s} value={s}>SECC {s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Local de Votación</label>
                                <Select onValueChange={(v) => { setSelectedLocal(v); setSelectedMesa(null); }} value={selectedLocal || ''}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona Local" /></SelectTrigger>
                                    <SelectContent>
                                        {locales.map((l: string) => (
                                            <SelectItem key={l} value={l}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Mesa</label>
                                <Select onValueChange={(v) => setSelectedMesa(parseInt(v))} value={selectedMesa ? String(selectedMesa) : ''}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona Mesa" /></SelectTrigger>
                                    <SelectContent>
                                        {currentLocalMesas.map((m: number) => <SelectItem key={m} value={String(m)}>Mesa {m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <Button 
                                    variant={activeModule === 'intendencia' ? 'default' : 'outline'}
                                    disabled={!selectedMesa}
                                    onClick={() => setActiveModule('intendencia')}
                                    className="text-xs"
                                >
                                    Intendente
                                </Button>
                                <Button 
                                    variant={activeModule === 'junta' ? 'default' : 'outline'}
                                    disabled={!selectedMesa}
                                    onClick={() => setActiveModule('junta')}
                                    className="text-xs"
                                >
                                    Concejales
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="h-[500px] flex flex-col">
                        <CardHeader className="bg-muted/50 border-b">
                            <CardTitle className="text-sm flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <History className="w-4 h-4" />
                                    Listado de Mesas
                                </div>
                                <Badge variant="outline">{currentLocalMesas.length} Mesas</Badge>
                            </CardTitle>
                        </CardHeader>
                        <ScrollArea className="flex-1 p-0">
                            <div className="divide-y">
                                {currentLocalMesas.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        Selecciona un local para ver el progreso
                                    </div>
                                ) : (
                                    currentLocalMesas.map((m: number) => {
                                        const status = mesasStatus[m];
                                        return (
                                            <div key={m} className={`p-4 flex items-center justify-between hover:bg-muted/30 transition-colors ${selectedMesa === m ? 'bg-primary/5 border-l-4 border-primary' : ''}`} onClick={() => setSelectedMesa(m)}>
                                                <div className="font-bold">Mesa {m}</div>
                                                <div className="flex gap-2">
                                                    <Badge variant={status?.intendencia_cargada ? "default" : "secondary"} className={status?.intendencia_cargada ? "bg-green-600" : "bg-gray-100 text-gray-400"}>
                                                        INT
                                                    </Badge>
                                                    <Badge variant={status?.junta_cargada ? "default" : "secondary"} className={status?.junta_cargada ? "bg-blue-600" : "bg-gray-100 text-gray-400"}>
                                                        JUN
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>

                {/* Main Form Area */}
                <div className="lg:col-span-2 relative">
                    {saveSuccess && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl animate-in fade-in duration-300">
                            <div className="bg-green-100 p-4 rounded-full mb-4">
                                <CheckCircle className="w-12 h-12 text-green-600 animate-bounce" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800">Resultado Guardado</h3>
                            <p className="text-sm text-slate-500">Actualizando totales en tiempo real...</p>
                        </div>
                    )}
                    
                    {!activeModule ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20">
                            <QrCode className="w-16 h-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-semibold text-muted-foreground">Esperando Escaneo o Selección</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
                                Escanea un código QR o utiliza el panel lateral para seleccionar manualmente la mesa y el módulo a cargar.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center bg-background p-2 rounded-lg border shadow-sm">
                                <Badge variant="outline" className="text-sm py-1 px-3">
                                    Cargando Mesa {selectedMesa}
                                </Badge>
                                <Button variant="ghost" size="sm" onClick={() => setActiveModule(null)}>
                                    Cancelar Carga
                                </Button>
                            </div>
                            
                            {activeModule === 'intendencia' ? (
                                <IntendenteForm 
                                    mesa={selectedMesa!} 
                                    local={selectedLocal!} 
                                    onSave={handleSaveResult}
                                    isSaving={isSaving}
                                    initialData={qrInitialData}
                                />
                            ) : (
                                <JuntaForm 
                                    mesa={selectedMesa!} 
                                    local={selectedLocal!} 
                                    onSave={handleSaveResult}
                                    isSaving={isSaving}
                                    initialData={qrInitialData}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Preview Dialog */}
                <Dialog open={!!pendingQRData} onOpenChange={(open) => { if (!open) setPendingQRData(null) }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Mesa Detectada en Código QR</DialogTitle>
                            <DialogDescription>
                                Revisa los datos de la mesa escaneada antes de aplicarlos.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            {pendingQRData?.provisional && (
                                <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm border border-red-300 font-bold flex items-start gap-2">
                                    <span className="text-red-500 text-lg leading-none">⚠</span>
                                    <div>
                                        <p>PARSER PROVISIONAL (MSA Binario)</p>
                                        <p className="font-normal text-xs mt-1">El formato binario del QR está siendo decodificado de forma experimental. Módulo detectado: <strong className="uppercase">{pendingQRData?.moduleType}</strong>. Los totales de votos deben ingresarse manualmente comparando con el papel. Este sistema se calibrará en mayo con actas reales.</p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm border border-yellow-200">
                                <p><strong>Aviso:</strong> Los datos se cargarán a la <strong>Mesa {selectedMesa}</strong> del local <strong>{selectedLocal}</strong>, según tu configuración manual.</p>
                                <p className="mt-2 text-xs opacity-80">QR indica: <i>{pendingQRData?.raw.local} (Mesa {pendingQRData?.raw.mesa})</i></p>
                            </div>

                            {pendingQRData?.provisionalVotes && Object.keys(pendingQRData.provisionalVotes).length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                    <p className="text-xs font-bold text-blue-700 mb-2">Valores extraídos del QR (provisional — verificar con el papel):</p>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        {Object.entries(pendingQRData.provisionalVotes).map(([k, v]) => (
                                            <div key={k} className="flex justify-between bg-white rounded px-2 py-1 border border-blue-100">
                                                <span className="text-slate-500 font-mono">{k}</span>
                                                <span className="font-bold">{String(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-lg border">
                                <div className="font-bold text-muted-foreground">Módulo:</div>
                                <div className="uppercase font-semibold">{pendingQRData?.moduleType}</div>
                                <div className="font-bold text-muted-foreground">Nulos:</div>
                                <div>{pendingQRData?.extra.nulos}</div>
                                <div className="font-bold text-muted-foreground">Blancos:</div>
                                <div>{pendingQRData?.extra.blancos}</div>
                                <div className="font-bold text-muted-foreground">Total:</div>
                                <div>{pendingQRData?.extra.total_general}</div>
                            </div>

                            <div className="bg-slate-900 text-green-400 p-2 rounded-md">
                                <p className="text-[10px] font-bold mb-1 text-slate-400">DATOS CRUDOS DEL QR:</p>
                                <p className="text-[11px] font-mono break-all">{pendingQRData?.rawText || '—'}</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setPendingQRData(null); isProcessingQR.current = false; }}>
                                Descartar
                            </Button>
                            <Button type="button" onClick={() => {
                                if (pendingQRData) {
                                    setQrInitialData(pendingQRData);
                                    setActiveModule(pendingQRData.moduleType);
                                    setPendingQRData(null);
                                    isProcessingQR.current = false;
                                }
                            }}>
                                Confirmar Datos QR
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

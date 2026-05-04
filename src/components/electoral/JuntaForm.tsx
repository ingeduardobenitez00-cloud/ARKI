import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JUNTA_LISTS, getJuntaOptions } from '@/data/electoral-metadata';
import { CandidateCard } from './CandidateCard';
import { AlertCircle, Save, CheckCircle, Database, Wand2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ActaImageCapture } from './ActaImageCapture';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { procesarQRARKI } from '@/lib/qr-processor';
import * as fflate from 'fflate';

interface JuntaFormProps {
    mesa: number;
    local: string;
    depto?: string; // Nuevo
    onSave: (data: any, imageFile: File) => void;
    isSaving?: boolean;
    initialData?: any; 
}

export function JuntaForm({ mesa, local, depto = 'CAPITAL', onSave, isSaving, initialData }: JuntaFormProps) {
    const [votes, setVotes] = useState<Record<string, Record<number, number>>>(initialData?.votes || {});
    const [extra, setExtra] = useState(initialData?.extra || { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);

    // Preview state
    const [ocrPreview, setOcrPreview] = useState<{ 
        votes: Record<string, Record<number, number>>, 
        extra: any,
        identity: { mesa: number, local: number, distrito: number },
        resultsBlock?: any[],
        isQr?: boolean,
        rawData?: number[],
        rawHex?: string
    } | null>(null);
    const [rawQrHex, setRawQrHex] = useState<string | null>(null);
    const [isOcrDialogOpen, setIsOcrDialogOpen] = useState(false);
    const [activeListId, setActiveListId] = useState(JUNTA_LISTS[0].id);

    // Handle incoming QR data asynchronously
    React.useEffect(() => {
        if (initialData) {
            if (initialData.votes) setVotes(initialData.votes);
            if (initialData.extra) setExtra(initialData.extra);
        }
    }, [initialData]);

    const handleOcrParsed = (text: string) => {
        const previewVotes: Record<string, Record<number, number>> = {};
        const previewExtra = { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 };
        setOcrPreview({ votes: previewVotes, extra: previewExtra, identity: { mesa, local: 0, distrito: 0 } });
        setIsOcrDialogOpen(true);
    };

    const handleAiParsed = (data: any) => {
        const previewVotes: Record<string, Record<number, number>> = {};
        
        // La IA nos devuelve un objeto plano, lo convertimos a la estructura de Junta (Lista -> Opcion)
        Object.entries(data.votos).forEach(([key, val]) => {
            const listId = key.split('-opt-')[0];
            const option = parseInt(key.split('-opt-')[1] || "1");
            if (!previewVotes[listId]) previewVotes[listId] = {};
            previewVotes[listId][option] = val as number;
        });

        setOcrPreview({
            votes: previewVotes,
            extra: {
                ...data.cierre,
                es_valido: true,
                total_calculado: Object.values(data.votos).reduce((a: any, b: any) => a + b, 0) + 
                                (data.cierre.nul || 0) + (data.cierre.blc || 0) + (data.cierre.vac || 0)
            },
            identity: { mesa, local: 0, distrito: 0 },
            resultsBlock: Object.entries(data.votos).map(([id, val]) => ({ id, nombre: `Opción ${id}`, votos: val })),
            isQr: false
        });
        setIsOcrDialogOpen(true);
    };

    const handleQrParsed = (data: number[], rawHex: string) => {
        // USAR MOTOR UNIFICADO ARKI (Con desempaquetado de bits)
        const resultado = procesarQRARKI(data, depto, 'JUNTA', 0);

        const previewVotes: Record<string, Record<number, number>> = {};
        
        resultado.votos.forEach(v => {
            const listId = v.id.split('-opt-')[0];
            const option = parseInt(v.id.split('-opt-')[1]);
            
            if (!previewVotes[listId]) previewVotes[listId] = {};
            previewVotes[listId][option] = v.votos;
        });

        setRawQrHex(rawHex);
        setOcrPreview({ 
            votes: previewVotes, 
            extra: { 
                ...resultado.cierre, 
                es_valido: resultado.validado,
                total_calculado: resultado.votos.reduce((a, b) => a + b.votos, 0) + 
                                 resultado.cierre.nul + resultado.cierre.blc + resultado.cierre.vac
            },
            identity: {
                mesa: data[5] || 0,
                local: data[4] || 0,
                distrito: data[2] || 0
            },
            resultsBlock: resultado.votos,
            isQr: true,
            rawData: data,
            rawHex: rawHex
        });
        setIsOcrDialogOpen(true);
    };

    const applyOcrData = () => {
        if (ocrPreview) {
            setVotes(ocrPreview.votes);
            setExtra({
                nulos: ocrPreview.extra.nul || ocrPreview.extra.nulos || 0,
                blancos: ocrPreview.extra.blc || ocrPreview.extra.blancos || 0,
                votos_computar: ocrPreview.extra.vac || ocrPreview.extra.votos_computar || 0,
                total_general: ocrPreview.extra.tot || ocrPreview.extra.total_general || 0
            });
            setOcrPreview(null);
            setIsOcrDialogOpen(false);
            toast({ title: "Datos Inyectados", description: "Votos preferenciales cargados con éxito." });
        }
    };

    const handleEditPreviewVote = (listId: string, option: number, value: string) => {
        if (!ocrPreview) return;
        const numValue = parseInt(value) || 0;
        
        const newVotes = { ...ocrPreview.votes };
        if (!newVotes[listId]) newVotes[listId] = {};
        newVotes[listId][option] = numValue;

        // Recalcular total general
        const totalVotosListas = Object.keys(newVotes).reduce((acc, lId) => {
            return acc + Object.values(newVotes[lId]).reduce((a, b) => a + (b as number), 0);
        }, 0);
        const totalExtra = (ocrPreview.extra.nul || 0) + (ocrPreview.extra.blc || 0) + (ocrPreview.extra.vac || 0);
        const newTotalCalculado = totalVotosListas + totalExtra;
        const esValido = newTotalCalculado === (ocrPreview.extra.tot || 0);

        setOcrPreview({
            ...ocrPreview,
            votes: newVotes,
            extra: { ...ocrPreview.extra, total_calculado: newTotalCalculado, es_valido: esValido }
        });
    };

    const handleEditPreviewExtra = (field: string, value: string) => {
        if (!ocrPreview) return;
        const numValue = parseInt(value) || 0;
        const newExtra = { ...ocrPreview.extra, [field]: numValue };
        
        // Recalcular total
        const totalVotosListas = Object.keys(ocrPreview.votes).reduce((acc, lId) => {
            return acc + Object.values(ocrPreview.votes[lId]).reduce((a, b) => a + (b as number), 0);
        }, 0);
        const newTotalCalculado = totalVotosListas + (newExtra.nul || 0) + (newExtra.blc || 0) + (newExtra.vac || 0);
        const esValido = newTotalCalculado === (newExtra.tot || 0);

        setOcrPreview({
            ...ocrPreview,
            extra: { ...newExtra, total_calculado: newTotalCalculado, es_valido: esValido }
        });
    };

    const handleVoteChange = (listId: string, option: number, value: string) => {
        setVotes(prev => ({
            ...prev,
            [listId]: {
                ...(prev[listId] || {}),
                [option]: parseInt(value) || 0
            }
        }));
    };

    const getListTotal = (listId: string) => {
        return Object.values(votes[listId] || {}).reduce((a, b) => a + b, 0);
    };

    const totalVotosListas = Object.keys(votes).reduce((acc, listId) => acc + getListTotal(listId), 0);
    const calculatedTotal = totalVotosListas + extra.nulos + extra.blancos + (extra.votos_computar || 0);
    const isTotalValid = calculatedTotal === extra.total_general && extra.total_general > 0;

    return (
        <Card className="w-full max-w-6xl mx-auto border-t-4 border-t-blue-600">
            <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center text-blue-600">
                    <div className="flex items-center gap-2">
                        <span>Junta Municipal</span>
                        {initialData && (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] py-0 h-5">
                                CARGADO POR QR
                            </Badge>
                        )}
                    </div>
                    <span className="text-sm font-normal text-muted-foreground">Mesa {mesa} | {local}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <ActaImageCapture 
                    onImageCaptured={setImageFile} 
                    onOcrParsed={handleOcrParsed}
                    onAiParsed={handleAiParsed}
                    onQrParsed={handleQrParsed}
                    depto={depto}
                    cargo="JUNTA MUNICIPAL"
                    listas={depto === 'CAPITAL' ? ["2C", "2P", "6", "7", "20"] : [510, 520, 530, 540, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700, 710, 720]}
                />
                
                <Tabs defaultValue={activeListId} onValueChange={setActiveListId} className="w-full">
                    <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-muted">
                        {JUNTA_LISTS.map(list => {
                            const listTotal = getListTotal(list.id);
                            return (
                                <TabsTrigger key={list.id} value={list.id} className="flex flex-col py-2 px-1 text-[10px] sm:text-xs">
                                    <span className="font-bold">L{list.listNumber}</span>
                                    {listTotal > 0 && <span className="text-green-600">({listTotal})</span>}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                    
                    {JUNTA_LISTS.map(list => (
                        <TabsContent key={list.id} value={list.id}>
                            <ScrollArea className="h-[500px] pr-4 mt-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {getJuntaOptions(list.id).map(opt => (
                                        <CandidateCard 
                                            key={opt.id}
                                            name={opt.name}
                                            photo={opt.photo}
                                            option={opt.option}
                                            votes={votes[list.id]?.[opt.option!] || ''}
                                            onChange={(v) => handleVoteChange(list.id, opt.option!, v)}
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    ))}
                </Tabs>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg border">
                    <div className="space-y-2">
                        <Label>Nulos</Label>
                        <Input 
                            type="number" 
                            value={extra.nulos || ''} 
                            onChange={(e) => setExtra((p: any) => ({...p, nulos: parseInt(e.target.value) || 0}))} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Blancos</Label>
                        <Input 
                            type="number" 
                            value={extra.blancos || ''} 
                            onChange={(e) => setExtra((p: any) => ({...p, blancos: parseInt(e.target.value) || 0}))} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Votos a Computar</Label>
                        <Input 
                            type="number" 
                            value={extra.votos_computar || ''} 
                            onChange={(e) => setExtra((p: any) => ({...p, votos_computar: parseInt(e.target.value) || 0}))} 
                            className="font-bold text-blue-700"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-blue-700 font-bold">Total General (Resultados)</Label>
                        <Input 
                            type="number" 
                            value={calculatedTotal} 
                            readOnly
                            className="votos-total font-black text-lg bg-slate-50 border-blue-600 text-blue-700"
                        />
                        <p className="text-[9px] text-muted-foreground italic">
                            * Suma de buzones de resultados electorales.
                        </p>
                    </div>
                </div>

                {calculatedTotal === 0 && (
                    <div className="flex items-center gap-2 text-blue-500 text-sm font-semibold justify-center bg-blue-50 p-2 rounded mt-4">
                        <AlertCircle className="w-4 h-4" />
                        <span>Esperando ingreso de datos o escaneo QR...</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-col w-full gap-4 pt-6">
                <Button 
                    className="w-full h-12 text-lg font-bold bg-blue-700 hover:bg-blue-800" 
                    disabled={!isTotalValid || !imageFile || isSaving}
                    onClick={() => onSave({ 
                        votes, 
                        ...extra, 
                        metodo_carga: rawQrHex ? 'QR_SCAN' : 'MANUAL',
                        raw_qr_data: rawQrHex 
                    }, imageFile!)}
                >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {isSaving ? 'Guardando...' : 'Finalizar Carga Junta Municipal'}
                </Button>
            </CardFooter>
            <Dialog open={isOcrDialogOpen} onOpenChange={setIsOcrDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <CardTitle className="text-blue-600 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-5 h-5" />
                                Analizador de Concejales
                            </div>
                            <Badge className={`border-none ${ocrPreview?.extra.es_valido ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                                {ocrPreview?.extra.es_valido ? 'VALIDACIÓN EXITOSA' : 'DISCREPANCIA EN SUMA'}
                            </Badge>
                        </CardTitle>
                        <DialogDescription>
                            Se han detectado datos para las siguientes listas.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-2 border-b">Lista</th>
                                        <th className="text-right p-2 border-b">Total Votos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-slate-200 text-slate-700 font-black text-[9px] text-center uppercase tracking-widest">
                                        <td colSpan={2} className="p-1">Buzón de Identidad (Referencia)</td>
                                    </tr>
                                    <tr className="border-b bg-slate-50 text-xs">
                                        <td className="p-2">Mesa / Local / Distrito</td>
                                        <td className="p-2 text-right font-mono">
                                            {ocrPreview?.identity.mesa} / {ocrPreview?.identity.local} / {ocrPreview?.identity.distrito}
                                        </td>
                                    </tr>
                                    <tr className={`font-black text-[9px] text-center uppercase tracking-widest ${!ocrPreview?.extra.es_valido ? 'bg-red-600 text-white' : 'bg-green-700 text-white'}`}>
                                        <td colSpan={2} className="p-1">
                                            {!ocrPreview?.extra.es_valido ? '⚠️ Buzón de Resultados (Discrepancia)' : '✅ Buzón de Resultados (Preferenciales)'}
                                        </td>
                                    </tr>
                                    {/* Filas por Lista con sus opciones preferenciales */}
                                    {JUNTA_LISTS.map((list) => {
                                        const listVotes = ocrPreview?.votes[list.id] || {};
                                        const listTotal = Object.values(listVotes).reduce((a: number, b) => a + (b as number), 0);
                                        
                                        // Solo mostrar opciones que tengan votos o las primeras 3 para no saturar si no hay nada
                                        const optionsToShow = Array.from({ length: 24 }, (_, i) => i + 1);
                                        
                                        return (
                                            <React.Fragment key={list.id}>
                                                <tr className="bg-slate-800 text-white text-[9px] uppercase">
                                                    <td colSpan={2} className="p-1 pl-2 font-black tracking-wider">
                                                        {list.name} — Total: {listTotal}
                                                    </td>
                                                </tr>
                                                {optionsToShow.map((opNum) => {
                                                    const val = listVotes[opNum] || 0;
                                                    if (val === 0 && opNum > 5) return null; // Ocultar ceros después de la op 5 para legibilidad
                                                    return (
                                                        <tr key={`${list.id}-op-${opNum}`} className={`border-b text-xs ${val > 0 ? 'bg-blue-50' : ''}`}>
                                                            <td className="p-1 pl-3 text-slate-600">
                                                                Opción {opNum}
                                                            </td>
                                                            <td className="p-1">
                                                                <Input 
                                                                    type="number"
                                                                    value={val}
                                                                    onChange={(e) => handleEditPreviewVote(list.id, opNum, e.target.value)}
                                                                    className="w-14 ml-auto h-6 text-right text-[10px] p-1 border-slate-200"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* SECCIÓN DE CIERRE EDITABLE */}
                                    <tr className="bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                                        <td colSpan={2} className="p-1 pl-2">Cierre del Acta</td>
                                    </tr>
                                    <tr className="bg-amber-50">
                                        <td className="p-2 text-xs">Nulos (NUL)</td>
                                        <td className="p-2">
                                            <Input type="number" value={ocrPreview?.extra.nul || 0} onChange={(e) => handleEditPreviewExtra('nul', e.target.value)} className="w-16 ml-auto h-7 text-right text-xs p-1" />
                                        </td>
                                    </tr>
                                    <tr className="bg-amber-50">
                                        <td className="p-2 text-xs">Blancos (BLC)</td>
                                        <td className="p-2">
                                            <Input type="number" value={ocrPreview?.extra.blc || 0} onChange={(e) => handleEditPreviewExtra('blc', e.target.value)} className="w-16 ml-auto h-7 text-right text-xs p-1" />
                                        </td>
                                    </tr>
                                    <tr className="bg-amber-50">
                                        <td className="p-2 text-xs">Vaciados (VAC)</td>
                                        <td className="p-2">
                                            <Input type="number" value={ocrPreview?.extra.vac || 0} onChange={(e) => handleEditPreviewExtra('vac', e.target.value)} className="w-16 ml-auto h-7 text-right text-xs p-1" />
                                        </td>
                                    </tr>

                                    <tr className="bg-blue-600 text-white">
                                        <td className="p-2 text-xs font-black uppercase">TOTAL OFICIAL JUNTA (TOT)</td>
                                        <td className="p-2">
                                            <Input 
                                                type="number" 
                                                value={ocrPreview?.extra.tot || 0} 
                                                onChange={(e) => handleEditPreviewExtra('tot', e.target.value)} 
                                                className="w-20 ml-auto h-8 text-right text-sm font-black p-1 bg-white text-blue-900" 
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic text-center">
                            * Los votos preferenciales individuales se aplicarán automáticamente a cada opción.
                        </p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsOcrDialogOpen(false)} className="flex-1">
                            Descartar
                        </Button>
                        <Button 
                            onClick={applyOcrData} 
                            className="bg-blue-700 hover:bg-blue-900 flex-1"
                            disabled={ocrPreview?.identity.mesa !== mesa}
                        >
                            {ocrPreview?.identity.mesa === mesa ? 'Inyectar al Formulario' : 'Mesa no Coincide'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

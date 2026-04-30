import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INTENDENTE_CANDIDATES } from '@/data/electoral-metadata';
import { CandidateCard } from './CandidateCard';
import { AlertCircle, Save, Wand2, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ActaImageCapture } from './ActaImageCapture';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface IntendenteFormProps {
    mesa: number;
    local: string;
    onSave: (data: any, imageFile: File) => void;
    isSaving?: boolean;
    initialData?: any; // New prop for QR auto-fill
}

export function IntendenteForm({ mesa, local, onSave, isSaving, initialData }: IntendenteFormProps) {
    const [votes, setVotes] = useState<Record<string, number>>(initialData?.votes || {});
    const [extra, setExtra] = useState(initialData?.extra || { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    
    // Preview OCR state
    const [ocrPreview, setOcrPreview] = useState<{ 
        votes: Record<string, number>, 
        extra: any,
        identity: { mesa: number, local: number, distrito: number },
        resultsBlock?: number[], // Bloque de 11 campos ancados al final
        isQr?: boolean,
        rawData?: number[],
        rawHex?: string
    } | null>(null);
    const [rawQrHex, setRawQrHex] = useState<string | null>(null);
    const [isOcrDialogOpen, setIsOcrDialogOpen] = useState(false);

    // Handle incoming QR data asynchronously
    React.useEffect(() => {
        if (initialData) {
            if (initialData.votes) setVotes(initialData.votes);
            if (initialData.extra) setExtra(initialData.extra);
        }
    }, [initialData]);

    const handleOcrParsed = (text: string) => {
        const previewVotes: Record<string, number> = {};
        const previewExtra = { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 };

        // 1. Intentar por identificador exacto (Regex)
        INTENDENTE_CANDIDATES.forEach(candidate => {
            const listNumber = candidate.list.split(' ')[0];
            const regex = new RegExp(`(?:^|\\s)${listNumber}\\b.*?(\\d+)\\s*$`, 'im');
            const match = text.match(regex);
            if (match && match[1]) {
                previewVotes[candidate.id] = parseInt(match[1], 10);
            }
        });

        // 2. Extraer campos fijos por palabra clave (más agresivo al final de línea)
        const nulosMatch = text.match(/NUL.*?\D(\d+)\s*$/im) || text.match(/NUL.*?(\d+)/im);
        if (nulosMatch && nulosMatch[1]) previewExtra.nulos = parseInt(nulosMatch[1], 10);
        
        const blancosMatch = text.match(/BLC.*?\D(\d+)\s*$/im) || text.match(/BLC.*?(\d+)/im);
        if (blancosMatch && blancosMatch[1]) previewExtra.blancos = parseInt(blancosMatch[1], 10);
        
        const vacMatch = text.match(/VAC.*?\D(\d+)\s*$/im) || text.match(/VAC.*?(\d+)/im);
        if (vacMatch && vacMatch[1]) previewExtra.votos_computar = parseInt(vacMatch[1], 10);
        
        const totalMatch = text.match(/TOT.*?\D(\d+)\s*$/im) || text.match(/TOT.*?(\d+)/im);
        if (totalMatch && totalMatch[1]) previewExtra.total_general = parseInt(totalMatch[1], 10);

        // 3. FALLBACK POR ORDEN (Heurística Posicional)
        // Si no captó nada o hay muchos ceros, intentamos por orden de filas
        const lines = text.split('\n').map(l => l.trim()).filter(l => /\d+/.test(l));
        
        // Si tenemos al menos 7 líneas con números, mapeamos por posición
        if (lines.length >= 7) {
            // Fila 0 -> Lista 2
            if (!previewVotes[INTENDENTE_CANDIDATES[0].id]) 
                previewVotes[INTENDENTE_CANDIDATES[0].id] = parseInt(lines[0].match(/(\d+)\s*$/)?.[1] || "0");
            // Fila 1 -> Lista 7
            if (!previewVotes[INTENDENTE_CANDIDATES[1].id]) 
                previewVotes[INTENDENTE_CANDIDATES[1].id] = parseInt(lines[1].match(/(\d+)\s*$/)?.[1] || "0");
            // Fila 2 -> Lista 300
            if (!previewVotes[INTENDENTE_CANDIDATES[2].id]) 
                previewVotes[INTENDENTE_CANDIDATES[2].id] = parseInt(lines[2].match(/(\d+)\s*$/)?.[1] || "0");

            // Mapear pie de acta por posición inversa
            const offset = lines.length - 4;
            if (previewExtra.nulos === 0) previewExtra.nulos = parseInt(lines[offset].match(/(\d+)\s*$/)?.[1] || "0");
            if (previewExtra.blancos === 0) previewExtra.blancos = parseInt(lines[offset+1].match(/(\d+)\s*$/)?.[1] || "0");
            if (previewExtra.votos_computar === 0) previewExtra.votos_computar = parseInt(lines[offset+2].match(/(\d+)\s*$/)?.[1] || "0");
            if (previewExtra.total_general === 0) previewExtra.total_general = parseInt(lines[offset+3].match(/(\d+)\s*$/)?.[1] || "0");
        }

        setOcrPreview({ votes: previewVotes, extra: previewExtra });
        setIsOcrDialogOpen(true);
    };

    const handleQrParsed = (data: number[], rawHex: string) => {
        const L = data.length;
        
        // CONTRATO DE CAMPOS DINÁMICO (Candidatos + 4 campos de cierre)
        const RESULT_FIELDS_COUNT = INTENDENTE_CANDIDATES.length + 4;
        const resultsBlock = data.slice(L - RESULT_FIELDS_COUNT);
        
        // IDENTIDAD (Todo lo que está a la izquierda de los 11 resultados)
        const identityBlock = data.slice(0, L - RESULT_FIELDS_COUNT);
        const identity = {
            eleccion: identityBlock[0] || 0,
            depto: identityBlock[1] || 0,
            distrito: identityBlock[2] || 0,
            zona: identityBlock[3] || 0,
            local: identityBlock[4] || 0,
            mesa: identityBlock[5] || 0,
            mesa_bis: identityBlock[6] || 0
        };

        // EXTRACCIÓN DE RESULTADOS (Cajones de Votos)
        const extraData = {
            total_general: resultsBlock[10] || 0, // El último (TOT)
            votos_computar: resultsBlock[9] || 0,  // VAC
            blancos: resultsBlock[8] || 0,         // BLC
            nulos: resultsBlock[7] || 0            // NUL
        };

        const previewVotes: Record<string, number> = {};
        // Solo tomamos los votos de las listas del bloque de resultados
        for (let i = 0; i < INTENDENTE_CANDIDATES.length; i++) {
            previewVotes[INTENDENTE_CANDIDATES[i].id] = resultsBlock[i] || 0;
        }

        // RESETEO DE CONTADOR: Suma Pura de Resultados
        const sumaResultados = Object.values(previewVotes).reduce((a, b) => a + b, 0) + 
                              extraData.nulos + extraData.blancos + extraData.votos_computar;
        
        // REGLA DE SEGURIDAD: Solo verde si hay coincidencia exacta con el Juez (TOT)
        const esValido = sumaResultados === extraData.total_general && extraData.total_general !== 0;

        setRawQrHex(rawHex);
        setOcrPreview({ 
            votes: previewVotes, 
            extra: { ...extraData, total_calculado: sumaResultados, es_valido: esValido },
            identity,
            resultsBlock, // Guardamos el bloque de 11 para lectura directa en la UI
            isQr: true,
            rawData: data,
            rawHex: rawHex
        });
        setIsOcrDialogOpen(true);
    };

    const applyOcrData = () => {
        if (ocrPreview && ocrPreview.rawData) {
            const newVotes: Record<string, number> = {};
            // REGLA 4: Inyección por Posición
            // Mapeamos el primer valor detectado al primer input, y así sucesivamente
            INTENDENTE_CANDIDATES.forEach((candidate, index) => {
                newVotes[candidate.id] = ocrPreview.rawData![index] || 0;
            });

            // Mapear los últimos campos (Nulos, Blancos, VAC)
            // Asumimos que están después de los candidatos
            const offset = INTENDENTE_CANDIDATES.length;
            const newExtra = {
                nulos: ocrPreview.rawData[offset] || 0,
                blancos: ocrPreview.rawData[offset + 1] || 0,
                votos_computar: ocrPreview.rawData[offset + 2] || 0,
                total_general: ocrPreview.rawData[offset + 3] || 0
            };

            setVotes(newVotes);
            setExtra(prev => ({ ...prev, ...newExtra }));
            setOcrPreview(null);
            setIsOcrDialogOpen(false);
        }
    };

    const handleVoteChange = (candidateId: string, value: string) => {
        setVotes(prev => ({ ...prev, [candidateId]: parseInt(value) || 0 }));
    };

    const calculatedTotal = Object.values(votes).reduce((a, b) => a + b, 0) + extra.nulos + extra.blancos + (extra.votos_computar || 0);
    const isTotalValid = calculatedTotal === extra.total_general && extra.total_general > 0;

    return (
        <Card className="w-full max-w-4xl mx-auto border-t-4 border-t-primary">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span>Intendencia Municipal</span>
                        {initialData && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-[10px] py-0 h-5">
                                CARGADO POR QR
                            </Badge>
                        )}
                    </div>
                    <span className="text-sm font-normal text-muted-foreground">Mesa {mesa} | {local}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <ActaImageCapture 
                        onImageCaptured={setImageFile} 
                        onOcrParsed={handleOcrParsed}
                        onQrParsed={handleQrParsed}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {INTENDENTE_CANDIDATES.map(candidate => (
                        <CandidateCard 
                            key={candidate.id}
                            name={candidate.name}
                            photo={candidate.photo}
                            list={candidate.list}
                            votes={votes[candidate.id] || ''}
                            onChange={(v) => handleVoteChange(candidate.id, v)}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                    <div className="space-y-2">
                        <Label>Votos Nulos</Label>
                        <Input 
                            type="number" 
                            value={extra.nulos || ''} 
                            onChange={(e) => setExtra((p: any) => ({...p, nulos: parseInt(e.target.value) || 0}))} 
                            className="font-bold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Votos en Blanco</Label>
                        <Input 
                            type="number" 
                            value={extra.blancos || ''} 
                            onChange={(e) => setExtra((p: any) => ({...p, blancos: parseInt(e.target.value) || 0}))} 
                            className="font-bold"
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
                            * Solo suma campos marcados como resultados electorales.
                        </p>
                    </div>
                </div>

                {calculatedTotal === 0 && (
                    <div className="flex items-center gap-2 text-blue-500 text-sm font-semibold justify-center bg-blue-50 p-2 rounded">
                        <AlertCircle className="w-4 h-4" />
                        <span>Esperando ingreso de datos o escaneo QR...</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-col w-full gap-4 pt-6">
                <Button 
                    className="w-full h-12 text-lg font-bold" 
                    disabled={!isTotalValid || !imageFile || isSaving}
                    onClick={() => onSave({ 
                        votes, 
                        ...extra, 
                        metodo_carga: rawQrHex ? 'QR_SCAN' : 'MANUAL',
                        raw_qr_data: rawQrHex 
                    }, imageFile!)}
                >
                    <Save className="w-5 h-5 mr-2" />
                    {isSaving ? 'Guardando...' : 'Guardar Resultados Intendencia'}
                </Button>
            </CardFooter>
            <Dialog open={isOcrDialogOpen} onOpenChange={setIsOcrDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <CardTitle className="text-purple-600 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-5 h-5" />
                                Espejo de Datos (Analizador)
                            </div>
                        <Badge className={`border-none ${ocrPreview?.extra.es_valido ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                            {ocrPreview?.extra.es_valido ? 'VALIDACIÓN EXITOSA' : 'DISCREPANCIA EN SUMA'}
                        </Badge>
                        </CardTitle>
                        <DialogDescription>
                            Revisa si los números coinciden con el acta física antes de aplicarlos al formulario.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-2 border-b">Lista / Campo</th>
                                        <th className="text-right p-2 border-b">Votos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-slate-200 text-slate-700 font-black text-[9px] text-center uppercase tracking-widest">
                                        <td colSpan={2} className="p-1">Buzón de Identidad (Referencia)</td>
                                    </tr>
                                    <tr className="border-b bg-slate-50">
                                        <td className="p-2 text-xs">Mesa / Local / Distrito</td>
                                        <td className="p-2 text-right font-mono text-xs">
                                            {ocrPreview?.identity.mesa} / {ocrPreview?.identity.local} / {ocrPreview?.identity.distrito}
                                        </td>
                                    </tr>
                                    <tr className={`font-black text-[9px] text-center uppercase tracking-widest ${!ocrPreview?.extra.es_valido ? 'bg-red-600 text-white' : 'bg-green-700 text-white'}`}>
                                        <td colSpan={2} className="p-1">
                                            {!ocrPreview?.extra.es_valido ? '⚠️ Buzón de Resultados (Discrepancia)' : '✅ Buzón de Resultados Electorales'}
                                        </td>
                                    </tr>
                                    {/* MATRIZ DE IMANES DINÁMICA */}
                                    {INTENDENTE_CANDIDATES.map((candidate, idx) => {
                                        const imán = (INTENDENTE_CANDIDATES.length + 4 - 1) - idx;
                                        const val = ocrPreview?.resultsBlock?.[idx] || 0;
                                        return (
                                            <tr key={candidate.id} className={`border-b hover:bg-slate-50 ${val > 0 ? 'bg-green-50' : ''}`}>
                                                <td className="p-2 text-xs font-semibold flex items-center gap-1">
                                                    <span className="text-[9px] text-slate-400 font-mono">🧲 L-{imán}</span>
                                                    <span>{candidate.name}</span>
                                                </td>
                                                <td className={`p-2 text-right font-black text-sm ${val > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                                                    {val}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Campos de Cierre */}
                                    {[
                                        { label: 'NULOS (NUL)',      imán: 3, idx: INTENDENTE_CANDIDATES.length },
                                        { label: 'BLANCOS (BLC)',    imán: 2, idx: INTENDENTE_CANDIDATES.length + 1 },
                                        { label: 'A COMPUTAR (VAC)', imán: 1, idx: INTENDENTE_CANDIDATES.length + 2 },
                                    ].map(({ label, imán, idx }) => {
                                        const val = ocrPreview?.resultsBlock?.[idx] || 0;
                                        return (
                                            <tr key={label} className="border-b bg-amber-50">
                                                <td className="p-2 text-xs font-semibold flex items-center gap-1">
                                                    <span className="text-[9px] text-slate-400 font-mono">🧲 L-{imán}</span>
                                                    <span>{label}</span>
                                                </td>
                                                <td className="p-2 text-right font-black text-sm">{val}</td>
                                            </tr>
                                        );
                                    })}
                                    {/* Suma y TOT */}
                                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                                        <td className="p-2 text-xs font-black uppercase">SUMA CALCULADA (Candidatos + Aux)</td>
                                        <td className={`p-2 text-right font-black text-lg ${ocrPreview?.extra.es_valido ? 'text-green-600' : 'text-red-600'}`}>
                                            {ocrPreview?.extra.total_calculado}
                                        </td>
                                    </tr>
                                    <tr className="bg-blue-600 text-white">
                                        <td className="p-2 text-xs font-black flex items-center gap-1">
                                            <span className="text-[9px] font-mono opacity-70">🧲 L-0 (TOT)</span>
                                            <span>TOTAL OFICIAL DEL ACTA</span>
                                        </td>
                                        <td className="p-2 text-right font-black text-lg">{ocrPreview?.resultsBlock?.[INTENDENTE_CANDIDATES.length + 3] ?? ocrPreview?.extra.total_general}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* NUEVO: Visualización de Bytes Crudos del QR */}
                        {ocrPreview?.isQr && ocrPreview?.rawData && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="text-[10px] font-black uppercase text-purple-600 mb-2 flex items-center gap-2">
                                    <Database className="w-3 h-3" />
                                    Estructura de Bytes Digitales (QR)
                                </h4>
                                <div className="bg-slate-950 p-2 rounded text-[9px] font-mono text-green-400 grid grid-cols-6 gap-x-2 gap-y-1 max-h-32 overflow-y-auto border border-green-900/30">
                                    {ocrPreview.rawData.map((val, idx) => (
                                        <div key={idx} className={`flex justify-between border-b border-green-900/10 ${val > 0 ? 'bg-green-900/20 text-white px-1' : 'opacity-40'}`}>
                                            <span className="text-slate-500">[{idx}]</span>
                                            <span>{val}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[9px] text-slate-500 mt-2 italic">
                                    * Se muestran todos los bytes decifrados. Los valores resaltados tienen votos.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsOcrDialogOpen(false)} className="flex-1">
                            Cancelar
                        </Button>
                        <Button 
                            onClick={applyOcrData} 
                            className={`${ocrPreview?.extra.es_valido ? 'bg-purple-600 hover:bg-purple-800' : 'bg-slate-400 cursor-not-allowed'} flex-1`}
                            disabled={!ocrPreview?.extra.es_valido || ocrPreview?.identity.mesa !== mesa}
                        >
                            {ocrPreview?.extra.es_valido 
                                ? (ocrPreview?.identity.mesa === mesa ? 'Inyectar al Formulario' : 'Mesa no Coincide')
                                : 'Discrepancia en Suma'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

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
        isQr?: boolean,
        rawData?: number[]
    } | null>(null);
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

    const handleQrParsed = (data: number[]) => {
        const previewVotes: Record<string, number> = {};
        // Mapeo directo por posición
        INTENDENTE_CANDIDATES.forEach((candidate, index) => {
            previewVotes[candidate.id] = data[index] || 0;
        });

        // Footer (últimas 4 posiciones)
        const previewExtra = {
            nulos: data[data.length - 4] || 0,
            blancos: data[data.length - 3] || 0,
            votos_computar: data[data.length - 2] || 0,
            total_general: data[data.length - 1] || 0
        };

        setOcrPreview({ 
            votes: previewVotes, 
            extra: previewExtra,
            isQr: true,
            rawData: data 
        });
        setIsOcrDialogOpen(true);
    };

    const applyOcrData = () => {
        if (ocrPreview) {
            setVotes(prev => ({ ...prev, ...ocrPreview.votes }));
            setExtra(prev => ({ ...prev, ...ocrPreview.extra }));
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
                        <Label className="text-primary font-bold">Total General (Certificado)</Label>
                        <Input 
                            type="number" 
                            value={extra.total_general || ''} 
                            onChange={(e) => setExtra((p: any) => ({...p, total_general: parseInt(e.target.value) || 0}))} 
                            className={`font-black text-lg ${isTotalValid ? 'border-green-500 ring-green-500' : 'border-red-500'}`}
                        />
                    </div>
                </div>

                {!isTotalValid && extra.total_general > 0 && (
                    <div className="flex items-center gap-2 text-red-500 text-sm font-semibold justify-center">
                        <AlertCircle className="w-4 h-4" />
                        <span>La suma ({calculatedTotal}) no coincide con el Total General ({extra.total_general})</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-col w-full gap-4 pt-6">
                <Button 
                    className="w-full h-12 text-lg font-bold" 
                    disabled={!isTotalValid || !imageFile || isSaving}
                    onClick={() => onSave({ votes, ...extra }, imageFile!)}
                >
                    <Save className="w-5 h-5 mr-2" />
                    {isSaving ? 'Guardando...' : 'Guardar Resultados Intendencia'}
                </Button>
            </CardFooter>
            <Dialog open={isOcrDialogOpen} onOpenChange={setIsOcrDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <CardTitle className="text-purple-600 flex items-center gap-2">
                            <Wand2 className="w-5 h-5" />
                            Confirmar Datos Extraídos
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
                                    <tr className="bg-slate-900 text-white font-black text-[9px] text-center uppercase tracking-widest">
                                        <td colSpan={2} className="p-1">
                                            Informe de Auditoría Digital (QR)
                                        </td>
                                    </tr>
                                    {ocrPreview?.rawData?.map((val, idx) => {
                                        if (val === 0) return null;
                                        
                                        // Intentar ver si este índice corresponde a un candidato del sistema
                                        // o si el número de byte coincide con el ID de la lista
                                        const systemCandidate = INTENDENTE_CANDIDATES.find(c => parseInt(c.list) === idx) ||
                                                              INTENDENTE_CANDIDATES[idx - 1]; // Fallback por posición
                                        
                                        const isFooter = idx >= ocrPreview.rawData!.length - 4;
                                        const label = isFooter ? 
                                            (idx === ocrPreview.rawData!.length - 1 ? "TOTAL CERTIFICADO" : 
                                             idx === ocrPreview.rawData!.length - 4 ? "VOTOS NULOS" :
                                             idx === ocrPreview.rawData!.length - 3 ? "VOTOS EN BLANCO" : "VOTOS A COMPUTAR") :
                                            (systemCandidate ? `LISTA ${systemCandidate.list} (Detectada)` : `Dato/Lista en Posición ${idx}`);

                                        return (
                                            <tr key={idx} className={`border-b ${systemCandidate ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                                                <td className="p-2 text-xs font-bold flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-400 font-mono">[{idx}]</span>
                                                    <span className={systemCandidate ? 'text-green-700' : 'text-slate-700'}>{label}</span>
                                                </td>
                                                <td className={`p-2 text-right font-black text-sm ${systemCandidate ? 'text-green-600' : 'text-slate-900'}`}>
                                                    {val}
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                        <Button onClick={applyOcrData} className="bg-purple-600 hover:bg-purple-700 flex-1">
                            Aplicar al Formulario
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

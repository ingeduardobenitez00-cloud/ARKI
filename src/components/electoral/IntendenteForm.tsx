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
import { procesarQRARKI } from '@/lib/qr-processor';
import * as fflate from 'fflate';

interface IntendenteFormProps {
    mesa: number;
    local: string;
    depto?: string; // Nuevo
    onSave: (data: any, imageFile: File) => void;
    isSaving?: boolean;
    initialData?: any; 
}

export function IntendenteForm({ mesa, local, depto = 'CAPITAL', onSave, isSaving, initialData }: IntendenteFormProps) {
    const [votes, setVotes] = useState<Record<string, number>>(initialData?.votes || {});
    const [extra, setExtra] = useState(initialData?.extra || { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    
    // Preview state
    const [ocrPreview, setOcrPreview] = useState<{ 
        votes: Record<string, number>, 
        extra: any,
        identity: { mesa: number, local: number, distrito: number },
        resultsBlock?: any[], 
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
        // Fallback básico para OCR de texto si el QR falla
        const previewVotes: Record<string, number> = {};
        const previewExtra = { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 };
        
        // (Lógica simplificada de OCR para no saturar)
        setOcrPreview({ votes: previewVotes, extra: previewExtra, identity: { mesa, local: 0, distrito: 0 } });
        setIsOcrDialogOpen(true);
    };

    const handleQrParsed = (data: number[], rawHex: string) => {
        // USAR EL MOTOR UNIFICADO ARKI
        const resultado = procesarQRARKI(data, depto, 'INTENDENTE', 0);
        
        const previewVotes: Record<string, number> = {};
        resultado.votos.forEach(v => {
            previewVotes[v.id] = v.votos;
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
                nulos: ocrPreview.extra.nul || ocrPreview.extra.nulos,
                blancos: ocrPreview.extra.blc || ocrPreview.extra.blancos,
                votos_computar: ocrPreview.extra.vac || ocrPreview.extra.votos_computar,
                total_general: ocrPreview.extra.tot || ocrPreview.extra.total_general
            });
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

                    <div className="space-y-3 py-4 max-h-[70vh] overflow-y-auto pr-2">
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
                                    {ocrPreview?.resultsBlock?.map((v, idx) => (
                                        <tr key={v.id} className={`border-b hover:bg-slate-50 ${v.votos > 0 ? 'bg-green-50' : ''}`}>
                                            <td className="p-2 text-xs font-semibold flex items-center gap-1">
                                                <span className="text-[9px] text-slate-400 font-mono">🧲 L-{v.id.split('-').pop()}</span>
                                                <span>{v.nombre}</span>
                                            </td>
                                            <td className={`p-2 text-right font-black text-sm ${v.votos > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {v.votos}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Fila de TOT (El Juez) */}
                                    <tr className="bg-blue-600 text-white">
                                        <td className="p-2 text-xs font-black flex items-center gap-1">
                                            <span className="text-[9px] font-mono opacity-70">🧲 L-0 (TOT)</span>
                                            <span>TOTAL OFICIAL DEL ACTA</span>
                                        </td>
                                        <td className="p-2 text-right font-black text-lg">{ocrPreview?.extra.tot}</td>
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

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JUNTA_LISTS, getJuntaOptions } from '@/data/electoral-metadata';
import { CandidateCard } from './CandidateCard';
import { AlertCircle, Save, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ActaImageCapture } from './ActaImageCapture';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Wand2 } from 'lucide-react';

interface JuntaFormProps {
    mesa: number;
    local: string;
    onSave: (data: any, imageFile: File) => void;
    isSaving?: boolean;
    initialData?: any; // New prop for QR auto-fill
}

export function JuntaForm({ mesa, local, onSave, isSaving, initialData }: JuntaFormProps) {
    const [votes, setVotes] = useState<Record<string, Record<number, number>>>(initialData?.votes || {});
    const [extra, setExtra] = useState(initialData?.extra || { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);

    // Preview OCR state
    const [ocrPreview, setOcrPreview] = useState<{ votes: Record<string, Record<number, number>>, extra: any } | null>(null);
    const [isOcrDialogOpen, setIsOcrDialogOpen] = useState(false);

    React.useEffect(() => {
        if (initialData) {
            if (initialData.votes) setVotes(initialData.votes);
            if (initialData.extra) setExtra(initialData.extra);
        }
    }, [initialData]);

    const handleOcrParsed = (text: string) => {
        const previewVotes: Record<string, Record<number, number>> = {};
        const previewExtra = { nulos: 0, blancos: 0, votos_computar: 0, total_general: 0 };
        const lines = text.split('\n');

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // 1. Identificar campos fijos (NUL, BLC, VAC, TOT) - Más agresivo
            const nulosMatch = trimmed.match(/NUL.*?\D(\d+)/i);
            if (nulosMatch && nulosMatch[1]) previewExtra.nulos = parseInt(nulosMatch[1], 10);
            const blancosMatch = trimmed.match(/BLC.*?\D(\d+)/i);
            if (blancosMatch && blancosMatch[1]) previewExtra.blancos = parseInt(blancosMatch[1], 10);
            const vacMatch = trimmed.match(/VAC.*?\D(\d+)/i);
            if (vacMatch && vacMatch[1]) previewExtra.votos_computar = parseInt(vacMatch[1], 10);
            const totalMatch = trimmed.match(/TOT.*?\D(\d+)/i);
            if (totalMatch && totalMatch[1]) previewExtra.total_general = parseInt(totalMatch[1], 10);

            // 2. Identificar por número de lista explícito (ej: "2C ...")
            JUNTA_LISTS.forEach(list => {
                const listRegex = new RegExp(`(?:^|\\s)${list.listNumber}\\b\\s*([\\d\\s]+)`, 'i');
                const match = trimmed.match(listRegex);
                if (match && match[1]) {
                    const numbers = match[1].trim().split(/\s+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
                    if (numbers.length > 0) {
                        if (!previewVotes[list.id]) previewVotes[list.id] = {};
                        if (numbers.length > 10) {
                            for (let i = 0; i < Math.min(16, numbers.length); i++) {
                                previewVotes[list.id][i + 1] = numbers[i];
                            }
                        } else {
                            for (let i = 0; i < Math.min(8, numbers.length); i++) {
                                previewVotes[list.id][17 + i] = numbers[i];
                            }
                        }
                    }
                }
            });
        });

        // 3. FALLBACK POR ORDEN (Si las listas no fueron identificadas por nombre)
        const candidateLines = lines.filter(l => (l.match(/\d+/g) || []).length > 5);
        if (candidateLines.length >= 5) {
            JUNTA_LISTS.forEach((list, index) => {
                // Si la lista aún no tiene votos, tomamos la línea correspondiente por índice
                if (!previewVotes[list.id] && candidateLines[index]) {
                    const numbers = candidateLines[index].match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
                    if (numbers.length > 0) {
                        previewVotes[list.id] = {};
                        // Distribuir números correlativamente (1 al 24)
                        for (let i = 0; i < Math.min(24, numbers.length); i++) {
                            previewVotes[list.id][i + 1] = numbers[i];
                        }
                    }
                }
            });
        }

        // 4. Fallback para campos fijos por posición (últimas 4 líneas con 1 solo número)
        const footerLines = lines.filter(l => (l.match(/\d+/g) || []).length === 1);
        if (footerLines.length >= 4) {
            const offset = footerLines.length - 4;
            if (previewExtra.nulos === 0) previewExtra.nulos = parseInt(footerLines[offset].match(/\d+/)?.[0] || "0");
            if (previewExtra.blancos === 0) previewExtra.blancos = parseInt(footerLines[offset+1].match(/\d+/)?.[0] || "0");
            if (previewExtra.votos_computar === 0) previewExtra.votos_computar = parseInt(footerLines[offset+2].match(/\d+/)?.[0] || "0");
            if (previewExtra.total_general === 0) previewExtra.total_general = parseInt(footerLines[offset+3].match(/\d+/)?.[0] || "0");
        }

        setOcrPreview({ votes: previewVotes, extra: previewExtra });
        setIsOcrDialogOpen(true);
    };

    const handleQrParsed = (data: number[]) => {
        const previewVotes: Record<string, Record<number, number>> = {};
        // Bloques de 24 para cada lista
        JUNTA_LISTS.forEach((list, listIndex) => {
            previewVotes[list.id] = {};
            const offset = listIndex * 24;
            for (let i = 0; i < 24; i++) {
                previewVotes[list.id][i + 1] = data[offset + i] || 0;
            }
        });

        // Footer (últimas 4 posiciones)
        const previewExtra = {
            nulos: data[data.length - 4] || 0,
            blancos: data[data.length - 3] || 0,
            votos_computar: data[data.length - 2] || 0,
            total_general: data[data.length - 1] || 0
        };

        setOcrPreview({ votes: previewVotes, extra: previewExtra });
        setIsOcrDialogOpen(true);
    };

    const applyOcrData = () => {
        if (ocrPreview) {
            setVotes(prev => {
                const merged = { ...prev };
                Object.keys(ocrPreview.votes).forEach(listId => {
                    merged[listId] = { ...(merged[listId] || {}), ...ocrPreview.votes[listId] };
                });
                return merged;
            });
            setExtra(prev => ({ ...prev, ...ocrPreview.extra }));
            setOcrPreview(null);
            setIsOcrDialogOpen(false);
        }
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
                    onQrParsed={handleQrParsed}
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
                        <Label className="text-blue-700 font-bold">Total General Certificado</Label>
                        <Input 
                            type="number" 
                            value={extra.total_general || ''} 
                            onChange={(e) => setExtra((p: any) => ({...p, total_general: parseInt(e.target.value) || 0}))} 
                            className={`font-black text-lg ${isTotalValid ? 'border-green-500 ring-green-500' : 'border-red-500'}`}
                        />
                    </div>
                </div>

                {!isTotalValid && extra.total_general > 0 && (
                    <div className="flex items-center gap-2 text-red-500 text-sm font-semibold justify-center bg-red-50 p-2 rounded">
                        <AlertCircle className="w-4 h-4" />
                        <span>Suma Actual: {calculatedTotal} | Diferencia: {Math.abs(extra.total_general - calculatedTotal)}</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-col w-full gap-4 pt-6">
                <Button 
                    className="w-full h-12 text-lg font-bold bg-blue-700 hover:bg-blue-800" 
                    disabled={!isTotalValid || !imageFile || isSaving}
                    onClick={() => onSave({ votes, ...extra }, imageFile!)}
                >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {isSaving ? 'Guardando...' : 'Finalizar Carga Junta Municipal'}
                </Button>
            </CardFooter>
            <Dialog open={isOcrDialogOpen} onOpenChange={setIsOcrDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <CardTitle className="text-blue-600 flex items-center gap-2">
                            <Wand2 className="w-5 h-5" />
                            Confirmar Datos de Junta
                        </CardTitle>
                        <DialogDescription>
                            Se han detectado datos para las siguientes listas.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-2 border-b">Lista</th>
                                        <th className="text-right p-2 border-b">Total Votos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {JUNTA_LISTS.map(list => {
                                        const votesObj = ocrPreview?.votes[list.id] || {};
                                        const total = Object.values(votesObj).reduce((a, b) => a + b, 0);
                                        if (total === 0) return null;
                                        return (
                                            <tr key={list.id} className="border-b">
                                                <td className="p-2 text-xs font-medium">L{list.listNumber} - {list.name}</td>
                                                <td className="p-2 text-right font-bold text-blue-600">{total}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-slate-50">
                                        <td className="p-2 text-xs font-bold italic">NUL / BLC / VAC</td>
                                        <td className="p-2 text-right font-bold">
                                            {ocrPreview?.extra.nulos} / {ocrPreview?.extra.blancos} / {ocrPreview?.extra.votos_computar}
                                        </td>
                                    </tr>
                                    <tr className="bg-blue-100">
                                        <td className="p-2 text-sm font-black">TOTAL CERTIFICADO</td>
                                        <td className="p-2 text-right font-black text-lg">{ocrPreview?.extra.total_general || 0}</td>
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
                        <Button onClick={applyOcrData} className="bg-blue-600 hover:bg-blue-800 flex-1">
                            Aplicar al Formulario
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

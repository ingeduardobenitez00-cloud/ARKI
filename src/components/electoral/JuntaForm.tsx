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

interface JuntaFormProps {
    mesa: number;
    local: string;
    onSave: (data: any) => void;
    isSaving?: boolean;
}

export function JuntaForm({ mesa, local, onSave, isSaving }: JuntaFormProps) {
    const [votes, setVotes] = useState<Record<string, Record<number, number>>>({});
    const [extra, setExtra] = useState({ nulos: 0, blancos: 0, total_general: 0 });

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
    const calculatedTotal = totalVotosListas + extra.nulos + extra.blancos;
    const isTotalValid = calculatedTotal === extra.total_general && extra.total_general > 0;

    return (
        <Card className="w-full max-w-6xl mx-auto border-t-4 border-t-blue-600">
            <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center text-blue-600">
                    <span>Junta Municipal</span>
                    <span className="text-sm font-normal text-muted-foreground">Mesa {mesa} | {local}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <Tabs defaultValue={JUNTA_LISTS[0].id} className="w-full">
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
                            onChange={(e) => setExtra(p => ({...p, nulos: parseInt(e.target.value) || 0}))} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Blancos</Label>
                        <Input 
                            type="number" 
                            value={extra.blancos || ''} 
                            onChange={(e) => setExtra(p => ({...p, blancos: parseInt(e.target.value) || 0}))} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Total Listas</Label>
                        <div className="h-10 flex items-center px-3 bg-white rounded-md border font-bold text-blue-700">
                            {totalVotosListas}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-blue-700 font-bold">Total General Certificado</Label>
                        <Input 
                            type="number" 
                            value={extra.total_general || ''} 
                            onChange={(e) => setExtra(p => ({...p, total_general: parseInt(e.target.value) || 0}))} 
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
            <CardFooter>
                <Button 
                    className="w-full h-12 text-lg font-bold bg-blue-700 hover:bg-blue-800" 
                    disabled={!isTotalValid || isSaving}
                    onClick={() => onSave({ votes, ...extra })}
                >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {isSaving ? 'Guardando...' : 'Finalizar Carga Junta Municipal'}
                </Button>
            </CardFooter>
        </Card>
    );
}

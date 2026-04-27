import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INTENDENTE_CANDIDATES } from '@/data/electoral-metadata';
import { CandidateCard } from './CandidateCard';
import { AlertCircle, Save } from 'lucide-react';

interface IntendenteFormProps {
    mesa: number;
    local: string;
    onSave: (data: any) => void;
    isSaving?: boolean;
}

export function IntendenteForm({ mesa, local, onSave, isSaving }: IntendenteFormProps) {
    const [votes, setVotes] = useState<Record<string, number>>({});
    const [extra, setExtra] = useState({ nulos: 0, blancos: 0, total_general: 0 });

    const handleVoteChange = (candidateId: string, value: string) => {
        setVotes(prev => ({ ...prev, [candidateId]: parseInt(value) || 0 }));
    };

    const calculatedTotal = Object.values(votes).reduce((a, b) => a + b, 0) + extra.nulos + extra.blancos;
    const isTotalValid = calculatedTotal === extra.total_general && extra.total_general > 0;

    return (
        <Card className="w-full max-w-4xl mx-auto border-t-4 border-t-primary">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>Intendencia Municipal</span>
                    <span className="text-sm font-normal text-muted-foreground">Mesa {mesa} | {local}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                            onChange={(e) => setExtra(p => ({...p, nulos: parseInt(e.target.value) || 0}))} 
                            className="font-bold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Votos en Blanco</Label>
                        <Input 
                            type="number" 
                            value={extra.blancos || ''} 
                            onChange={(e) => setExtra(p => ({...p, blancos: parseInt(e.target.value) || 0}))} 
                            className="font-bold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-primary font-bold">Total General (Certificado)</Label>
                        <Input 
                            type="number" 
                            value={extra.total_general || ''} 
                            onChange={(e) => setExtra(p => ({...p, total_general: parseInt(e.target.value) || 0}))} 
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
            <CardFooter>
                <Button 
                    className="w-full h-12 text-lg font-bold" 
                    disabled={!isTotalValid || isSaving}
                    onClick={() => onSave({ votes, ...extra })}
                >
                    <Save className="w-5 h-5 mr-2" />
                    {isSaving ? 'Guardando...' : 'Guardar Resultados Intendencia'}
                </Button>
            </CardFooter>
        </Card>
    );
}

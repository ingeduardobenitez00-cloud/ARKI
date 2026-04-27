import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CandidateCardProps {
    name: string;
    photo: string;
    list?: string;
    option?: number;
    votes: number | string;
    onChange: (value: string) => void;
}

export function CandidateCard({ name, photo, list, option, votes, onChange }: CandidateCardProps) {
    return (
        <Card className="overflow-hidden transition-all hover:ring-2 hover:ring-primary/50">
            <div className="aspect-square w-full relative bg-muted">
                <img 
                    src={photo} 
                    alt={name}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=' + encodeURIComponent(name);
                    }}
                />
                <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                    {option ? `Opción ${option}` : list}
                </div>
            </div>
            <CardContent className="p-3 space-y-2">
                <div className="text-sm font-semibold truncate" title={name}>{name}</div>
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Votos</Label>
                    <Input 
                        type="number" 
                        min="0"
                        value={votes}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="0"
                        className="h-8 text-center font-bold"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

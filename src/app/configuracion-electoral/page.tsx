"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { JUNTA_LISTS, getJuntaOptions, INTENDENTE_CANDIDATES, Candidate } from '@/data/electoral-metadata';
import { Upload, Crop, Save, User, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ConfiguracionElectoralPage() {
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Canvas ref for cropping
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 200, height: 200 });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSourceImage(event.target?.result as string);
                // Reset crop area or provide a default
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!selectedCandidate || !canvasRef.current) return;
        
        setIsSaving(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
            const response = await fetch('/api/upload-candidate-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: dataUrl,
                    imagePath: selectedCandidate.photo.split('?')[0] // Remove cache busting part if exists
                }),
            });

            const result = await response.json();
            if (result.success) {
                toast({ title: "Foto Guardada", description: `Se ha actualizado la foto de ${selectedCandidate.name}` });
                setSelectedCandidate(null);
                setSourceImage(null);
                // Trigger global refresh if needed
                window.location.reload(); 
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error al guardar", description: String(error) });
        } finally {
            setIsSaving(false);
        }
    };

    const renderCandidateList = (candidates: Candidate[]) => (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
            {candidates.map((c) => (
                <Card key={c.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedCandidate(c)}>
                    <CardContent className="p-2 flex flex-col items-center">
                        <div className="w-20 h-20 bg-muted rounded overflow-hidden mb-2 relative">
                            {c.photo ? (
                                <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-full h-full p-4 text-muted-foreground" />
                            )}
                        </div>
                        <p className="text-xs font-bold text-center line-clamp-1">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">Opc. {c.option || '-'}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );

    return (
        <div className="container mx-auto py-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold">Gestión de Candidatos</h1>
                <p className="text-muted-foreground">Administra las fotos y nombres de los candidatos para el día de las elecciones.</p>
            </header>

            <Tabs defaultValue="intendente">
                <TabsList className="grid grid-cols-3 md:w-[400px]">
                    <TabsTrigger value="intendente">Intendentes</TabsTrigger>
                    <TabsTrigger value="junta">Junta Municipal</TabsTrigger>
                </TabsList>

                <TabsContent value="intendente" className="mt-6">
                    <Card>
                        <CardHeader><CardTitle>Candidatos a la Intendencia</CardTitle></CardHeader>
                        <CardContent>{renderCandidateList(INTENDENTE_CANDIDATES)}</CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="junta" className="mt-6">
                    <Tabs defaultValue={JUNTA_LISTS[0].id}>
                        <TabsList className="flex flex-wrap h-auto gap-2 p-2 bg-muted/50 rounded-lg">
                            {JUNTA_LISTS.map(list => (
                                <TabsTrigger key={list.id} value={list.id}>{list.listNumber}</TabsTrigger>
                            ))}
                        </TabsList>
                        {JUNTA_LISTS.map(list => (
                            <TabsContent key={list.id} value={list.id}>
                                <Card>
                                    <CardHeader><CardTitle>{list.name}</CardTitle></CardHeader>
                                    <CardContent>{renderCandidateList(getJuntaOptions(list.id))}</CardContent>
                                </Card>
                            </TabsContent>
                        ))}
                    </Tabs>
                </TabsContent>
            </Tabs>

            {/* Modal de Edición */}
            <Dialog open={!!selectedCandidate} onOpenChange={() => { setSelectedCandidate(null); setSourceImage(null); }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Editar Foto: {selectedCandidate?.name}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex flex-col items-center gap-4 py-4">
                        {!sourceImage ? (
                            <div className="w-full aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 text-muted-foreground">
                                <Upload className="w-12 h-12 mb-4" />
                                <p>Sube una foto o captura de pantalla</p>
                                <Input type="file" className="mt-4 max-w-xs" onChange={handleFileChange} accept="image/*" />
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center gap-4">
                                <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded w-full text-center">
                                    Asegúrate de que la cara del candidato esté centrada.
                                </p>
                                <div className="relative border rounded overflow-hidden bg-black/5 flex items-center justify-center" style={{ maxHeight: '400px' }}>
                                    <img 
                                        src={sourceImage} 
                                        className="max-w-full max-h-[400px] object-contain"
                                        onLoad={(e) => {
                                            // Real processing logic here if we wanted complex cropping
                                            // For now, simpler: user sees the image and we'll save a 300x300 center crop or full
                                            const img = e.currentTarget;
                                            if (canvasRef.current) {
                                                const ctx = canvasRef.current.getContext('2d');
                                                if (ctx) {
                                                    // Default: Center crop logic or simple draw
                                                    const size = Math.min(img.naturalWidth, img.naturalHeight);
                                                    ctx.drawImage(
                                                        img, 
                                                        (img.naturalWidth - size) / 2, (img.naturalHeight - size) / 2, size, size,
                                                        0, 0, 300, 300
                                                    );
                                                }
                                            }
                                        }}
                                    />
                                    {/* Virtual Preview of the result */}
                                    <div className="absolute top-4 right-4 flex flex-col items-center gap-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vista Previa</p>
                                        <canvas ref={canvasRef} width={300} height={300} className="w-24 h-24 rounded-full border-2 border-primary shadow-lg bg-white" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setSourceImage(null)}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Nueva Imagen
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedCandidate(null)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={!sourceImage || isSaving}>
                            <Save className="mr-2 h-4 w-4" /> {isSaving ? "Guardando..." : "Guardar Foto"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

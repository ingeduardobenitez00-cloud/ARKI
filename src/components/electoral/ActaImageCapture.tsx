import React, { useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Image as ImageIcon, Trash2, CheckCircle2, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ActaImageCaptureProps {
    onImageCaptured: (file: File | null) => void;
    onOcrParsed?: (text: string) => void;
}

export function ActaImageCapture({ onImageCaptured, onOcrParsed }: ActaImageCaptureProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
            onImageCaptured(file);
        }
    };

    const handleRetake = () => {
        setPreviewUrl(null);
        onImageCaptured(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRunOcr = async () => {
        if (!previewUrl || !onOcrParsed) return;
        setIsOcrProcessing(true);
        setOcrProgress(0);
        try {
            const { data: { text } } = await Tesseract.recognize(
                previewUrl,
                'spa',
                { logger: m => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                    }
                }}
            );
            console.log("Resultados Crudos OCR:\n", text);
            onOcrParsed(text);
        } catch (error) {
            console.error("Error ejecutando OCR", error);
        } finally {
            setIsOcrProcessing(false);
        }
    };

    return (
        <Card className="w-full bg-slate-50 border-dashed border-2">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-4">
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                />

                {!previewUrl ? (
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                            <ImageIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800">Fotografía Obligatoria del Acta</h4>
                            <p className="text-xs text-slate-500 max-w-[250px] mx-auto mt-1">
                                Toma una foto o sube una imagen de la galería.
                            </p>
                        </div>
                        <Button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-blue-700 hover:bg-blue-800 font-bold w-full max-w-sm"
                        >
                            <Camera className="w-4 h-4 mr-2" />
                            Cámara / Galería
                        </Button>
                    </div>
                ) : (
                    <div className="w-full flex flex-col items-center space-y-3">
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-bold w-full justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                            Acta Capturada Correctamente
                        </div>
                        <div className="relative w-full max-w-sm aspect-[3/4] rounded-lg overflow-hidden border-2 border-green-200 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src={previewUrl} 
                                alt="Vista previa del acta" 
                                className="w-full h-full object-cover"
                            />
                            {isOcrProcessing && (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <span className="font-bold">Analizando Imagen...</span>
                                    <span className="text-sm">{ocrProgress}% completado</span>
                                </div>
                            )}
                        </div>
                        {onOcrParsed && (
                            <Button 
                                type="button"
                                onClick={handleRunOcr}
                                disabled={isOcrProcessing}
                                className="bg-purple-600 hover:bg-purple-700 font-bold w-full max-w-sm"
                            >
                                <Wand2 className="w-4 h-4 mr-2" />
                                Extraer Datos Automáticamente
                            </Button>
                        )}
                        <Button 
                            type="button"
                            variant="outline"
                            onClick={handleRetake}
                            disabled={isOcrProcessing}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold w-full max-w-sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Volver a tomar foto
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

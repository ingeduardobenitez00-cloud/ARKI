import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ActaImageCaptureProps {
    onImageCaptured: (file: File | null) => void;
}

export function ActaImageCapture({ onImageCaptured }: ActaImageCaptureProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

    return (
        <Card className="w-full bg-slate-50 border-dashed border-2">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-4">
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                />

                {!previewUrl ? (
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                            <Camera className="w-8 h-8" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800">Fotografía Obligatoria del Acta</h4>
                            <p className="text-xs text-slate-500 max-w-[250px] mx-auto mt-1">
                                Toma una foto clara y enfocada del acta para auditoría.
                            </p>
                        </div>
                        <Button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-blue-700 hover:bg-blue-800 font-bold"
                        >
                            <Camera className="w-4 h-4 mr-2" />
                            Abrir Cámara
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
                        </div>
                        <Button 
                            type="button"
                            variant="outline"
                            onClick={handleRetake}
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

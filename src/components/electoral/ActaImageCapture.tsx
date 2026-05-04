import React, { useRef, useState } from 'react';
import Tesseract, { createWorker } from 'tesseract.js';
import { Camera, Image as ImageIcon, Trash2, CheckCircle2, Wand2, Loader2, AlertTriangle, QrCode, X } from 'lucide-react';
import * as fflate from 'fflate';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// Eliminamos el import estático para evitar error de SSR
// import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface ActaImageCaptureProps {
    onImageCaptured: (file: File | null) => void;
    onOcrParsed: (text: string) => void;
    onAiParsed?: (data: any) => void;
    onQrParsed: (data: number[], rawHex: string) => void;
    depto?: string;
    cargo?: string;
    listas?: any;
}

export function ActaImageCapture({ onImageCaptured, onOcrParsed, onAiParsed, onQrParsed, depto, cargo, listas }: ActaImageCaptureProps) {
    const { toast } = useToast();
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const qrScannerRef = useRef<any>(null);
    
    // Crop states
    const [isCropMode, setIsCropMode] = useState(false);
    const [cropArea, setCropArea] = useState({ x: 10, y: 30, w: 80, h: 40 }); // en porcentajes

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
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
    };

    const handleStartQrScanner = async () => {
        setIsQrScannerOpen(true);
        
        // Importación dinámica de la clase base Html5Qrcode
        const { Html5Qrcode } = await import('html5-qrcode');
        
        setTimeout(() => {
            const qrElement = document.getElementById('qr-reader');
            if (qrElement && !qrScannerRef.current) {
                const scanner = new Html5Qrcode('qr-reader');
                qrScannerRef.current = scanner;

                scanner.start(
                    { facingMode: "environment" }, 
                    { fps: 20, qrbox: { width: 280, height: 280 } },
                    (result) => {
                        console.log("QR Scanned:", result);
                        decodeAndProcessQr(result);
                        stopQrScanner();
                    },
                    (err) => { /* Silenciar errores de escaneo */ }
                ).catch(err => {
                    console.error("Error al iniciar cámara:", err);
                    toast({
                        title: "Error de Cámara",
                        description: "No se pudo acceder a la cámara trasera. Asegúrate de dar permisos.",
                        variant: "destructive"
                    });
                });
            }
        }, 500);
    };

    const stopQrScanner = async () => {
        if (qrScannerRef.current) {
            try {
                await qrScannerRef.current.stop();
            } catch (e) {
                console.error("Error al detener cámara:", e);
            }
            qrScannerRef.current = null;
        }
        setIsQrScannerOpen(false);
    };

    const decodeAndProcessQr = (hex: string) => {
        console.log("--- PROCESANDO QR ARKI ---");
        try {
            const cleanHex = hex.trim().replace(/\s/g, '').replace(/[^0-9A-Fa-f]/g, '');
            const hexMatch = cleanHex.match(/.{1,2}/g);
            if (!hexMatch) throw new Error("Error en HEX.");
            const bytes = new Uint8Array(hexMatch.map(byte => parseInt(byte, 16)));
            
            let finalData: number[] = [];

            try {
                let zlibStart = -1;
                for (let i = 0; i < bytes.length - 1; i++) {
                    if (bytes[i] === 0x78 && (bytes[i+1] === 0x9C || bytes[i+1] === 0x01)) {
                        zlibStart = i; break;
                    }
                }
                if (zlibStart !== -1) {
                    const decompressed = fflate.unzlibSync(bytes.slice(zlibStart));
                    finalData = Array.from(decompressed);
                } else { throw new Error("No Zlib"); }
            } catch (e) {
                finalData = Array.from(bytes);
            }

            if (onQrParsed) {
                onQrParsed(finalData, cleanHex);
                stopQrScanner(); 
                toast({ title: "¡QR Decifrado!", className: "bg-green-600 text-white" });
            }
        } catch (e: any) {
            console.error("Error QR:", e);
            toast({ title: "Error de Lectura", variant: "destructive" });
        }
    };

    const handleRunAi = async () => {
        if (!previewUrl || !onAiParsed) return;
        setIsAiProcessing(true);
        
        try {
            let finalImage = previewUrl;

            // Si estamos en modo recorte, generamos el recorte usando un Canvas
            if (isCropMode) {
                const img = new Image();
                img.src = previewUrl;
                await new Promise(resolve => img.onload = resolve);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const sx = (cropArea.x / 100) * img.width;
                    const sy = (cropArea.y / 100) * img.height;
                    const sw = (cropArea.w / 100) * img.width;
                    const sh = (cropArea.h / 100) * img.height;
                    
                    canvas.width = sw;
                    canvas.height = sh;
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                    finalImage = canvas.toDataURL('image/jpeg', 0.9);
                }
            }

            const response = await fetch('/api/ia-vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: finalImage,
                    depto: depto || 'CAPITAL',
                    cargo: cargo || 'INTENDENTE',
                    listas: listas || []
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            onAiParsed(data);
            toast({
                title: "IA: Análisis Completado",
                description: `Datos extraídos con ${Math.round(data.confianza * 100)}% de confianza.`,
                className: "bg-blue-600 text-white border-none",
            });
        } catch (error: any) {
            toast({
                title: "Error en IA",
                description: error.message || "No se pudo procesar con IA.",
                variant: "destructive",
            });
        } finally {
            setIsAiProcessing(false);
            setIsCropMode(false);
        }
    };

    return (
        <Card className="w-full bg-slate-50 border-dashed border-2">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-4">
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    ref={cameraInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                />
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={galleryInputRef}
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
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mt-2">
                            <Button 
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                className="bg-blue-700 hover:bg-blue-800 font-bold flex-1"
                            >
                                <Camera className="w-4 h-4 mr-2" />
                                Cámara
                            </Button>
                            <Button 
                                type="button"
                                variant="outline"
                                onClick={() => galleryInputRef.current?.click()}
                                className="border-blue-700 text-blue-700 hover:bg-blue-50 font-bold flex-1"
                            >
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Galerías
                            </Button>
                            <Button 
                                type="button"
                                onClick={handleStartQrScanner}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold flex-1"
                            >
                                <QrCode className="w-4 h-4 mr-2" />
                                Escáner QR
                            </Button>
                        </div>

                        {/* Recomendaciones para el usuario */}
                        <div className="w-full max-w-sm mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                            <h5 className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1 mb-1">
                                <AlertTriangle className="w-3 h-3" />
                                Tips para el "Botón Mágico"
                            </h5>
                            <ul className="text-[10px] text-amber-700 space-y-1 list-disc pl-3 leading-tight">
                                <li><b>Evita sombras:</b> Asegúrate que tu cuerpo o celular no tapen la luz.</li>
                                <li><b>Foto Plana:</b> Toma la foto totalmente desde arriba (no inclinada).</li>
                                <li><b>Sin Arrugas:</b> Estira bien el acta sobre la mesa.</li>
                                <li><b>Foco:</b> Si los números se ven borrosos, la IA no podrá leerlos.</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex flex-col items-center space-y-3">
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-bold w-full justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                            Acta Capturada Correctamente
                        </div>
                        <div className="relative w-full max-w-sm aspect-[3/4] rounded-lg overflow-hidden border-2 border-green-200 shadow-sm bg-black">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src={previewUrl} 
                                alt="Vista previa del acta" 
                                className={`w-full h-full object-contain ${isCropMode ? 'opacity-50' : ''}`}
                            />
                            
                            {/* OVERLAY DE RECORTE */}
                            {isCropMode && (
                                <div 
                                    className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move"
                                    style={{
                                        left: `${cropArea.x}%`,
                                        top: `${cropArea.y}%`,
                                        width: `${cropArea.w}%`,
                                        height: `${cropArea.h}%`
                                    }}
                                >
                                    <div className="absolute -top-6 left-0 bg-yellow-400 text-black text-[9px] font-black px-2 py-0.5 rounded-t">
                                        ÁREA DE ESCANEO (ARRASTRAR)
                                    </div>
                                    {/* Controles de tamaño simples */}
                                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white" />
                                </div>
                            )}

                            {isAiProcessing && (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 z-50">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <span className="font-bold">Analizando con IA...</span>
                                    <span className="text-sm">Por favor espera</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 w-full max-w-sm">
                            <Button 
                                type="button"
                                variant={isCropMode ? "secondary" : "outline"}
                                onClick={() => setIsCropMode(!isCropMode)}
                                disabled={isAiProcessing}
                                className={`flex-1 font-bold ${isCropMode ? 'bg-yellow-400 hover:bg-yellow-500 text-black border-none' : 'border-blue-600 text-blue-600'}`}
                            >
                                <Wand2 className="w-4 h-4 mr-2" />
                                {isCropMode ? "Listo" : "Enfocar Números"}
                            </Button>
                            
                            <Button 
                                type="button"
                                variant="outline"
                                onClick={handleRetake}
                                disabled={isAiProcessing}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold px-3"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>

                        {onAiParsed && (
                            <Button 
                                type="button"
                                onClick={handleRunAi}
                                disabled={isAiProcessing}
                                className="bg-blue-600 hover:bg-blue-800 font-black w-full max-w-sm shadow-lg border-2 border-white/20 h-12"
                            >
                                {isAiProcessing ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Wand2 className="w-4 h-4 mr-2" />
                                )}
                                {isCropMode ? "ESCANEAR ÁREA SELECCIONADA" : "ESCANEO INTELIGENTE (IA)"}
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Modal de Escáner QR */}
            <Dialog open={isQrScannerOpen} onOpenChange={setIsQrScannerOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <QrCode className="w-5 h-5" />
                            Escáner de Acta (QR MSA)
                        </DialogTitle>
                    </DialogHeader>
                    <div id="qr-reader" className="overflow-hidden rounded-lg border bg-black min-h-[250px]"></div>
                    <div className="flex flex-col gap-2">
                        <p className="text-[10px] text-center text-muted-foreground italic">
                            Apunta al código QR en la parte inferior del acta.
                        </p>
                        <Button variant="outline" onClick={stopQrScanner} className="w-full">
                            Cancelar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

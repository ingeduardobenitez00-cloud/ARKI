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
    onQrParsed: (data: number[], rawHex: string) => void;
}

export function ActaImageCapture({ onImageCaptured, onOcrParsed, onQrParsed }: ActaImageCaptureProps) {
    const { toast } = useToast();
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const qrScannerRef = useRef<any>(null);

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
                    { fps: 10, qrbox: { width: 250, height: 250 } },
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
        console.log("--- INICIANDO DECIFRADO QR ---");
        console.log("Contenido crudo escaneado:", hex);
        
        try {
            // 1. Limpieza extrema del HEX
            const cleanHex = hex.trim().replace(/\s/g, '').replace(/[^0-9A-Fa-f]/g, '');
            console.log("HEX limpio para procesar:", cleanHex);

            if (cleanHex.length < 32) {
                throw new Error(`Contenido demasiado corto (${cleanHex.length} caracteres). ¿Es un acta MSA?`);
            }
            
            // 2. Convertir Hex a Array de Bytes
            const hexMatch = cleanHex.match(/.{1,2}/g);
            if (!hexMatch) throw new Error("No se pudo parsear el HEX a bytes.");
            
            const bytes = new Uint8Array(hexMatch.map(byte => parseInt(byte, 16)));
            console.log("Total bytes extraídos:", bytes.length);

            // 3. Búsqueda Inteligente del inicio de Zlib (0x78 0x9C)
            let startIndex = -1;
            for (let i = 0; i < bytes.length - 1; i++) {
                if (bytes[i] === 0x78 && (bytes[i + 1] === 0x9C || bytes[i + 1] === 0x01 || bytes[i + 1] === 0xDA)) {
                    startIndex = i;
                    break;
                }
            }

            if (startIndex === -1) {
                // Fallback al offset de 15 si no se encuentra el marcador
                startIndex = 15;
                console.warn("No se encontró marcador Zlib, usando offset por defecto 15");
            } else {
                console.log(`Marcador Zlib encontrado en posición: ${startIndex}`);
            }

            const compressedData = bytes.slice(startIndex);
            console.log("Primeros bytes de data a descomprimir:", 
                Array.from(compressedData.slice(0, 5)).map(b => b.toString(16)).join(' ')
            );

            // 4. Descomprimir usando Zlib
            const decompressed = fflate.unzlibSync(compressedData);
            const dataArray = Array.from(decompressed);
            console.log("BUFFER BRUTO DESCOMPRIMIDO:", dataArray);

            // REGLA 1: Sincronización de Inicio (DATA_OFFSET)
            // Reseteado a 0 para recalibración manual
            const DATA_OFFSET = 0; 
            const payloadOnly = dataArray.slice(DATA_OFFSET);

            if (onQrParsed) {
                // REGLA DE PRECISIÓN 5: Enviamos también el HEX original para auditoría
                onQrParsed(payloadOnly, cleanHex); 
                
                toast({
                    title: "¡QR Decifrado con Éxito!",
                    description: `Bloque de votos extraído tras offset ${DATA_OFFSET}.`,
                    className: "bg-green-600 text-white border-none shadow-lg",
                });
            }
        } catch (e: any) {
            console.error("ERROR CRÍTICO EN DECIFRADO QR:", e);
            toast({
                title: "Error de Decifrado",
                description: e.message || "El formato del QR no coincide con el protocolo MSA.",
                variant: "destructive",
            });
        }
    };

    const handleRunOcr = async () => {
        if (!previewUrl || !onOcrParsed) return;
        setIsOcrProcessing(true);
        setOcrProgress(0);
        
        let worker: any = null;
        try {
            // --- PRE-PROCESAMIENTO DE IMAGEN ---
            // Creamos un canvas para mejorar el contraste y convertir a escala de grises
            const img = new Image();
            img.src = previewUrl;
            await new Promise((resolve) => (img.onload = resolve));

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;

            if (ctx) {
                // Aplicar filtros de imagen para OCR
                ctx.filter = 'grayscale(1) contrast(2) brightness(1.1)';
                ctx.drawImage(img, 0, 0);
            }
            const processedImageData = canvas.toDataURL('image/jpeg', 0.9);

            console.log("Iniciando Worker de Tesseract (Optimizado)...");
            worker = await createWorker('spa', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                    }
                }
            });

            // Configurar parámetros para mejorar precisión numérica
            await worker.setParameters({
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ. ', // Solo números y letras mayúsculas
                tessjs_create_hocr: '0',
                tessjs_create_tsv: '0',
            });

            console.log("Iniciando Reconocimiento con Filtros...");
            const { data: { text } } = await worker.recognize(processedImageData);
            
            if (!text || text.trim().length === 0) {
                throw new Error("No se pudo extraer texto de la imagen");
            }

            console.log("Resultados Crudos OCR:\n", text);
            onOcrParsed(text);
            
            toast({
                title: "OCR Completado",
                description: "Datos extraídos. Revisa el resumen en pantalla para confirmar.",
                className: "bg-purple-600 text-white border-none",
            });

            await worker.terminate();
        } catch (error: any) {
            console.error("Error detallado OCR:", error);
            toast({
                title: "Error en OCR",
                description: `Error: ${error.message || "Desconocido"}. Revisa la conexión o intenta de nuevo.`,
                variant: "destructive",
            });
            if (worker) {
                try { await worker.terminate(); } catch(e) {}
            }
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

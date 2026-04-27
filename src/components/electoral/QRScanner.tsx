import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, AlertCircle } from 'lucide-react';

interface QRScannerProps {
    onResult: (result: string) => void;
    onError?: (error: string) => void;
}

export function QRScanner({ onResult, onError }: QRScannerProps) {
    const [isStarted, setIsStarted] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    const startScanner = async () => {
        try {
            setCameraError(null);
            const html5QrCode = new Html5Qrcode("qr-reader-internal");
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    onResult(decodedText);
                },
                (errorMessage) => {
                    // Constant scanning errors are ignored by default
                }
            );
            setIsStarted(true);
        } catch (err) {
            console.error("Error al iniciar cámara:", err);
            setCameraError("No se pudo acceder a la cámara. Verifica los permisos.");
            if (onError) onError(String(err));
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current && isStarted) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
                setIsStarted(false);
            } catch (err) {
                console.error("Error al detener cámara:", err);
            }
        }
    };

    useEffect(() => {
        // Auto-start on mount if possible
        startScanner();
        return () => {
            stopScanner();
        };
    }, []);

    return (
        <div className="w-full max-w-md mx-auto overflow-hidden rounded-2xl border-2 border-primary/20 bg-background shadow-2xl">
            <div className="relative aspect-square bg-slate-900 flex flex-col items-center justify-center">
                <div id="qr-reader-internal" className="w-full h-full"></div>
                
                {!isStarted && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900/80 text-white">
                        <Camera className="w-12 h-12 mb-4 animate-pulse" />
                        <p className="text-sm font-medium mb-4">Solicitando acceso a la cámara...</p>
                        <Button onClick={startScanner} variant="secondary">Habilitar Cámara</Button>
                    </div>
                )}

                {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-red-900/90 text-white">
                        <AlertCircle className="w-12 h-12 mb-4" />
                        <p className="text-sm font-bold mb-4">{cameraError}</p>
                        <Button onClick={startScanner} variant="outline" className="text-white border-white hover:bg-white/10">Reintentar</Button>
                    </div>
                )}

                {/* Scanning Frame Overlay */}
                {isStarted && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-64 h-64 border-2 border-primary rounded-lg border-dashed opacity-50"></div>
                        <div className="absolute top-4 left-4 right-4 flex justify-between">
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">ESCANEANDO...</span>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-4 text-center text-xs text-muted-foreground font-bold uppercase tracking-widest bg-muted/30 border-t">
                Apunta la cámara al código QR del acta
            </div>
        </div>
    );
}

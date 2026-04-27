import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerProps {
    onResult: (result: string) => void;
    onError?: (error: string) => void;
}

export function QRScanner({ onResult, onError }: QRScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );

        scanner.render(
            (decodedText) => {
                onResult(decodedText);
            },
            (errorMessage) => {
                if (onError) onError(errorMessage);
            }
        );

        scannerRef.current = scanner;

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
            }
        };
    }, [onResult, onError]);

    return (
        <div className="w-full max-w-md mx-auto overflow-hidden rounded-xl border-2 border-primary/20 bg-background shadow-lg">
            <div id="qr-reader" className="w-full"></div>
            <div className="p-4 text-center text-xs text-muted-foreground uppercase tracking-widest bg-muted/30">
                Apunta la cámara al código QR del acta
            </div>
        </div>
    );
}

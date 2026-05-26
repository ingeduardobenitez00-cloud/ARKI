"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, doc, writeBatch, deleteField, query, where, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    FileSpreadsheet, 
    UploadCloud, 
    CheckCircle2, 
    AlertTriangle, 
    RefreshCw, 
    Database, 
    Loader2, 
    Lock, 
    Smartphone, 
    Info, 
    ChevronRight, 
    Play, 
    FileText,
    History,
    XCircle,
    UserCircle,
    ShieldAlert
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { logAction } from '@/lib/audit';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

// Definición de las colecciones de Firebase
const COLLECTION_PADRON = 'sheet1';
const COLLECTION_CAPTURAS = 'votos_confirmados';

interface LogEntry {
    type: 'success' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: string;
}

export default function MigrarCelularesPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Seguridad de roles: Super-Admin, Admin, Presidente, Comunicaciones
    const isAuthorized = useMemo(() => {
        if (!user) return false;
        return ['Super-Admin', 'Admin', 'Presidente', 'Comunicaciones'].includes(user.role);
    }, [user]);

    // Estados del flujo del archivo
    const [file, setFile] = useState<File | null>(null);
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [mapping, setMapping] = useState({ cedula: '', telefono: '' });
    const [targetColumn, setTargetColumn] = useState<'TELEFONO_MIGRADO' | 'TELEFONO_MIGRADO_2'>('TELEFONO_MIGRADO_2');
    
    // Estados del procesamiento
    const [status, setStatus] = useState<'idle' | 'reading' | 'mapping' | 'migrating' | 'done' | 'error'>('idle');
    const [isDragging, setIsDragging] = useState(false);
    
    // Métricas del progreso
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [updatedPadronCount, setUpdatedPadronCount] = useState(0);
    const [updatedCapturasCount, setUpdatedCapturasCount] = useState(0);
    const [notFoundCount, setNotFoundCount] = useState(0);
    const [skippedCount, setSkippedCount] = useState(0);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll para la consola de logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (type: LogEntry['type'], message: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { type, message, timestamp: time }]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            validateAndProcessFile(droppedFile);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            validateAndProcessFile(selectedFile);
        }
    };

    const validateAndProcessFile = (selectedFile: File) => {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
        if (fileExt !== 'xlsx' && fileExt !== 'xls') {
            toast({
                title: "Formato no soportado",
                description: "Por favor carga un archivo Excel con extensión .xlsx o .xls",
                variant: "destructive"
            });
            return;
        }

        setFile(selectedFile);
        setStatus('reading');
        setLogs([]);
        addLog('info', `Leyendo archivo: ${selectedFile.name}...`);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const bstr = event.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });

                if (jsonData.length === 0) {
                    addLog('error', 'El archivo Excel está vacío.');
                    setStatus('error');
                    toast({
                        title: "Archivo vacío",
                        description: "El archivo cargado no contiene registros.",
                        variant: "destructive"
                    });
                    return;
                }

                addLog('success', `Lectura completada. Se detectaron ${jsonData.length} filas en la hoja "${firstSheetName}".`);
                
                // Extraer encabezados/columnas
                const detectedHeaders = Object.keys(jsonData[0] as object);
                setColumns(detectedHeaders);
                setSheetData(jsonData);

                // Auto-detección inteligente de mapeo de columnas
                const detectedCedula = detectedHeaders.find(h => {
                    const normalized = h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return ['CEDULA', 'CI', 'C.I.', 'C.I', 'DOCUMENTO', 'NRO_CEDULA', 'NRO CEDULA', 'CEDULA IDENTIDAD'].includes(normalized);
                }) || "";

                const detectedTelefono = detectedHeaders.find(h => {
                    const normalized = h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return ['TELEFONO', 'CELULAR', 'TELEFONOS', 'CELULARES', 'MOVIL', 'MÓVIL', 'WHATSAPP'].includes(normalized);
                }) || "";

                setMapping({
                    cedula: detectedCedula,
                    telefono: detectedTelefono
                });

                if (detectedCedula && detectedTelefono) {
                    addLog('info', `Columnas mapeadas automáticamente: Cédula ➔ "${detectedCedula}", Teléfono ➔ "${detectedTelefono}"`);
                } else {
                    addLog('warn', 'No se pudieron detectar automáticamente las columnas de Cédula o Teléfono. Por favor, asígnalas manualmente.');
                }

                setStatus('mapping');
            } catch (err) {
                console.error(err);
                addLog('error', 'Error al procesar la estructura del Excel.');
                setStatus('error');
                toast({
                    title: "Error de lectura",
                    description: "Hubo un error al interpretar el archivo de Excel.",
                    variant: "destructive"
                });
            }
        };

        reader.onerror = () => {
            addLog('error', 'Error al leer el archivo físico.');
            setStatus('error');
        };

        reader.readAsBinaryString(selectedFile);
    };

    // Previsualización de los primeros 5 registros según el mapeo actual
    const previewData = useMemo(() => {
        if (sheetData.length === 0 || !mapping.cedula || !mapping.telefono) return [];
        return sheetData.slice(0, 5).map(row => ({
            cedulaRaw: row[mapping.cedula] || 'N/A',
            telefonoRaw: row[mapping.telefono] || 'N/A',
        }));
    }, [sheetData, mapping]);

    const resetProcess = () => {
        setFile(null);
        setSheetData([]);
        setColumns([]);
        setMapping({ cedula: '', telefono: '' });
        setStatus('idle');
        setProgress(0);
        setProcessedCount(0);
        setUpdatedPadronCount(0);
        setUpdatedCapturasCount(0);
        setNotFoundCount(0);
        setSkippedCount(0);
        setLogs([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const runMigration = async () => {
        if (!db || !user || sheetData.length === 0) return;
        if (!mapping.cedula || !mapping.telefono) {
            toast({
                title: "Asignación incompleta",
                description: "Debes elegir qué columnas corresponden a Cédula y Teléfono.",
                variant: "destructive"
            });
            return;
        }

        setStatus('migrating');
        setLogs([]);
        setProgress(0);
        setProcessedCount(0);
        setUpdatedPadronCount(0);
        setUpdatedCapturasCount(0);
        setNotFoundCount(0);
        setSkippedCount(0);

        addLog('info', '🚀 Iniciando migración masiva...');
        addLog('info', '📥 Descargando identificadores activos de Votos Seguros para sincronización doble...');

        let activeCapturasSet = new Set<string>();
        try {
            const capturasSnapshot = await getDocs(collection(db, COLLECTION_CAPTURAS));
            capturasSnapshot.forEach(docSnap => {
                activeCapturasSet.add(docSnap.id);
            });
            addLog('success', `Se cargaron ${activeCapturasSet.size} registros existentes en Votos Seguros.`);
        } catch (err) {
            addLog('warn', '⚠️ No se pudieron pre-cargar los Votos Seguros. Se continuará con la actualización del padrón principal.');
        }

        addLog('info', '⚡ Procesando registros en lotes de 500 para máximo rendimiento...');

        const totalRecords = sheetData.length;
        let localUpdatedPadron = 0;
        let localUpdatedCapturas = 0;
        let localNotFound = 0;
        let localSkipped = 0;

        // Procesamiento en lotes para consultas Firestore
        let currentBatch = writeBatch(db);
        let currentBatchSize = 0;
        const queryBatchSize = 30;

        for (let i = 0; i < totalRecords; i += queryBatchSize) {
            const chunk = sheetData.slice(i, i + queryBatchSize);
            
            const chunkMap: Record<string, { telClean: string, row: any }> = {};
            const cedulasNumericas: number[] = [];
            const cedulasStrings: string[] = [];

            chunk.forEach(row => {
                const rawCed = row[mapping.cedula];
                if (rawCed === undefined || rawCed === null || String(rawCed).trim() === '') {
                    localSkipped++;
                    return;
                }
                
                const cedulaStr = String(rawCed).replace(/\D/g, '');
                if (cedulaStr === '') {
                    localSkipped++;
                    return;
                }

                let telRaw = row[mapping.telefono] !== undefined && row[mapping.telefono] !== null ? String(row[mapping.telefono]).replace(/\D/g, '') : '';
                if (telRaw.toLowerCase() === 'null' || telRaw.toLowerCase() === 'undefined') telRaw = '';

                let telClean = '';
                if (telRaw !== '') {
                    if (telRaw.length >= 9) {
                        telClean = '595' + telRaw.slice(-9);
                    } else {
                        telClean = '595' + telRaw.replace(/^0+/, '');
                    }
                }

                if (telClean === '595' || telClean === '') {
                    localSkipped++;
                    return;
                }

                chunkMap[cedulaStr] = { telClean, row };
                cedulasNumericas.push(Number(cedulaStr));
                cedulasStrings.push(cedulaStr);
            });

            if (Object.keys(chunkMap).length === 0) {
                const processed = Math.min(i + queryBatchSize, totalRecords);
                const percent = Math.round((processed / totalRecords) * 100);
                setProgress(percent);
                setProcessedCount(processed);
                setSkippedCount(localSkipped);
                continue;
            }

            const fetchedDocs: Record<string, string> = {};

            try {
                if (cedulasNumericas.length > 0) {
                    const uniqueNum = Array.from(new Set(cedulasNumericas)).filter(n => !isNaN(n));
                    if (uniqueNum.length > 0) {
                        const qNum = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', uniqueNum));
                        const snapNum = await getDocs(qNum);
                        snapNum.forEach(docSnap => {
                            const ced = String(docSnap.data().CEDULA).replace(/\D/g, '');
                            fetchedDocs[ced] = docSnap.id;
                        });
                    }
                }

                const remaining = Array.from(new Set(cedulasStrings)).filter(c => !fetchedDocs[c]);
                if (remaining.length > 0) {
                    const qStr = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', remaining));
                    const snapStr = await getDocs(qStr);
                    snapStr.forEach(docSnap => {
                        const ced = String(docSnap.data().CEDULA).replace(/\D/g, '');
                        fetchedDocs[ced] = docSnap.id;
                    });
                }
            } catch (err) {
                console.error("Error querying chunk", err);
            }

            for (const cedulaStr of Object.keys(chunkMap)) {
                const { telClean } = chunkMap[cedulaStr];
                const docId = fetchedDocs[cedulaStr];

                if (!docId) {
                    localSkipped++;
                    continue;
                }

                const padronRef = doc(db, COLLECTION_PADRON, docId);
                const updateObj: any = {
                    [targetColumn]: telClean,
                    telefonoUpdatedBy_id: user.id,
                    telefonoUpdatedBy_nombre: user.name,
                    telefonoUpdatedAt: new Date().toISOString()
                };

                currentBatch.set(padronRef, updateObj, { merge: true });
                currentBatchSize++;
                localUpdatedPadron++;

                if (activeCapturasSet.has(docId)) {
                    const capturasRef = doc(db, COLLECTION_CAPTURAS, docId);
                    currentBatch.set(capturasRef, {
                        [targetColumn]: telClean,
                        updatedAt: new Date().toISOString(),
                        updatedBy_id: user.id,
                        updatedBy_nombre: user.name
                    }, { merge: true });
                    currentBatchSize++;
                    localUpdatedCapturas++;
                }

                if (currentBatchSize >= 450) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    currentBatchSize = 0;
                }
            }

            const processed = Math.min(i + queryBatchSize, totalRecords);
            const percent = Math.round((processed / totalRecords) * 100);
            
            setProgress(percent);
            setProcessedCount(processed);
            setUpdatedPadronCount(localUpdatedPadron);
            setUpdatedCapturasCount(localUpdatedCapturas);
            setSkippedCount(localSkipped);
            
            if (processed % 300 === 0 || processed === totalRecords) {
                addLog('info', `Progreso: ${processed}/${totalRecords} procesados...`);
            }
        }

        if (currentBatchSize > 0) {
            try {
                await currentBatch.commit();
            } catch (e) {
                console.error(e);
            }
        }

        // Registro de Auditoría Final
        try {
            await logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'MIGRACION EXCEL CELULARES',
                action: 'MIGRÓ CELULARES MASIVAMENTE',
                targetName: `Archivo: ${file?.name} - Sincronizados: ${localUpdatedPadron} en Padrón y ${localUpdatedCapturas} en Votos Seguros`
            });
        } catch (auditErr) {
            console.warn("Fallo al registrar auditoría:", auditErr);
        }

        // Forzar actualización final de la interfaz
        setProgress(100);
        setProcessedCount(totalRecords);
        setUpdatedPadronCount(localUpdatedPadron);
        setUpdatedCapturasCount(localUpdatedCapturas);
        setSkippedCount(localSkipped);

        setStatus('done');
        addLog('success', '🎉 ¡Migración finalizada con éxito!');
        addLog('success', `------------------------------------------------`);
        addLog('success', `✅ Total Procesados del Archivo: ${totalRecords}`);
        addLog('success', `📲 Celulares actualizados en Padrón (sheet1): ${localUpdatedPadron}`);
        addLog('success', `🎯 Sincronizados en Votos Seguros (capturas): ${localUpdatedCapturas}`);
        addLog('success', `⚠️ Omitidos (Cédula o Teléfono vacíos): ${localSkipped}`);
        addLog('success', `------------------------------------------------`);

        toast({
            title: "Migración Exitosa",
            description: `Se han actualizado ${localUpdatedPadron} números de celular de forma masiva.`,
        });
    };

    const runReversion = async () => {
        if (!db || !user || sheetData.length === 0) return;
        if (!mapping.cedula || !mapping.telefono) {
            toast({
                title: "Asignación incompleta",
                description: "Debes elegir qué columnas corresponden a Cédula y Teléfono.",
                variant: "destructive"
            });
            return;
        }

        setStatus('migrating');
        setLogs([]);
        setProgress(0);
        setProcessedCount(0);
        setUpdatedPadronCount(0);
        setUpdatedCapturasCount(0);
        setNotFoundCount(0);
        setSkippedCount(0);

        addLog('info', '🔄 Iniciando reversión / deshacer de la migración actual...');
        addLog('info', '📥 Cargando identificadores activos de Votos Seguros...');

        let activeCapturasSet = new Set<string>();
        try {
            const capturasSnapshot = await getDocs(collection(db, COLLECTION_CAPTURAS));
            capturasSnapshot.forEach(docSnap => {
                activeCapturasSet.add(docSnap.id);
            });
            addLog('success', `Se cargaron ${activeCapturasSet.size} registros de Votos Seguros para reversión doble.`);
        } catch (err) {
            addLog('warn', '⚠️ No se pudieron pre-cargar los Votos Seguros. Se continuará con el borrado del padrón principal.');
        }

        addLog('info', '⚡ Procesando borrados en lotes de 500 para máximo rendimiento...');

        const totalRecords = sheetData.length;
        let localUpdatedPadron = 0;
        let localUpdatedCapturas = 0;
        let localSkipped = 0;

        let currentBatch = writeBatch(db);
        let currentBatchSize = 0;
        const queryBatchSize = 30;

        for (let i = 0; i < totalRecords; i += queryBatchSize) {
            const chunk = sheetData.slice(i, i + queryBatchSize);
            
            const chunkMap: Record<string, boolean> = {};
            const cedulasNumericas: number[] = [];
            const cedulasStrings: string[] = [];

            chunk.forEach(row => {
                const rawCed = row[mapping.cedula];
                if (rawCed === undefined || rawCed === null || String(rawCed).trim() === '') {
                    localSkipped++;
                    return;
                }
                
                const cedulaStr = String(rawCed).replace(/\D/g, '');
                if (cedulaStr === '') {
                    localSkipped++;
                    return;
                }

                chunkMap[cedulaStr] = true;
                cedulasNumericas.push(Number(cedulaStr));
                cedulasStrings.push(cedulaStr);
            });

            if (Object.keys(chunkMap).length === 0) {
                const processed = Math.min(i + queryBatchSize, totalRecords);
                const percent = Math.round((processed / totalRecords) * 100);
                setProgress(percent);
                setProcessedCount(processed);
                setSkippedCount(localSkipped);
                continue;
            }

            const fetchedDocs: Record<string, string> = {};

            try {
                if (cedulasNumericas.length > 0) {
                    const uniqueNum = Array.from(new Set(cedulasNumericas)).filter(n => !isNaN(n));
                    if (uniqueNum.length > 0) {
                        const qNum = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', uniqueNum));
                        const snapNum = await getDocs(qNum);
                        snapNum.forEach(docSnap => {
                            const ced = String(docSnap.data().CEDULA).replace(/\D/g, '');
                            fetchedDocs[ced] = docSnap.id;
                        });
                    }
                }

                const remaining = Array.from(new Set(cedulasStrings)).filter(c => !fetchedDocs[c]);
                if (remaining.length > 0) {
                    const qStr = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', remaining));
                    const snapStr = await getDocs(qStr);
                    snapStr.forEach(docSnap => {
                        const ced = String(docSnap.data().CEDULA).replace(/\D/g, '');
                        fetchedDocs[ced] = docSnap.id;
                    });
                }
            } catch (err) {
                console.error("Error querying chunk", err);
            }

            for (const cedulaStr of Object.keys(chunkMap)) {
                const docId = fetchedDocs[cedulaStr];

                if (!docId) {
                    localSkipped++;
                    continue;
                }

                const padronRef = doc(db, COLLECTION_PADRON, docId);
                currentBatch.set(padronRef, {
                    [targetColumn]: deleteField()
                }, { merge: true });
                currentBatchSize++;
                localUpdatedPadron++;

                if (activeCapturasSet.has(docId)) {
                    const capturasRef = doc(db, COLLECTION_CAPTURAS, docId);
                    currentBatch.set(capturasRef, {
                        [targetColumn]: deleteField()
                    }, { merge: true });
                    currentBatchSize++;
                    localUpdatedCapturas++;
                }

                if (currentBatchSize >= 450) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    currentBatchSize = 0;
                }
            }

            const processed = Math.min(i + queryBatchSize, totalRecords);
            const percent = Math.round((processed / totalRecords) * 100);
            
            setProgress(percent);
            setProcessedCount(processed);
            setUpdatedPadronCount(localUpdatedPadron);
            setUpdatedCapturasCount(localUpdatedCapturas);
            setSkippedCount(localSkipped);
            
            if (processed % 300 === 0 || processed === totalRecords) {
                addLog('info', `Progreso: ${processed}/${totalRecords} revertidos...`);
            }
        }

        if (currentBatchSize > 0) {
            try {
                await currentBatch.commit();
            } catch (e) {
                console.error(e);
            }
        }

        // Registro de Auditoría Final
        try {
            await logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'REVERSION MIGRACION EXCEL',
                action: 'REVERTIÓ CELULARES MASIVAMENTE',
                targetName: `Archivo: ${file?.name} - Removidos: ${localUpdatedPadron} en Padrón y ${localUpdatedCapturas} en Votos Seguros`
            });
        } catch (auditErr) {
            console.warn("Fallo al registrar auditoría:", auditErr);
        }

        // Forzar actualización final de la interfaz
        setProgress(100);
        setProcessedCount(totalRecords);
        setUpdatedPadronCount(localUpdatedPadron);
        setUpdatedCapturasCount(localUpdatedCapturas);
        setSkippedCount(localSkipped);

        setStatus('done');
        addLog('success', '🔄 ¡Reversión finalizada con éxito!');
        addLog('success', `------------------------------------------------`);
        addLog('success', `✅ Total Procesados del Archivo: ${totalRecords}`);
        addLog('success', `📲 Teléfonos borrados en Padrón (sheet1): ${localUpdatedPadron}`);
        addLog('success', `🎯 Teléfonos borrados en Votos Seguros: ${localUpdatedCapturas}`);
        addLog('success', `⚠️ Omitidos (Cédula vacía): ${localSkipped}`);
        addLog('success', `------------------------------------------------`);

        toast({
            title: "Reversión Completada",
            description: `Se han removido con éxito todos los teléfonos importados por este Excel.`,
        });
    };

    // Renderizado en caso de acceso denegado
    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
                <Card className="w-full max-w-md border-red-200/50 shadow-2xl rounded-3xl overflow-hidden bg-white">
                    <div className="h-2 bg-red-600 w-full" />
                    <CardHeader className="text-center pt-8">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100">
                            <Lock className="h-8 w-8 stroke-[2.5]" />
                        </div>
                        <CardTitle className="text-xl font-black uppercase tracking-tight text-red-600 mt-4">Acceso Restringido</CardTitle>
                        <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400 mt-2">
                            Módulo de Administración Estratégica
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 text-center space-y-4">
                        <p className="text-slate-500 text-xs uppercase leading-relaxed font-semibold">
                            Lo sentimos, este módulo está reservado exclusivamente para los roles con permisos de administración avanzada:
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                            {['Super-Admin', 'Admin', 'Presidente', 'Comunicaciones'].map(role => (
                                <Badge key={role} variant="destructive" className="bg-red-50 text-red-700 border-red-100 font-black text-[9px] uppercase px-3 py-1">
                                    {role}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                        Migración Masiva de Celulares
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                        Sincroniza y actualiza miles de contactos electorales en segundos desde Excel.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-black border-primary/20 bg-primary/5 text-primary px-3 py-1 rounded-full uppercase">
                        Acceso: {user?.role}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel de Configuración y Carga */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm overflow-hidden rounded-3xl">
                        <CardHeader className="bg-muted/30 border-b py-4">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <UploadCloud className="h-4 w-4 text-primary" />
                                Paso 1: Carga tu Archivo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {status === 'idle' ? (
                                <div 
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        "border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px]",
                                        isDragging 
                                            ? "border-primary bg-primary/[0.03] scale-[0.98]" 
                                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                                    )}
                                >
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept=".xlsx,.xls"
                                        className="hidden" 
                                    />
                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/5 shadow-inner mb-4 animate-bounce">
                                        <UploadCloud className="h-6 w-6" />
                                    </div>
                                    <p className="font-black text-xs uppercase tracking-tight text-slate-800 text-center">
                                        Arrastra tu Excel aquí
                                    </p>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-2 text-center">
                                        o haz clic para buscar (.xlsx, .xls)
                                    </p>
                                </div>
                            ) : (
                                <div className="border rounded-2xl p-4 bg-slate-50 border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/5">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-black text-xs uppercase text-slate-850 truncate leading-none">{file?.name}</p>
                                            <p className="text-[8px] font-black tracking-widest uppercase text-slate-400 mt-1">
                                                {sheetData.length} Registros Cargados
                                            </p>
                                        </div>
                                    </div>
                                    {status !== 'migrating' && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={resetProcess}
                                            className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-full shrink-0"
                                        >
                                            <XCircle className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Paso 2: Mapeo de Columnas */}
                    {(status === 'mapping' || status === 'migrating' || status === 'done') && (
                        <Card className="border-primary/10 shadow-sm overflow-hidden rounded-3xl animate-in slide-in-from-bottom-2 duration-300">
                            <CardHeader className="bg-muted/30 border-b py-4">
                                <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                    <Database className="h-4 w-4 text-primary" />
                                    Paso 2: Mapear Columnas
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Columna Cédula de Identidad</label>
                                    <select 
                                        disabled={status === 'migrating'}
                                        value={mapping.cedula}
                                        onChange={(e) => setMapping(prev => ({ ...prev, cedula: e.target.value }))}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white font-bold text-xs uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="">-- Selecciona Columna --</option>
                                        {columns.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Columna Teléfono / Celular</label>
                                    <select 
                                        disabled={status === 'migrating'}
                                        value={mapping.telefono}
                                        onChange={(e) => setMapping(prev => ({ ...prev, telefono: e.target.value }))}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white font-bold text-xs uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="">-- Selecciona Columna --</option>
                                        {columns.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-primary">¿Dónde se guardarán estos números?</label>
                                    <select 
                                        disabled={status === 'migrating'}
                                        value={targetColumn}
                                        onChange={(e) => setTargetColumn(e.target.value as 'TELEFONO_MIGRADO' | 'TELEFONO_MIGRADO_2')}
                                        className="w-full h-11 px-3 rounded-xl border-2 border-primary/20 bg-primary/5 font-black text-xs uppercase text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="TELEFONO_MIGRADO">Teléfono Migrado 1 (Sobrescribir anteriores)</option>
                                        <option value="TELEFONO_MIGRADO_2">Teléfono Migrado 2 (Lista Nueva)</option>
                                    </select>
                                </div>

                                {mapping.cedula && mapping.telefono ? (
                                    <div className="p-3.5 bg-green-50 text-green-800 border border-green-100 rounded-2xl flex items-start gap-2.5 text-[10px] leading-snug">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                        <div className="font-semibold uppercase tracking-tight">
                                            Mapeo válido configurado correctamente. El sistema está listo para iniciar la actualización.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-2xl flex items-start gap-2.5 text-[10px] leading-snug">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="font-semibold uppercase tracking-tight">
                                            Debes mapear ambas columnas de tu Excel para habilitar el motor de migración.
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Monitor, Previsualización y Consola */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Tarjeta Principal de Control y Previsualización */}
                    <Card className="border-primary/10 shadow-lg overflow-hidden min-h-[400px] rounded-3xl flex flex-col">
                        <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" />
                                Paso 3: Consola e Inicio
                            </CardTitle>
                            {status === 'mapping' && mapping.cedula && mapping.telefono && (
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={runReversion} 
                                        variant="outline"
                                        className="border-red-200 text-red-700 hover:bg-red-50 font-black text-xs uppercase h-10 px-4 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
                                    >
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        Revertir este Excel
                                    </Button>
                                    <Button 
                                        onClick={runMigration} 
                                        className="bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase h-10 px-5 rounded-xl shadow-md flex items-center gap-2 transition-transform active:scale-95"
                                    >
                                        <Play className="h-3.5 w-3.5 fill-white/20" />
                                        Iniciar Migración
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="pt-6 flex-1 flex flex-col space-y-6">
                            {status === 'idle' && (
                                <div className="flex flex-col items-center justify-center h-[300px] border-2 border-dashed rounded-[2rem] bg-slate-50/50 opacity-30 text-center px-8">
                                    <FileSpreadsheet className="h-16 w-16 mb-4 text-slate-400" />
                                    <p className="font-black uppercase tracking-[0.15em] text-xs leading-normal">
                                        Espera de Archivo Excel<br/>
                                        <span className="text-[10px] text-muted-foreground font-bold tracking-normal mt-1 block">Sube un padrón o listado telefónico para comenzar el análisis automático.</span>
                                    </p>
                                </div>
                            )}

                            {status === 'reading' && (
                                <div className="flex flex-col items-center justify-center h-[300px] text-center px-8 space-y-4">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                    <p className="font-black uppercase tracking-[0.1em] text-xs text-slate-800 animate-pulse">
                                        Analizando estructura de datos...
                                    </p>
                                </div>
                            )}

                            {/* Previsualización del mapeo de datos */}
                            {(status === 'mapping' && previewData.length > 0) && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        <Info className="h-4 w-4 text-primary" />
                                        Muestra de Previsualización (Primeros 5 registros)
                                    </div>
                                    <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-inner bg-slate-50/30">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/40 text-[9px] font-black uppercase text-slate-500 border-b border-slate-100">
                                                    <th className="py-3 px-4">Cédula de Identidad</th>
                                                    <th className="py-3 px-4">Teléfono WhatsApp</th>
                                                    <th className="py-3 px-4 text-right">Estructura</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.map((row, idx) => (
                                                    <tr key={idx} className="border-b border-slate-100/50 hover:bg-white/50 text-xs font-bold text-slate-700">
                                                        <td className="py-3.5 px-4 font-mono text-slate-900">{row.cedulaRaw}</td>
                                                        <td className="py-3.5 px-4 text-green-700">{row.telefonoRaw}</td>
                                                        <td className="py-3.5 px-4 text-right">
                                                            <Badge variant="outline" className="text-[8px] bg-green-50/50 border-green-100 text-green-700 font-bold uppercase py-0.5 px-2">
                                                                VÁLIDA
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Barra de progreso y métricas durante la migración */}
                            {(status === 'migrating' || status === 'done') && (
                                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs font-black uppercase text-slate-800">
                                            <span className="flex items-center gap-2">
                                                {status === 'migrating' ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        Escribiendo en Base de Datos...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                        Proceso Completado
                                                    </>
                                                )}
                                            </span>
                                            <span className="text-primary">{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-3 rounded-full bg-slate-100 [&>div]:bg-primary" />
                                    </div>

                                    {/* Mallas de contadores */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="border bg-slate-50/30 rounded-2xl p-4 text-center space-y-1.5 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Procesados</p>
                                            <p className="text-2xl font-black text-slate-900 leading-none">{processedCount}</p>
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none">filas analizadas</p>
                                        </div>
                                        <div className="border border-green-100 bg-green-50/10 rounded-2xl p-4 text-center space-y-1.5 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-green-600 tracking-wider">Padrón</p>
                                            <p className="text-2xl font-black text-green-600 leading-none">{updatedPadronCount}</p>
                                            <p className="text-[8px] font-bold text-green-500 uppercase leading-none">teléfonos en columna aparte</p>
                                        </div>
                                        <div className="border border-primary/10 bg-primary/[0.01] rounded-2xl p-4 text-center space-y-1.5 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-primary tracking-wider">Votos Seguros</p>
                                            <p className="text-2xl font-black text-primary leading-none">{updatedCapturasCount}</p>
                                            <p className="text-[8px] font-bold text-primary/80 uppercase leading-none">teléfonos en columna aparte</p>
                                        </div>
                                        <div className="border bg-slate-50/30 rounded-2xl p-4 text-center space-y-1.5 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Omitidos</p>
                                            <p className="text-2xl font-black text-slate-400 leading-none">{skippedCount}</p>
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none">sin datos/vacíos</p>
                                        </div>
                                    </div>

                                    {status === 'done' && (
                                        <div className="pt-4 border-t border-dashed border-red-200 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                                                <div className="flex items-start gap-2.5">
                                                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                                    <div className="space-y-0.5">
                                                        <h4 className="text-[11px] font-black uppercase text-red-900 tracking-wide">¿Te equivocaste de archivo o mapeo?</h4>
                                                        <p className="text-[9px] font-bold text-red-700 uppercase leading-snug">Puedes revertir y borrar todos los teléfonos importados por este Excel de forma limpia.</p>
                                                    </div>
                                                </div>
                                                <Button 
                                                    onClick={runReversion}
                                                    variant="destructive"
                                                    size="sm"
                                                    className="font-black text-[9px] uppercase tracking-wider py-4 px-4 h-9 rounded-xl shadow-md shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                                                >
                                                    <XCircle className="h-4 w-4" /> REVERTIR ESTA CARGA
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Consola de logs interactivos */}
                            {(status === 'reading' || status === 'mapping' || status === 'migrating' || status === 'done' || status === 'error') && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Consola del Servidor (Logs)</div>
                                    <div className="h-[200px] border-2 border-slate-950 bg-slate-950 text-slate-100 rounded-3xl p-5 font-mono text-[11px] overflow-y-auto space-y-2 shadow-inner">
                                        {logs.map((log, idx) => (
                                            <div key={idx} className={cn(
                                                "flex items-start gap-2",
                                                log.type === 'success' ? "text-green-400" :
                                                log.type === 'warn' ? "text-yellow-400" :
                                                log.type === 'error' ? "text-red-400" :
                                                "text-blue-300"
                                            )}>
                                                <span className="text-[9px] text-slate-500 shrink-0 font-sans">[{log.timestamp}]</span>
                                                <span className="leading-relaxed whitespace-pre-wrap">{log.message}</span>
                                            </div>
                                        ))}
                                        <div ref={logsEndRef} />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t py-4 flex justify-between items-center px-8 rounded-b-3xl">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">MOTOR DE ACTUALIZACIÓN ELECTORAL • NEXTJS CLIENT PROCESSOR</p>
                            <Badge variant="outline" className="text-[9px] font-black border-primary/10">v5.3 PREMIUM</Badge>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}

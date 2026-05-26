"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, doc, writeBatch, deleteField, getDoc, query, addDoc, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    FileSpreadsheet, 
    UploadCloud, 
    CheckCircle2, 
    AlertTriangle, 
    RefreshCw, 
    Database, 
    Loader2, 
    Lock, 
    BookHeart, 
    Info, 
    ChevronRight, 
    Play, 
    FileText,
    History,
    XCircle,
    UserCircle,
    ShieldAlert,
    Users,
    ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { logAction } from '@/lib/audit';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

// Definición de colecciones de Firebase
const COLLECTION_PADRON = 'sheet1';
const COLLECTION_CAPTURAS = 'votos_confirmados';

interface LogEntry {
    type: 'success' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: string;
}

export default function MigrarVotosPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Seguridad de roles: Super-Admin, Admin, Presidente, Coordinador, Dirigente
    const isAuthorized = useMemo(() => {
        if (!user) return false;
        return ['Super-Admin', 'Admin', 'Presidente', 'Coordinador', 'Dirigente'].includes(user.role);
    }, [user]);

    const userSeccionales = useMemo(() => {
        if (!user) return [];
        return user.seccionales || (user.seccional ? [user.seccional] : []);
    }, [user]);

    // Estados del flujo del archivo
    const [file, setFile] = useState<File | null>(null);
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [mapping, setMapping] = useState({ cedula: '', telefono: '' });
    
    // Almacén en memoria de electores pre-consultados
    const [fetchedElectors, setFetchedElectors] = useState<Record<string, any>>({});
    const [operatorMapping, setOperatorMapping] = useState<Record<string, string>>({});
    
    // Estados del procesamiento
    const [status, setStatus] = useState<'idle' | 'reading' | 'checking' | 'mapping' | 'migrating' | 'done' | 'error'>('idle');
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

    // ESCUCHADOR EN TIEMPO REAL A TODOS LOS USUARIOS PARA DELEGACIONES
    const usersQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'users'));
    }, [db]);

    const { data: allUsers } = useCollection<any>(usersQuery);

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
        setFetchedElectors({});
        setOperatorMapping({});
        addLog('info', `Leyendo archivo: ${selectedFile.name}...`);

        const reader = new FileReader();
        reader.onload = async (event) => {
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
                    // Proceder directamente a consultar electores
                    await runPreChecking(jsonData, detectedCedula);
                } else {
                    addLog('warn', 'No se pudieron detectar automáticamente las columnas de Cédula o Teléfono. Por favor, asígnalas manualmente.');
                    setStatus('mapping');
                }
            } catch (err) {
                console.error(err);
                addLog('error', 'Error al procesar la estructura del Excel.');
                setStatus('error');
            }
        };

        reader.onerror = () => {
            addLog('error', 'Error al leer el archivo físico.');
            setStatus('error');
        };

        reader.readAsBinaryString(selectedFile);
    };

    // Consulta en lote de todos los electores del Excel en Firestore para checking de seccional
    const runPreChecking = async (data: any[], cedulaColumn: string) => {
        if (!db) return;
        setStatus('checking');
        addLog('info', '🔍 Consultando estado de los electores en el Padrón Nacional (Firestore)...');
        
        const tempFetched: Record<string, any> = {};
        let notFound = 0;
        const total = data.length;
        
        // Extraer y limpiar todas las cédulas
        const allCedulas = data.map(row => {
            const rawCed = row[cedulaColumn];
            if (rawCed === undefined || rawCed === null) return null;
            const cedStr = String(rawCed).replace(/\D/g, '');
            return cedStr || null;
        });

        // Consultamos en lotes de 30 usando query 'in' para mayor rendimiento y flexibilidad (busca por campo CEDULA)
        const batchSize = 30;
        for (let i = 0; i < total; i += batchSize) {
            const chunkCedulas = allCedulas.slice(i, i + batchSize).filter(Boolean) as string[];
            
            if (chunkCedulas.length > 0) {
                const uniqueCedulas = Array.from(new Set(chunkCedulas));
                
                // 1. Búsqueda Numérica
                const numCedulas = uniqueCedulas.map(c => Number(c));
                try {
                    const qNum = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', numCedulas));
                    const snapNum = await getDocs(qNum);
                    snapNum.forEach(docSnap => {
                        const data = docSnap.data();
                        const ced = String(data.CEDULA).replace(/\D/g, '');
                        tempFetched[ced] = { id: docSnap.id, ...data };
                    });
                } catch (e) {
                    console.error("Error en query numérica", e);
                }

                // 2. Búsqueda por String (fallback para los no encontrados)
                const remaining = uniqueCedulas.filter(c => !tempFetched[c]);
                if (remaining.length > 0) {
                    try {
                        const qStr = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', remaining));
                        const snapStr = await getDocs(qStr);
                        snapStr.forEach(docSnap => {
                            const data = docSnap.data();
                            const ced = String(data.CEDULA).replace(/\D/g, '');
                            tempFetched[ced] = { id: docSnap.id, ...data };
                        });
                    } catch (e) {
                        console.error("Error en query string", e);
                    }
                }
            }

            const processed = Math.min(i + batchSize, total);
            setProgress(Math.round((processed / total) * 100));
        }

        // Contar los no encontrados
        for (let i = 0; i < total; i++) {
            const c = allCedulas[i];
            if (c) {
                if (!tempFetched[c]) {
                    tempFetched[c] = null; // Marcar como no encontrado
                    notFound++;
                }
            } else {
                notFound++;
            }
        }

        setFetchedElectors(tempFetched);
        setNotFoundCount(notFound);
        addLog('success', `Análisis de seccionales completado. Registrados en padrón: ${total - notFound} | No encontrados: ${notFound}`);
        setStatus('mapping');
    };

    // Si el usuario cambia manualmente las columnas mapeadas, re-ejecutar el pre-checking
    const handleMappingChange = async (type: 'cedula' | 'telefono', val: string) => {
        const newMapping = { ...mapping, [type]: val };
        setMapping(newMapping);
        if (type === 'cedula' && val && sheetData.length > 0) {
            await runPreChecking(sheetData, val);
        }
    };

    // Identificar qué seccionales externas están representadas en el Excel
    const externalSeccionales = useMemo(() => {
        if (sheetData.length === 0 || !mapping.cedula) return [];
        const secs = new Set<string>();
        sheetData.forEach(row => {
            const rawCed = row[mapping.cedula];
            if (!rawCed) return;
            const cedulaStr = String(rawCed).replace(/\D/g, '');
            const elector = fetchedElectors[cedulaStr];
            if (elector && elector.CODIGO_SEC) {
                const electorSec = String(elector.CODIGO_SEC).trim();
                // Si la seccional del elector no está entre las del usuario
                if (electorSec && !userSeccionales.includes(electorSec)) {
                    secs.add(electorSec);
                }
            }
        });
        return Array.from(secs).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }, [sheetData, mapping, fetchedElectors, userSeccionales]);

    // Obtener los operadores dirigentes de una seccional específica
    const getOperatorsForSeccional = (secCode: string) => {
        if (!allUsers) return [];
        return allUsers.filter(u => {
            const rawSecc = u.seccionales || (u.seccional ? [u.seccional] : []);
            const userSecs = rawSecc.map((s: any) => 
                String(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/^(SECCIONAL|SECCION\.|SECCION|SECC\.|SECC|SEC\.|SEC)\s*/g, '').trim()
            );
            return userSecs.includes(secCode) && (u.role === 'Dirigente' || u.role === 'Coordinador' || u.role === 'Presidente');
        });
    };

    // Previsualización de los primeros 10 registros
    const previewData = useMemo(() => {
        if (sheetData.length === 0 || !mapping.cedula || !mapping.telefono) return [];
        return sheetData.slice(0, 10).map(row => {
            const rawCed = row[mapping.cedula];
            const cedulaStr = rawCed ? String(rawCed).replace(/\D/g, '') : '';
            const elector = fetchedElectors[cedulaStr];
            return {
                cedulaRaw: rawCed || 'N/A',
                telefonoRaw: row[mapping.telefono] || 'N/A',
                elector: elector || null,
                exists: elector !== undefined && elector !== null
            };
        });
    }, [sheetData, mapping, fetchedElectors]);

    // Estadísticas calculadas dinámicamente sobre el Excel analizado
    const statistics = useMemo(() => {
        if (sheetData.length === 0 || !mapping.cedula) {
            return { total: 0, valid: 0, local: 0, external: 0, omitted: 0 };
        }
        let valid = 0;
        let local = 0;
        let external = 0;
        let omitted = 0;

        sheetData.forEach(row => {
            const rawCed = row[mapping.cedula];
            if (rawCed === undefined || rawCed === null) {
                omitted++;
                return;
            }
            const cedulaStr = String(rawCed).replace(/\D/g, '');
            if (!cedulaStr) {
                omitted++;
                return;
            }

            const elector = fetchedElectors[cedulaStr];
            if (elector) {
                valid++;
                const electorSec = String(elector.CODIGO_SEC || '').trim();
                if (userSeccionales.includes(electorSec)) {
                    local++;
                } else {
                    external++;
                }
            } else if (elector === null) {
                omitted++;
            }
        });

        return { total: sheetData.length, valid, local, external, omitted };
    }, [sheetData, mapping, fetchedElectors, userSeccionales]);

    const resetProcess = () => {
        setFile(null);
        setSheetData([]);
        setColumns([]);
        setMapping({ cedula: '', telefono: '' });
        setFetchedElectors({});
        setOperatorMapping({});
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
        setProgress(0);
        setProcessedCount(0);
        setUpdatedPadronCount(0);
        setUpdatedCapturasCount(0);
        setSkippedCount(0);
        setLogs([]);

        addLog('info', '🚀 Iniciando migración masiva de Votos Seguros...');
        addLog('info', '⚡ Procesando en lotes seguros de 200 registros...');

        const totalRecords = sheetData.length;
        let localUpdatedPadron = 0;
        let localUpdatedCapturas = 0;
        let localSkipped = 0;

        // Diccionario para contar votos delegados y crear notificaciones consolidadas
        const delegatedCounts: Record<string, { operatorName: string; count: number; seccionales: Set<string> }> = {};

        let currentBatch = writeBatch(db);
        let currentBatchSize = 0;

        for (let i = 0; i < totalRecords; i++) {
            const row = sheetData[i];
            const rawCed = row[mapping.cedula];
            const rawTel = row[mapping.telefono];

            // 1. Limpieza de Cédula
            if (rawCed === undefined || rawCed === null || String(rawCed).trim() === '') {
                localSkipped++;
                continue;
            }
            const cedulaStr = String(rawCed).replace(/\D/g, '');
            if (cedulaStr === '') {
                localSkipped++;
                continue;
            }

            // Validar si existe en Padrón pre-analizado
            const electorData = fetchedElectors[cedulaStr];
            if (!electorData || !electorData.id) {
                // Si no existe en el padrón, lo omitimos para no contaminar votos_confirmados con CI fantasmas
                localSkipped++;
                continue;
            }
            
            const docId = electorData.id;

            // 2. Limpieza de Teléfono
            let telRaw = rawTel !== undefined && rawTel !== null ? String(rawTel).replace(/\D/g, '') : '';
            let telClean = '';
            if (telRaw !== '' && telRaw.toLowerCase() !== 'null' && telRaw.toLowerCase() !== 'undefined') {
                if (telRaw.length >= 9) {
                    telClean = '595' + telRaw.slice(-9);
                } else {
                    telClean = '595' + telRaw.replace(/^0+/, '');
                }
            }
            if (telClean === '595') telClean = '';

            // 3. Determinar Operador (Delegación) para este elector
            const electorSec = String(electorData.CODIGO_SEC || '').trim();
            const isLocal = userSeccionales.includes(electorSec);
            
            let assignedOperatorId = user.id;
            let assignedOperatorName = user.name;
            let isDelegated = false;

            if (!isLocal && electorSec) {
                const mappedOpId = operatorMapping[electorSec];
                if (mappedOpId && mappedOpId !== 'user_me') {
                    const opUser = allUsers?.find(u => u.id === mappedOpId);
                    if (opUser) {
                        assignedOperatorId = opUser.id;
                        assignedOperatorName = opUser.name;
                        isDelegated = true;
                    }
                }
            }

            // 4. Preparación de guardado en Votos Seguros (votos_confirmados)
            const capturasRef = doc(db, COLLECTION_CAPTURAS, docId);
            const vsObj: any = {
                ...electorData,
                observacion: "VOTO SEGURO",
                TELEFONO: telClean || electorData.TELEFONO || '',
                registradoPor_id: assignedOperatorId,
                registradoPor_nombre: assignedOperatorName,
                updatedAt: new Date().toISOString(),
                // Meta info de migración
                migradoDesdeExcel: file?.name || 'MIGRACION_EXCEL',
                excelMigradoAt: new Date().toISOString()
            };

            if (isDelegated) {
                vsObj.delegadoPor_id = user.id;
                vsObj.delegadoPor_nombre = user.name;

                if (!delegatedCounts[assignedOperatorId]) {
                    delegatedCounts[assignedOperatorId] = {
                        operatorName: assignedOperatorName,
                        count: 0,
                        seccionales: new Set<string>()
                    };
                }
                delegatedCounts[assignedOperatorId].count++;
                if (electorSec) {
                    delegatedCounts[assignedOperatorId].seccionales.add(electorSec);
                }
            }

            currentBatch.set(capturasRef, vsObj, { merge: true });
            currentBatchSize++;
            localUpdatedCapturas++;

            // 5. Actualización en Padrón (sheet1)
            const padronRef = doc(db, COLLECTION_PADRON, docId);
            const padronObj: any = {
                observacion: "VOTO SEGURO",
                votoSeguroUpdatedBy_id: user.id,
                votoSeguroUpdatedBy_nombre: user.name,
                votoSeguroUpdatedAt: new Date().toISOString(),
                migradoDesdeExcel: file?.name || 'MIGRACION_EXCEL'
            };

            if (telClean) {
                padronObj.TELEFONO = telClean;
                padronObj.TELEFONO_MIGRADO = telClean;
            }

            currentBatch.update(padronRef, padronObj);
            currentBatchSize++;
            localUpdatedPadron++;

            // 6. Commit de Lote Firestore si alcanzamos el límite de tamaño seguro (400 operaciones)
            if (currentBatchSize >= 400) {
                try {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    currentBatchSize = 0;

                    // Actualizar métricas parciales
                    const processed = i + 1;
                    setProgress(Math.round((processed / totalRecords) * 100));
                } catch (batchErr) {
                    console.error("Error commiteando lote intermedio:", batchErr);
                    addLog('error', `❌ Error al guardar lote en Firestore.`);
                }
            }
        }

        // Commit del lote final restante (fuera del bucle)
        if (currentBatchSize > 0) {
            try {
                await currentBatch.commit();
            } catch (batchErr) {
                console.error("Error commiteando lote final:", batchErr);
                addLog('error', `❌ Error al guardar lote final en Firestore.`);
            }
        }

        // Actualizar métricas finales
        setProgress(100);
        setProcessedCount(totalRecords);
        setUpdatedPadronCount(localUpdatedPadron);
        setUpdatedCapturasCount(localUpdatedCapturas);
        setSkippedCount(localSkipped);

        // Auditoría
        try {
            await logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'MIGRACION EXCEL VOTOS SEGUROS',
                action: 'MIGRÓ VOTOS SEGUROS MASIVAMENTE',
                targetName: `Archivo: ${file?.name} - Sincronizados: ${localUpdatedCapturas} Votos Seguros.`
            });
        } catch (auditErr) {
            console.warn("Fallo al registrar auditoría:", auditErr);
        }

        // Crear Notificaciones Consolidadas de Delegación en Firestore
        try {
            const notificationsColl = collection(db, 'notifications');
            const entries = Object.entries(delegatedCounts);
            if (entries.length > 0) {
                addLog('info', `🔔 Generando ${entries.length} notificaciones de delegación...`);
                for (const [targetUserId, data] of entries) {
                    await addDoc(notificationsColl, {
                        recipientId: targetUserId,
                        senderId: user.id,
                        senderName: user.name,
                        title: "Asignación de Votos Seguros",
                        message: `Te ha asignado ${data.count} nuevos votos seguros de la Seccional ${Array.from(data.seccionales).join(', ')}.`,
                        type: "delegation",
                        count: data.count,
                        seccionales: Array.from(data.seccionales),
                        read: false,
                        createdAt: new Date().toISOString()
                    });
                }
                addLog('success', `🔔 ¡Notificaciones enviadas en tiempo real con éxito!`);
            }
        } catch (notifErr) {
            console.warn("Fallo al guardar notificaciones:", notifErr);
        }

        setStatus('done');
        addLog('success', '🎉 ¡Migración de Votos Seguros finalizada con éxito!');
        addLog('success', `------------------------------------------------`);
        addLog('success', `✅ Total Procesados: ${totalRecords}`);
        addLog('success', `🎯 Votos Confirmados Registrados: ${localUpdatedCapturas}`);
        addLog('success', `📲 Padrón Actualizado (Marcas de Voto Seguro): ${localUpdatedPadron}`);
        addLog('success', `⚠️ Omitidos (No encontrados en padrón o vacíos): ${localSkipped}`);
        addLog('success', `------------------------------------------------`);

        toast({
            title: "Migración de Votos Exitosa",
            description: `Se han registrado ${localUpdatedCapturas} votos seguros con éxito.`,
        });
    };

    const runReversion = async () => {
        if (!db || !user || !file) return;

        setStatus('migrating');
        setProgress(0);
        setProcessedCount(0);
        setUpdatedPadronCount(0);
        setUpdatedCapturasCount(0);
        setSkippedCount(0);
        setLogs([]);

        addLog('info', `🔄 Iniciando reversión de los votos migrados desde: ${file.name}...`);

        const totalRecords = sheetData.length;
        let localUpdatedPadron = 0;
        let localUpdatedCapturas = 0;
        let localSkipped = 0;

        let currentBatch = writeBatch(db);
        let currentBatchSize = 0;

        for (let i = 0; i < totalRecords; i++) {
            const row = sheetData[i];
            const rawCed = row[mapping.cedula];
            if (!rawCed) {
                localSkipped++;
                continue;
            }
            const cedulaStr = String(rawCed).replace(/\D/g, '');
            if (!cedulaStr) {
                localSkipped++;
                continue;
            }

            const electorData = fetchedElectors[cedulaStr];
            const docId = electorData?.id || cedulaStr;

            // Eliminar de votos_confirmados
            const capturasRef = doc(db, COLLECTION_CAPTURAS, docId);
            currentBatch.delete(capturasRef);
            currentBatchSize++;
            localUpdatedCapturas++;

            // Remover marca de sheet1
            const padronRef = doc(db, COLLECTION_PADRON, docId);
            currentBatch.update(padronRef, {
                observacion: deleteField(),
                TELEFONO_MIGRADO: deleteField(),
                votoSeguroUpdatedBy_id: deleteField(),
                votoSeguroUpdatedBy_nombre: deleteField(),
                votoSeguroUpdatedAt: deleteField(),
                migradoDesdeExcel: deleteField()
            });
            currentBatchSize++;
            localUpdatedPadron++;

            if (currentBatchSize >= 400) {
                try {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    currentBatchSize = 0;

                    const processed = i + 1;
                    setProgress(Math.round((processed / totalRecords) * 100));
                } catch (err) {
                    console.error("Error al revertir lote:", err);
                }
            }
        }

        // Commit del lote final restante (fuera del bucle)
        if (currentBatchSize > 0) {
            try {
                await currentBatch.commit();
            } catch (err) {
                console.error("Error al revertir lote final:", err);
            }
        }

        // Actualizar métricas finales
        setProgress(100);
        setProcessedCount(totalRecords);
        setUpdatedPadronCount(localUpdatedPadron);
        setUpdatedCapturasCount(localUpdatedCapturas);
        setSkippedCount(localSkipped);

        try {
            await logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'REVERSION MIGRACION VOTOS',
                action: 'REVERTIÓ VOTOS SEGUROS MASIVAMENTE',
                targetName: `Archivo: ${file.name} - Removidos: ${localUpdatedCapturas} votos.`
            });
        } catch (auditErr) {
            console.warn(auditErr);
        }

        setStatus('done');
        addLog('success', '🔄 ¡Reversión finalizada con éxito!');
        addLog('success', `❌ Votos Seguros Removidos: ${localUpdatedCapturas}`);
        addLog('success', `📲 Padrón Limpiado: ${localUpdatedPadron}`);

        toast({
            title: "Reversión Completada",
            description: "Se han removido las marcas de voto seguro del archivo actual.",
        });
    };

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
                            Este módulo está reservado exclusivamente para los roles autorizados:
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                            {['Super-Admin', 'Admin', 'Presidente', 'Coordinador', 'Dirigente'].map(role => (
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
                        Migración de Votos Seguros
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                        Sincroniza y delega capturas masivas de votos seguros cruzando con el Padrón Nacional.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-black border-primary/20 bg-primary/5 text-primary px-3 py-1 rounded-full uppercase">
                        Jurisdicción: SECC {userSeccionales.join(', ')}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel de Carga y Mapeo */}
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
                                        "border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[200px]",
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
                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/5 shadow-inner mb-4">
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

                    {/* Selector de mapeo de columnas */}
                    {(status === 'mapping' || status === 'migrating' || status === 'done' || status === 'checking') && (
                        <Card className="border-primary/10 shadow-sm overflow-hidden rounded-3xl">
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
                                        disabled={status === 'migrating' || status === 'checking'}
                                        value={mapping.cedula}
                                        onChange={(e) => handleMappingChange('cedula', e.target.value)}
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
                                        disabled={status === 'migrating' || status === 'checking'}
                                        value={mapping.telefono}
                                        onChange={(e) => handleMappingChange('telefono', e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white font-bold text-xs uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="">-- Selecciona Columna --</option>
                                        {columns.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Panel Central de Previsualización y Control */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Panel de Delegación Inteligente por Seccionales */}
                    {status === 'mapping' && externalSeccionales.length > 0 && (
                        <Card className="border-amber-200/50 bg-amber-50/10 shadow-md overflow-hidden rounded-3xl animate-in fade-in duration-300">
                            <CardHeader className="bg-amber-500/10 border-b border-amber-100 py-4">
                                <CardTitle className="text-xs font-black uppercase text-amber-800 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Mapeo Inteligente: Seccionales de Capital Detectadas
                                </CardTitle>
                                <CardDescription className="text-[9px] uppercase font-bold text-amber-600">
                                    Se detectaron electores que pertenecen a otras jurisdicciones. Selecciona a qué operador asignar cada seccional.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {externalSeccionales.map(sec => {
                                        const ops = getOperatorsForSeccional(sec);
                                        return (
                                            <div key={sec} className="p-4 border rounded-2xl bg-white space-y-2 shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black uppercase text-slate-800">SECCIONAL {sec}</span>
                                                    <Badge variant="outline" className="text-[8px] font-bold border-amber-200 text-amber-700 bg-amber-50 px-2">
                                                        {sheetData.filter(row => {
                                                            const rawCed = row[mapping.cedula];
                                                            if (!rawCed) return false;
                                                            const cedulaStr = String(rawCed).replace(/\D/g, '');
                                                            return fetchedElectors[cedulaStr]?.CODIGO_SEC == sec;
                                                        }).length} Electores
                                                    </Badge>
                                                </div>
                                                
                                                <select
                                                    value={operatorMapping[sec] || ''}
                                                    onChange={(e) => setOperatorMapping(prev => ({ ...prev, [sec]: e.target.value }))}
                                                    className="w-full h-10 px-2 rounded-xl border border-slate-200 bg-white font-bold text-[11px] uppercase focus:outline-none"
                                                >
                                                    <option value="user_me">-- Registrar a mi Nombre --</option>
                                                    {ops.map(op => (
                                                        <option key={op.id} value={op.id}>
                                                            {op.name} ({op.role})
                                                        </option>
                                                    ))}
                                                </select>
                                                
                                                {ops.length === 0 && (
                                                    <p className="text-[8px] font-bold text-red-500 uppercase flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3 shrink-0" />
                                                        Sin operadores registrados para esta seccional.
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Consola principal de control y previsualización */}
                    <Card className="border-primary/10 shadow-lg overflow-hidden min-h-[400px] rounded-3xl flex flex-col">
                        <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <BookHeart className="h-4 w-4 text-primary" />
                                Paso 3: Previsualización e Inicio
                            </CardTitle>
                            {status === 'mapping' && mapping.cedula && mapping.telefono && (
                                <div className="flex gap-2">
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
                                        <span className="text-[10px] text-muted-foreground font-bold tracking-normal mt-1 block">Sube un listado para comenzar el análisis automático de seccionales.</span>
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

                            {status === 'checking' && (
                                <div className="flex flex-col items-center justify-center h-[300px] text-center px-8 space-y-4">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                    <p className="font-black uppercase tracking-[0.1em] text-xs text-slate-800 animate-pulse">
                                        Cruzando datos con el Padrón Nacional ({progress}%)...
                                    </p>
                                    <Progress value={progress} className="h-2 w-full max-w-xs bg-slate-100" />
                                </div>
                            )}

                            {(status === 'mapping' && previewData.length > 0) && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* Métrica Resumen de Resultados del Prechecking */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between shadow-sm">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total en Excel</span>
                                            <span className="text-2xl font-black text-slate-850 mt-1.5">{statistics.total} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-normal">Filas</span></span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-green-50/40 border border-green-100/50 flex flex-col justify-between shadow-sm">
                                            <span className="text-[9px] font-black uppercase text-green-600 tracking-widest">Mi Seccional</span>
                                            <span className="text-2xl font-black text-green-700 mt-1.5">{statistics.local} <span className="text-[10px] text-green-500 font-bold uppercase tracking-normal">Votos</span></span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100/50 flex flex-col justify-between shadow-sm">
                                            <span className="text-[9px] font-black uppercase text-amber-600 tracking-widest">Otras Seccionales</span>
                                            <span className="text-2xl font-black text-amber-700 mt-1.5">{statistics.external} <span className="text-[10px] text-amber-500 font-bold uppercase tracking-normal">Votos</span></span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-red-50/40 border border-red-100/50 flex flex-col justify-between shadow-sm">
                                            <span className="text-[9px] font-black uppercase text-red-600 tracking-widest">No en Padrón</span>
                                            <span className="text-2xl font-black text-red-700 mt-1.5">{statistics.omitted} <span className="text-[10px] text-red-500 font-bold uppercase tracking-normal">Omitidos</span></span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            <Info className="h-4 w-4 text-primary" />
                                            Checking de Seccionales (Muestra de primeros 10 registros)
                                        </div>
                                        <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-inner bg-slate-50/30">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40 text-[9px] font-black uppercase text-slate-500 border-b border-slate-100">
                                                    <TableHead className="py-3 px-4">Cédula</TableHead>
                                                    <TableHead className="py-3 px-4">Elector</TableHead>
                                                    <TableHead className="py-3 px-4">Teléfono</TableHead>
                                                    <TableHead className="py-3 px-4">Seccional</TableHead>
                                                    <TableHead className="py-3 px-4 text-right">Jurisdicción</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {previewData.map((row, idx) => {
                                                    const isLocal = row.elector && userSeccionales.includes(String(row.elector.CODIGO_SEC));
                                                    return (
                                                        <TableRow key={idx} className="border-b border-slate-100/50 hover:bg-white/50 text-xs font-bold text-slate-700">
                                                            <td className="py-3.5 px-4 font-mono text-slate-900">{row.cedulaRaw}</td>
                                                            <td className="py-3.5 px-4 uppercase truncate max-w-[150px]">
                                                                {row.elector ? `${row.elector.NOMBRE} ${row.elector.APELLIDO}` : (
                                                                    <span className="text-red-500 italic font-medium">Cédula no en Padrón</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-slate-500">{row.telefonoRaw}</td>
                                                            <td className="py-3.5 px-4">
                                                                {row.elector?.CODIGO_SEC ? (
                                                                    <Badge variant="outline" className="text-[9px] font-black">
                                                                        SECC {row.elector.CODIGO_SEC}
                                                                    </Badge>
                                                                ) : '---'}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right">
                                                                {row.exists ? (
                                                                    isLocal ? (
                                                                        <Badge className="text-[8px] bg-green-500 text-white font-bold uppercase py-0.5 px-2">
                                                                            MI SECCIONAL (OK)
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge className="text-[8px] bg-amber-500 text-white font-bold uppercase py-0.5 px-2">
                                                                            OTRA SECCIONAL
                                                                        </Badge>
                                                                    )
                                                                ) : (
                                                                    <Badge className="text-[8px] bg-red-500 text-white font-bold uppercase py-0.5 px-2">
                                                                        OMITIDO
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
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
                                                        Proceso Completado con Éxito
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
                                            <p className="text-[8px] font-bold text-green-500 uppercase leading-none">marcas actualizadas</p>
                                        </div>
                                        <div className="border border-primary/10 bg-primary/[0.01] rounded-2xl p-4 text-center space-y-1.5 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-primary tracking-wider">Votos Seguros</p>
                                            <p className="text-2xl font-black text-primary leading-none">{updatedCapturasCount}</p>
                                            <p className="text-[8px] font-bold text-primary/80 uppercase leading-none">votos registrados</p>
                                        </div>
                                        <div className="border bg-slate-50/30 rounded-2xl p-4 text-center space-y-1.5 shadow-sm">
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Omitidos</p>
                                            <p className="text-2xl font-black text-slate-400 leading-none">{skippedCount}</p>
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none">inexistentes / vacíos</p>
                                        </div>
                                    </div>

                                    {status === 'done' && (
                                        <div className="pt-4 border-t border-dashed border-red-200 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                                                <div className="flex items-start gap-2.5">
                                                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                                    <div className="space-y-0.5">
                                                        <h4 className="text-[11px] font-black uppercase text-red-900 tracking-wide">¿Te equivocaste de archivo o mapeo?</h4>
                                                        <p className="text-[9px] font-bold text-red-700 uppercase leading-snug">Puedes revertir y borrar todos los votos seguros importados por este Excel de forma limpia.</p>
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
                            {(status === 'reading' || status === 'checking' || status === 'mapping' || status === 'migrating' || status === 'done' || status === 'error') && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Consola de Servidor (Logs)</div>
                                    <div className="h-[150px] border-2 border-slate-950 bg-slate-950 text-slate-100 rounded-3xl p-5 font-mono text-[11px] overflow-y-auto space-y-2 shadow-inner">
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

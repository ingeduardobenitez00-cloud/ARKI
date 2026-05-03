import { MoldeConfig, getMolde } from './electoral-config';

export interface ResultadoProcesamiento {
    votos: number[];
    cierre: {
        nul: number;
        blc: number;
        vac: number;
        tot: number;
    };
    validado: boolean;
    error?: string;
}

/**
 * Procesa los bytes del QR utilizando el patrón de Anclaje Inverso (Bottom-Up).
 * 
 * @param qrArray Array de bytes (descomprimidos)
 * @param depto Departamento seleccionado (CAPITAL, CENTRAL, etc.)
 * @param cargo Cargo seleccionado (INTENDENTE, JUNTA)
 */
export const procesarQRARKI = (
    qrArray: number[], 
    depto: string, 
    cargo: 'INTENDENTE' | 'JUNTA'
): ResultadoProcesamiento => {
    try {
        const config = getMolde(depto, cargo);
        
        // 1. Identificar el MOLDE activo y calcular el offset de corte inverso
        // El anclaje es el final del array. Tomamos los últimos N campos según el molde.
        const effectiveLen = Math.min(qrArray.length, config.totalCampos);
        const bloqueData = qrArray.slice(-effectiveLen);
        
        // 2. Extraer el cierre (los últimos 4 bytes: NUL, BLC, VAC, TOT)
        const cierreBytes = bloqueData.slice(-4);
        const [nul, blc, vac, tot] = cierreBytes;

        // 3. Extraer los votos (todo lo anterior al cierre dentro del bloque)
        const votos = bloqueData.slice(0, -4);

        // 4. Validación 'Bottom-Up' (El TOT es el ancla)
        // La suma de votos + nul + blc + vac debe ser igual a tot
        const sumaVotos = votos.reduce((acc, val) => acc + val, 0);
        const sumaTotalCalculada = sumaVotos + nul + blc + vac;

        const validado = sumaTotalCalculada === tot;

        if (!validado) {
            console.warn(`Error de validación: Calculado ${sumaTotalCalculada} vs TOT ${tot}`);
        }

        return {
            votos,
            cierre: { nul, blc, vac, tot },
            validado,
            error: validado ? undefined : `Inconsistencia de datos: Suma (${sumaTotalCalculada}) != TOT (${tot})`
        };
    } catch (e: any) {
        return {
            votos: [],
            cierre: { nul: 0, blc: 0, vac: 0, tot: 0 },
            validado: false,
            error: e.message
        };
    }
};

/**
 * Mapea los votos planos a una estructura organizada por Listas (para Junta).
 */
export const mapearVotosJunta = (votos: number[], config: MoldeConfig) => {
    const listas: Record<string, { total: number; opciones: Record<number, number> }> = {};
    
    for (let i = 0; i < config.totalListas; i++) {
        const offset = i * config.opcionesPorLista;
        const votosLista = votos.slice(offset, offset + config.opcionesPorLista);
        const totalLista = votosLista.reduce((acc, val) => acc + val, 0);
        
        const opciones: Record<number, number> = {};
        votosLista.forEach((v, idx) => {
            if (v > 0) opciones[idx + 1] = v;
        });

        listas[`lista-${i + 1}`] = {
            total: totalLista,
            options: opciones
        } as any;
    }
    
    return listas;
};

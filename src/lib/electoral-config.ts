export interface MoldeConfig {
    totalListas: number;
    opcionesPorLista: number;
    totalCampos: number;
    cierre: string[];
}

export interface DeptoConfig {
    INTENDENTE: MoldeConfig;
    JUNTA: MoldeConfig;
}

export const MOLDES_ARKI: Record<string, DeptoConfig> = {
    CAPITAL: {
        INTENDENTE: {
            totalListas: 3,
            opcionesPorLista: 1, 
            totalCampos: 14, // 7 (Header) + 3 (Listas) + 4 (Cierre)
            cierre: ['NUL', 'BLC', 'VAC', 'TOT']
        },
        JUNTA: {
            totalListas: 5,
            opcionesPorLista: 24,
            totalCampos: 129, // 5 (Listas) * 25 + 4 (Cierre)
            cierre: ['NUL', 'BLC', 'VAC', 'TOT']
        }
    },
    CENTRAL: {
        INTENDENTE: {
            totalListas: 7,
            opcionesPorLista: 1,
            totalCampos: 18, // 7 (Header) + 7 (Listas) + 4 (Cierre)
            cierre: ['NUL', 'BLC', 'VAC', 'TOT']
        },
        JUNTA: {
            totalListas: 21,
            opcionesPorLista: 24,
            totalCampos: 529, // 21 (Listas) * 25 + 4 (Cierre)
            cierre: ['NUL', 'BLC', 'VAC', 'TOT']
        }
    },
    PRUEBA: { // Placeholder for "Acta de Prueba" logic
        INTENDENTE: {
            totalListas: 11,
            opcionesPorLista: 1,
            totalCampos: 15,
            cierre: ['NUL', 'BLC', 'VAC', 'TOT']
        },
        JUNTA: {
            totalListas: 1,
            opcionesPorLista: 24,
            totalCampos: 28,
            cierre: ['NUL', 'BLC', 'VAC', 'TOT']
        }
    }
};

/**
 * Factory to get the configuration for a specific department and role.
 */
export const getMolde = (depto: string, cargo: 'INTENDENTE' | 'JUNTA'): MoldeConfig => {
    const config = MOLDES_ARKI[depto]?.[cargo];
    if (!config) {
        throw new Error(`Configuración no encontrada para ${depto} - ${cargo}`);
    }
    return config;
};

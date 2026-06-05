import { NextResponse } from 'next/server';


export async function POST(request: Request) {
    try {
        // Fetch from ETR API
        const token = process.env.ETR_API_TOKEN;
        if (!token) {
            return NextResponse.json({ success: false, error: 'ETR_API_TOKEN no configurado en variables de entorno' }, { status: 500 });
        }

        console.log('Fetching ETR API...');
        const response = await fetch('https://etr.webnet.com.py/api/listar-padron-estado-v', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                codigo_dpto: 0,
                cod_distrito: 0
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`ETR API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        if (!data.success || !data.data || !data.data.registros) {
            throw new Error('Formato de respuesta de API ETR inválido');
        }

        const registros = data.data.registros;
        console.log(`Recibidos ${registros.length} registros de la API ETR.`);

        // Extract set of cedulas that have voted
        const votedCedulas = new Set(registros.map((r: any) => String(r.cedula)));

        return NextResponse.json({ 
            success: true, 
            votedCedulas: Array.from(votedCedulas),
            message: `Datos obtenidos. ${votedCedulas.size} registros registrados como Ya Votó en ETR.` 
        });

    } catch (error: any) {
        console.error('Error syncing with ETR API:', error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}

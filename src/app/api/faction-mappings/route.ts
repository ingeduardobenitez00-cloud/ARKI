import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'faction-mappings.json');

export async function GET() {
    try {
        if (!fs.existsSync(DATA_FILE_PATH)) {
            return NextResponse.json({});
        }
        const fileData = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(fileData));
    } catch (error) {
        console.error('Error reading faction mappings:', error);
        return NextResponse.json({}, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
        return NextResponse.json({ success: true, message: 'Configuración guardada correctamente.' });
    } catch (error) {
        console.error('Error saving faction mappings:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar.' }, { status: 500 });
    }
}

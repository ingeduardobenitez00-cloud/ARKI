import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { image, imagePath } = await request.json();
        
        if (!image || !imagePath) {
            return NextResponse.json({ success: false, error: 'Missing image or path' }, { status: 400 });
        }

        // Remove 'data:image/jpeg;base64,' or 'data:image/png;base64,'
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Ensure the path is safe
        const safePath = imagePath.replace(/\.\./g, '');
        const fullPath = path.join(process.cwd(), 'public', safePath);
        
        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(fullPath, buffer);
        
        return NextResponse.json({ 
            success: true, 
            path: `/${safePath}?t=${Date.now()}` // Add timestamp to bypass cache
        });
    } catch (error) {
        console.error('Error saving image:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

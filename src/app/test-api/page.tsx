"use client";
import { useState } from 'react';
export default function TestPage() {
    const [result, setResult] = useState('');
    const [url, setUrl] = useState('dinamics/certificado.ajax.php?eleccion=44&candidatura=2&departamento=0&distrito=0&zona=34&local=1&mesa=1');
    const runTest = async () => {
        try {
            const res = await fetch('/api/tsje-proxy?path=' + encodeURIComponent(url));
            const text = await res.text();
            setResult(text);
        } catch (e: any) {
            setResult(e.message);
        }
    };
    return <div className="p-10">
        <input className="border p-2 w-full mb-4" value={url} onChange={e => setUrl(e.target.value)} />
        <button onClick={runTest} className="p-4 bg-blue-500 text-white">TEST</button>
        <pre className="mt-4 p-4 bg-slate-100 text-xs overflow-auto">{result}</pre>
    </div>;
}

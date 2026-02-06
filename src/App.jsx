import React, { useState } from 'react';
import { UploadCloud, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, ListFilter, ArrowLeftRight } from 'lucide-react';

function App() {
    const [activeTab, setActiveTab] = useState('pes'); // 'pes' or 'iva'

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800 font-sans">
            <div className="w-full max-w-5xl">

                {/* Header */}
                <header className="mb-8 text-center animate-fade-in-down">
                    <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                        Herramientas ARCA
                    </h1>
                    <p className="text-slate-400">Procesamiento de Facturas y Control de IVA</p>
                </header>

                {/* Tabs Navigation */}
                <div className="flex justify-center mb-8 bg-slate-800/50 p-1 rounded-xl backdrop-blur-sm w-fit mx-auto border border-slate-700/50">
                    <button
                        onClick={() => setActiveTab('pes')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'pes' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <ListFilter size={18} />
                        Filtro PES
                    </button>
                    <button
                        onClick={() => setActiveTab('iva')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'iva' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <ArrowLeftRight size={18} />
                        Comparador IVA
                    </button>
                </div>

                {/* Content */}
                <div className="animate-fade-in">
                    {activeTab === 'pes' ? <PesFilter /> : <IvaComparator />}
                </div>

            </div>
        </div>
    );
}

// --- SUB-APP: PES FILTER ---
function PesFilter() {
    const [file1, setFile1] = useState(null);
    const [results1, setResults1] = useState(null);
    const [file2, setFile2] = useState(null);
    const [results2, setResults2] = useState(null);
    const [error, setError] = useState(null);

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

    const handleDrop = (e, fileNum) => {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.files.length > 0) validateAndSetFile(e.dataTransfer.files[0], fileNum);
    };

    const handleFileInput = (e, fileNum) => {
        if (e.target.files.length > 0) validateAndSetFile(e.target.files[0], fileNum);
    };

    const validateAndSetFile = (file, fileNum) => {
        if (file.type === "text/plain") {
            if (fileNum === 1) {
                setFile1(file); setResults1(null); setFile2(null); setResults2(null);
            } else {
                setFile2(file); setResults2(null);
            }
            setError(null);
        } else {
            setError("Por favor, sube un archivo de texto (.txt)");
        }
    };

    const getKeyFile1 = (line) => line.substring(8, 36);
    const getKeyFile2 = (line) => line.substring(0, 28);

    const processFile1 = () => {
        if (!file1) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const lines = content.split(/\r\n|\n/);
            const conPes = [];
            const sinPes = [];
            const sinPesKeys = new Set();

            lines.forEach(line => {
                if (line.trim().length > 0) {
                    if (line.includes('PES')) {
                        conPes.push(line);
                    } else {
                        sinPes.push(line);
                        if (line.length >= 36) sinPesKeys.add(getKeyFile1(line));
                    }
                }
            });
            setResults1({ conPes, sinPes, sinPesKeys });
        };
        reader.onerror = () => setError("Error al leer el archivo");
        reader.readAsText(file1);
    };

    const processFile2 = () => {
        if (!file2 || !results1) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const lines = content.split(/\r\n|\n/);
            const matchSinPes = [];
            const noMatch = [];

            lines.forEach(line => {
                if (line.trim().length > 0) {
                    if (line.length >= 28) {
                        const key = getKeyFile2(line);
                        if (results1.sinPesKeys.has(key)) matchSinPes.push(line);
                        else noMatch.push(line);
                    } else {
                        noMatch.push(line);
                    }
                }
            });
            setResults2({ matchSinPes, noMatch });
        };
        reader.onerror = () => setError("Error al leer el archivo");
        reader.readAsText(file2);
    };

    const downloadFile = (contentArray, filename) => {
        const content = contentArray.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const reset = () => { setFile1(null); setResults1(null); setFile2(null); setResults2(null); setError(null); };

    return (
        <div className="grid grid-cols-1 gap-8">
            {/* Step 1 */}
            <section className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl">
                <h2 className="text-xl font-semibold mb-4 text-slate-200 flex items-center gap-2">
                    <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                    Archivo de Comprobantes
                </h2>

                {!results1 ? (
                    <UploadUI file={file1} onDrop={(e) => handleDrop(e, 1)} onFileChange={(e) => handleFileInput(e, 1)} error={!file2 && error} label="Subir comprobantes (.txt)" />
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ResultCard title='Contiene "PES"' count={results1.conPes.length} color="green" onDownload={() => downloadFile(results1.conPes, 'comprobantes_con_pes.txt')} />
                            <ResultCard title='Sin "PES"' count={results1.sinPes.length} color="cyan" onDownload={() => downloadFile(results1.sinPes, 'comprobantes_sin_pes.txt')} />
                        </div>
                        <div className="flex justify-end"><button onClick={reset} className="text-sm text-slate-400 hover:text-white underline">Reiniciar todo</button></div>
                    </div>
                )}
                {!results1 && <button onClick={processFile1} disabled={!file1} className={`w-full mt-4 py-3 rounded-lg font-medium transition-all ${file1 ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-700 text-slate-500'}`}>Procesar Comprobantes</button>}
            </section>

            {/* Step 2 */}
            {results1 && (
                <section className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl animate-fade-in-up">
                    <h2 className="text-xl font-semibold mb-4 text-slate-200 flex items-center gap-2">
                        <span className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                        Archivo de Alícuotas (Cruce)
                    </h2>
                    <p className="text-slate-400 text-sm mb-4">Filtrar alícuotas que coincidan con los comprobantes "Sin PES".</p>

                    {!results2 ? (
                        <UploadUI file={file2} onDrop={(e) => handleDrop(e, 2)} onFileChange={(e) => handleFileInput(e, 2)} label="Subir alícuotas (.txt)" color="indigo" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                            <ResultCard title='Coincide con "Sin PES"' count={results2.matchSinPes.length} color="indigo" onDownload={() => downloadFile(results2.matchSinPes, 'alicuotas_match_sin_pes.txt')} />
                            <ResultCard title='No Coincide (Resto)' count={results2.noMatch.length} color="slate" onDownload={() => downloadFile(results2.noMatch, 'alicuotas_resto.txt')} />
                        </div>
                    )}
                    {!results2 && <button onClick={processFile2} disabled={!file2} className={`w-full mt-4 py-3 rounded-lg font-medium transition-all ${file2 ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-700 text-slate-500'}`}>Procesar Cruce</button>}
                </section>
            )}
        </div>
    );
}

// --- SUB-APP: IVA COMPARATOR ---
function IvaComparator() {
    const [protheusFile, setProtheusFile] = useState(null);
    const [arcaFile, setArcaFile] = useState(null);
    const [missingInProtheus, setMissingInProtheus] = useState(null);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleDrop = (e, type) => {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0], type);
    };

    const handleFile = (file, type) => {
        if (type === 'protheus' && (file.type === "text/xml" || file.name.endsWith('.xml') || file.name.endsWith('.xls'))) {
            setProtheusFile(file);
        } else if (type === 'arca') {
            setArcaFile(file); // Accept any for CSV/TXT
        } else {
            // Simple fallback validation
            if (type === 'protheus') setProtheusFile(null);
        }
        setError(null);
        setMissingInProtheus(null);
    };

    const processFiles = async () => {
        if (!protheusFile || !arcaFile) return;
        setIsProcessing(true);

        try {
            // 1. Process Protheus (XML)
            const protheusText = await readFile(protheusFile);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(protheusText, "text/xml");

            const protheusKeys = new Set();
            const rows = xmlDoc.getElementsByTagName("Row");

            // Helper to clean CUIT/Document
            const cleanCuit = (val) => val ? val.replace(/\D/g, '') : '';

            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].getElementsByTagName("Cell");
                let numero = null;
                let cuit = null;

                for (let j = 0; j < cells.length; j++) {
                    const index = cells[j].getAttribute("ss:Index");
                    const data = cells[j].getElementsByTagName("Data")[0];
                    if (!data) continue;

                    if (index === "9") { // NUMERO
                        numero = data.textContent.trim();
                    } else if (index === "4") { // Nº DOCUMENTO (CUIT)
                        cuit = cleanCuit(data.textContent.trim());
                    }
                }

                // If we have both, create a composite key
                if (numero && numero.length >= 8 && cuit) {
                    const key = `${cuit}-${numero}`;
                    protheusKeys.add(key);
                }
            }

            // 2. Process Arca (CSV)
            const arcaText = await readFile(arcaFile);
            const arcaLines = arcaText.split(/\r\n|\n/);
            const missing = [];

            for (let i = 1; i < arcaLines.length; i++) { // Skip header
                const line = arcaLines[i].trim();
                if (line) {
                    const cols = line.split(';');
                    // Arca cols: 0:Date, 1:Type, 2:POS, 3:Num, 7: CUIT Emisor
                    if (cols.length >= 8) {
                        const type = cols[1];
                        const pos = cols[2];
                        const num = cols[3];
                        const cuitEmisor = cleanCuit(cols[7]);

                        // PROCESS: Facturas + NC + ND
                        const validInvoiceTypes = [
                            '1', '6', '11', '51', '19',      // Facturas
                            '2', '7', '12', '52', '20',      // Notas de Débito
                            '3', '8', '13', '53', '21'       // Notas de Crédito
                        ];

                        if (validInvoiceTypes.includes(type) && pos && num && cuitEmisor) {
                            // Pad to match Protheus format: 4 digit POS + 8 digit Num
                            const paddedPos = pos.padStart(4, '0');
                            const paddedNum = num.padStart(8, '0');
                            const constructedNum = `${paddedPos}${paddedNum}`;
                            const constructedKey = `${cuitEmisor}-${constructedNum}`;

                            if (!protheusKeys.has(constructedKey)) {
                                missing.push(line);
                            }
                        }
                    }
                }
            }

            setMissingInProtheus(missing);

        } catch (err) {
            console.error(err);
            setError("Error al procesar los archivos. Verifica los formatos.");
        } finally {
            setIsProcessing(false);
        }
    };

    const readFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file); // Default encoding UTF-8
        });
    };

    const downloadResults = () => {
        if (!missingInProtheus) return;

        // AFIP CSV Headers for guidance
        const headers = [
            "Fecha de Emisión", "Tipo", "Punto de Venta", "Número", "Número Hasta",
            "Cód. Autorización", "Tipo Doc. Emisor", "Nro. Doc. Emisor", "Denominación Emisor"
        ].join('\t');

        // Convert semicolons to tabs for Excel compatibility
        const content = missingInProtheus.map(line => {
            return line.split(';').slice(0, 9).join('\t');
        }).join('\n');

        const finalContent = `${headers}\n${content}`;

        const blob = new Blob([finalContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'faltantes_en_protheus.xls';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6 text-slate-200">Comparación de IVA</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Protheus Input */}
                <div className="space-y-2">
                    <p className="text-slate-400 font-medium">1. Archivo Protheus (XML)</p>
                    <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => handleDrop(e, 'protheus')}
                        className={`
                      border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                      ${protheusFile ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/5'}
                    `}
                    >
                        <input type="file" accept=".xml,.xls" onChange={(e) => handleFile(e.target.files[0], 'protheus')} className="hidden" id="protheus-upload" />
                        <label htmlFor="protheus-upload" className="cursor-pointer">
                            <div className="flex flex-col items-center gap-2">
                                {protheusFile ? <CheckCircle2 className="text-green-500" /> : <UploadCloud className="text-indigo-500" />}
                                <span className="text-sm truncate max-w-[200px]">{protheusFile ? protheusFile.name : "Matriz (.xml)"}</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Arca Input */}
                <div className="space-y-2">
                    <p className="text-slate-400 font-medium">2. Archivo Arca (CSV)</p>
                    <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => handleDrop(e, 'arca')}
                        className={`
                      border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                      ${arcaFile ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/5'}
                    `}
                    >
                        <input type="file" accept=".csv,.txt" onChange={(e) => handleFile(e.target.files[0], 'arca')} className="hidden" id="arca-upload" />
                        <label htmlFor="arca-upload" className="cursor-pointer">
                            <div className="flex flex-col items-center gap-2">
                                {arcaFile ? <CheckCircle2 className="text-green-500" /> : <UploadCloud className="text-indigo-500" />}
                                <span className="text-sm truncate max-w-[200px]">{arcaFile ? arcaFile.name : "Reporte Arca (.csv)"}</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {error && <div className="mb-4 text-red-400 bg-red-400/10 p-3 rounded flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

            <button
                onClick={processFiles}
                disabled={!protheusFile || !arcaFile || isProcessing}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2
                ${(protheusFile && arcaFile) ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
            `}
            >
                {isProcessing ? <RefreshCw className="animate-spin" /> : <ArrowLeftRight />}
                Comparar Archivos
            </button>

            {missingInProtheus && (
                <div className="mt-8 animate-fade-in-up">
                    <div className="bg-slate-700/30 p-6 rounded-xl border border-red-500/20">
                        <h3 className="text-lg font-semibold text-white mb-2">Resultados</h3>
                        <p className="text-slate-400 mb-6">Se encontraron <strong className="text-red-400">{missingInProtheus.length}</strong> facturas en Arca que NO están en Protheus.</p>
                        <button
                            onClick={downloadResults}
                            className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <Download size={18} /> Descargar Faltantes
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// UI Helper
function UploadUI({ file, onDrop, onFileChange, error, label, color = "blue" }) {
    const borderColor = file ? 'border-green-500' : 'border-slate-600';
    const bgColor = file ? 'bg-green-500/10' : `hover:bg-${color}-500/5`;
    const iconColor = file ? 'text-green-500' : `text-${color}-500`;

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${borderColor} ${bgColor}`}
        >
            <input type="file" onChange={onFileChange} className="hidden" id={`upload-${label}`} />
            <label htmlFor={`upload-${label}`} className="cursor-pointer block">
                <div className="flex flex-col items-center gap-2">
                    {file ? <CheckCircle2 className={`w-10 h-10 ${iconColor}`} /> : <UploadCloud className={`w-10 h-10 ${iconColor}`} />}
                    <span className={file ? "text-green-400" : "text-slate-300"}>{file ? file.name : label}</span>
                </div>
            </label>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
    );
}

// Result Card Helper
function ResultCard({ title, count, color, onDownload }) {
    // Map simple color names to Tailwind classes manually for reliability
    const styles = {
        green: "bg-green-500/10 border-green-500/20 text-green-400",
        cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
        indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
        slate: "bg-slate-500/10 border-slate-500/20 text-slate-400",
    };
    return (
        <div className={`p-5 rounded-xl border transition-colors ${styles[color] || styles.slate}`}>
            <h3 className="font-semibold text-base mb-2">{title}</h3>
            <p className="text-2xl font-bold mb-4">{count}</p>
            <button onClick={onDownload} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center gap-2 text-sm transition-all">
                <Download size={16} /> Descargar
            </button>
        </div>
    );
}

export default App;

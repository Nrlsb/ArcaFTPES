import React, { useState } from 'react';
import { UploadCloud, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

function App() {
    // State for File 1 (Comprobantes)
    const [file1, setFile1] = useState(null);
    const [results1, setResults1] = useState(null);

    // State for File 2 (Alicuotas)
    const [file2, setFile2] = useState(null);
    const [results2, setResults2] = useState(null);

    const [error, setError] = useState(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e, fileNum) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            validateAndSetFile(files[0], fileNum);
        }
    };

    const handleFileInput = (e, fileNum) => {
        if (e.target.files.length > 0) {
            validateAndSetFile(e.target.files[0], fileNum);
        }
    };

    const validateAndSetFile = (file, fileNum) => {
        if (file.type === "text/plain") {
            if (fileNum === 1) {
                setFile1(file);
                setResults1(null); // Reset results if file changes
                setFile2(null);    // Reset file 2 dependent chain
                setResults2(null);
            } else {
                setFile2(file);
                setResults2(null);
            }
            setError(null);
        } else {
            setError("Por favor, sube un archivo de texto (.txt)");
        }
    };

    // Extract key from Comprobantes (File 1): Pos 8 to 36
    const getKeyFile1 = (line) => line.substring(8, 36);

    // Extract key from Alicuotas (File 2): Pos 0 to 28
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
                        // Store key for future cross-referencing
                        // Only if line is long enough to have valid structural data
                        if (line.length >= 36) {
                            sinPesKeys.add(getKeyFile1(line));
                        }
                    }
                }
            });

            setResults1({
                conPes,
                sinPes,
                sinPesKeys // Pass this set for File 2 processing
            });
        };
        reader.onerror = () => setError("Error al leer el archivo de comprobantes");
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
                        if (results1.sinPesKeys.has(key)) {
                            matchSinPes.push(line);
                        } else {
                            noMatch.push(line);
                        }
                    } else {
                        noMatch.push(line);
                    }
                }
            });

            setResults2({
                matchSinPes,
                noMatch
            });
        };
        reader.onerror = () => setError("Error al leer el archivo de alícuotas");
        reader.readAsText(file2);
    };

    const downloadFile = (contentArray, filename) => {
        const content = contentArray.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const resetApp = () => {
        setFile1(null);
        setResults1(null);
        setFile2(null);
        setResults2(null);
        setError(null);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800 font-sans">
            <div className="w-full max-w-4xl">

                {/* Header */}
                <header className="mb-8 text-center animate-fade-in-down">
                    <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                        Filtro Avanzado de Facturas
                    </h1>
                    <p className="text-slate-400">Proceso de filtrado y cruce de alícuotas</p>
                </header>

                <div className="grid grid-cols-1 gap-8">
                    {/* STEP 1: Main File */}
                    <section className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4 text-slate-200 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                            Archivo de Comprobantes
                        </h2>

                        {!results1 ? (
                            <div className="space-y-4">
                                <div
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, 1)}
                                    className={`
                    border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer
                    ${file1 ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-blue-500 hover:bg-blue-500/5'}
                  `}
                                >
                                    <input
                                        type="file"
                                        accept=".txt"
                                        onChange={(e) => handleFileInput(e, 1)}
                                        className="hidden"
                                        id="file1-upload"
                                    />
                                    <label htmlFor="file1-upload" className="cursor-pointer block h-full w-full">
                                        <div className="flex flex-col items-center gap-2">
                                            {file1 ? <CheckCircle2 className="w-10 h-10 text-green-500" /> : <UploadCloud className="w-10 h-10 text-blue-500" />}
                                            <span className={file1 ? "text-green-400" : "text-slate-300"}>
                                                {file1 ? file1.name : "Subir comprobantes (.txt)"}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                                <button
                                    onClick={processFile1}
                                    disabled={!file1}
                                    className={`w-full py-3 rounded-lg font-medium transition-all ${file1 ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-700 text-slate-500'}`}
                                >
                                    Procesar Comprobantes
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Result Cards 1 */}
                                    <ResultCard
                                        title='Contiene "PES"'
                                        count={results1.conPes.length}
                                        color="green"
                                        onDownload={() => downloadFile(results1.conPes, 'comprobantes_con_pes.txt')}
                                    />
                                    <ResultCard
                                        title='Sin "PES"'
                                        count={results1.sinPes.length}
                                        color="cyan"
                                        onDownload={() => downloadFile(results1.sinPes, 'comprobantes_sin_pes.txt')}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={resetApp} className="text-sm text-slate-400 hover:text-white underline">Reiniciar todo</button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* STEP 2: Alicia File (Only visible after Step 1 done) */}
                    {results1 && (
                        <section className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl animate-fade-in-up">
                            <h2 className="text-xl font-semibold mb-4 text-slate-200 flex items-center gap-2">
                                <span className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                                Archivo de Alícuotas (Cruce)
                            </h2>
                            <p className="text-slate-400 text-sm mb-4">
                                Se filtrará este archivo buscando coincidencias con los <strong>{results1.sinPes.length}</strong> comprobantes "Sin PES" detectados.
                            </p>

                            {!results2 ? (
                                <div className="space-y-4">
                                    <div
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, 2)}
                                        className={`
                      border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer
                      ${file2 ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/5'}
                    `}
                                    >
                                        <input
                                            type="file"
                                            accept=".txt"
                                            onChange={(e) => handleFileInput(e, 2)}
                                            className="hidden"
                                            id="file2-upload"
                                        />
                                        <label htmlFor="file2-upload" className="cursor-pointer block h-full w-full">
                                            <div className="flex flex-col items-center gap-2">
                                                {file2 ? <CheckCircle2 className="w-10 h-10 text-green-500" /> : <UploadCloud className="w-10 h-10 text-indigo-500" />}
                                                <span className={file2 ? "text-green-400" : "text-slate-300"}>
                                                    {file2 ? file2.name : "Subir alícuotas (.txt)"}
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                    <button
                                        onClick={processFile2}
                                        disabled={!file2}
                                        className={`w-full py-3 rounded-lg font-medium transition-all ${file2 ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-700 text-slate-500'}`}
                                    >
                                        Procesar Cruce
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ResultCard
                                            title='Coincide con "Sin PES"'
                                            count={results2.matchSinPes.length}
                                            color="indigo"
                                            onDownload={() => downloadFile(results2.matchSinPes, 'alicuotas_match_sin_pes.txt')}
                                        />
                                        <ResultCard
                                            title='No Coincide (Resto)'
                                            count={results2.noMatch.length}
                                            color="slate"
                                            onDownload={() => downloadFile(results2.noMatch, 'alicuotas_resto.txt')}
                                        />
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-4 rounded-lg">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

// Helper Component for consistent cards
function ResultCard({ title, count, color, onDownload }) {
    const colorClasses = {
        green: "bg-green-500 shadow-green-500/50 text-green-400 border-green-500/20 hover:bg-green-600/30",
        cyan: "bg-cyan-500 shadow-cyan-500/50 text-cyan-400 border-cyan-500/20 hover:bg-cyan-600/30",
        indigo: "bg-indigo-500 shadow-indigo-500/50 text-indigo-400 border-indigo-500/20 hover:bg-indigo-600/30",
        slate: "bg-slate-500 shadow-slate-500/50 text-slate-300 border-slate-500/20 hover:bg-slate-600/30",
        red: "bg-red-500 shadow-red-500/50 text-red-400 border-red-500/20 hover:bg-red-600/30",
    };

    const btnClasses = {
        green: "bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-500/20",
        cyan: "bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border-cyan-500/20",
        indigo: "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border-indigo-500/20",
        slate: "bg-slate-600/20 hover:bg-slate-600/30 text-slate-300 border-slate-500/20",
        red: "bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/20",
    };

    return (
        <div className={`bg-slate-700/30 p-5 rounded-xl border transition-colors group ${colorClasses[color].split(' ').pop()}`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-2 h-2 rounded-full ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]}`}></div>
                <h3 className="font-semibold text-base text-slate-200">{title}</h3>
            </div>
            <p className="text-2xl font-bold text-white mb-4">{count} <span className="text-xs font-normal text-slate-400">regs</span></p>
            <button
                onClick={onDownload}
                className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all font-medium border text-sm ${btnClasses[color]}`}
            >
                <Download size={16} /> Descargar
            </button>
        </div>
    )
}

export default App;

import React, { useState } from 'react';
import { UploadCloud, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, ListFilter, ArrowLeftRight, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

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
                        Comp. Simple
                    </button>
                    <button
                        onClick={() => setActiveTab('mensual')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'mensual' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <Calendar size={18} />
                        Comp. Mensual
                    </button>
                </div>

                {/* Content */}
                <div className="animate-fade-in">
                    {activeTab === 'pes' && <PesFilter />}
                    {activeTab === 'iva' && <IvaComparator />}
                    {activeTab === 'mensual' && <MonthlyComparator />}
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

// --- SUB-APP: MONTHLY COMPARATOR ---
function MonthlyComparator() {
    const [protheusFile, setProtheusFile] = useState(null);
    const [arcaFile, setArcaFile] = useState(null);
    const [stats, setStats] = useState(null);
    const [generatedCsv, setGeneratedCsv] = useState(null);
    const [generatedDiffCsv, setGeneratedDiffCsv] = useState(null);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Filtros
    const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
    const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());

    const handleDrop = (e, type) => {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0], type);
    };

    const handleFile = (file, type) => {
        if (type === 'protheus' && (file.type === "text/xml" || file.name.endsWith('.xml') || file.name.endsWith('.xls'))) {
            setProtheusFile(file);
        } else if (type === 'arca') {
            setArcaFile(file);
        }
        setError(null);
        setStats(null);
    };

    const normalizeDate = (dateStr) => {
        if (!dateStr) return null;
        // Soportar YYYY-MM-DD y DD/MM/YYYY
        let dia, mes, anio;
        if (dateStr.includes('-')) {
            [anio, mes, dia] = dateStr.split('-');
        } else if (dateStr.includes('/')) {
            [dia, mes, anio] = dateStr.split('/');
        } else {
            return null;
        }
        return {
            dia: parseInt(dia),
            mes: parseInt(mes),
            anio: parseInt(anio)
        };
    };

    const isDateInPeriod = (dateStr) => {
        const d = normalizeDate(dateStr);
        if (!d) return false;
        return d.mes === parseInt(mesFiltro) && d.anio === parseInt(anioFiltro);
    };

    const parseAfipNumber = (val) => {
        if (!val) return 0.0;
        // 27.685,95 -> 27685.95
        return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0.0;
    };

    const readFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const processFiles = async () => {
        if (!protheusFile || !arcaFile) return;
        setIsProcessing(true);
        setStats(null);

        try {
            // 1. Process AFIP (CSV)
            const afipText = await readFile(arcaFile);
            const afipLines = afipText.split(/\r\n|\n/);
            const afipMap = new Map();
            let afipTotal = 0;
            let afipFiltered = 0;

            // Headers usually in line 0
            const afipHeaders = afipLines[0].split(';');
            // Mapping simplistic based on known indices or name
            // Assuming standard format as per user script: 
            // 0:Fecha, 1:Tipo, 2:PtoVta, 3:Num, 7:DocEmisor, 8:Denom, ... 14:Total, 11:IVA (variable)
            // Lets stick to column index logic from script for reliability if headers match

            for (let i = 1; i < afipLines.length; i++) {
                const line = afipLines[i].trim();
                if (!line) continue;
                afipTotal++;

                // Parse CSV correctly handling quotes is hard manually, but we try basic split for now
                // or use a regex for semi-colon split.
                const cols = line.split(';');

                // Using CSV Header names from script logic:
                // We need indices. Let's try to map dynamically or hardcode based on user script
                // Script uses: 'Fecha de Emisión', 'Nro. Doc. Emisor', 'Punto de Venta', 'Número Desde', 'Imp. Total', 'Total IVA'
                // This implies we should find indices.

                const getCol = (name) => {
                    const idx = afipHeaders.findIndex(h => h.includes(name));
                    return idx > -1 ? cols[idx] : '';
                };

                const fecha = getCol('Fecha');
                if (!isDateInPeriod(fecha)) continue;
                afipFiltered++;

                const cuit = (getCol('Nro. Doc') || '').replace(/\./g, '');
                const ptoVta = (getCol('Punto de Venta') || '').padStart(4, '0');
                const numero = (getCol('Número Desde') || '').padStart(8, '0');
                const uniqueId = `${cuit}${ptoVta}${numero}`;

                const total = parseAfipNumber(getCol('Imp. Total'));
                const iva = parseAfipNumber(getCol('Total IVA')); // Might need adjustment if header differs

                afipMap.set(uniqueId, {
                    fecha,
                    emisor: getCol('Denominación') || '',
                    iva,
                    total,
                    cuit,
                    uniqueId
                });
            }

            // 2. Process Protheus (XML)
            const protheusText = await readFile(protheusFile);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(protheusText, "text/xml");
            const rows = xmlDoc.getElementsByTagName("Row");

            let protTotal = 0;
            let protFiltered = 0;
            const comparisonList = [];

            // Skip headers (approx first 1-2 rows)
            // We iterate all and check for data
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].getElementsByTagName("Cell");
                let rowData = {};
                let hasData = false;

                // Extract data efficiently
                for (let j = 0; j < cells.length; j++) {
                    const indexAttr = cells[j].getAttribute("ss:Index");
                    const index = indexAttr ? parseInt(indexAttr) - 1 : j; // 0-based for array logic
                    const dataNode = cells[j].getElementsByTagName("Data")[0];
                    if (dataNode) {
                        const val = dataNode.textContent.trim();
                        // Map based on expected columns from script
                        // Script: Headers found dynamically. Here let's guess standard layout or use fixed index?
                        // Script mapped headers. Let's assume standard layout.
                        // based on previous IvaComparator:
                        // 2: Denominacion, 4: CUIT, 6: Fecha, 9: Numero, 11: Total
                        // Let's add IVA. Assuming it is around Total.
                        // We will check header row first? simpler to hardcode if file format is stable.
                        // User script: 'CODIGO', 'DENOMINACION', 'Nº DOCUMENTO', 'FECHA', 'NUMERO', 'TOTAL', 'IVA'

                        // Let's rely on column names if possible.
                        // Implementing simple column finder:
                        if (val === 'FECHA') { /* Header row detected */ }
                    }
                }
            }

            // RE-STRATEGY for XML:
            // Convert XML to Array of Objects first
            const cleanRows = [];
            let headers = [];
            let headerIndex = -1;

            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].getElementsByTagName("Cell");
                let rowVals = [];
                let currentIdx = 0;

                for (let j = 0; j < cells.length; j++) {
                    const indexAttr = cells[j].getAttribute("ss:Index");
                    const targetIdx = indexAttr ? parseInt(indexAttr) - 1 : currentIdx;
                    while (rowVals.length < targetIdx) rowVals.push('');

                    const data = cells[j].getElementsByTagName("Data")[0];
                    rowVals.push(data ? data.textContent.trim() : '');
                    currentIdx = rowVals.length;
                }
                cleanRows.push(rowVals);
            }

            // Find header
            for (let i = 0; i < cleanRows.length; i++) {
                if (cleanRows[i].includes('Nº DOCUMENTO') || cleanRows[i].includes('DENOMINACION')) {
                    headers = cleanRows[i];
                    headerIndex = i;
                    break;
                }
            }

            if (headerIndex === -1) throw new Error("No se encontró cabecera en Protheus XML");

            // Parse Data
            for (let i = headerIndex + 1; i < cleanRows.length; i++) {
                const r = cleanRows[i];
                if (r.length === 0) continue;

                const getVal = (name) => {
                    const idx = headers.indexOf(name);
                    return idx > -1 ? r[idx] : '';
                };

                const fechaProbable = getVal('FECHA');
                // Try to find correct 'FECHA' column if multiple
                // Actually relying on exact name from XML file is safer.

                // Check if it is a data row
                if (!fechaProbable) continue;
                protTotal++;

                if (!isDateInPeriod(fechaProbable)) continue;
                protFiltered++;

                const cuit = getVal('Nº DOCUMENTO').replace(/-/g, '').trim();
                const numero = getVal('NUMERO').trim(); // Ensure we get the number
                const uniqueId = `${cuit}${numero}`;
                const total = parseFloat(getVal('TOTAL')) || 0;
                const iva = parseFloat(getVal('IVA')) || 0; // Check if 'IVA' column exists in your XML!
                const den = getVal('DENOMINACION');

                // Match
                let estado = 'SOLO EN PROTHEUS';
                let afipData = { total: 0, iva: 0, fecha: '', emisor: '' };

                if (afipMap.has(uniqueId)) {
                    estado = 'UNIDO';
                    afipData = afipMap.get(uniqueId);
                    afipMap.delete(uniqueId);
                }

                comparisonList.push({
                    id: uniqueId,
                    estado,
                    emisor: den || afipData.emisor,
                    cuit,
                    fecha_prot: fechaProbable,
                    fecha_afip: afipData.fecha,
                    iva_prot: iva,
                    iva_afip: afipData.iva,
                    total_prot: total,
                    total_afip: afipData.total,
                    dif_iva: iva - afipData.iva,
                    dif_total: total - afipData.total
                });
            }

            // Add remaining AFIP
            afipMap.forEach((val, key) => {
                comparisonList.push({
                    id: key,
                    estado: 'SOLO EN AFIP',
                    emisor: val.emisor,
                    cuit: val.cuit,
                    fecha_prot: '',
                    fecha_afip: val.fecha,
                    iva_prot: 0,
                    iva_afip: val.iva,
                    total_prot: 0,
                    total_afip: val.total,
                    dif_iva: 0 - val.iva,
                    dif_total: 0 - val.total
                });
            });

            // Generate CSV Content
            const csvHeader = 'ID;ESTADO;CUIT;EMISOR;FECHA_PROTHEUS;FECHA_AFIP;IVA_PROT;IVA_AFIP;DIF_IVA;TOTAL_PROT;TOTAL_AFIP;DIF_TOTAL';
            const csvRows = [csvHeader];
            const diffRows = [csvHeader];
            let diffCount = 0;

            comparisonList.forEach(item => {
                const formatNum = (n) => n.toFixed(2).replace('.', ',');
                const line = [
                    item.id, item.estado, item.cuit, `"${item.emisor}"`,
                    item.fecha_prot, item.fecha_afip,
                    formatNum(item.iva_prot), formatNum(item.iva_afip), formatNum(item.dif_iva),
                    formatNum(item.total_prot), formatNum(item.total_afip), formatNum(item.dif_total)
                ].join(';');

                csvRows.push(line);
                if (item.estado !== 'UNIDO' || Math.abs(item.dif_iva) > 0.05 || Math.abs(item.dif_total) > 0.05) {
                    diffRows.push(line);
                    diffCount++;
                }
            });

            setGeneratedCsv(csvRows.join('\n'));
            setGeneratedDiffCsv(diffRows.join('\n'));
            setStats({
                total: comparisonList.length,
                diffs: diffCount,
                matched: comparisonList.length - diffCount,
                afipCount: afipFiltered,
                protCount: protFiltered
            });

        } catch (err) {
            console.error(err);
            setError("Error al procesar: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadCsv = (content, name) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-slate-200">Comparativo Mensual</h2>
                <div className="flex gap-4 items-center bg-slate-700/30 p-2 rounded-lg border border-slate-600">
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-400">Mes</label>
                        <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="bg-transparent text-white border-none outline-none font-bold">
                            {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-400">Año</label>
                        <input type="number" value={anioFiltro} onChange={e => setAnioFiltro(e.target.value)} className="bg-transparent text-white w-20 border-none outline-none font-bold" />
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                    <p className="text-slate-400 font-medium">1. Archivo Protheus (XML)</p>
                    <UploadUI file={protheusFile} onDrop={(e) => handleDrop(e, 'protheus')} onFileChange={(e) => handleFile(e.target.files[0], 'protheus')} label="Matriz (.xml)" color="violet" />
                </div>
                <div className="space-y-2">
                    <p className="text-slate-400 font-medium">2. Archivo Arca (CSV)</p>
                    <UploadUI file={arcaFile} onDrop={(e) => handleDrop(e, 'arca')} onFileChange={(e) => handleFile(e.target.files[0], 'arca')} label="Reporte Arca (.csv)" color="violet" />
                </div>
            </div>

            {error && <div className="mb-4 text-red-400 bg-red-400/10 p-3 rounded flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

            <button
                onClick={processFiles}
                disabled={!protheusFile || !arcaFile || isProcessing}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2
                ${(protheusFile && arcaFile) ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
            `}
            >
                {isProcessing ? <RefreshCw className="animate-spin" /> : <Calendar />}
                Generar Comparativo {mesFiltro}/{anioFiltro}
            </button>

            {stats && (
                <div className="mt-8 animate-fade-in-up space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600 text-center">
                            <div className="text-slate-400 text-sm">Registros Protheus</div>
                            <div className="text-2xl font-bold text-white">{stats.protCount}</div>
                        </div>
                        <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600 text-center">
                            <div className="text-slate-400 text-sm">Registros Arca</div>
                            <div className="text-2xl font-bold text-white">{stats.afipCount}</div>
                        </div>
                        <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600 text-center">
                            <div className="text-slate-400 text-sm">Discrepancias</div>
                            <div className="text-2xl font-bold text-red-400">{stats.diffs}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => downloadCsv(generatedCsv, `Comparativo_${mesFiltro}_${anioFiltro}.csv`)}
                            className="p-4 bg-green-600/20 text-green-400 border border-green-500/30 rounded-xl hover:bg-green-600/30 transition-all flex items-center justify-center gap-2 font-semibold">
                            <Download size={20} /> Descargar Reporte Completo
                        </button>
                        <button
                            onClick={() => downloadCsv(generatedDiffCsv, `Diferencias_${mesFiltro}_${anioFiltro}.csv`)}
                            className="p-4 bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-600/30 transition-all flex items-center justify-center gap-2 font-semibold">
                            <AlertCircle size={20} /> Descargar Solo Diferencias
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- SUB-APP: IVA COMPARATOR ---
function IvaComparator() {
    const [protheusFile, setProtheusFile] = useState(null);
    const [arcaFile, setArcaFile] = useState(null);
    const [missingInProtheus, setMissingInProtheus] = useState(null);
    const [missingInArca, setMissingInArca] = useState(null);
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
        setMissingInArca(null);
    };

    const processFiles = async () => {
        if (!protheusFile || !arcaFile) return;
        setIsProcessing(true);

        try {
            // 1. Process Protheus (XML)
            const protheusText = await readFile(protheusFile);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(protheusText, "text/xml");

            const protheusMap = new Map();
            const rows = xmlDoc.getElementsByTagName("Row");

            // Helper to clean CUIT/Document
            const cleanCuit = (val) => val ? val.replace(/\D/g, '') : '';

            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].getElementsByTagName("Cell");
                let numero = null;
                let cuit = null;
                let denominacion = '';
                let fecha = '';
                let total = '';
                let colIndex = 0;

                for (let j = 0; j < cells.length; j++) {
                    const indexAttr = cells[j].getAttribute("ss:Index");
                    if (indexAttr) {
                        colIndex = parseInt(indexAttr, 10);
                    } else {
                        colIndex++;
                    }

                    const data = cells[j].getElementsByTagName("Data")[0];
                    if (!data) continue;
                    const val = data.textContent.trim();

                    if (colIndex === 9) { // NUMERO
                        numero = val;
                    } else if (colIndex === 4) { // Nº DOCUMENTO (CUIT)
                        cuit = cleanCuit(val);
                    } else if (colIndex === 2) { // DENOMINACION
                        denominacion = val;
                    } else if (colIndex === 6) { // FECHA
                        fecha = val;
                    } else if (colIndex === 11) { // TOTAL
                        total = val;
                    }
                }

                // If we have both, create a composite key
                if (numero && numero.length >= 8 && cuit) {
                    const key = `${cuit}-${numero}`;
                    protheusMap.set(key, { cuit, numero, denominacion, fecha, total });
                }
            }

            // 2. Process Arca (CSV)
            const arcaText = await readFile(arcaFile);
            const arcaLines = arcaText.split(/\r\n|\n/);
            const missing = []; // In Arca but NOT in Protheus

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

                            if (protheusMap.has(constructedKey)) {
                                protheusMap.delete(constructedKey); // Match found, remove from map
                            } else {
                                missing.push(line);
                            }
                        }
                    }
                }
            }

            setMissingInProtheus(missing);
            setMissingInArca(Array.from(protheusMap.values()));

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

    const downloadMissingInProtheus = () => {
        if (!missingInProtheus) return;

        // Prepare data for XLSX
        const headers = [
            "Fecha de Emisión", "Tipo", "Punto de Venta", "Número", "Número Hasta",
            "Cód. Autorización", "Tipo Doc. Emisor", "Nro. Doc. Emisor", "Denominación Emisor"
        ];

        // Parse semi-colon separated strings into arrays
        const dataRows = missingInProtheus.map(line => {
            const cols = line.split(';');
            // Take first 9 columns as per original logic, map/clean if necessary
            // Original: line.split(';').slice(0, 9).join('\t')
            return cols.slice(0, 9);
        });

        // Add headers to the beginning
        const wsData = [headers, ...dataRows];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Faltan en Protheus");

        XLSX.writeFile(wb, "faltantes_en_protheus.xlsx");
    };

    const downloadMissingInArca = () => {
        if (!missingInArca) return;

        // Prepare data objects
        const data = missingInArca.map(item => ({
            "CUIT": item.cuit,
            "Número": item.numero,
            "Fecha": item.fecha,
            "Denominación": item.denominacion,
            "Total": item.total
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Faltan en Arca");

        XLSX.writeFile(wb, "sobrantes_protheus_faltan_isca.xlsx");
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
                    <div className="mt-8 animate-fade-in-up grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Faltan en Protheus */}
                        <div className="bg-slate-700/30 p-6 rounded-xl border border-red-500/20">
                            <h3 className="text-lg font-semibold text-white mb-2">Faltan en Protheus</h3>
                            <p className="text-slate-400 mb-6 text-sm">Están en Arca pero <strong className="text-red-400">NO</strong> en el sistema.</p>
                            <div className="text-4xl font-bold text-red-400 mb-6 text-center">{missingInProtheus.length}</div>
                            <button
                                onClick={downloadMissingInProtheus}
                                className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg font-medium flex items-center justify-center gap-2"
                            >
                                <Download size={18} /> Descargar Lista
                            </button>
                        </div>

                        {/* Faltan en Arca */}
                        <div className="bg-slate-700/30 p-6 rounded-xl border border-yellow-500/20">
                            <h3 className="text-lg font-semibold text-white mb-2">Faltan en Arca</h3>
                            <p className="text-slate-400 mb-6 text-sm">Están en Protheus pero <strong className="text-yellow-400">NO</strong> en AFIP.</p>
                            <div className="text-4xl font-bold text-yellow-400 mb-6 text-center">{missingInArca.length}</div>
                            <button
                                onClick={downloadMissingInArca}
                                className="w-full py-3 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/30 rounded-lg font-medium flex items-center justify-center gap-2"
                            >
                                <Download size={18} /> Descargar Lista
                            </button>
                        </div>
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

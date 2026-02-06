/**
 * Nombre del archivo: generar_comparativo_mensual.js
 * Descripción: Script CORREGIDO para conciliar archivos de IVA.
 * CORRECCIONES:
 * 1. Convierte los importes de Protheus a positivo (valor absoluto).
 * 2. Filtra correctamente el archivo de Diferencias.
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const xml2js = require('xml2js');

// --- CONFIGURACIÓN ---
const FILE_AFIP = '11 - AFIP IVA Noviembre 2025.csv';
const FILE_PROTHEUS = 'matrar2b.xml';

const FILE_OUTPUT_GENERAL = 'Comparativo_Noviembre_2025.csv';
const FILE_OUTPUT_DIFERENCIAS = 'Facturas_Sin_Cruce_Noviembre.csv';
const FILE_OUTPUT_SOLO_AFIP = 'Solo_AFIP_Noviembre.csv';
const FILE_OUTPUT_SOLO_PROTHEUS = 'Solo_Protheus_Noviembre.csv';

// --- FILTRO POR DEFECTO ---
const MES_FILTRO = 11;
const ANIO_FILTRO = 2025;

/**
 * Función Principal
 */
async function generarReporte(mesFiltro, anioFiltro) {
    if (!mesFiltro || !anioFiltro) throw new Error("Mes y Año requeridos");
    console.log(`--- Procesando: Mes ${mesFiltro} / Año ${anioFiltro} ---`);

    // Helper: Validar fecha
    const esFechaDelPeriodo = (fechaRaw) => {
        if (!fechaRaw) return false;
        const fechaStr = String(fechaRaw);

        let mes, anio;
        if (fechaStr.includes('-')) { // AFIP YYYY-MM-DD
            const p = fechaStr.split('-');
            anio = parseInt(p[0]); mes = parseInt(p[1]);
        } else if (fechaStr.includes('/')) { // Prot DD/MM/YYYY
            const p = fechaStr.split('/');
            mes = parseInt(p[1]); anio = parseInt(p[2]);
        } else return false;

        return mes === mesFiltro && anio === anioFiltro;
    };

    // 1. LEER AFIP
    const afipRaw = fs.readFileSync(FILE_AFIP, 'utf-8');
    const afipRecords = parse(afipRaw, { delimiter: ';', columns: true, relax_quotes: true });

    const afipMap = new Map();
    afipRecords.forEach(rec => {
        if (!esFechaDelPeriodo(rec['Fecha de Emisión'])) return;

        // Clave: CUIT + PTO + NUM
        const id = rec['Nro. Doc. Emisor'].replace(/\./g, '') +
            rec['Punto de Venta'].padStart(4, '0') +
            rec['Número Desde'].padStart(8, '0');

        afipMap.set(id, {
            fecha: rec['Fecha de Emisión'],
            emisor: rec['Denominación Emisor'],
            iva: parseNum(rec['Total IVA']),
            total: parseNum(rec['Imp. Total']), // AFIP ya es positivo
            cuit: rec['Nro. Doc. Emisor'].replace(/\./g, '')
        });
    });

    // 2. LEER PROTHEUS
    const protheusRecords = await parseProtheusXML(FILE_PROTHEUS);
    const comparisonMap = new Map();

    // 3. CRUCE
    protheusRecords.forEach(prot => {
        if (!esFechaDelPeriodo(prot['FECHA'])) return;

        const cuit = (prot['Nº DOCUMENTO'] || '').replace(/-/g, '').trim();
        const num = (prot['NUMERO'] || '').trim();
        const id = cuit + num;

        // CORRECCIÓN DE SIGNO: Usamos Math.abs() para ignorar el negativo de Protheus
        const totalProt = Math.abs(parseFloat(prot['TOTAL']) || 0.0);
        const ivaProt = Math.abs(parseFloat(prot['IVA']) || 0.0);

        const afipMatch = afipMap.get(id);

        let estadoCruce = 'SOLO PROTHEUS';
        let validacionMontos = '-';
        let afipData = { total: 0, iva: 0, fecha: '', emisor: '' };

        if (afipMatch) {
            estadoCruce = 'AMBOS';
            afipData = afipMatch;
            afipMap.delete(id);
        }

        // Calculamos diferencia
        const difTotal = Number((totalProt - afipData.total).toFixed(2));
        const difIva = Number((ivaProt - afipData.iva).toFixed(2));

        // Validación de montos solo si hay cruce
        if (estadoCruce === 'AMBOS') {
            const esDiferenciaReal = Math.abs(difTotal) > 0.05 || Math.abs(difIva) > 0.05;
            validacionMontos = esDiferenciaReal ? 'DIFERENCIA' : 'OK';
        }

        comparisonMap.set(id, {
            id,
            estado_cruce: estadoCruce,
            validacion_montos: validacionMontos,
            cuit: cuit,
            emisor: prot['DENOMINACION'] || afipData.emisor,
            fecha_prot: prot['FECHA'],
            fecha_afip: afipData.fecha,
            iva_prot: ivaProt,
            iva_afip: afipData.iva,
            dif_iva: difIva,
            total_prot: totalProt,
            total_afip: afipData.total,
            dif_total: difTotal
        });
    });

    // 4. AGREGAR RESTO DE AFIP
    afipMap.forEach((afipData, id) => {
        comparisonMap.set(id, {
            id,
            estado_cruce: 'SOLO AFIP',
            validacion_montos: '-',
            cuit: afipData.cuit, emisor: afipData.emisor,
            fecha_prot: '', fecha_afip: afipData.fecha,
            iva_prot: 0, iva_afip: afipData.iva,
            total_prot: 0, total_afip: afipData.total,
            dif_iva: 0 - afipData.iva,
            dif_total: 0 - afipData.total
        });
    });

    return Array.from(comparisonMap.values());
}

// Helper numérico
function parseNum(val) {
    if (!val) return 0.0;
    return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0.0;
}

// Helper XML (Igual que antes)
async function parseProtheusXML(filePath) {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser();
    const res = await parser.parseStringPromise(xmlContent);

    // Buscar en todas las hojas de trabajo
    const sheets = res['Workbook']['Worksheet'] || [];
    let targetRows = null;
    let headIdx = -1, headers = [];

    for (const sheet of sheets) {
        if (!sheet['Table'] || !sheet['Table'][0]['Row']) continue;
        const rows = sheet['Table'][0]['Row'];

        // Convertir filas a matriz para buscar cabecera
        const matrix = rows.map(r => {
            if (!r['Cell']) return [];
            let rowData = [];
            r['Cell'].forEach(c => {
                let idx = c['$'] && c['$']['ss:Index'] ? parseInt(c['$']['ss:Index']) - 1 : rowData.length;
                while (rowData.length < idx) rowData.push('');
                let val = '';
                if (c['Data']) val = c['Data'][0]['_'] || c['Data'][0];
                rowData.push(val);
            });
            return rowData;
        });

        // Buscar cabecera en esta hoja
        for (let i = 0; i < matrix.length; i++) {
            if (matrix[i].includes('CODIGO') && matrix[i].includes('DENOMINACION')) {
                headIdx = i;
                headers = matrix[i];
                targetRows = matrix; // Encontramos la hoja correcta
                break;
            }
        }

        if (targetRows) break; // Terminar si encontramos
    }

    if (!targetRows) throw new Error("No se encontró la hoja con 'CODIGO' y 'DENOMINACION' en el XML");

    return targetRows.slice(headIdx + 1).map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = row[i] || '');
        return obj;
    });
}

const XLSX = require('xlsx');

// --- CONFIGURACIÓN DE SALIDA ---
const FILE_OUTPUT_EXCEL = `Reporte_Comparativo_${MES_FILTRO}_${ANIO_FILTRO}.xlsx`;

// ... (rest of the file remains, upgrading main function)

// Función para exportar a Excel
function exportToExcel(data, diferencias, soloAfip, soloProtheus) {
    const wb = XLSX.utils.book_new();

    // Helper para crear hoja
    const createSheet = (name, arrData) => {
        if (!arrData.length) return;
        const ws = XLSX.utils.json_to_sheet(arrData.map(i => ({
            ID: i.id,
            Estado: i.estado_cruce,
            Validacion: i.validacion_montos,
            CUIT: i.cuit,
            Emisor: i.emisor,
            Fecha_Prot: i.fecha_prot,
            Fecha_AFIP: i.fecha_afip,
            IVA_Prot: i.iva_prot,
            IVA_AFIP: i.iva_afip,
            Dif_IVA: i.dif_iva,
            Total_Prot: i.total_prot,
            Total_AFIP: i.total_afip,
            Dif_Total: i.dif_total
        })));

        // Ajustar ancho de columnas básico
        const wscols = [
            { wch: 20 }, // ID
            { wch: 15 }, // Estado
            { wch: 15 }, // Validacion
            { wch: 15 }, // CUIT
            { wch: 30 }, // Emisor
            { wch: 12 }, // Fecha P
            { wch: 12 }, // Fecha A
            { wch: 10 }, // IVA P
            { wch: 10 }, // IVA A
            { wch: 10 }, // Dif IVA
            { wch: 10 }, // Total P
            { wch: 10 }, // Total A
            { wch: 10 }  // Dif Total
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, name);
    };

    createSheet("General", data);
    createSheet("Diferencias", diferencias);
    createSheet("Solo AFIP", soloAfip);
    createSheet("Solo Protheus", soloProtheus);

    XLSX.writeFile(wb, FILE_OUTPUT_EXCEL);
    console.log(`\n Archivo Excel generado: ${FILE_OUTPUT_EXCEL}`);
}

// Ejecución directa
async function main() {
    try {
        const data = await generarReporte(MES_FILTRO, ANIO_FILTRO);

        // Filtrar subconjuntos
        const diferencias = data.filter(d => d.estado_cruce !== 'AMBOS' || d.validacion_montos === 'DIFERENCIA');
        const soloAfip = data.filter(d => d.estado_cruce === 'SOLO AFIP');
        const soloProtheus = data.filter(d => d.estado_cruce === 'SOLO PROTHEUS');

        console.log("Generando reporte Excel...");
        exportToExcel(data, diferencias, soloAfip, soloProtheus);

        console.log(`\n Resumen:`);
        console.log(` - Total registros: ${data.length}`);
        console.log(` - Diferencias: ${diferencias.length}`);
        console.log(` - Solo AFIP: ${soloAfip.length}`);
        console.log(` - Solo Protheus: ${soloProtheus.length}`);

    } catch (error) {
        console.error("ERROR FATAL:", error.message);
    }
}

module.exports = { generarReporte };
if (require.main === module) main();
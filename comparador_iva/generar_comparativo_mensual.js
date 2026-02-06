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
    const esFechaDelPeriodo = (fechaStr) => {
        if (!fechaStr) return false;
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
        let estado = 'SOLO EN PROTHEUS';
        let afipData = { total: 0, iva: 0, fecha: '', emisor: '' };

        if (afipMatch) {
            estado = 'UNIDO';
            afipData = afipMatch;
            afipMap.delete(id);
        }

        // Calculamos diferencia (ahora ambos son positivos)
        // Redondeamos a 2 decimales para evitar errores de coma flotante (0.00000001)
        const difTotal = Number((totalProt - afipData.total).toFixed(2));
        const difIva = Number((ivaProt - afipData.iva).toFixed(2));

        // Si la diferencia es minúscula (menor a 1 peso), asumimos que es 0
        const esDiferenciaReal = Math.abs(difTotal) > 0.05 || Math.abs(difIva) > 0.05;

        // Si están unidos pero hay diferencia real, cambiamos el estado para alertar
        if (estado === 'UNIDO' && esDiferenciaReal) {
            estado = 'DIFERENCIA IMPORTE';
        }

        comparisonMap.set(id, {
            id, estado,
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
            id, estado: 'SOLO EN AFIP',
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
    const rows = res['Workbook']['Worksheet'][0]['Table'][0]['Row'];

    // Buscar cabecera
    let headIdx = -1, headers = [];
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

    for (let i = 0; i < matrix.length; i++) {
        if (matrix[i].includes('CODIGO') && matrix[i].includes('DENOMINACION')) {
            headIdx = i; headers = matrix[i]; break;
        }
    }
    if (headIdx === -1) throw new Error("No hay cabecera en XML");

    return matrix.slice(headIdx + 1).map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = row[i] || '');
        return obj;
    });
}

// Ejecución directa (Genera CSVs)
async function main() {
    const data = await generarReporte(MES_FILTRO, ANIO_FILTRO);

    // Filtrar solo las diferencias reales para el archivo de errores
    const diferencias = data.filter(d => d.estado !== 'UNIDO');

    const toCSV = (arr) => {
        if (!arr.length) return '';
        const head = ['ID', 'ESTADO', 'CUIT', 'EMISOR', 'FECHA_PROTHEUS', 'FECHA_AFIP', 'IVA_PROT', 'IVA_AFIP', 'DIF_IVA', 'TOTAL_PROT', 'TOTAL_AFIP', 'DIF_TOTAL'];
        const rows = arr.map(i => [
            i.id, i.estado, i.cuit, `"${i.emisor}"`,
            i.fecha_prot, i.fecha_afip,
            i.iva_prot.toFixed(2).replace('.', ','), i.iva_afip.toFixed(2).replace('.', ','), i.dif_iva.toFixed(2).replace('.', ','),
            i.total_prot.toFixed(2).replace('.', ','), i.total_afip.toFixed(2).replace('.', ','), i.dif_total.toFixed(2).replace('.', ',')
        ].join(';'));
        return [head.join(';'), ...rows].join('\n');
    };

    fs.writeFileSync(FILE_OUTPUT_GENERAL, toCSV(data));
    fs.writeFileSync(FILE_OUTPUT_DIFERENCIAS, toCSV(diferencias));

    console.log(`\n LISTO: ${data.length} total. ${diferencias.length} diferencias.`);
    console.log(` Archivos: ${FILE_OUTPUT_GENERAL} y ${FILE_OUTPUT_DIFERENCIAS}`);
}

module.exports = { generarReporte };
if (require.main === module) main();
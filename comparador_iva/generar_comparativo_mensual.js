/**
 * Nombre del archivo: generar_comparativo_mensual.js
 * Descripción: Script para conciliar archivos de IVA entre Sistema ERP (Protheus XML) y AFIP (CSV).
 * Incluye filtrado por mes/año y generación de reporte de discrepancias.
 * Autor: Generado por Gemini para el Usuario.
 * * Requisitos:
 * - Node.js instalado
 * - Dependencias: npm install csv-parse xml2js
 * * Uso:
 * node generar_comparativo_mensual.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const xml2js = require('xml2js');

// --- CONFIGURACIÓN DE ARCHIVOS Y FILTROS ---
const FILE_AFIP = '11 - AFIP IVA Noviembre 2025.csv';
const FILE_PROTHEUS = 'matrar2b.xml';

const FILE_OUTPUT_GENERAL = 'Comparativo_Noviembre_2025.csv';
const FILE_OUTPUT_DIFERENCIAS = 'Facturas_Sin_Cruce_Noviembre.csv';

// --- OPCIÓN PARA ELEGIR EL MES ---
// Cambia estos valores para analizar otro período
const MES_FILTRO = 11;   // Noviembre
const ANIO_FILTRO = 2025;

/**
 * Función Principal de Lógica de Negocio
 * @param {number} mesFiltro - Mes a filtrar (1-12)
 * @param {number} anioFiltro - Año a filtrar (ej. 2025)
 */
async function generarReporte(mesFiltro, anioFiltro) {
    if (!mesFiltro || !anioFiltro) throw new Error("Mes y Año son requeridos");

    console.log(`--- Iniciando Conciliación para el período: ${mesFiltro}/${anioFiltro} ---`);

    // Helper interno para validar fecha
    const esFechaDelPeriodo = (fechaStr) => {
        if (!fechaStr) return false;
        let mes, anio;
        if (fechaStr.includes('-')) {
            const partes = fechaStr.split('-');
            anio = parseInt(partes[0]);
            mes = parseInt(partes[1]);
        } else if (fechaStr.includes('/')) {
            const partes = fechaStr.split('/');
            mes = parseInt(partes[1]);
            anio = parseInt(partes[2]);
        } else {
            return false;
        }
        return mes === mesFiltro && anio === anioFiltro;
    };

    // 1. PROCESAR AFIP
    console.log(`Leyendo AFIP: ${FILE_AFIP}...`);
    const afipRaw = fs.readFileSync(FILE_AFIP, 'utf-8');

    const afipRecords = parse(afipRaw, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true
    });

    const afipMap = new Map();
    let afipTotalCount = 0;
    let afipFilteredCount = 0;

    afipRecords.forEach(record => {
        afipTotalCount++;
        // FILTRO DE FECHA
        if (!esFechaDelPeriodo(record['Fecha de Emisión'])) {
            return;
        }

        const cuit = record['Nro. Doc. Emisor'].replace(/\./g, '');
        const ptoVta = record['Punto de Venta'].padStart(4, '0');
        const numero = record['Número Desde'].padStart(8, '0');
        const uniqueId = `${cuit}${ptoVta}${numero}`;

        afipMap.set(uniqueId, {
            fecha: record['Fecha de Emisión'],
            emisor: record['Denominación Emisor'],
            iva: parseAfipNumber(record['Total IVA']),
            total: parseAfipNumber(record['Imp. Total']),
            cuit: cuit,
            raw: record
        });
        afipFilteredCount++;
    });
    console.log(`Registros AFIP leídos: ${afipTotalCount}. Filtrados por mes: ${afipFilteredCount}`);

    // 2. PROCESAR PROTHEUS
    console.log(`Leyendo Protheus XML: ${FILE_PROTHEUS}...`);
    const protheusRecordsRaw = await parseProtheusXML(FILE_PROTHEUS);

    const comparisonMap = new Map();
    let protTotalCount = 0;
    let protFilteredCount = 0;

    // 3. CRUCE: Primero iteramos Protheus
    protheusRecordsRaw.forEach(prot => {
        protTotalCount++;
        if (!esFechaDelPeriodo(prot['FECHA'])) {
            return;
        }
        protFilteredCount++;

        const cuitRaw = prot['Nº DOCUMENTO'] || '';
        const cuit = cuitRaw.replace(/-/g, '').trim();
        const numero = (prot['NUMERO'] || '').trim();
        const uniqueId = `${cuit}${numero}`;

        const totalProt = parseFloat(prot['TOTAL']) || 0.0;
        const ivaProt = parseFloat(prot['IVA']) || 0.0;

        const afipMatch = afipMap.get(uniqueId);

        let estado = 'SOLO EN PROTHEUS';
        let afipData = { total: 0, iva: 0, fecha: '', emisor: '' };

        if (afipMatch) {
            estado = 'UNIDO';
            afipData = afipMatch;
            afipMap.delete(uniqueId);
        }

        const difTotal = totalProt - afipData.total;
        const difIva = ivaProt - afipData.iva;

        comparisonMap.set(uniqueId, {
            id: uniqueId,
            estado: estado,
            emisor: prot['DENOMINACION'] || afipData.emisor,
            cuit: cuit,
            fecha_prot: prot['FECHA'],
            iva_prot: ivaProt,
            total_prot: totalProt,
            fecha_afip: afipData.fecha,
            iva_afip: afipData.iva,
            total_afip: afipData.total,
            dif_iva: difIva,
            dif_total: difTotal
        });
    });

    console.log(`Registros Protheus leídos: ${protTotalCount}. Filtrados por mes: ${protFilteredCount}`);

    // 4. CRUCE INVERSO
    afipMap.forEach((afipData, uniqueId) => {
        comparisonMap.set(uniqueId, {
            id: uniqueId,
            estado: 'SOLO EN AFIP',
            emisor: afipData.emisor,
            cuit: afipData.cuit,
            fecha_prot: '',
            iva_prot: 0,
            total_prot: 0,
            fecha_afip: afipData.fecha,
            iva_afip: afipData.iva,
            total_afip: afipData.total,
            dif_iva: 0 - afipData.iva,
            dif_total: 0 - afipData.total
        });
    });

    // Retornamos los datos para procesar (ya sea CSV o API)
    return Array.from(comparisonMap.values());
}

/**
 * Verifica si una fecha pertenece al mes y año configurados.
 * Soporta formatos: 'YYYY-MM-DD' (AFIP) y 'DD/MM/YYYY' (Protheus)
 */
// This function is now internal to generarReporte, so it's removed from global scope.

/**
 * Función auxiliar para limpiar números de AFIP (formato europeo: 1.000,00)
 * Transforma "27.685,95" o "27685,95" -> 27685.95 (Float)
 */
function parseAfipNumber(value) {
    if (!value) return 0.0;
    // Eliminar puntos de miles y reemplazar coma decimal por punto
    const clean = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0.0;
}

/**
 * Función auxiliar para parsear el XML de Excel 2003 (SpreadsheetML) de Protheus.
 * Extrae los datos de las celdas y maneja los índices vacíos.
 */
async function parseProtheusXML(filePath) {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);

    // Navegar la estructura XML de Excel: Workbook -> Worksheet -> Table -> Row -> Cell -> Data
    const worksheets = result['Workbook']['Worksheet'];
    if (!worksheets) throw new Error('No se encontraron hojas de trabajo en el XML.');

    let dataRows = [];
    let headers = [];

    // Iteramos sobre las filas de la primera hoja
    const rows = worksheets[0]['Table'][0]['Row'];

    // Buscamos la fila de cabecera
    let headerIndex = -1;

    // Convertimos la estructura compleja del XML a un array de arrays simple
    const cleanRows = rows.map(row => {
        const cells = row['Cell'];
        if (!cells) return [];

        let rowData = [];
        cells.forEach(cell => {
            // Manejar atributo ss:Index (Excel salta celdas vacías)
            let cellIndex = 0;
            if (cell['$'] && cell['$']['ss:Index']) {
                cellIndex = parseInt(cell['$']['ss:Index']) - 1;
            } else {
                cellIndex = rowData.length;
            }

            // Rellenar huecos si saltó índices
            while (rowData.length < cellIndex) {
                rowData.push('');
            }

            // Extraer el valor (Data)
            let cellValue = '';
            if (cell['Data'] && cell['Data'][0] && cell['Data'][0]['_']) {
                cellValue = cell['Data'][0]['_'];
            } else if (cell['Data'] && typeof cell['Data'][0] === 'string') {
                cellValue = cell['Data'][0];
            }
            rowData.push(cellValue);
        });
        return rowData;
    });

    // Identificar cabecera
    for (let i = 0; i < cleanRows.length; i++) {
        if (cleanRows[i].includes('CODIGO') && cleanRows[i].includes('DENOMINACION')) {
            headers = cleanRows[i];
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) throw new Error('No se encontró la cabecera en el archivo Protheus.');

    // Convertir filas a objetos basados en la cabecera
    for (let i = headerIndex + 1; i < cleanRows.length; i++) {
        const rowArray = cleanRows[i];
        if (rowArray.length === 0) continue;

        let rowObj = {};
        headers.forEach((header, index) => {
            rowObj[header] = rowArray[index] || '';
        });
        dataRows.push(rowObj);
    }

    return dataRows;
}

/**
 * Función Principal de Ejecución (Legacy CSV Mode)
 */
async function main() {
    // Usamos los valores globales por defecto
    const data = await generarReporte(MES_FILTRO, ANIO_FILTRO);

    // 5. GENERAR CSV GENERAL
    const cabecera = [
        'ID_UNICO', 'ESTADO_CRUCE', 'CUIT', 'EMISOR',
        'FECHA_PROTHEUS', 'FECHA_AFIP',
        'IVA_PROTHEUS', 'IVA_AFIP', 'DIFERENCIA_IVA',
        'TOTAL_PROTHEUS', 'TOTAL_AFIP', 'DIFERENCIA_TOTAL'
    ];

    const filasCsvGeneral = [cabecera.join(';')];
    const filasCsvDiferencias = [cabecera.join(';')];

    let contDiferencias = 0;

    for (const item of data) {
        const fila = [
            item.id,
            item.estado,
            item.cuit,
            `"${item.emisor}"`,
            item.fecha_prot,
            item.fecha_afip,
            item.iva_prot.toFixed(2).replace('.', ','),
            item.iva_afip.toFixed(2).replace('.', ','),
            item.dif_iva.toFixed(2).replace('.', ','),
            item.total_prot.toFixed(2).replace('.', ','),
            item.total_afip.toFixed(2).replace('.', ','),
            item.dif_total.toFixed(2).replace('.', ',')
        ];

        const lineaCsv = fila.join(';');
        filasCsvGeneral.push(lineaCsv);

        if (item.estado !== 'UNIDO') {
            filasCsvDiferencias.push(lineaCsv);
            contDiferencias++;
        }
    }

    fs.writeFileSync(FILE_OUTPUT_GENERAL, filasCsvGeneral.join('\n'), { encoding: 'utf-8' });
    fs.writeFileSync(FILE_OUTPUT_DIFERENCIAS, filasCsvDiferencias.join('\n'), { encoding: 'utf-8' });

    console.log('\n--- RESULTADOS ---');
    console.log(`Archivo Completo generado: ${FILE_OUTPUT_GENERAL} (${data.length} registros)`);
    console.log(`Archivo Diferencias generado: ${FILE_OUTPUT_DIFERENCIAS} (${contDiferencias} registros sin cruzar)`);
}

// Exportamos la función para usar en el servidor
module.exports = { generarReporte };

// Si se ejecuta directamente, corremos main()
if (require.main === module) {
    main().catch(error => {
        console.error('Ocurrió un error fatal:', error);
    });
}

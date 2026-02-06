/**
 * Nombre del archivo: generar_comparativo.js
 * Descripción: Script para conciliar archivos de IVA entre Sistema ERP (Protheus XML) y AFIP (CSV).
 * Autor: Generado por Gemini para el Usuario.
 * * Requisitos:
 * - Node.js instalado
 * - Dependencias: npm install csv-parse xml2js
 * * Uso:
 * node generar_comparativo.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const xml2js = require('xml2js');

// --- CONFIGURACIÓN DE ARCHIVOS ---
const FILE_AFIP = '11 - AFIP IVA Noviembre 2025.csv';
const FILE_PROTHEUS = 'matrar2b.xml';
const FILE_OUTPUT = 'Comparativo_Generado_Node.csv';

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
    let headerIndex = -1;
    let targetRows = null;

    // Buscar la hoja correcta iterando sobre todas
    for (const sheet of worksheets) {
        if (!sheet['Table'] || !sheet['Table'][0]['Row']) continue;

        const rows = sheet['Table'][0]['Row'];

        // Limpiar filas para esta hoja
        const tempCleanRows = rows.map(row => {
            const cells = row['Cell'];
            if (!cells) return [];

            let rowData = [];
            cells.forEach(cell => {
                let cellIndex = 0;
                if (cell['$'] && cell['$']['ss:Index']) {
                    cellIndex = parseInt(cell['$']['ss:Index']) - 1;
                } else {
                    cellIndex = rowData.length;
                }
                while (rowData.length < cellIndex) rowData.push('');

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

        // Buscar cabecera en esta hoja
        for (let i = 0; i < tempCleanRows.length; i++) {
            if (tempCleanRows[i].includes('CODIGO') && tempCleanRows[i].includes('DENOMINACION')) {
                headers = tempCleanRows[i];
                headerIndex = i;
                targetRows = tempCleanRows;
                break;
            }
        }

        if (headerIndex !== -1) break; // Encontrado
    }

    if (headerIndex === -1 || !targetRows) throw new Error('No se encontró la cabecera en ninguna hoja del archivo Protheus.');

    // Convertir filas a objetos basados en la cabecera encontrada
    for (let i = headerIndex + 1; i < targetRows.length; i++) {
        const rowArray = targetRows[i];
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
 * Función Principal de Ejecución
 */
async function main() {
    console.log('--- Iniciando Proceso de Conciliación ---');

    // 1. PROCESAR AFIP
    console.log(`Leyendo AFIP: ${FILE_AFIP}...`);
    const afipRaw = fs.readFileSync(FILE_AFIP, 'utf-8'); // AFIP suele ser latin1, pero Node usa utf8 por defecto. Si hay problemas de tildes, usar 'latin1'.

    const afipRecords = parse(afipRaw, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true // Permite comillas dentro de campos si es necesario
    });

    const afipMap = new Map();

    afipRecords.forEach(record => {
        // Lógica de Clave Única AFIP:
        // CUIT Emisor + Punto Venta (4 digitos) + Numero (8 digitos)

        const cuit = record['Nro. Doc. Emisor'].replace(/\./g, ''); // Quitar puntos si los hay
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
    });
    console.log(`Registros AFIP cargados: ${afipMap.size}`);


    // 2. PROCESAR PROTHEUS
    console.log(`Leyendo Protheus XML: ${FILE_PROTHEUS}...`);
    const protheusRecords = await parseProtheusXML(FILE_PROTHEUS);

    const comparisonMap = new Map();

    // 3. CRUCE: Primero iteramos Protheus y buscamos en AFIP
    protheusRecords.forEach(prot => {
        // Lógica de Clave Única Protheus:
        // CUIT (columna Nº DOCUMENTO sin guiones) + NUMERO (ya viene con 12 digitos según tu archivo)

        const cuitRaw = prot['Nº DOCUMENTO'] || '';
        const cuit = cuitRaw.replace(/-/g, '').trim();
        const numero = (prot['NUMERO'] || '').trim(); // Asumimos formato '000400025904'

        const uniqueId = `${cuit}${numero}`;

        // Parsear importes Protheus (asumimos que vienen como números en el XML o strings simples)
        const totalProt = parseFloat(prot['TOTAL']) || 0.0;
        const ivaProt = parseFloat(prot['IVA']) || 0.0;

        // Buscar coincidencia en AFIP
        const afipMatch = afipMap.get(uniqueId);

        let estado = 'SOLO EN PROTHEUS';
        let afipData = { total: 0, iva: 0, fecha: '', emisor: '' };

        if (afipMatch) {
            estado = 'UNIDO';
            afipData = afipMatch;
            // Marcamos el registro de AFIP como procesado para saber cuáles sobraron después
            afipMap.delete(uniqueId);
        }

        const difTotal = totalProt - afipData.total;
        const difIva = ivaProt - afipData.iva;

        comparisonMap.set(uniqueId, {
            id: uniqueId,
            estado: estado,
            emisor: prot['DENOMINACION'] || afipData.emisor,
            cuit: cuit,
            // Datos Protheus
            fecha_prot: prot['FECHA'],
            iva_prot: ivaProt,
            total_prot: totalProt,
            // Datos AFIP
            fecha_afip: afipData.fecha,
            iva_afip: afipData.iva,
            total_afip: afipData.total,
            // Diferencias
            dif_iva: difIva,
            dif_total: difTotal
        });
    });

    // 4. CRUCE INVERSO: Revisar qué quedó en AFIP sin procesar (Solo AFIP)
    afipMap.forEach((afipData, uniqueId) => {
        comparisonMap.set(uniqueId, {
            id: uniqueId,
            estado: 'SOLO EN AFIP',
            emisor: afipData.emisor,
            cuit: afipData.cuit,
            // Datos Protheus (Vacíos)
            fecha_prot: '',
            iva_prot: 0,
            total_prot: 0,
            // Datos AFIP
            fecha_afip: afipData.fecha,
            iva_afip: afipData.iva,
            total_afip: afipData.total,
            // Diferencias (0 - AFIP) => Negativo porque "falta" en Protheus
            dif_iva: 0 - afipData.iva,
            dif_total: 0 - afipData.total
        });
    });

    console.log(`Total registros procesados para reporte: ${comparisonMap.size}`);

    // 5. GENERAR CSV DE SALIDA
    const cabecera = [
        'ID_UNICO', 'ESTADO_CRUCE', 'CUIT', 'EMISOR',
        'FECHA_PROTHEUS', 'FECHA_AFIP',
        'IVA_PROTHEUS', 'IVA_AFIP', 'DIFERENCIA_IVA',
        'TOTAL_PROTHEUS', 'TOTAL_AFIP', 'DIFERENCIA_TOTAL'
    ];

    const filasCsv = [cabecera.join(';')]; // Usamos punto y coma para Excel español

    for (const item of comparisonMap.values()) {
        const fila = [
            item.id,
            item.estado,
            item.cuit,
            `"${item.emisor}"`, // Comillas para proteger nombres con comas
            item.fecha_prot,
            item.fecha_afip,
            item.iva_prot.toFixed(2).replace('.', ','), // Formato Español
            item.iva_afip.toFixed(2).replace('.', ','),
            item.dif_iva.toFixed(2).replace('.', ','),
            item.total_prot.toFixed(2).replace('.', ','),
            item.total_afip.toFixed(2).replace('.', ','),
            item.dif_total.toFixed(2).replace('.', ',')
        ];
        filasCsv.push(fila.join(';'));
    }

    fs.writeFileSync(FILE_OUTPUT, filasCsv.join('\n'), { encoding: 'utf-8' }); // Agrega BOM para que Excel abra UTF-8 directo si quieres: '\ufeff' + ...

    console.log(`\n¡Éxito! Archivo generado: ${FILE_OUTPUT}`);
    console.log('Puedes abrir este archivo en Excel. Usa ";" como delimitador.');
}

// Ejecutar
main().catch(error => {
    console.error('Ocurrió un error fatal:', error);
});

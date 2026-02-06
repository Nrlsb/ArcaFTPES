const fs = require('fs');
const path = require('path');

const protheusPath = 'matrar2b.xml';
const arcaPath = '11 - AFIP IVA Noviembre 2025.csv';

// Helper to clean CUIT
const cleanCuit = (val) => val ? val.replace(/\D/g, '') : '';


// 1. Process Protheus (Mocking DOMParser with Regex)
function processProtheus(content) {
    const map = new Map();
    const duplicates = [];
    const lengths = {};
    const espCounts = {};

    // Extract rows
    const rowRegex = /<Row>([\s\S]*?)<\/Row>/g;
    let rank = 0;
    let match;

    while ((match = rowRegex.exec(content)) !== null) {
        const rowContent = match[1];
        // Extract cells
        const cellRegex = /<Cell( ss:Index="(\d+)")?.*?>\s*<Data.*?>(.*?)<\/Data>\s*<\/Cell>/g;
        let cellMatch;
        let colIndex = 0;

        let numero = null;
        let cuit = null;
        let denominacion = '';
        let total = '';
        let esp = '';

        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            const indexAttr = cellMatch[2];
            if (indexAttr) {
                colIndex = parseInt(indexAttr, 10);
            } else {
                colIndex++;
            }

            const val = cellMatch[3].trim(); // Data content

            if (colIndex === 9) numero = val;
            if (colIndex === 4) cuit = cleanCuit(val);
            if (colIndex === 2) denominacion = val;
            if (colIndex === 7) esp = val;
            if (colIndex === 11) total = val;
        }

        if (numero && numero.length >= 8 && cuit) {
            const cleanedNumero = numero.replace(/\D/g, '');
            const key = `${cuit}-${cleanedNumero}`;

            const len = cleanedNumero.length;
            lengths[len] = (lengths[len] || 0) + 1;

            if (map.has(key)) {
                duplicates.push({ key });
            }
            map.set(key, { rank, cuit, numero: cleanedNumero, denominacion, total, esp });

            // Track ESP counts
            if (esp) {
                espCounts[esp] = (espCounts[esp] || 0) + 1;
            }

            rank++;
        }
    }
    return { map, duplicates, lengths, espCounts };
}

// 2. Process Arca
function processArca(content, protheusMap) {
    const lines = content.split(/\r\n|\n/);
    const missingInProtheus = [];

    let processedCount = 0;
    let skippedCount = 0;
    let matchCount = 0;

    // Type Categories
    const facturas = ['1', '6', '11', '51', '19'];
    const notas = ['2', '7', '12', '52', '20', '3', '8', '13', '53', '21'];

    const validInvoiceTypes = [...facturas, ...notas];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(';');
        if (cols.length >= 8) {
            const type = cols[1];
            const pos = cols[2];
            const num = cols[3];
            const cuitEmisor = cleanCuit(cols[7]);

            if (validInvoiceTypes.includes(type) && pos && num && cuitEmisor) {
                processedCount++;
                const paddedPos = pos.padStart(4, '0');
                const paddedNum = num.padStart(8, '0');
                const constructedNum = `${paddedPos}${paddedNum}`;
                const constructedKey = `${cuitEmisor}-${constructedNum}`;

                const isFactura = facturas.includes(type);
                const category = isFactura ? "Factura" : "NotaCambio";

                if (protheusMap.has(constructedKey)) {
                    protheusMap.delete(constructedKey);
                    matchCount++;
                } else {
                    missingInProtheus.push({ line, key: constructedKey, type, category });
                }
            } else {
                skippedCount++;
            }
        }
    }
    return { missingInProtheus, matchCount, processedCount, skippedCount };
}

async function run() {
    try {
        console.log('Reading Protheus File...');
        const protheusContent = fs.readFileSync(protheusPath, 'utf8');
        const { map: protheusMap, duplicates, lengths, espCounts } = processProtheus(protheusContent);

        const initialMapSize = protheusMap.size; // 501

        console.log(`Protheus Map Size: ${initialMapSize}`);
        console.log(`Protheus Number Lengths:`, JSON.stringify(lengths, null, 2));
        console.log(`Protheus ESP Counts:`, JSON.stringify(espCounts, null, 2));

        console.log('Reading Arca File...');
        const arcaContent = fs.readFileSync(arcaPath, 'utf8');
        const { missingInProtheus, matchCount, processedCount, skippedCount } = processArca(arcaContent, protheusMap);

        const missingInArca = Array.from(protheusMap.values());

        console.log('-----------------------------------');
        console.log(`Total Matches: ${matchCount}`);

        // Faltan en Protheus Breakdown
        const missingProtheusByCat = { Factura: 0, NotaCambio: 0 };
        missingInProtheus.forEach(m => missingProtheusByCat[m.category]++);

        console.log(`Faltan en Protheus Total: ${missingInProtheus.length}`);
        console.log(`  - Facturas: ${missingProtheusByCat.Factura}`);
        console.log(`  - Notas (NC/ND): ${missingProtheusByCat.NotaCambio}`);

        // Faltan en Arca Breakdown
        const missingArcaByESP = {};
        missingInArca.forEach(m => missingArcaByESP[m.esp] = (missingArcaByESP[m.esp] || 0) + 1);

        // Map ESP to Category (approx)
        // NF = Factura? NCP = Nota Credito?
        // Let's assume NF matches Facturas and NCP matches Notas.

        console.log(`Faltan en Arca Total: ${missingInArca.length}`);
        console.log(`  - Breakdown by ESP:`, JSON.stringify(missingArcaByESP, null, 2));

        const totalFacturaDiffs = missingProtheusByCat.Factura + (missingArcaByESP["NF"] || 0);
        console.log(`Predicted "Factura Only" Difference: ${totalFacturaDiffs}`);

        if (duplicates.length > 0) {
            console.log('Sample Duplicate in Protheus:', JSON.stringify(duplicates[0], null, 2));
        }

        console.log("--- SAMPLES FALTAN EN PROTHEUS (KEY) ---");
        missingInProtheus.slice(0, 10).forEach(m => console.log(m.key));

        console.log("--- SAMPLES FALTAN EN ARCA (KEY) ---");
        missingInArca.slice(0, 10).forEach(m => console.log(`${m.cuit}-${m.numero}`));

    } catch (err) {
        console.error("Error:", err);
    }
}

run();

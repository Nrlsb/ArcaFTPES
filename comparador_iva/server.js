const express = require('express');
const path = require('path');
const { generarReporte } = require('./generar_comparativo_mensual');

const app = express();
const PORT = 3000;

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API para obtener los datos comparados
app.get('/api/compare', async (req, res) => {
    try {
        const { mes, anio } = req.query;

        const mesInt = parseInt(mes) || 11; // Default Noviembre
        const anioInt = parseInt(anio) || 2025; // Default 2025

        const data = await generarReporte(mesInt, anioInt);
        res.json({ success: true, count: data.length, data: data });
    } catch (error) {
        console.error('Error en API:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

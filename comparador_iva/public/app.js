document.addEventListener('DOMContentLoaded', () => {
    const btnActualizar = document.getElementById('btn-actualizar');
    const loadingOverlay = document.getElementById('loading');
    const tableBody = document.querySelector('#resultados-tabla tbody');
    const searchInput = document.getElementById('busqueda');
    const checkSoloDiferencias = document.getElementById('solo-diferencias');

    // Stats elements
    const statTotal = document.getElementById('stat-total');
    const statDiff = document.getElementById('stat-diff');
    const statMatch = document.getElementById('stat-match');

    let currentData = [];

    // Cargar datos inicialmente
    fetchData();

    btnActualizar.addEventListener('click', fetchData);
    searchInput.addEventListener('input', renderTable);
    checkSoloDiferencias.addEventListener('change', renderTable);

    async function fetchData() {
        const mes = document.getElementById('mes').value;
        const anio = document.getElementById('anio').value;

        showLoading(true);

        try {
            const response = await fetch(`/api/compare?mes=${mes}&anio=${anio}`);
            const result = await response.json();

            if (result.success) {
                currentData = result.data;
                updateStats();
                renderTable();
            } else {
                alert('Error al obtener datos: ' + result.error);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Error de conexión con el servidor');
        } finally {
            showLoading(false);
        }
    }

    function updateStats() {
        if (!currentData) return;

        const total = currentData.length;
        const discrepancias = currentData.filter(item => item.estado !== 'UNIDO').length;
        const coincidencias = total - discrepancias;

        statTotal.textContent = total;
        statDiff.textContent = discrepancias;
        statMatch.textContent = coincidencias;
    }

    function renderTable() {
        tableBody.innerHTML = '';

        const searchTerm = searchInput.value.toLowerCase();
        const soloDif = checkSoloDiferencias.checked;

        const filtered = currentData.filter(item => {
            // Filtro de diferencias
            if (soloDif && item.estado === 'UNIDO') return false;

            // Filtro de búsqueda
            const searchMatch =
                item.emisor.toLowerCase().includes(searchTerm) ||
                item.cuit.includes(searchTerm) ||
                item.estado.toLowerCase().includes(searchTerm);

            return searchMatch;
        });

        // Optimización: Si hay muchos datos, renderizar solo los primeros 100 o implementar paginación
        // Por ahora, renderizamos todo pero limitado a 500 para evitar congelar si hay miles
        const itemsToShow = filtered.slice(0, 500);

        itemsToShow.forEach(item => {
            const tr = document.createElement('tr');

            const badgeClass = getStatusClass(item.estado);
            const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

            tr.innerHTML = `
                <td><span class="status-badge ${badgeClass}">${item.estado}</span></td>
                <td>${item.emisor}</td>
                <td>${item.cuit}</td>
                <td>${item.fecha_afip || item.fecha_prot || '-'}</td>
                <td class="text-right currency">${formatoMoneda.format(item.iva_afip)}</td>
                <td class="text-right currency">${formatoMoneda.format(item.iva_prot)}</td>
                <td class="text-right currency" style="color: ${item.dif_iva !== 0 ? 'var(--danger)' : 'inherit'}">
                    ${formatoMoneda.format(item.dif_iva)}
                </td>
            `;

            tableBody.appendChild(tr);
        });

        if (filtered.length > 500) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                Mostrando 500 de ${filtered.length} resultados. Refina tu búsqueda.
            </td>`;
            tableBody.appendChild(tr);
        }

        if (filtered.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                No se encontraron resultados.
            </td>`;
            tableBody.appendChild(tr);
        }
    }

    function getStatusClass(estado) {
        if (estado === 'UNIDO') return 'status-unido';
        if (estado === 'SOLO EN AFIP') return 'status-only-afip';
        return 'status-error'; // Solo en Protheus
    }

    function showLoading(show) {
        if (show) loadingOverlay.classList.remove('hidden');
        else loadingOverlay.classList.add('hidden');
    }
});

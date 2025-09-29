document.addEventListener('DOMContentLoaded', () => {
    const mapWrapper = document.querySelector('.map-wrapper');
    const map = document.getElementById('map-background');
    const locationsListDiv = document.getElementById('locations-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Estado do mapa
    let transform = { scale: 1, translateX: 0, translateY: 0 };
    let isPanning = false;
    let isDrawing = false;
    let startPan = { x: 0, y: 0 };
    let startDraw = { x: 0, y: 0 };
    let selectionRectEl = null;

    // --- FUNÇÕES DE TRANSFORMAÇÃO E COORDENADAS ---
    
    const applyTransform = () => {
        // Limita o pan para não perder o mapa de vista
        const maxX = 0;
        const minX = mapWrapper.clientWidth - map.clientWidth * transform.scale;
        const maxY = 0;
        const minY = mapWrapper.clientHeight - map.clientHeight * transform.scale;

        transform.translateX = Math.min(Math.max(transform.translateX, minX), maxX);
        transform.translateY = Math.min(Math.max(transform.translateY, minY), maxY);

        map.style.transform = `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`;
    };

    const getMapCoordinates = (e) => {
        const rect = mapWrapper.getBoundingClientRect();
        const x = (e.clientX - rect.left - transform.translateX) / transform.scale;
        const y = (e.clientY - rect.top - transform.translateY) / transform.scale;
        return { x, y };
    };
    
    const setInitialView = () => {
        const scaleX = mapWrapper.clientWidth / map.clientWidth;
        const scaleY = mapWrapper.clientHeight / map.clientHeight;
        transform.scale = Math.min(scaleX, scaleY); // Fit to screen

        transform.translateX = (mapWrapper.clientWidth - map.clientWidth * transform.scale) / 2;
        transform.translateY = (mapWrapper.clientHeight - map.clientHeight * transform.scale) / 2;
        applyTransform();
    };

    // --- RENDERIZAÇÃO E FETCH ---

    const renderLocations = (locations) => {
        map.querySelectorAll('.existing-area').forEach(el => el.remove());
        locationsListDiv.innerHTML = '';

        locations.forEach(loc => {
            if (loc.coords_json) {
                const coords = JSON.parse(loc.coords_json);
                const areaEl = document.createElement('div');
                areaEl.className = 'existing-area';
                areaEl.style.left = `${coords.x}px`;
                areaEl.style.top = `${coords.y}px`;
                areaEl.style.width = `${coords.width}px`;
                areaEl.style.height = `${coords.height}px`;
                areaEl.textContent = loc.nome;
                map.appendChild(areaEl);
            }
            const listItem = document.createElement('div');
            listItem.className = 'location-item';
            listItem.innerHTML = `
                <span>${loc.nome}</span>
                <button class="delete-btn" data-id="${loc.id}" data-name="${loc.nome}">
                    <i data-lucide="trash-2" style="pointer-events: none;"></i>
                </button>
            `;
            locationsListDiv.appendChild(listItem);
        });
        lucide.createIcons();
    };

    const fetchLocations = async () => {
        loadingSpinner.hidden = false;
        try {
            const response = await fetch('/api/locais');
            if (!response.ok) throw new Error('Falha ao carregar locais.');
            const locations = await response.json();
            renderLocations(locations);
        } catch (error) {
            console.error('Erro:', error);
            locationsListDiv.innerHTML = `<p>Erro ao carregar locais.</p>`;
        } finally {
            loadingSpinner.hidden = true;
        }
    };

    // --- EVENT LISTENERS ---

    mapWrapper.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (e.shiftKey || e.button !== 0) {
            isPanning = true;
            startPan = { x: e.clientX - transform.translateX, y: e.clientY - transform.translateY };
            mapWrapper.style.cursor = 'grabbing';
        } else {
            isDrawing = true;
            startDraw = getMapCoordinates(e);
            
            selectionRectEl = document.createElement('div');
            selectionRectEl.className = 'selection-rectangle';
            map.appendChild(selectionRectEl);
        }
    });

    mapWrapper.addEventListener('mousemove', (e) => {
        e.preventDefault();
        if (isPanning) {
            transform.translateX = e.clientX - startPan.x;
            transform.translateY = e.clientY - startPan.y;
            applyTransform();
        } else if (isDrawing) {
            const currentCoords = getMapCoordinates(e);
            const width = Math.abs(currentCoords.x - startDraw.x);
            const height = Math.abs(currentCoords.y - startDraw.y);
            const left = Math.min(startDraw.x, currentCoords.x);
            const top = Math.min(startDraw.y, currentCoords.y);

            selectionRectEl.style.left = `${left}px`;
            selectionRectEl.style.top = `${top}px`;
            selectionRectEl.style.width = `${width}px`;
            selectionRectEl.style.height = `${height}px`;
        }
    });

    window.addEventListener('mouseup', async (e) => {
        if (isPanning) {
            isPanning = false;
            mapWrapper.style.cursor = 'crosshair';
        } else if (isDrawing) {
            isDrawing = false;
            const endDraw = getMapCoordinates(e);
            
            const width = Math.abs(endDraw.x - startDraw.x);
            const height = Math.abs(endDraw.y - startDraw.y);

            if (width < 10 || height < 10) {
                selectionRectEl.remove();
                return;
            }

            const locationName = prompt("Digite o nome para este novo local:");
            if (locationName && locationName.trim()) {
                const coords = {
                    x: Math.min(startDraw.x, endDraw.x),
                    y: Math.min(startDraw.y, endDraw.y),
                    width,
                    height
                };

                try {
                    const response = await fetch('/api/locais', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            nome: locationName.trim(),
                            coords_json: JSON.stringify(coords)
                        })
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.error);
                    }
                    fetchLocations();
                } catch (error) {
                    alert(`Erro ao salvar local: ${error.message}`);
                }
            }
            selectionRectEl.remove();
        }
    });

    mapWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = mapWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = 1.1;
        const oldScale = transform.scale;
        
        if (e.deltaY < 0) { // Zoom in
            transform.scale *= zoomFactor;
        } else { // Zoom out
            transform.scale /= zoomFactor;
        }
        transform.scale = Math.min(Math.max(0.1, transform.scale), 5); // Limites do zoom

        // Ajusta a posição para que o zoom seja centrado no mouse
        transform.translateX = mouseX - (mouseX - transform.translateX) * (transform.scale / oldScale);
        transform.translateY = mouseY - (mouseY - transform.translateY) * (transform.scale / oldScale);

        applyTransform();
    });

    locationsListDiv.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-btn');
        if (btn) {
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            if (confirm(`Tem certeza que deseja apagar o local "${name}"?`)) {
                try {
                    const response = await fetch(`/api/locais/${id}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    fetchLocations();
                } catch (error) {
                    alert(`Erro ao apagar: ${error.message}`);
                }
            }
        }
    });

    // Inicia a aplicação
    setInitialView();
    fetchLocations();
    lucide.createIcons();
});


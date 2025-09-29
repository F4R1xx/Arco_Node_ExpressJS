document.addEventListener('DOMContentLoaded', () => {
    const mapWrapper = document.querySelector('.map-container-wrapper');
    const mapContainer = document.getElementById('map-container');
    // Variáveis dos spinners corrigidas para corresponder aos IDs no HTML
    const loadingSpinnerMap = document.getElementById('loading-spinner-map'); 
    const loadingSpinnerSidebar = document.getElementById('loading-spinner-sidebar');
    
    const locationsLegendList = document.getElementById('locations-legend-list');
    const modal = document.getElementById('asset-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('close-modal-btn');

    let allLocations = [];
    let allAssets = [];
    
    // Estado do mapa
    let transform = { scale: 1, translateX: 0, translateY: 0 };
    let isPanning = false;
    let startPan = { x: 0, y: 0 };

    const applyTransform = () => {
        if (!mapWrapper || !mapContainer) return;
        const maxX = 0;
        const minX = mapWrapper.clientWidth - mapContainer.clientWidth * transform.scale;
        const maxY = 0;
        const minY = mapWrapper.clientHeight - mapContainer.clientHeight * transform.scale;
        transform.translateX = Math.min(Math.max(transform.translateX, minX), maxX);
        transform.translateY = Math.min(Math.max(transform.translateY, minY), maxY);
        mapContainer.style.transform = `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`;
    };

    const setInitialView = () => {
        if (!mapWrapper || !mapContainer) return;
        const scaleX = mapWrapper.clientWidth / mapContainer.clientWidth;
        const scaleY = mapWrapper.clientHeight / mapContainer.clientHeight;
        transform.scale = Math.min(scaleX, scaleY);
        transform.translateX = (mapWrapper.clientWidth - mapContainer.clientWidth * transform.scale) / 2;
        transform.translateY = (mapWrapper.clientHeight - mapContainer.clientHeight * transform.scale) / 2;
        applyTransform();
    };
    
    const fetchAllData = async () => {
        // Mostra ambos os spinners no início
        if(loadingSpinnerMap) loadingSpinnerMap.hidden = false;
        if(loadingSpinnerSidebar) loadingSpinnerSidebar.hidden = false;

        try {
            const [locsResponse, assetsResponse] = await Promise.all([
                fetch('/api/locais'),
                fetch('/api/ativos')
            ]);
            if (!locsResponse.ok || !assetsResponse.ok) throw new Error('Falha ao carregar dados do servidor.');
            
            allLocations = await locsResponse.json();
            allAssets = await assetsResponse.json();

            renderMap();
            renderLegend();

        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            if(mapContainer) mapContainer.innerHTML = `<p>${error.message}</p>`;
        } finally {
            // Esconde ambos os spinners no final
            if(loadingSpinnerMap) loadingSpinnerMap.hidden = true;
            if(loadingSpinnerSidebar) loadingSpinnerSidebar.hidden = true;
        }
    };

    const renderMap = () => {
        if (!mapContainer) return;
        mapContainer.innerHTML = ''; // Limpa o mapa

        // 1. Desenha as áreas dos locais
        allLocations.forEach(loc => {
            if (loc.coords_json) {
                const coords = JSON.parse(loc.coords_json);
                const areaEl = document.createElement('div');
                areaEl.className = 'location-area';
                areaEl.style.left = `${coords.x}px`;
                areaEl.style.top = `${coords.y}px`;
                areaEl.style.width = `${coords.width}px`;
                areaEl.style.height = `${coords.height}px`;
                mapContainer.appendChild(areaEl);
            }
        });

        // 2. Desenha os marcadores de ativos
        allAssets.forEach(asset => {
            let location = allLocations.find(loc => loc.nome === asset.setor);
            if (!location) {
                 location = allLocations.find(loc => loc.nome === asset.local);
            }

            if (location && location.coords_json) {
                const coords = JSON.parse(location.coords_json);
                const assetX = coords.x + Math.random() * coords.width;
                const assetY = coords.y + Math.random() * coords.height;

                const marker = document.createElement('div');
                const typeClass = asset.tipo.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
                marker.className = `asset-marker marker-${typeClass || 'default'}`;
                marker.style.left = `${assetX}px`;
                marker.style.top = `${assetY}px`;
                marker.title = asset.nome_ativo || asset.tipo;

                marker.addEventListener('click', () => showAssetModal(asset));
                mapContainer.appendChild(marker);
            }
        });
    };

    const renderLegend = () => {
        if (!locationsLegendList) return;
        locationsLegendList.innerHTML = '';
        const sortedLocations = [...allLocations].sort((a, b) => a.nome.localeCompare(b.nome));

        sortedLocations.forEach(loc => {
            const item = document.createElement('div');
            item.className = 'location-legend-item';
            item.textContent = loc.nome;
            item.addEventListener('click', () => centerOnLocation(loc));
            locationsLegendList.appendChild(item);
        });
    };
    
    const centerOnLocation = (location) => {
        if (!location.coords_json) return;
        const coords = JSON.parse(location.coords_json);

        transform.scale = 1.5;
        const centerX = coords.x + coords.width / 2;
        const centerY = coords.y + coords.height / 2;
        
        transform.translateX = (mapWrapper.clientWidth / 2) - (centerX * transform.scale);
        transform.translateY = (mapWrapper.clientHeight / 2) - (centerY * transform.scale);
        
        applyTransform();
    };

    const showAssetModal = (asset) => {
        const dados = JSON.parse(asset.dados_especificos || '{}');
        let detailsHtml = `
            <div class="modal-header"><h2>${asset.nome_ativo || asset.tipo}</h2></div>
            <div class="detail-grid">
                <div class="detail-item"><strong>Tipo</strong><span>${asset.tipo}</span></div>
                ${asset.patrimonio ? `<div class="detail-item"><strong>Patrimônio</strong><span>${asset.patrimonio}</span></div>` : ''}
                ${asset.serial ? `<div class="detail-item"><strong>Serial</strong><span>${asset.serial}</span></div>` : ''}
                ${asset.marca_modelo ? `<div class="detail-item"><strong>Marca/Modelo</strong><span>${asset.marca_modelo}</span></div>` : ''}
                ${asset.local ? `<div class="detail-item"><strong>Local</strong><span>${asset.local}</span></div>` : ''}
                ${asset.setor ? `<div class="detail-item"><strong>Setor</strong><span>${asset.setor}</span></div>` : ''}
                ${dados.imei ? `<div class="detail-item"><strong>IMEI</strong><span>${dados.imei}</span></div>` : ''}
                ${dados.ramal ? `<div class="detail-item"><strong>Ramal</strong><span>${dados.ramal}</span></div>` : ''}
            </div>
        `;
        modalBody.innerHTML = detailsHtml;
        modal.hidden = false;
        lucide.createIcons();
    };

    // --- Event Listeners para Pan/Zoom e Modal ---
    if (mapWrapper) {
        mapWrapper.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isPanning = true;
            startPan = { x: e.clientX - transform.translateX, y: e.clientY - transform.translateY };
            mapWrapper.style.cursor = 'grabbing';
        });

        mapWrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = mapWrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const zoomFactor = 1.1;
            const oldScale = transform.scale;
            
            if (e.deltaY < 0) { transform.scale *= zoomFactor; } 
            else { transform.scale /= zoomFactor; }
            transform.scale = Math.min(Math.max(0.1, transform.scale), 5);

            transform.translateX = mouseX - (mouseX - transform.translateX) * (transform.scale / oldScale);
            transform.translateY = mouseY - (mouseY - transform.translateY) * (transform.scale / oldScale);
            applyTransform();
        });
    }

    window.addEventListener('mouseup', () => {
        isPanning = false;
        if (mapWrapper) mapWrapper.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        transform.translateX = e.clientX - startPan.x;
        transform.translateY = e.clientY - startPan.y;
        applyTransform();
    });

    if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.hidden = true);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.hidden = true;
    });

    // --- Inicialização ---
    setInitialView();
    fetchAllData();
    lucide.createIcons();
});


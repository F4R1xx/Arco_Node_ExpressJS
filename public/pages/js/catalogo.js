document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos da DOM ---
    const assetList = document.getElementById('asset-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noResults = document.getElementById('no-results');
    const searchInput = document.getElementById('search-input');
    const filterTipo = document.getElementById('filter-tipo');
    const modalContainer = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    const modalActions = document.getElementById('modal-actions');
    const closeModalBtn = document.getElementById('close-modal');

    // --- Estado da Aplicação ---
    let allAssets = [];
    let currentAssetId = null;

    const typeTagClasses = {
        'Estação de Trabalho': 'tag-estacao',
        'Monitor': 'tag-monitor',
        'Telefone': 'tag-telefone',
        'Câmera': 'tag-camera',
        'Switch': 'tag-switch'
    };
    
    // --- FUNÇÕES DE RENDERIZAÇÃO ---

    // Renderiza a lista principal de ativos
    const renderAssets = (assets) => {
        assetList.innerHTML = '';
        noResults.hidden = assets.length > 0;

        assets.forEach(asset => {
            if (asset.ativo_pai_id) return; // Não mostra ativos filhos (monitores) na lista principal
            const item = document.createElement('div');
            item.className = 'asset-list-item';
            
            let statusHtml = '<div class="col-status"></div>'; // Coluna vazia por padrão
            if (asset.tipo === 'Estação de Trabalho') {
                const statusClass = asset.status_online?.toLowerCase() || 'unknown';
                statusHtml = `<div class="col-status"><div class="status-light ${statusClass}">${asset.status_online || 'N/A'}</div></div>`;
            }

            item.innerHTML = `
                <div class="col-tipo"><span class="type-tag ${typeTagClasses[asset.tipo] || 'tag-default'}">${asset.tipo}</span></div>
                <div class="col-nome">${asset.nome_ativo || 'N/A'}</div>
                <div class="col-local">${asset.setor ? `${asset.local} / ${asset.setor}` : asset.local || 'N/A'}</div>
                <div class="col-patrimonio">${asset.patrimonio || 'N/A'}</div>
                ${statusHtml}
                <div class="col-actions"><button class="view-details-btn" data-id="${asset.id}" title="Ver detalhes"><i data-lucide="more-horizontal"></i></button></div>`;
            
            assetList.appendChild(item);
        });
        lucide.createIcons();
    };

    // Gera o HTML para o modo de VISUALIZAÇÃO do modal
    const createViewModeHtml = (asset) => {
        const dados = JSON.parse(asset.dados_especificos || '{}');
        let detailsHtml = `<div class="modal-header"><h2>${asset.nome_ativo || 'Ativo sem nome'}</h2><span class="type-tag ${typeTagClasses[asset.tipo] || 'tag-default'}">${asset.tipo}</span></div><div class="detail-grid">${asset.patrimonio ? `<div class="detail-item"><strong>Patrimônio</strong><span>${asset.patrimonio}</span></div>` : ''}${asset.serial ? `<div class="detail-item"><strong>Serial</strong><span>${asset.serial}</span></div>` : ''}${asset.marca_modelo ? `<div class="detail-item"><strong>Marca/Modelo</strong><span>${asset.marca_modelo}</span></div>` : ''}${asset.rfid ? `<div class="detail-item"><strong>RFID</strong><span>${asset.rfid}</span></div>` : ''}${asset.local ? `<div class="detail-item"><strong>Local</strong><span>${asset.local}</span></div>` : ''}${asset.setor ? `<div class="detail-item"><strong>Setor</strong><span>${asset.setor}</span></div>` : ''}</div>`;
        
        if (asset.tipo === 'Estação de Trabalho') {
            const statusClass = asset.status_online?.toLowerCase() || 'unknown';
            const ultimoPing = asset.ultimo_ping ? new Date(asset.ultimo_ping).toLocaleString('pt-BR') : 'Nunca';
            detailsHtml += `<h3 class="detail-section-title">Status da Conexão</h3><div class="ping-status-container"><div id="ping-status-display" class="ping-status-display"><div class="status-indicator ${statusClass}"></div><div class="status-text"><strong>${asset.status_online || 'Desconhecido'}</strong><span>Última verificação: ${ultimoPing}</span></div></div><button id="ping-btn" class="btn btn-secondary"><i data-lucide="activity"></i>Pingar Computador</button></div>`;
        }

        let specificDataHtml = '';
        if (dados.imei) specificDataHtml += `<div class="detail-item"><strong>IMEI</strong><span>${dados.imei}</span></div>`;
        if (dados.ramal) specificDataHtml += `<div class="detail-item"><strong>Ramal</strong><span>${dados.ramal}</span></div>`;
        if(specificDataHtml) detailsHtml += `<h3 class="detail-section-title">Dados Específicos</h3><div class="detail-grid">${specificDataHtml}</div>`;
        
        return detailsHtml;
    };

    // Gera o HTML para o modo de EDIÇÃO do modal
    const createEditModeHtml = (asset) => {
        const dados = JSON.parse(asset.dados_especificos || '{}');
        const v = (val) => val || ''; // Garante que nulos virem string vazia
        return `<div class="modal-header"><h2>Editando: ${v(asset.nome_ativo)}</h2></div><form id="edit-asset-form"><div class="detail-grid"><div class="form-group"><label for="edit-nome">Nome / Identificador</label><input type="text" id="edit-nome" value="${v(asset.nome_ativo)}"></div><div class="form-group"><label for="edit-patrimonio">Patrimônio</label><input type="text" id="edit-patrimonio" value="${v(asset.patrimonio)}"></div><div class="form-group"><label for="edit-serial">Serial</label><input type="text" id="edit-serial" value="${v(asset.serial)}"></div><div class="form-group"><label for="edit-rfid">RFID</label><input type="text" id="edit-rfid" value="${v(asset.rfid)}"></div><div class="form-group"><label for="edit-marca">Marca/Modelo</label><input type="text" id="edit-marca" value="${v(asset.marca_modelo)}"></div><div class="form-group"><label for="edit-local">Prédio / Unidade</label><input type="text" id="edit-local" value="${v(asset.local)}"></div><div class="form-group"><label for="edit-setor">Setor</label><input type="text" id="edit-setor" value="${v(asset.setor)}"></div></div>${asset.tipo === 'Telefone' ? `<h3 class="detail-section-title">Dados Específicos</h3><div class="detail-grid"><div class="form-group"><label for="edit-imei">IMEI</label><input type="text" id="edit-imei" value="${v(dados.imei)}"></div><div class="form-group"><label for="edit-ramal">Ramal</label><input type="text" id="edit-ramal" value="${v(dados.ramal)}"></div></div>` : ''}</form>`;
    };

    // --- LÓGICA DO MODAL ---
    
    const openModal = (assetId, mode = 'view') => {
        currentAssetId = assetId;
        const asset = allAssets.find(a => a.id === assetId);
        if (!asset) return;

        if (mode === 'view') {
            modalBody.innerHTML = createViewModeHtml(asset);
            modalActions.innerHTML = `<button id="delete-btn" class="btn btn-danger-outline">Excluir</button><button id="edit-btn" class="btn btn-primary">Editar</button>`;
            document.getElementById('edit-btn').addEventListener('click', () => openModal(assetId, 'edit'));
            document.getElementById('delete-btn').addEventListener('click', showDeleteConfirmation);
            const pingBtn = document.getElementById('ping-btn');
            if (pingBtn) pingBtn.addEventListener('click', () => handlePing(asset));
        } else if (mode === 'edit') {
            modalBody.innerHTML = createEditModeHtml(asset);
            modalActions.innerHTML = `<button id="cancel-btn" class="btn btn-secondary">Cancelar</button><button id="save-btn" class="btn btn-primary">Salvar Alterações</button>`;
            document.getElementById('cancel-btn').addEventListener('click', () => openModal(assetId, 'view'));
            document.getElementById('save-btn').addEventListener('click', handleSave);
        }
        modalContainer.hidden = false;
        lucide.createIcons();
    };

    const showDeleteConfirmation = () => {
        modalBody.innerHTML = `<div class="delete-prompt"><i data-lucide="alert-triangle"></i><h3>Confirmar Exclusão</h3><p>Esta ação não pode ser desfeita. Se este ativo for uma estação de trabalho, todos os monitores vinculados também serão removidos.</p></div>`;
        modalActions.innerHTML = `<button id="cancel-delete-btn" class="btn btn-secondary">Cancelar</button><button id="confirm-delete-btn" class="btn btn-danger">Sim, Excluir Ativo</button>`;
        document.getElementById('cancel-delete-btn').addEventListener('click', () => openModal(currentAssetId, 'view'));
        document.getElementById('confirm-delete-btn').addEventListener('click', handleDelete);
        lucide.createIcons();
    };

    // --- FUNÇÕES DE API (PING, SALVAR, EXCLUIR) ---

    const handlePing = async (asset) => {
        const pingBtn = document.getElementById('ping-btn');
        const statusDisplay = document.getElementById('ping-status-display');
        if (!pingBtn || !statusDisplay) return;
        pingBtn.disabled = true;
        pingBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i>Pingando...';
        lucide.createIcons();
        try {
            const response = await fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostname: asset.nome_ativo }) });
            if (!response.ok) {
                let errorMsg = 'Falha na resposta do servidor.';
                try {
                    const result = await response.json();
                    errorMsg = result.error || errorMsg;
                } catch (e) {
                   // A resposta não era JSON, o que pode acontecer em erros 500
                   errorMsg = `Erro ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMsg);
            }
            const result = await response.json();
            
            const statusClass = result.status.toLowerCase();
            statusDisplay.innerHTML = `<div class="status-indicator ${statusClass}"></div><div class="status-text"><strong>${result.status}</strong><span>Última verificação: ${new Date(result.timestamp).toLocaleString('pt-BR')}</span></div>`;
            
            const assetIndex = allAssets.findIndex(a => a.id === asset.id);
            if (assetIndex > -1) {
                allAssets[assetIndex].status_online = result.status;
                allAssets[assetIndex].ultimo_ping = result.timestamp;
                filterAndSearch(); // Re-renderiza a lista principal para atualizar o status
            }
        } catch (error) {
            statusDisplay.querySelector('.status-text').innerHTML = `<strong>Erro</strong><span>${error.message}</span>`;
        } finally {
            pingBtn.disabled = false;
            pingBtn.innerHTML = '<i data-lucide="activity"></i>Pingar Computador';
            lucide.createIcons();
        }
    };

    const handleSave = async () => {
        if (!currentAssetId) return;
        const asset = allAssets.find(a => a.id === currentAssetId);
        const dados = JSON.parse(asset.dados_especificos || '{}');
        const updatedData = {
            nome_ativo: document.getElementById('edit-nome').value,
            patrimonio: document.getElementById('edit-patrimonio').value,
            serial: document.getElementById('edit-serial').value,
            rfid: document.getElementById('edit-rfid').value,
            marca_modelo: document.getElementById('edit-marca').value,
            local: document.getElementById('edit-local').value,
            setor: document.getElementById('edit-setor').value,
            dados_especificos: { ...dados, imei: asset.tipo === 'Telefone' ? document.getElementById('edit-imei').value : dados.imei, ramal: asset.tipo === 'Telefone' ? document.getElementById('edit-ramal').value : dados.ramal, }
        };
        try {
            const response = await fetch(`/api/ativos/${currentAssetId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert(result.message);
            modalContainer.hidden = true;
            await fetchAssets();
        } catch (error) {
            alert(`Erro ao salvar: ${error.message}`);
        }
    };

    const handleDelete = async () => {
        try {
            const response = await fetch(`/api/ativos/${currentAssetId}`, { method: 'DELETE' });
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                let errorMsg = 'Erro do servidor.';
                if (contentType && contentType.includes("application/json")) {
                    const result = await response.json();
                    errorMsg = result.error;
                } else {
                    errorMsg = await response.text();
                }
                throw new Error(errorMsg);
            }
            const result = await response.json();
            alert(result.message);
            modalContainer.hidden = true;
            await fetchAssets();
        } catch (error) {
            alert(`Erro ao excluir: ${error.message}`);
        }
    };

    // --- BUSCA E FILTRO ---

    const fetchAssets = async () => {
        loadingSpinner.hidden = false;
        try {
            const response = await fetch('/api/ativos');
            if (!response.ok) throw new Error('Falha ao carregar os dados.');
            allAssets = await response.json();
            filterAndSearch();
        } catch (error) {
            assetList.innerHTML = `<p class="no-results-message">Erro ao carregar ativos. Tente novamente.</p>`;
        } finally {
            loadingSpinner.hidden = true;
        }
    };

    const filterAndSearch = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const tipo = filterTipo.value;
        const filteredAssets = allAssets.filter(asset =>
            (searchTerm === '' || ['nome_ativo', 'patrimonio', 'serial', 'local', 'setor'].some(field => asset[field]?.toLowerCase().includes(searchTerm))) &&
            (tipo === 'todos' || asset.tipo === tipo)
        );
        renderAssets(filteredAssets);
    };
    
    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    searchInput.addEventListener('input', filterAndSearch);
    filterTipo.addEventListener('change', filterAndSearch);
    assetList.addEventListener('click', e => {
        const button = e.target.closest('.view-details-btn');
        if (button) openModal(parseInt(button.dataset.id, 10), 'view');
    });
    closeModalBtn.addEventListener('click', () => modalContainer.hidden = true);
    modalContainer.addEventListener('click', e => {
        if (e.target === modalContainer) modalContainer.hidden = true;
    });

    fetchAssets();
});

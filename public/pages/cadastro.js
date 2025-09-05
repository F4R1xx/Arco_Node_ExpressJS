document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-cadastro-estacao');
    const monitoresContainer = document.getElementById('monitores-container');
    const addMonitorBtn = document.getElementById('add-monitor-btn');
    let monitorCount = 0;

    // Função para adicionar um novo conjunto de campos de monitor
    const addMonitorField = () => {
        monitorCount++;
        const monitorId = monitorCount;

        const monitorEntry = document.createElement('div');
        monitorEntry.classList.add('monitor-entry');
        monitorEntry.setAttribute('id', `monitor-entry-${monitorId}`);

        monitorEntry.innerHTML = `
            <h4>Monitor ${monitorId}</h4>
            <div class="form-grid">
                <div class="form-group">
                    <label for="monitor-patrimonio-${monitorId}">Patrimônio</label>
                    <input type="text" id="monitor-patrimonio-${monitorId}" class="monitor-patrimonio">
                </div>
                <div class="form-group">
                    <label for="monitor-rfid-${monitorId}">RFID</label>
                    <input type="text" id="monitor-rfid-${monitorId}" class="monitor-rfid">
                </div>
                <div class="form-group">
                    <label for="monitor-serial-${monitorId}">Serial</label>
                    <input type="text" id="monitor-serial-${monitorId}" class="monitor-serial">
                </div>
                <div class="form-group">
                    <label for="monitor-marca-${monitorId}">Marca/Modelo</label>
                    <input type="text" id="monitor-marca-${monitorId}" class="monitor-marca">
                </div>
            </div>
            <button type="button" class="remove-monitor-btn" data-monitor-id="${monitorId}">
                <i data-lucide="x"></i>
            </button>
        `;
        monitoresContainer.appendChild(monitorEntry);
        lucide.createIcons(); // Recria os ícones para incluir o novo 'x'
    };

    // Adiciona o primeiro campo de monitor ao carregar a página
    addMonitorField();

    // Event listener para adicionar mais monitores
    addMonitorBtn.addEventListener('click', addMonitorField);

    // Event listener para remover um monitor (usando delegação de eventos)
    monitoresContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-monitor-btn');
        if (removeBtn) {
            const monitorId = removeBtn.dataset.monitorId;
            const monitorEntryToRemove = document.getElementById(`monitor-entry-${monitorId}`);
            if (monitorEntryToRemove) {
                monitorEntryToRemove.remove();
            }
        }
    });

    // Event listener para o envio do formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Coletar dados do computador
        const computador = {
            nome: document.getElementById('comp-nome').value,
            patrimonio: document.getElementById('comp-patrimonio').value,
            rfid: document.getElementById('comp-rfid').value,
            serial: document.getElementById('comp-serial').value,
            marca: document.getElementById('comp-marca').value,
        };

        // 2. Coletar dados dos monitores
        const monitores = [];
        const monitorEntries = monitoresContainer.querySelectorAll('.monitor-entry');
        monitorEntries.forEach(entry => {
            const monitor = {
                patrimonio: entry.querySelector('.monitor-patrimonio').value,
                rfid: entry.querySelector('.monitor-rfid').value,
                serial: entry.querySelector('.monitor-serial').value,
                marca: entry.querySelector('.monitor-marca').value,
            };
            // Adiciona apenas se algum campo do monitor foi preenchido
            if (Object.values(monitor).some(val => val.trim() !== '')) {
                monitores.push(monitor);
            }
        });

        // 3. Coletar dados dos periféricos
        const perifericos = {
            teclado: document.getElementById('teclado').checked,
            mouse: document.getElementById('mouse').checked,
            headset: document.getElementById('headset').checked,
            mousepad: document.getElementById('mousepad').checked,
            suporte_headset: document.getElementById('suporte-headset').checked,
            webcam: document.getElementById('webcam').checked,
        };

        // 4. Coletar dados de localização
        const localizacao = {
            local: document.getElementById('local').value,
            setor: document.getElementById('setor').value,
        };
        
        // 5. Montar o payload final
        const payload = {
            computador,
            monitores,
            perifericos,
            localizacao
        };

        // 6. Enviar para a API
        try {
            const response = await fetch('/api/estacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Estação de trabalho cadastrada com sucesso! ID: ${result.id}`);
                form.reset();
                monitoresContainer.innerHTML = ''; // Limpa os campos de monitor
                addMonitorField(); // Adiciona o primeiro novamente
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao cadastrar a estação.');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert(`Erro ao cadastrar: ${error.message}`);
        }
    });
});

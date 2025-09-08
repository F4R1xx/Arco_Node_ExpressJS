document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-add-local');
    const locationInput = document.getElementById('nome-local');
    const locationList = document.getElementById('location-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noLocationsMsg = document.getElementById('no-locations');

    // Função para renderizar a lista de locais
    const renderLocations = (locations) => {
        locationList.innerHTML = ''; 
        if (locations.length === 0) {
            noLocationsMsg.hidden = false;
            return;
        }
        noLocationsMsg.hidden = true;

        locations.forEach(location => {
            const item = document.createElement('div');
            item.className = 'location-list-item';
            // Adicionado o botão de apagar
            item.innerHTML = `
                <span>${location.nome}</span>
                <button class="delete-location-btn" data-id="${location.id}" title="Apagar local">
                    <i data-lucide="trash-2"></i>
                </button>
            `;
            locationList.appendChild(item);
        });
        lucide.createIcons(); // Recria os ícones para incluir o novo
    };

    // Função para buscar os locais da API
    const fetchLocations = async () => {
        try {
            loadingSpinner.hidden = false;
            const response = await fetch('/api/locais');
            if (!response.ok) throw new Error('Falha ao carregar locais.');
            const locations = await response.json();
            renderLocations(locations);
        } catch (error) {
            console.error('Erro:', error);
            locationList.innerHTML = `<p class="empty-message">Erro ao carregar locais.</p>`;
        } finally {
            loadingSpinner.hidden = true;
        }
    };

    // Event listener para o formulário de adição
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = locationInput.value.trim();
        if (!nome) return;

        try {
            const response = await fetch('/api/locais', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            locationInput.value = '';
            fetchLocations();

        } catch (error) {
            console.error('Erro ao adicionar local:', error);
            alert(`Erro: ${error.message}`);
        }
    });

    // --- NOVO EVENT LISTENER PARA APAGAR ---
    locationList.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-location-btn');
        if (deleteBtn) {
            const locationId = deleteBtn.dataset.id;
            const locationName = deleteBtn.previousElementSibling.textContent;
            
            // Mensagem de confirmação para evitar exclusões acidentais
            if (confirm(`Tem a certeza de que deseja apagar o local "${locationName}"? Esta ação não pode ser desfeita.`)) {
                try {
                    const response = await fetch(`/api/locais/${locationId}`, {
                        method: 'DELETE'
                    });
                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error);
                    }
                    alert(result.message);
                    fetchLocations(); // Atualiza a lista após apagar
                } catch (error) {
                    console.error('Erro ao apagar local:', error);
                    alert(`Não foi possível apagar o local: ${error.message}`);
                }
            }
        }
    });

    fetchLocations();
});


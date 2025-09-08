const express = require('express');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
const port = 3000;

let db;

async function setupDatabase() {
  db = await sqlite.open({
    filename: './database.db',
    driver: sqlite3.Database
  });
  console.log('Conectado ao banco de dados SQLite.');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, nome_ativo TEXT,
      patrimonio TEXT, rfid TEXT, serial TEXT, marca_modelo TEXT, local TEXT,
      setor TEXT, ativo_pai_id INTEGER, dados_especificos TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ativo_pai_id) REFERENCES ativos(id) ON DELETE SET NULL
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS locais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );
  `);
  
  console.log('Tabelas "ativos" e "locais" prontas.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE API PARA LOCAIS ---

app.get('/api/locais', async (req, res) => {
    try {
        const locais = await db.all('SELECT * FROM locais ORDER BY nome');
        res.json(locais);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar locais.' });
    }
});

app.post('/api/locais', async (req, res) => {
    const { nome } = req.body;
    if (!nome) {
        return res.status(400).json({ error: 'O nome do local é obrigatório.' });
    }
    try {
        const result = await db.run('INSERT INTO locais (nome) VALUES (?)', [nome]);
        res.status(201).json({ id: result.lastID, nome });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Este local já existe.' });
        }
        res.status(500).json({ error: 'Erro ao adicionar o local.' });
    }
});

// --- NOVA ROTA DE EXCLUSÃO (DELETE) ---
app.delete('/api/locais/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Primeiro, verifica se o local está em uso por algum ativo
        const local = await db.get('SELECT nome FROM locais WHERE id = ?', [id]);
        if (!local) {
            return res.status(404).json({ error: 'Local não encontrado.' });
        }

        const ativoUsando = await db.get('SELECT id FROM ativos WHERE local = ?', [local.nome]);
        if (ativoUsando) {
            return res.status(400).json({ error: 'Este local não pode ser apagado pois está em uso por um ou mais ativos.' });
        }

        // Se não estiver em uso, apaga o local
        await db.run('DELETE FROM locais WHERE id = ?', [id]);
        res.status(200).json({ message: 'Local apagado com sucesso!' });

    } catch (err) {
        console.error("Erro ao apagar local:", err.message);
        res.status(500).json({ error: 'Erro ao apagar o local.' });
    }
});


// --- ROTAS DE ATIVOS (sem alteração) ---
// (Coloque aqui as suas rotas POST, PUT, e GET para /api/ativos)
app.post('/api/ativos', async (req, res) => { /* ... código existente ... */ });
app.put('/api/ativos/:id', async (req, res) => { /* ... código existente ... */ });
app.get('/api/ativos', async (req, res) => { /* ... código existente ... */ });


async function startServer() {
  await setupDatabase();
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

startServer();


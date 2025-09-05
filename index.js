const express = require('express');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path'); // Para trabalhar com caminhos de arquivo

const app = express();
const port = 3000;

// Conecta ao banco de dados e inicializa as tabelas
let db;
async function setupDatabase() {
  db = await sqlite.open({
    filename: './database.db',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      localizacao TEXT,
      status TEXT
    );
  `);
  console.log('Tabela de itens criada ou já existente.');
}

// Middleware para processar JSON (necessário para API REST)
app.use(express.json());

// Serve os arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Rotas de API ---

// Rota para listar todos os itens
app.get('/api/itens', async (req, res) => {
  try {
    const itens = await db.all('SELECT * FROM itens');
    res.json(itens); // Envia os dados como JSON
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar itens.' });
  }
});

// Rota para adicionar um novo item
app.post('/api/itens', async (req, res) => {
  try {
    const { nome, localizacao, status } = req.body;
    const result = await db.run(
      'INSERT INTO itens (nome, localizacao, status) VALUES (?, ?, ?)',
      [nome, localizacao, status]
    );
    res.status(201).json({ id: result.lastID, nome, localizacao, status });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar item.' });
  }
});

// Inicia o servidor e o banco de dados
async function startServer() {
  await setupDatabase();
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

startServer();
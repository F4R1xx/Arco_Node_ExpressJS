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

  // Mantém a tabela antiga se existir
  await db.exec(`
    CREATE TABLE IF NOT EXISTS itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      localizacao TEXT,
      status TEXT
    );
  `);

  // Cria as novas tabelas para estações de trabalho
  await db.exec(`
    CREATE TABLE IF NOT EXISTS estacoes_trabalho (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computador_nome TEXT,
      computador_patrimonio TEXT,
      computador_rfid TEXT,
      computador_serial TEXT,
      computador_marca TEXT,
      teclado BOOLEAN,
      mouse BOOLEAN,
      headset BOOLEAN,
      mousepad BOOLEAN,
      suporte_headset BOOLEAN,
      webcam BOOLEAN,
      local TEXT,
      setor TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS monitores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estacao_id INTEGER,
      patrimonio TEXT,
      rfid TEXT,
      serial TEXT,
      marca TEXT,
      FOREIGN KEY (estacao_id) REFERENCES estacoes_trabalho(id) ON DELETE CASCADE
    );
  `);
  
  console.log('Tabelas de estações de trabalho e monitores prontas.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Rotas de API ---

// Rota para adicionar uma nova estação de trabalho
app.post('/api/estacao', async (req, res) => {
  const { computador, monitores, perifericos, localizacao } = req.body;

  try {
    // Inicia a transação
    await db.exec('BEGIN TRANSACTION');

    const estacaoResult = await db.run(
      `INSERT INTO estacoes_trabalho (
        computador_nome, computador_patrimonio, computador_rfid, computador_serial, computador_marca,
        teclado, mouse, headset, mousepad, suporte_headset, webcam,
        local, setor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        computador.nome, computador.patrimonio, computador.rfid, computador.serial, computador.marca,
        perifericos.teclado, perifericos.mouse, perifericos.headset, perifericos.mousepad, perifericos.suporte_headset, perifericos.webcam,
        localizacao.local, localizacao.setor
      ]
    );

    const estacaoId = estacaoResult.lastID;

    if (monitores && monitores.length > 0) {
      const stmt = await db.prepare('INSERT INTO monitores (estacao_id, patrimonio, rfid, serial, marca) VALUES (?, ?, ?, ?, ?)');
      for (const monitor of monitores) {
        await stmt.run(estacaoId, monitor.patrimonio, monitor.rfid, monitor.serial, monitor.marca);
      }
      await stmt.finalize();
    }
    
    // Finaliza a transação
    await db.exec('COMMIT');

    res.status(201).json({ id: estacaoId, message: 'Estação de trabalho cadastrada com sucesso!' });

  } catch (err) {
    // Em caso de erro, desfaz a transação
    await db.exec('ROLLBACK');
    console.error('Erro no cadastro:', err.message);
    res.status(500).json({ error: 'Erro ao cadastrar a estação de trabalho.' });
  }
});


// Rota antiga para listar itens (pode ser mantida ou removida)
app.get('/api/itens', async (req, res) => {
  try {
    const itens = await db.all('SELECT * FROM itens');
    res.json(itens);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar itens.' });
  }
});

async function startServer() {
  await setupDatabase();
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

startServer();

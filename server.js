const express = require('express');
const { conectarBanco, getDb } = require('./db'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware essencial para ler JSON
app.use(express.json());

// Conecta ao banco de dados e só depois inicia o servidor
conectarBanco()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
        });
    })
    .catch((erro) => {
        console.error("❌ Erro ao conectar ao banco de dados:", erro);
        process.exit(1); 
    });

// Rota GET inicial de teste
app.get('/', (req, res) => {
    res.send('🎵 API de Música Gospel rodando e conectada!');
});

// Rota GET para listar todas as músicas guardadas na base de dados
app.get('/musicas', async (req, res) => {
    try {
        const banco = getDb();
        const colecao = banco.collection('lista_musicas');
        const musicas = await colecao.find({}).toArray();
        res.status(200).json(musicas);
    } catch (erro) {
        console.error("❌ Erro ao buscar músicas:", erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao obter a lista de músicas.' });
    }
},);

// Rota POST para adicionar uma nova música gospel ao MongoDB
app.post('/musicas', async (req, res) => {
    try {
        const banco = getDb();
        const colecao = banco.collection('lista_musicas'); 
        const novaMusica = req.body; 
        const resultado = await colecao.insertOne(novaMusica);
        
        res.status(201).json({ 
            mensagem: 'Música gospel adicionada com sucesso!', 
            id: resultado.insertedId 
        });
    } catch (erro) {
        console.error("❌ Erro ao adicionar música:", erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao guardar a música na base de dados.' });
    }
});

// Rota GET para pesquisar músicas na API do Deezer
app.get('/deezer/pesquisar/:termo', async (req, res) => {
    try {
        const termo = req.params.termo;
        
        // Faz a pesquisa diretamente com o termo inserido
        const resposta = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(termo)}`);
        const dados = await resposta.json();
        
        res.status(200).json(dados.data);
    } catch (erro) {
        console.error("❌ Erro ao consultar a API do Deezer:", erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao comunicar com a API do Deezer.' });
    }
});
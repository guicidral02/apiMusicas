const express = require('express');
const { conectarBanco, getDb } = require('./db');
const { ObjectId } = require('mongodb'); // Necessário para encontrar itens pelo ID (PUT e DELETE)
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
});

// Rota POST para adicionar uma nova música ao MongoDB
app.post('/musicas', async (req, res) => {
    try {
        const banco = getDb();
        const colecao = banco.collection('lista_musicas'); 
        const novaMusica = req.body; 
        const resultado = await colecao.insertOne(novaMusica);
        
        res.status(201).json({ 
            mensagem: 'Música adicionada com sucesso!', 
            id: resultado.insertedId 
        });
    } catch (erro) {
        console.error("❌ Erro ao adicionar música:", erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao guardar a música.' });
    }
});

// Rota PUT para atualizar os dados de uma música existente
app.put('/musicas/:id', async (req, res) => {
    try {
        const banco = getDb();
        const colecao = banco.collection('lista_musicas');
        const id = req.params.id;
        const dadosAtualizados = req.body;

        const resultado = await colecao.updateOne(
            { _id: new ObjectId(id) },
            { $set: dadosAtualizados }
        );

        if (resultado.matchedCount === 0) {
            return res.status(404).json({ erro: 'Música não encontrada.' });
        }

        res.status(200).json({ mensagem: 'Música atualizada com sucesso!' });
    } catch (erro) {
        console.error("❌ Erro ao atualizar música:", erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao atualizar a música.' });
    }
});

// Rota DELETE para apagar uma música da base de dados
app.delete('/musicas/:id', async (req, res) => {
    try {
        const banco = getDb();
        const colecao = banco.collection('lista_musicas');
        const id = req.params.id;

        const resultado = await colecao.deleteOne({ _id: new ObjectId(id) });

        if (resultado.deletedCount === 0) {
            return res.status(404).json({ erro: 'Música não encontrada.' });
        }

        res.status(200).json({ mensagem: 'Música apagada com sucesso!' });
    } catch (erro) {
        console.error("❌ Erro ao apagar música:", erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao apagar a música.' });
    }
});

// Rota GET para pesquisar músicas na API do Deezer
app.get('/deezer/pesquisar/:termo', async (req, res) => {
    try {
        const termo = req.params.termo;
        
        // Faz a pesquisa diretamente com o termo inserido (ex: midianlima)
        const resposta = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(termo)}`);
        const dados = await resposta.json();
        
        res.status(200).json(dados.data);
    } catch (erro) {
        console.error("❌ Erro ao consultar a API do Deezer:", erro);
        res.status(500).json({ erro: 'Ocorreu um erro ao comunicar com a API do Deezer.' });
    }
});

setTimeout(async () => {
    try {
        // 1. SE QUISERES ADICIONAR UMA MÚSICA:
        // Descomenta (tira as barras //) do código abaixo e muda os dados dentro dos parênteses
        
        
        await fetch('http://localhost:3000/musicas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                titulo: "É tudo Sobre Você", 
                artista: "Morada", 
                album: "Ele É", 
                ano: 2021 
            })
        });
        
        // 2. MOSTRAR A TABELA NO TERMINAL:
        console.log("\n📋 A carregar a tua lista de músicas da base de dados...\n");
        const resposta = await fetch('http://localhost:3000/musicas');
        const musicas = await resposta.json();
        
        if (musicas.length > 0) {
            console.table(musicas);
        } else {
            console.log("A tua base de dados ainda está vazia.");
        }
    } catch (erro) {
        console.error("Erro no teste automático:", erro);
    }
}, 1000);
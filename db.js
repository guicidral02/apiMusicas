const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db('projeto_musica'); 
        console.log("✅ Conectado ao MongoDB com sucesso!");
        return db;
    } catch (err) {
        console.error("❌ Erro ao conectar ao MongoDB:", err);
        process.exit(1); 
    }
}

function getDb() {
    if (!db) {
        throw new Error("A base de dados ainda não foi conectada.");
    }
    return db;
}

module.exports = { conectarBanco, getDb };
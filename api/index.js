const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const accountingKnowledge = require("../data/contabilidade");
const reformKnowledge = require("../data/reforma-tributaria");

const app = express();
app.use(express.json({ limit: "2mb" }));

// ======================================================
// CONFIGURAÇÃO
// ======================================================
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://USUARIO:SENHA@cluster.mongodb.net/softcom?retryWrites=true&w=majority";
const PORT = process.env.PORT || 3000;
const PRE_DEFINED_ACCESS_PASSWORD = process.env.REGISTER_ACCESS_PASSWORD || "otimus32";
const JWT_SECRET = process.env.JWT_SECRET || "troque-esta-chave-jwt-em-producao";
const MAX_UPLOAD_BYTES = Math.floor(2.5 * 1024 * 1024);

// ======================================================
// MONGODB
// ======================================================
let mongoPromise = null;
async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!mongoPromise) {
    mongoPromise = mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 }).catch(error => {
      mongoPromise = null;
      throw error;
    });
  }
  await mongoPromise;
}

// ======================================================
// MODELOS
// ======================================================
const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({
  login: { type: String, required: true, unique: true, trim: true, lowercase: true },
  senhaHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" },
  createdAt: { type: Date, default: Date.now }
}, { collection: "users" }));

const Memory = mongoose.models.Memory || mongoose.model("Memory", new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  texto: { type: String, required: true },
  imagemUrl: { type: String, default: "" },
  agente: { type: String, default: "Sistema" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: "memories" }));

const DocumentFolder = mongoose.models.DocumentFolder || mongoose.model("DocumentFolder", new mongoose.Schema({
  nome: { type: String, required: true, trim: true, unique: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: "document_folders" }));

const DocumentItem = mongoose.models.DocumentItem || mongoose.model("DocumentItem", new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  descricao: { type: String, default: "" },
  pastaId: { type: mongoose.Schema.Types.ObjectId, ref: "DocumentFolder", default: null },
  pastaNome: { type: String, default: "" },
  tipoConteudo: { type: String, enum: ["TEXTO", "PDF", "HTML", "VIDEO", "IMAGEM", "AUDIO", "LINK", "ARQUIVO"], required: true },
  texto: { type: String, default: "" },
  externalUrl: { type: String, default: "" },
  nomeArquivo: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  content: { type: String, default: "" },
  agente: { type: String, default: "Sistema" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: "documents" }));

// ======================================================
// AUTH
// ======================================================
function createToken(user) {
  return jwt.sign({ sub: String(user._id), login: user.login, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
}
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Usuário não autenticado." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Acesso restrito aos administradores." });
  next();
}

// ======================================================
// HEALTH
// ======================================================
app.get("/api/health", async (req, res) => {
  try {
    await connectDatabase();
    res.json({ ok: true, empresa: "Softcom", database: "online", mongooseState: mongoose.connection.readyState });
  } catch (error) {
    console.error("ERRO MONGODB:", error);
    res.status(500).json({ ok: false, database: "offline", error: error.message, code: error.code || null });
  }
});

// ======================================================
// USUÁRIOS
// ======================================================
async function registerUser(req, res) {
  try {
    const login = String(req.body.login || req.body.username || "").trim().toLowerCase();
    const senha = String(req.body.senha || req.body.password || "");
    const accessPassword = String(req.body.accessPassword || "");
    if (!login || !senha || !accessPassword) return res.status(400).json({ message: "Preencha usuário, senha e chave de cadastro." });
    if (accessPassword !== PRE_DEFINED_ACCESS_PASSWORD) return res.status(403).json({ message: "Chave de cadastro incorreta." });
    if (senha.length < 6) return res.status(400).json({ message: "A senha deve possuir pelo menos 6 caracteres." });
    await connectDatabase();
    if (await User.findOne({ login })) return res.status(409).json({ message: "Este usuário já está cadastrado." });
    const senhaHash = await bcrypt.hash(senha, 12);
    const role = (await User.countDocuments()) === 0 ? "admin" : "user";
    const user = await User.create({ login, senhaHash, role });
    return res.status(201).json({ message: "Usuário cadastrado com sucesso.", user: { id: user._id, login: user.login, role: user.role } });
  } catch (error) {
    console.error("ERRO CADASTRO:", error);
    return res.status(500).json({ message: "Erro interno ao cadastrar usuário.", error: error.message, code: error.code || null });
  }
}
async function loginUser(req, res) {
  try {
    await connectDatabase();
    const login = String(req.body.login || req.body.username || "").trim().toLowerCase();
    const senha = String(req.body.senha || req.body.password || "");
    const user = await User.findOne({ login });
    if (!user || !await bcrypt.compare(senha, user.senhaHash)) return res.status(401).json({ authenticated: false, message: "Usuário ou senha inválidos." });
    return res.json({ authenticated: true, token: createToken(user), user: { id: user._id, login: user.login, role: user.role } });
  } catch (error) {
    console.error("ERRO LOGIN:", error);
    return res.status(500).json({ authenticated: false, message: "Erro interno ao realizar login.", error: error.message });
  }
}
app.post("/api/auth/register", registerUser);
app.post("/api/users", registerUser);
app.post("/api/auth/login", loginUser);
app.post("/api/login", loginUser);

// ======================================================
// CONHECIMENTO - ÚNICA BASE DO CHAT SOFTCOM
// ======================================================
app.get("/api/memories", authenticate, async (req, res) => {
  try {
    await connectDatabase();
    return res.json(await Memory.find().sort({ updatedAt: -1 }).lean());
  } catch (error) {
    return res.status(500).json({ message: "Erro ao carregar Conhecimento.", error: error.message });
  }
});
app.post("/api/memories", authenticate, requireAdmin, async (req, res) => {
  try {
    await connectDatabase();
    const titulo = String(req.body.titulo || "").trim();
    const texto = String(req.body.texto || "").trim();
    const imagemUrl = String(req.body.imagemUrl || "").trim();
    if (!titulo || !texto) return res.status(400).json({ message: "Título e conteúdo são obrigatórios." });
    const item = await Memory.create({ titulo, texto, imagemUrl, agente: req.user.login });
    return res.status(201).json({ message: "Conhecimento cadastrado com sucesso.", item });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao cadastrar Conhecimento.", error: error.message });
  }
});
app.put("/api/memories/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await connectDatabase();
    const titulo = String(req.body.titulo || "").trim();
    const texto = String(req.body.texto || "").trim();
    const imagemUrl = String(req.body.imagemUrl || "").trim();
    if (!titulo || !texto) return res.status(400).json({ message: "Título e conteúdo são obrigatórios." });
    const item = await Memory.findByIdAndUpdate(req.params.id, { titulo, texto, imagemUrl, agente: req.user.login, updatedAt: new Date() }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Conhecimento não encontrado." });
    return res.json({ message: "Conhecimento atualizado com sucesso.", item });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao atualizar Conhecimento.", error: error.message });
  }
});
app.delete("/api/memories/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await connectDatabase();
    const item = await Memory.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Conhecimento não encontrado." });
    return res.json({ message: "Conhecimento excluído com sucesso." });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao excluir Conhecimento.", error: error.message });
  }
});

// ======================================================
// DOCUMENTAÇÃO - BIBLIOTECA INDEPENDENTE
// ======================================================
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });
function uploadSingle(req, res, next) {
  upload.single("arquivo")(req, res, error => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Arquivo muito grande. Limite local: 2,5 MB. Para vídeos maiores, use uma URL externa." });
    return res.status(400).json({ message: error.message || "Erro no upload." });
  });
}
function validHttpUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol); } catch { return false; }
}
function regexEscape(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

app.get("/api/documentos/pastas", authenticate, async (req, res) => {
  try { await connectDatabase(); return res.json(await DocumentFolder.find().sort({ nome: 1 }).lean()); }
  catch (error) { return res.status(500).json({ message: "Erro ao carregar pastas.", error: error.message }); }
});
app.post("/api/documentos/pastas", authenticate, requireAdmin, async (req, res) => {
  try {
    await connectDatabase();
    const nome = String(req.body.nome || "").trim();
    if (!nome) return res.status(400).json({ message: "Informe o nome da pasta." });
    const existing = await DocumentFolder.findOne({ nome: new RegExp(`^${regexEscape(nome)}$`, "i") });
    if (existing) return res.status(409).json({ message: "Já existe uma pasta com este nome.", folder: existing });
    const folder = await DocumentFolder.create({ nome });
    return res.status(201).json({ message: "Pasta criada com sucesso.", folder });
  } catch (error) { return res.status(500).json({ message: "Erro ao criar pasta.", error: error.message }); }
});
app.put("/api/documentos/pastas/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await connectDatabase();
    const nome = String(req.body.nome || "").trim();
    if (!nome) return res.status(400).json({ message: "Informe o novo nome." });
    const folder = await DocumentFolder.findByIdAndUpdate(req.params.id, { nome }, { new: true, runValidators: true });
    if (!folder) return res.status(404).json({ message: "Pasta não encontrada." });
    await DocumentItem.updateMany({ pastaId: folder._id }, { pastaNome: folder.nome });
    return res.json({ message: "Pasta renomeada com sucesso.", folder });
  } catch (error) { return res.status(500).json({ message: "Erro ao renomear pasta.", error: error.message }); }
});
app.delete("/api/documentos/pastas/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await connectDatabase();
    if (await DocumentItem.countDocuments({ pastaId: req.params.id })) return res.status(409).json({ message: "A pasta contém documentos. Mova ou exclua os itens antes de apagar a pasta." });
    const folder = await DocumentFolder.findByIdAndDelete(req.params.id);
    if (!folder) return res.status(404).json({ message: "Pasta não encontrada." });
    return res.json({ message: "Pasta excluída com sucesso." });
  } catch (error) { return res.status(500).json({ message: "Erro ao excluir pasta.", error: error.message }); }
});

app.get("/api/documentos", authenticate, async (req, res) => {
  try {
    await connectDatabase();
    const docs = await DocumentItem.find().select("-content -texto").sort({ pastaNome: 1, updatedAt: -1 }).lean();
    return res.json(docs.map(doc => ({ ...doc, hasBinary: Boolean(doc.nomeArquivo) })));
  } catch (error) { return res.status(500).json({ message: "Erro ao carregar documentação.", error: error.message }); }
});
app.get("/api/documentos/item/:id", authenticate, async (req, res) => {
  try {
    await connectDatabase();
    const item = await DocumentItem.findById(req.params.id).select("-content").lean();
    if (!item) return res.status(404).json({ message: "Documento não encontrado." });
    return res.json(item);
  } catch (error) { return res.status(500).json({ message: "Erro ao carregar documento.", error: error.message }); }
});
app.get("/api/documentos/content/:id", authenticate, async (req, res) => {
  try {
    await connectDatabase();
    const item = await DocumentItem.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: "Documento não encontrado." });
    return res.json(item);
  } catch (error) { return res.status(500).json({ message: "Erro ao carregar conteúdo.", error: error.message }); }
});
app.get("/api/documentos/download/:id", authenticate, async (req, res) => {
  try {
    await connectDatabase();
    const item = await DocumentItem.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: "Documento não encontrado." });
    if (!item.content) return res.status(404).json({ message: "Este item não possui arquivo local para download." });
    const buffer = Buffer.from(item.content, "base64");
    res.setHeader("Content-Type", item.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(item.nomeArquivo || "arquivo")}`);
    return res.send(buffer);
  } catch (error) { return res.status(500).json({ message: "Erro ao baixar documento.", error: error.message }); }
});

async function buildDocumentPayload(req, existing = null) {
  const titulo = String(req.body.titulo || "").trim();
  const descricao = String(req.body.descricao || "").trim();
  const pastaId = String(req.body.pastaId || "").trim();
  const tipoConteudo = String(req.body.tipoConteudo || "").toUpperCase();
  const texto = String(req.body.texto || "");
  const externalUrl = String(req.body.externalUrl || "").trim();
  const allowed = ["TEXTO", "PDF", "HTML", "VIDEO", "IMAGEM", "AUDIO", "LINK", "ARQUIVO"];
  if (!titulo || !allowed.includes(tipoConteudo)) { const e = new Error("Título e tipo são obrigatórios."); e.status = 400; throw e; }
  let folder = null;
  if (pastaId) {
    folder = await DocumentFolder.findById(pastaId);
    if (!folder) { const e = new Error("Pasta selecionada não existe."); e.status = 400; throw e; }
  }
  const payload = { titulo, descricao, pastaId: folder?._id || null, pastaNome: folder?.nome || "", tipoConteudo, updatedAt: new Date() };
  if (tipoConteudo === "TEXTO") {
    if (!texto.trim()) { const e = new Error("Digite o conteúdo do texto."); e.status = 400; throw e; }
    return { ...payload, texto, externalUrl: "", nomeArquivo: "", mimeType: "", content: "" };
  }
  if (tipoConteudo === "LINK") {
    if (!validHttpUrl(externalUrl)) { const e = new Error("Informe uma URL HTTP/HTTPS válida."); e.status = 400; throw e; }
    return { ...payload, texto: "", externalUrl, nomeArquivo: "", mimeType: "", content: "" };
  }
  if (tipoConteudo === "VIDEO" && externalUrl) {
    if (!validHttpUrl(externalUrl)) { const e = new Error("Informe uma URL de vídeo válida."); e.status = 400; throw e; }
    return { ...payload, texto: "", externalUrl, nomeArquivo: "", mimeType: "", content: "" };
  }
  if (!req.file && existing && existing.tipoConteudo === tipoConteudo && existing.content) {
    return { ...payload, texto: "", externalUrl: "", nomeArquivo: existing.nomeArquivo || "", mimeType: existing.mimeType || "", content: existing.content || "" };
  }
  if (!req.file) { const e = new Error(tipoConteudo === "VIDEO" ? "Informe uma URL de vídeo ou selecione um arquivo de vídeo pequeno." : "Selecione um arquivo."); e.status = 400; throw e; }
  const file = req.file, mime = file.mimetype || "";
  if (tipoConteudo === "PDF" && !(mime === "application/pdf" || /\.pdf$/i.test(file.originalname))) { const e = new Error("O arquivo selecionado não é PDF."); e.status = 400; throw e; }
  if (tipoConteudo === "HTML" && !(mime === "text/html" || /\.html?$/i.test(file.originalname))) { const e = new Error("O arquivo selecionado não é HTML."); e.status = 400; throw e; }
  if (tipoConteudo === "VIDEO" && !mime.startsWith("video/")) { const e = new Error("O arquivo selecionado não é vídeo."); e.status = 400; throw e; }
  if (tipoConteudo === "IMAGEM" && !mime.startsWith("image/")) { const e = new Error("O arquivo selecionado não é imagem."); e.status = 400; throw e; }
  if (tipoConteudo === "AUDIO" && !mime.startsWith("audio/")) { const e = new Error("O arquivo selecionado não é áudio."); e.status = 400; throw e; }
  return { ...payload, texto: "", externalUrl: "", nomeArquivo: file.originalname, mimeType: mime || "application/octet-stream", content: file.buffer.toString("base64") };
}

app.post("/api/documentos", authenticate, requireAdmin, uploadSingle, async (req, res) => {
  try {
    await connectDatabase();
    const payload = await buildDocumentPayload(req); payload.agente = req.user.login;
    const item = await DocumentItem.create(payload);
    return res.status(201).json({ message: "Documento cadastrado com sucesso.", item: { id: item._id, titulo: item.titulo } });
  } catch (error) {
    console.error("ERRO DOCUMENTO:", error);
    return res.status(error.status || 500).json({ message: error.message || "Erro ao salvar documento." });
  }
});
app.put("/api/documentos/:id", authenticate, requireAdmin, uploadSingle, async (req, res) => {
  try {
    await connectDatabase();
    const existing = await DocumentItem.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Documento não encontrado." });
    const payload = await buildDocumentPayload(req, existing); payload.agente = req.user.login;
    const item = await DocumentItem.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    return res.json({ message: "Documento atualizado com sucesso.", item: { id: item._id, titulo: item.titulo } });
  } catch (error) {
    console.error("ERRO EDITAR DOCUMENTO:", error);
    return res.status(error.status || 500).json({ message: error.message || "Erro ao atualizar documento." });
  }
});
app.delete("/api/documentos/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await connectDatabase();
    const item = await DocumentItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Documento não encontrado." });
    return res.json({ message: "Documento excluído com sucesso." });
  } catch (error) { return res.status(500).json({ message: "Erro ao excluir documento.", error: error.message }); }
});

// ======================================================
// CHAT - BUSCA E N8N OPCIONAL
// ======================================================
function normalizeText(text = "") {
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function scoreItem(title, text, keywords, query) {
  const normalizedQuery = normalizeText(query);
  const words = normalizedQuery.split(" ").filter(word => word.length > 1);
  const titleText = normalizeText(title), bodyText = normalizeText(text), keywordText = normalizeText(Array.isArray(keywords) ? keywords.join(" ") : "");
  let score = 0;
  for (const word of words) { if (titleText.includes(word)) score += 7; if (keywordText.includes(word)) score += 5; if (bodyText.includes(word)) score += 1; }
  if (normalizedQuery && (titleText.includes(normalizedQuery) || keywordText.includes(normalizedQuery) || bodyText.includes(normalizedQuery))) score += 20;
  if (words.length && words.every(word => titleText.includes(word) || keywordText.includes(word) || bodyText.includes(word))) score += 10;
  return score;
}
async function callN8n(webhookUrl, query, context, bot) {
  if (!webhookUrl) return null;
  const headers = { "Content-Type": "application/json" };
  if (process.env.N8N_SHARED_SECRET) headers["X-Custom-Secret"] = process.env.N8N_SHARED_SECRET;
  const response = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify({ bot, query, context }) });
  if (!response.ok) throw new Error(`n8n retornou ${response.status}.`);
  const data = await response.json();
  return data.response || data.answer || data.output || data.text || null;
}
function localResponse(results, emptyMessage) {
  if (!results.length) return emptyMessage;
  return results.map((item, index) => `${index + 1}. ${item.titulo}\n\n${item.texto}`).join("\n\n--------------------\n\n");
}

// CHAT SOFTCOM: SOMENTE MEMORIES
app.post("/api/chat", authenticate, async (req, res) => {
  try {
    await connectDatabase();
    const query = String(req.body.query || "").trim();
    if (!query) return res.status(400).json({ message: "Digite uma pergunta." });
    const memories = await Memory.find().sort({ updatedAt: -1 }).lean();
    const results = memories.map(item => ({ id: item._id, titulo: item.titulo, texto: item.texto, imagemUrl: item.imagemUrl, score: scoreItem(item.titulo, item.texto, [], query) })).filter(item => item.score > 0).sort((a,b) => b.score-a.score).slice(0,5);
    if (!results.length) return res.json({ response: "Não encontrei essa informação na aba Conhecimento da Softcom. Tente outras palavras ou peça para um administrador cadastrar o procedimento.", sources: [] });
    let answer = null;
    if (process.env.N8N_SOFTCOM_WEBHOOK_URL) {
      try { answer = await callN8n(process.env.N8N_SOFTCOM_WEBHOOK_URL, query, results.map(i => ({ titulo:i.titulo, texto:i.texto, imagemUrl:i.imagemUrl })), "Chat Softcom"); }
      catch (error) { console.error("ERRO N8N SOFTCOM:", error.message); }
    }
    if (!answer) answer = localResponse(results, "Não encontrei a informação.");
    return res.json({ response: answer, sources: results.map(i => ({ titulo:i.titulo, origem:"Conhecimento" })) });
  } catch (error) { return res.status(500).json({ message: "Erro ao consultar Conhecimento.", error: error.message }); }
});

async function specialChat(req, res, base, webhook, botName, emptyMessage) {
  try {
    const query = String(req.body.query || "").trim();
    if (!query) return res.status(400).json({ message: "Digite uma pergunta." });
    const results = base.map(item => ({ ...item, score: scoreItem(item.titulo, item.texto, item.keywords, query) })).filter(item => item.score > 0).sort((a,b) => b.score-a.score).slice(0,6);
    let answer = null;
    if (results.length && webhook) {
      try { answer = await callN8n(webhook, query, results, botName); }
      catch (error) { console.error(`ERRO N8N ${botName}:`, error.message); }
    }
    if (!answer) answer = localResponse(results, emptyMessage);
    return res.json({ response: answer, sources: results.map(item => ({ titulo:item.titulo, fonte:item.fonte, atualizado:item.atualizado })) });
  } catch (error) { return res.status(500).json({ message: `Erro ao consultar ${botName}.`, error: error.message }); }
}
app.post("/api/chat-contabilidade", authenticate, (req,res) => specialChat(req,res,accountingKnowledge,process.env.N8N_CONTABILIDADE_WEBHOOK_URL,"Chat Contabilidade","Não encontrei um tópico suficientemente relacionado na base inicial do Chat Contabilidade. Consulte a Receita Federal, a legislação do ente competente ou amplie a base do chatbot."));
app.post("/api/chat-reforma", authenticate, (req,res) => specialChat(req,res,reformKnowledge,process.env.N8N_REFORMA_WEBHOOK_URL,"Chat Reforma Tributária","Não encontrei um tópico suficientemente relacionado na base inicial da Reforma Tributária. Consulte a legislação e as orientações oficiais vigentes."));

// ======================================================
// 404 API / VERCEL / LOCAL
// ======================================================
app.use("/api", (req, res) => res.status(404).json({ message: "Rota da API não encontrada.", path: req.originalUrl }));
module.exports = app;
if (require.main === module) {
  connectDatabase().then(() => app.listen(PORT, () => console.log(`Softcom rodando em http://localhost:${PORT}`))).catch(error => console.error("Não foi possível iniciar:", error));
}

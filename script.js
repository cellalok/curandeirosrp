const firebaseConfig = {
apiKey: "AIzaSyDobXJ_knDYZpmPAoktRzEU8U3GGB6t3cI",
authDomain: "painel-curandeiros.firebaseapp.com",
projectId: "painel-curandeiros",
storageBucket: "painel-curandeiros.firebasestorage.app",
messagingSenderId: "1069159942082",
appId: "1:1069159942082:web:d77a35c46d68849f2db85b"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const storage = firebase.storage();

let usuarioAtual = null;
let inicioExpediente = null;
let intervalo = null;
let heartbeatInterval = null;
let imagens = [];

let usuariosCache = [];
let ativosCache = {};

let usuariosOnlineCache = [];
let ativosOnlineCache = {};

const gerarPDFAutomatico = true;

const ADMINS_NOMES = [
"Luna Serenight"
// "Nome Do Novo Admin"
];

// =========================
// HASH
// =========================

async function gerarHash(texto){
const encoder = new TextEncoder();
const data = encoder.encode(texto);
const hashBuffer = await crypto.subtle.digest("SHA-256", data);
const hashArray = Array.from(new Uint8Array(hashBuffer));

return hashArray
.map(b => b.toString(16).padStart(2,"0"))
.join("");
}

// =========================
// FORMATAR
// =========================

function formatarCargo(cargo){
return cargo === "chefe" ? "Mestre Curandeiro" : "Aprendiz Curandeiro";
}

function formatarTempo(tempo){
if(!tempo) return "0h 0min 0s";

const partes = tempo.split(":");

const horas = parseInt(partes[0] || 0);
const minutos = parseInt(partes[1] || 0);
const segundos = parseInt(partes[2] || 0);

return `${horas}h ${minutos}min ${segundos}s`;
}

function usuarioEhAdmin(){
return usuarioAtual &&
ADMINS_NOMES.includes(usuarioAtual.nome);
}

function gerarSenhaProvisoria(){
const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
let senha = "";

for(let i = 0; i < 8; i++){
senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
}

return senha;
}

// =========================
// SESSÃO
// =========================

function salvarSessao(){
localStorage.setItem("curandeiroLogado", JSON.stringify(usuarioAtual));
}

function restaurarSessao(){
const sessao = localStorage.getItem("curandeiroLogado");

if(!sessao) return;

usuarioAtual = JSON.parse(sessao);

abrirPainel();
iniciarHeartbeat();
}

async function logout(){
try{
if(usuarioAtual){
await db.collection("ativos")
.doc(usuarioAtual.docId)
.delete();
}
}catch(err){
console.error(err);
}

localStorage.removeItem("curandeiroLogado");
location.reload();
}

// =========================
// LOGIN DUPLO
// =========================

async function verificarLoginDuplicado(id){
const snapshot = await db.collection("ativos")
.where("id","==",id)
.get();

if(snapshot.empty) return false;

const agora = Date.now();
let loginAtivo = false;

for(const doc of snapshot.docs){
const dados = doc.data();

if(dados.ultimoPing && agora - dados.ultimoPing <= 45000){
loginAtivo = true;
}else{
await db.collection("ativos").doc(doc.id).delete();
}
}

return loginAtivo;
}

// =========================
// HEARTBEAT
// =========================

function iniciarHeartbeat(){
atualizarHeartbeat();

clearInterval(heartbeatInterval);

heartbeatInterval = setInterval(()=>{
atualizarHeartbeat();
},30000);
}

async function atualizarHeartbeat(){
if(!usuarioAtual) return;

await db.collection("ativos")
.doc(usuarioAtual.docId)
.set({
nome:usuarioAtual.nome,
id:usuarioAtual.id,
cargo:usuarioAtual.cargo,
ultimoPing:Date.now()
});
}

// =========================
// LOGIN
// =========================

async function entrarSistema(){
try{
const idDigitado = document.getElementById("idLogin")
.value
.trim()
.toUpperCase();

const senhaDigitada = document.getElementById("senhaLogin")
.value
.trim();

const snapshot = await db.collection("usuarios").get();

let usuarioEncontrado = null;

snapshot.forEach(doc=>{
const dados = doc.data();

const idBanco = (dados.id || "")
.toString()
.trim()
.toUpperCase();

if(idBanco === idDigitado){
usuarioEncontrado = {
...dados,
docId:doc.id
};
}
});

if(!usuarioEncontrado){
alert("ID inválido");
return;
}

const jaLogado = await verificarLoginDuplicado(usuarioEncontrado.id);

if(jaLogado){
alert("Usuário já está online");
return;
}

const senhaHash = await gerarHash(senhaDigitada);

if(usuarioEncontrado.senha !== senhaHash){
alert("Senha inválida");
return;
}

usuarioAtual = usuarioEncontrado;

salvarSessao();
abrirPainel();
iniciarHeartbeat();

}catch(error){
console.error(error);
alert("Erro no login");
}
}

// =========================
// PAINEL
// =========================

function abrirPainel(){
document.querySelector(".login-card").style.display = "none";
document.getElementById("painel").style.display = "block";

document.getElementById("status").innerHTML = `
<div>
<div style="font-size:24px;font-weight:bold;">
${usuarioAtual.nome}
</div>

<div style="font-size:14px;color:#9dff63;margin-top:4px;">
🎖 ${formatarCargo(usuarioAtual.cargo)}
</div>

<div style="font-size:13px;color:#7dff63;margin-top:6px;">
🟢 Sistema conectado
</div>
</div>
`;

if(usuarioAtual.primeiroLogin){
document.getElementById("trocarSenhaCard").style.display = "block";

setTimeout(()=>{
alert("Primeiro acesso detectado.\n\nAltere sua senha provisória antes de continuar.");
},500);
}

// Online/offline visível para todos
carregarMembrosOnlineGeral();

if(usuarioEhAdmin()){
document.getElementById("adminPanel").style.display = "block";

const btnGerador = document.getElementById("btnAbaGerador");

if(btnGerador){
btnGerador.style.display = "block";
}

iniciarRealtimePainel();
carregarLogs();
carregarMembros();
carregarSelectMembros();
carregarSelectResetSenha();
mostrarAba("realtime");
}
}

// =========================
// ABAS ADMIN
// =========================

function mostrarAba(nome){
const abas = [
"abaRealtime",
"abaLogs",
"abaMembros",
"abaGerador"
];

abas.forEach(id=>{
const elemento = document.getElementById(id);

if(elemento){
elemento.style.display = "none";
}
});

if(nome === "realtime"){
document.getElementById("abaRealtime").style.display = "block";
}

if(nome === "logs"){
document.getElementById("abaLogs").style.display = "block";
}

if(nome === "membros"){
document.getElementById("abaMembros").style.display = "block";
renderizarMembros();
}

if(nome === "gerador" && usuarioEhAdmin()){
document.getElementById("abaGerador").style.display = "block";
carregarSelectResetSenha();
}
}

// =========================
// TROCAR SENHA
// =========================

async function trocarSenha(){
const novaSenha = document.getElementById("novaSenha")
.value
.trim();

if(!novaSenha){
alert("Digite uma senha");
return;
}

if(novaSenha.length < 6){
alert("A senha deve ter no mínimo 6 caracteres");
return;
}

try{
const senhaHash = await gerarHash(novaSenha);

await db.collection("usuarios")
.doc(usuarioAtual.docId)
.update({
senha:senhaHash,
primeiroLogin:false,
senhaAlteradaEm:Date.now()
});

usuarioAtual.senha = senhaHash;
usuarioAtual.primeiroLogin = false;

salvarSessao();

alert("Senha alterada com sucesso!");

document.getElementById("trocarSenhaCard").style.display = "none";

}catch(error){
console.error(error);
alert("Erro ao alterar senha. Verifique as regras do Firebase.");
}
}

// =========================
// GERADOR FIREBASE
// =========================

async function gerarUsuarioFirebase(){
if(!usuarioEhAdmin()){
alert("Você não tem permissão para usar esta ferramenta.");
return;
}

const nome = document.getElementById("firebaseNome").value.trim();
const id = document.getElementById("firebaseID").value.trim();
const cargo = document.getElementById("firebaseCargo").value;
const senha = document.getElementById("firebaseSenha").value.trim();

if(!nome || !id || !senha){
alert("Preencha nome, ID e senha provisória");
return;
}

const hash = await gerarHash(senha);

const json = {
nome:nome,
id:id,
cargo:cargo,
senha:hash,
primeiroLogin:true,
criadoEm:Date.now()
};

document.getElementById("firebaseResultado").value =
JSON.stringify(json,null,2);
}

// =========================
// RESET SENHA PROVISÓRIA
// =========================

async function carregarSelectResetSenha(){
if(!usuarioEhAdmin()) return;

const select = document.getElementById("resetUsuario");

if(!select) return;

select.innerHTML = '<option value="">Selecione um membro</option>';

const snapshot = await db.collection("usuarios").get();

snapshot.forEach(doc=>{
const membro = doc.data();

const option = document.createElement("option");

option.value = doc.id;
option.innerText = `${membro.nome} (${membro.id})`;

select.appendChild(option);
});
}

async function resetarSenhaUsuario(){
if(!usuarioEhAdmin()){
alert("Você não tem permissão para resetar senhas.");
return;
}

const docId = document.getElementById("resetUsuario").value;

if(!docId){
alert("Selecione um membro.");
return;
}

try{
const novaSenha = gerarSenhaProvisoria();
const hash = await gerarHash(novaSenha);

await db.collection("usuarios")
.doc(docId)
.update({
senha:hash,
primeiroLogin:true,
senhaResetadaEm:Date.now()
});

const doc = await db.collection("usuarios")
.doc(docId)
.get();

const membro = doc.data();

document.getElementById("resultadoResetSenha").value =
`Membro: ${membro.nome}

ID: ${membro.id}

Nova senha provisória:

${novaSenha}

Primeiro login obrigatório.`;

registrarLog(`Senha resetada para ${membro.nome}`);

alert("Senha provisória gerada com sucesso.");

}catch(error){
console.error(error);
alert("Erro ao resetar senha. Verifique as regras do Firebase.");
}
}

// =========================
// EXPEDIENTE
// =========================

async function iniciarExpediente(){
if(inicioExpediente){
alert("Expediente já iniciado");
return;
}

imagens = [];
atualizarPreview();

inicioExpediente = new Date();

clearInterval(intervalo);

intervalo = setInterval(atualizarTimer,1000);
atualizarTimer();
}

function atualizarTimer(){
if(!inicioExpediente) return;

const agora = new Date();
const diff = agora - inicioExpediente;

const horas = Math.floor(diff / 3600000);
const minutos = Math.floor((diff % 3600000)/60000);
const segundos = Math.floor((diff % 60000)/1000);

document.getElementById("timer").innerText =
`${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
}

// =========================
// PRINTS
// =========================

async function processarArquivo(file){
const reader = new FileReader();

reader.onload = function(e){
const base64 = e.target.result;
imagens.push(base64);
atualizarPreview();
};

reader.readAsDataURL(file);
}

document.getElementById("upload").addEventListener("change", async (e)=>{
for(const file of e.target.files){
await processarArquivo(file);
}
});

document.addEventListener("paste", async (event)=>{
const items = event.clipboardData.items;

for(const item of items){
if(item.type.indexOf("image") !== -1){
const file = item.getAsFile();
await processarArquivo(file);
}
}
});

function removerPrint(index){
imagens.splice(index,1);
atualizarPreview();
}

function limparPrints(){
imagens = [];
atualizarPreview();
}

function atualizarPreview(){
const container = document.getElementById("previewContainer");

container.innerHTML = "";

imagens.forEach((img,index)=>{
const div = document.createElement("div");

div.classList.add("preview-box");

div.innerHTML = `
<div class="preview-number">#${index+1}</div>
<img src="${img}">
<button class="remove-print" onclick="removerPrint(${index})">X</button>
`;

container.appendChild(div);
});
}

// =========================
// FINALIZAR
// =========================

async function finalizarExpediente(){
if(!inicioExpediente){
alert("Inicie o expediente");
return;
}

clearInterval(intervalo);

const agora = new Date();
const dataISO = agora.toISOString().split("T")[0];

const registro = {
nome:usuarioAtual.nome,
id:usuarioAtual.id,
cargo:usuarioAtual.cargo,
entrada:inicioExpediente.toLocaleTimeString("pt-BR"),
saida:agora.toLocaleTimeString("pt-BR"),
total:document.getElementById("timer").innerText,
data:dataISO,
prints:imagens,
timestamp:Date.now()
};

await db.collection("registros").add(registro);

registrarLog(`Expediente finalizado por ${usuarioAtual.nome}`);

alert("Registro salvo");

if(gerarPDFAutomatico){
await gerarPDFDiario(dataISO);
}

inicioExpediente = null;

document.getElementById("timer").innerText = "00:00:00";

imagens = [];
atualizarPreview();
}

// =========================
// PDF PREMIUM PAGINADO
// =========================

async function gerarPDFDiario(dataAutomatica = null){
let dataSelecionada = dataAutomatica;

if(!dataSelecionada){
dataSelecionada = document.getElementById("dataRelatorio").value;
}

if(!dataSelecionada){
alert("Selecione uma data");
return;
}

const membroSelecionado =
document.getElementById("membroRelatorio")?.value || usuarioAtual.id;

const snapshot = await db.collection("registros")
.where("data","==",dataSelecionada)
.where("id","==",membroSelecionado)
.get();

if(snapshot.empty){
alert("Nenhum registro encontrado");
return;
}

const template = document.getElementById("pdfTemplate");

template.innerHTML = "";
template.style.display = "block";

const printsPorPagina = 10;
let numeroPagina = 1;

snapshot.forEach(documento=>{
const item = documento.data();
const prints = item.prints || [];

if(prints.length === 0){
criarPaginaPDF(template,item,[],0,0,numeroPagina);
numeroPagina++;
return;
}

for(let i = 0; i < prints.length; i += printsPorPagina){
const grupo = prints.slice(i, i + printsPorPagina);

criarPaginaPDF(
template,
item,
grupo,
i,
prints.length,
numeroPagina
);

numeroPagina++;
}
});

const { jsPDF } = window.jspdf;
const pdf = new jsPDF("p","px","a4");

const paginas = Array.from(template.children);

for(let i = 0; i < paginas.length; i++){
const canvas = await html2canvas(paginas[i],{
scale:2,
useCORS:true,
backgroundColor:null
});

const img = canvas.toDataURL("image/jpeg",0.95);

const pdfWidth = pdf.internal.pageSize.getWidth();
const pdfHeight = pdf.internal.pageSize.getHeight();

if(i > 0){
pdf.addPage();
}

pdf.addImage(img,"JPEG",0,0,pdfWidth,pdfHeight);
}

pdf.save(`Relatorio_${dataSelecionada}.pdf`);

template.innerHTML = "";
template.style.display = "none";

alert("PDF premium gerado");
}

function criarPaginaPDF(template,item,prints,inicioIndex,totalPrints,numeroPagina){
const pagina = document.createElement("div");

pagina.style.width = "794px";
pagina.style.height = "1123px";
pagina.style.padding = "34px";
pagina.style.position = "relative";
pagina.style.boxSizing = "border-box";
pagina.style.overflow = "hidden";
pagina.style.color = "#ffffff";
pagina.style.fontFamily = "'Orbitron', sans-serif";
pagina.style.background = `
linear-gradient(rgba(0,0,0,.82), rgba(0,0,0,.94)),
url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=1600&auto=format&fit=crop')
center/cover no-repeat
`;

pagina.innerHTML = `
<div style="
height:100%;
border:2px solid #9dff63;
border-radius:26px;
padding:24px;
box-sizing:border-box;
background:rgba(0,0,0,.55);
box-shadow:
0 0 16px #9dff63,
inset 0 0 24px rgba(157,255,99,.15);
position:relative;
overflow:hidden;
">

<div style="
position:absolute;
top:0;
left:0;
right:0;
height:6px;
background:linear-gradient(90deg, transparent, #9dff63, transparent);
box-shadow:0 0 18px #9dff63;
"></div>

<h1 style="
text-align:center;
font-size:34px;
margin:6px 0 6px;
color:#b8ff69;
text-shadow:0 0 15px #b8ff69;
">
☣ RELATÓRIO MÉDICO ☣
</h1>

<p style="
text-align:center;
font-size:15px;
opacity:.85;
margin-bottom:22px;
">
Bunker dos Curandeiros • FiveM RP
</p>

<div style="
display:grid;
grid-template-columns:1fr 1fr;
gap:12px;
margin-bottom:18px;
">

${infoBox("📅 Data", item.data)}
${infoBox("👤 Curandeiro", item.nome)}
${infoBox("🎖 Cargo", formatarCargo(item.cargo))}
${infoBox("⏱ Tempo Total", formatarTempo(item.total))}
${infoBox("🟢 Entrada", item.entrada)}
${infoBox("🔴 Saída", item.saida)}

</div>

<div style="
margin-top:8px;
margin-bottom:14px;
padding:10px 14px;
border-radius:16px;
background:rgba(157,255,99,.08);
border:1px solid rgba(157,255,99,.35);
color:#b8ff69;
font-size:16px;
font-weight:bold;
text-align:center;
">
📸 Atendimentos ${totalPrints ? `${inicioIndex + 1} até ${inicioIndex + prints.length} de ${totalPrints}` : "0"}
</div>

<div id="printsGrid" style="
display:grid;
grid-template-columns:1fr 1fr;
gap:10px;
"></div>

<div style="
position:absolute;
bottom:18px;
left:28px;
font-size:11px;
color:rgba(255,255,255,.55);
">
Sistema Curandeiros
</div>

<div style="
position:absolute;
bottom:18px;
right:28px;
font-size:13px;
color:#b8ff69;
">
Página ${numeroPagina}
</div>

</div>
`;

const grid = pagina.querySelector("#printsGrid");

prints.forEach((print,index)=>{
const card = document.createElement("div");

card.style.background = "rgba(0,0,0,.72)";
card.style.border = "1px solid rgba(157,255,99,.55)";
card.style.borderRadius = "12px";
card.style.padding = "6px";
card.style.boxSizing = "border-box";
card.style.boxShadow = "0 0 12px rgba(157,255,99,.14)";

card.innerHTML = `
<div style="
text-align:center;
margin-bottom:4px;
color:#b8ff69;
font-weight:bold;
font-size:10px;
">
📷 Atendimento #${inicioIndex + index + 1}
</div>

<div style="
width:100%;
height:75px;
background:#050505;
border-radius:10px;
border:1px solid rgba(157,255,99,.35);
display:flex;
align-items:center;
justify-content:center;
overflow:hidden;
">
<img src="${print}" style="
width:100%;
height:100%;
object-fit:cover;
display:block;
">
</div>
`;

grid.appendChild(card);
});

template.appendChild(pagina);
}

function infoBox(titulo, valor){
return `
<div style="
background:rgba(0,0,0,.58);
border:1px solid rgba(157,255,99,.25);
border-radius:14px;
padding:10px 12px;
box-sizing:border-box;
min-height:58px;
">
<div style="
font-size:11px;
color:#9dff63;
margin-bottom:6px;
font-weight:bold;
">
${titulo}
</div>
<div style="
font-size:14px;
color:#ffffff;
word-break:break-word;
">
${valor || "-"}
</div>
</div>
`;
}

// =========================
// LOGS
// =========================

async function registrarLog(texto){
if(!usuarioAtual) return;

await db.collection("logs").add({
autor:usuarioAtual.nome,
texto:texto,
data:new Date().toLocaleString("pt-BR"),
timestamp:Date.now()
});
}

function carregarLogs(){
if(!usuarioEhAdmin()) return;

db.collection("logs")
.orderBy("timestamp","desc")
.onSnapshot(snapshot=>{
const lista = document.getElementById("listaLogs");

if(!lista) return;

lista.innerHTML = "";

snapshot.forEach(doc=>{
const item = doc.data();

const div = document.createElement("div");

div.classList.add("realtime-card");

div.innerHTML = `
<h3>🛰 ${item.autor}</h3>
<p>${item.texto}</p>
<p>${item.data}</p>
`;

lista.appendChild(div);
});
});
}

// =========================
// REALTIME ADMIN
// =========================

function iniciarRealtimePainel(){
if(!usuarioEhAdmin()) return;

db.collection("registros")
.orderBy("timestamp","desc")
.onSnapshot(snapshot=>{
const lista = document.getElementById("listaRealtime");

if(!lista) return;

lista.innerHTML = "";

snapshot.forEach(doc=>{
const item = doc.data();

const card = document.createElement("div");

card.classList.add("realtime-card");

card.innerHTML = `
<h3>${item.nome}</h3>
<p>📅 ${item.data}</p>
<p>⏱ ${item.total}</p>
<p>${item.entrada} - ${item.saida}</p>
<p>📸 Atendimentos: ${(item.prints || []).length}</p>
`;

lista.appendChild(card);
});
});
}

// =========================
// HISTÓRICO
// =========================

async function filtrarHistorico(){
const data = document.getElementById("filtroHistorico").value;
const lista = document.getElementById("historicoLista");

if(!data){
alert("Selecione uma data");
return;
}

lista.innerHTML = "";

let query = db.collection("registros")
.where("data","==",data);

if(!usuarioEhAdmin()){
query = query.where("id","==",usuarioAtual.id);
}

const snapshot = await query.get();

if(snapshot.empty){
lista.innerHTML = "<p>Nenhum histórico encontrado.</p>";
return;
}

snapshot.forEach(doc=>{
const item = doc.data();

const card = document.createElement("div");

card.classList.add("realtime-card");

card.innerHTML = `
<h3>${item.nome}</h3>
<p>📅 ${item.data}</p>
<p>🟢 Entrada: ${item.entrada}</p>
<p>🔴 Saída: ${item.saida}</p>
<p>⏱ Total: ${formatarTempo(item.total)}</p>
<p>📸 Atendimentos: ${(item.prints || []).length}</p>
`;

lista.appendChild(card);
});
}

// =========================
// MEMBROS ADMIN ONLINE/OFFLINE
// =========================

function carregarMembros(){
if(!usuarioEhAdmin()) return;

db.collection("usuarios")
.onSnapshot(snapshot=>{
usuariosCache = [];

snapshot.forEach(doc=>{
usuariosCache.push({
docId:doc.id,
...doc.data()
});
});

renderizarMembros();
});

db.collection("ativos")
.onSnapshot(snapshot=>{
ativosCache = {};

snapshot.forEach(doc=>{
const ativo = doc.data();

ativosCache[ativo.id] = ativo;
});

renderizarMembros();
});

setInterval(()=>{
renderizarMembros();
},30000);
}

function renderizarMembros(){
const lista = document.getElementById("listaMembros");

if(!lista || !usuariosCache.length) return;

lista.innerHTML = "";

const agora = Date.now();

usuariosCache.forEach(membro=>{
const ativo = ativosCache[membro.id];

const online =
ativo &&
ativo.ultimoPing &&
agora - ativo.ultimoPing <= 45000;

const card = document.createElement("div");

card.classList.add("membro-card");

card.innerHTML = `
<h3>${membro.nome}</h3>
<p>${formatarCargo(membro.cargo)}</p>
<p>ID: ${membro.id}</p>
<p>Primeiro login: ${membro.primeiroLogin ? "Sim" : "Não"}</p>

<p>
<span class="${online ? "status-online" : "status-offline"}">
● ${online ? "ONLINE" : "OFFLINE"}
</span>
</p>
`;

lista.appendChild(card);
});
}

// =========================
// MEMBROS ONLINE GERAL
// =========================

function carregarMembrosOnlineGeral(){
db.collection("usuarios")
.onSnapshot(snapshot=>{
usuariosOnlineCache = [];

snapshot.forEach(doc=>{
usuariosOnlineCache.push({
docId:doc.id,
...doc.data()
});
});

renderizarMembrosOnlineGeral();
});

db.collection("ativos")
.onSnapshot(snapshot=>{
ativosOnlineCache = {};

snapshot.forEach(doc=>{
const ativo = doc.data();

ativosOnlineCache[ativo.id] = ativo;
});

renderizarMembrosOnlineGeral();
});

setInterval(()=>{
renderizarMembrosOnlineGeral();
},30000);
}

function renderizarMembrosOnlineGeral(){
const lista = document.getElementById("listaMembrosOnline");

if(!lista || !usuariosOnlineCache.length) return;

lista.innerHTML = "";

const agora = Date.now();

usuariosOnlineCache.forEach(membro=>{
const ativo = ativosOnlineCache[membro.id];

const online =
ativo &&
ativo.ultimoPing &&
agora - ativo.ultimoPing <= 45000;

const card = document.createElement("div");

card.classList.add("membro-card");

card.innerHTML = `
<h3>${membro.nome}</h3>
<p>${formatarCargo(membro.cargo)}</p>

<p>
<span class="${online ? "status-online" : "status-offline"}">
● ${online ? "ONLINE" : "OFFLINE"}
</span>
</p>
`;

lista.appendChild(card);
});
}

// =========================
// SELECT MEMBROS PDF
// =========================

async function carregarSelectMembros(){
const select = document.getElementById("membroRelatorio");

if(!select) return;

select.innerHTML = `
<option value="">
Meu relatório
</option>
`;

if(!usuarioEhAdmin()) return;

const snapshot = await db.collection("usuarios").get();

snapshot.forEach(doc=>{
const membro = doc.data();

const option = document.createElement("option");

option.value = membro.id;
option.innerText = membro.nome;

select.appendChild(option);
});
}

// =========================
// AUTO LOGIN
// =========================

restaurarSessao();

// =========================
// FECHAR ABA
// =========================

window.addEventListener("beforeunload", async ()=>{
try{
if(usuarioAtual){
await db.collection("ativos")
.doc(usuarioAtual.docId)
.delete();
}
}catch(err){
console.error(err);
}
});

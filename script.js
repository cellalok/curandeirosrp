const firebaseConfig = {

    apiKey: "AIzaSyDobXJ_knDYZpmPAoktRzEU8U3GGB6t3cI",

    authDomain: "painel-curandeiros.firebaseapp.com",
    
    projectId: "https://painel-curandeiros-default-rtdb.firebaseio.com",

    databaseURL: "https://painel-curandeiros-default-rtdb.firebaseio.com",
    
    storageBucket: "painel-curandeiros.firebasestorage.app",

    messagingSenderId: "1069159942082",

    appId: "1:1069159942082:web:d77a35c46d68849f2db85b"

};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

let usuarioAtual = null;

let inicioExpediente = null;

let intervalo;

let imagens = [];

// HASH

async function gerarHash(texto){

    const encoder = new TextEncoder();

    const data = encoder.encode(texto);

    const hashBuffer =
    await crypto.subtle.digest(
        "SHA-256",
        data
    );

    const hashArray =
    Array.from(
        new Uint8Array(hashBuffer)
    );

    return hashArray
    .map(b =>
        b.toString(16).padStart(2,"0")
    )
    .join("");
}

// LOGIN OTIMIZADO

async function entrarSistema(){

    try{

        const id =
        document.getElementById("idLogin")
        .value.trim();

        const senha =
        document.getElementById("senhaLogin")
        .value.trim();

        if(!id || !senha){

            alert("Preencha ID e senha");

            return;
        }

        const botao =
        document.querySelector(".login-card button");

        botao.disabled = true;

        botao.innerText = "Entrando...";

        // BUSCA APENAS ID

        const snapshot =
        await db.collection("usuarios")
        .where("id","==",id)
        .limit(1)
        .get();

        if(snapshot.empty){

            alert("ID inválido");

            botao.disabled = false;

            botao.innerText = "Entrar";

            return;
        }

        const usuario =
        snapshot.docs[0];

        const dados =
        usuario.data();

        // COMPARA HASH LOCALMENTE

        const senhaHash =
        await gerarHash(senha);

        if(dados.senha !== senhaHash){

            alert("Senha inválida");

            botao.disabled = false;

            botao.innerText = "Entrar";

            return;
        }

        usuarioAtual = dados;

        usuarioAtual.docId =
        usuario.id;

        document.querySelector(".login-card")
        .style.display = "none";

        document.getElementById("painel")
        .style.display = "block";

        document.getElementById("status")
        .innerHTML =

        `☣ Bem-vindo(a),
        ${usuarioAtual.nome}`;

        // ONLINE

        await db.collection("ativos")
        .doc(usuarioAtual.id)
        .set({

            nome:usuarioAtual.nome,

            id:usuarioAtual.id,

            cargo:usuarioAtual.cargo,

            online:true,

            ultimoLogin:
            new Date().toLocaleString()
        });

        // PRIMEIRO LOGIN

        if(usuarioAtual.primeiroLogin){

            document.getElementById(
            "trocarSenhaCard"
            ).style.display = "block";
        }

        // CHEFE

        if(usuarioAtual.cargo === "chefe"){

            document.getElementById(
            "adminPanel"
            ).style.display = "block";

            document.getElementById(
            "painelRealtime"
            ).style.display = "block";

            document.getElementById(
            "membrosPanel"
            ).style.display = "block";

            iniciarRealtimePainel();

            carregarMembros();
        }

    }catch(error){

        console.error(error);

        alert("Erro ao logar");

    }finally{

        const botao =
        document.querySelector(".login-card button");

        botao.disabled = false;

        botao.innerText = "Entrar";
    }
}

// TROCAR SENHA

async function trocarSenha(){

    const novaSenha =
    document.getElementById("novaSenha")
    .value;

    if(novaSenha.length < 4){

        alert("Senha muito curta");

        return;
    }

    const senhaHash =
    await gerarHash(novaSenha);

    await db.collection("usuarios")
    .doc(usuarioAtual.docId)
    .update({

        senha:senhaHash,

        primeiroLogin:false
    });

    alert("☣ Senha alterada");

    document.getElementById(
    "trocarSenhaCard"
    ).style.display = "none";
}

// EXPEDIENTE

async function iniciarExpediente(){

    imagens = [];

    atualizarPreview();

    inicioExpediente = new Date();

    intervalo =
    setInterval(
        atualizarTimer,
        1000
    );

    document.getElementById("status")
    .innerHTML =

    `🟢 Entrada:
    ${inicioExpediente.toLocaleTimeString()}`;
}

function atualizarTimer(){

    const agora = new Date();

    const diff =
    agora - inicioExpediente;

    const horas =
    Math.floor(diff / 3600000);

    const minutos =
    Math.floor((diff % 3600000)/60000);

    const segundos =
    Math.floor((diff % 60000)/1000);

    document.getElementById("timer")
    .innerText =

    `${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
}

async function finalizarExpediente(){

    clearInterval(intervalo);

    const agora = new Date();

    await db.collection("registros")
    .add({

        nome:usuarioAtual.nome,

        id:usuarioAtual.id,

        cargo:usuarioAtual.cargo,

        entrada:
        inicioExpediente.toLocaleTimeString(),

        saida:
        agora.toLocaleTimeString(),

        total:
        document.getElementById("timer")
        .innerText,

        data:
        agora.toLocaleDateString(),

        prints:imagens,

        timestamp:Date.now()
    });

    alert("☣ Expediente salvo");
}

// PRINTS

document
.getElementById("upload")
.addEventListener("change",(e)=>{

    for(const file of e.target.files){

        processarImagem(file);
    }
});

document.addEventListener("paste",(event)=>{

    const items =
    event.clipboardData.items;

    for(const item of items){

        if(item.type.indexOf("image") !== -1){

            processarImagem(
                item.getAsFile()
            );
        }
    }
});

function processarImagem(file){

    const reader =
    new FileReader();

    reader.onload = function(e){

        imagens.push(e.target.result);

        atualizarPreview();
    }

    reader.readAsDataURL(file);
}

function atualizarPreview(){

    const container =
    document.getElementById("previewContainer");

    container.innerHTML = "";

    imagens.forEach((img,index)=>{

        const div =
        document.createElement("div");

        div.classList.add("preview-box");

        div.innerHTML = `

            <div class="preview-number">
                #${index+1}
            </div>

            <img src="${img}">

        `;

        container.appendChild(div);
    });
}

// REALTIME

function iniciarRealtimePainel(){

    db.collection("registros")

    .orderBy("timestamp","desc")

    .onSnapshot(snapshot=>{

        const lista =
        document.getElementById("listaRealtime");

        lista.innerHTML = "";

        snapshot.forEach(doc=>{

            const item = doc.data();

            const card =
            document.createElement("div");

            card.classList.add("realtime-card");

            let imagensHTML = "";

            if(item.prints){

                item.prints.forEach((img)=>{

                    imagensHTML += `

                    <img
                    src="${img}"
                    onclick="abrirImagem('${img}')">

                    `;
                });
            }

            card.innerHTML = `

                <h3>
                    👤 ${item.nome}
                </h3>

                <p>
                    🪪 ${item.id}
                </p>

                <p>
                    ⏱ ${item.total}
                </p>

                <p>
                    📅 ${item.data}
                </p>

                <div class="prints-grid">

                    ${imagensHTML}

                </div>

            `;

            lista.appendChild(card);
        });
    });
}

// MEMBROS

function carregarMembros(){

    db.collection("usuarios")

    .onSnapshot(async snapshot=>{

        const lista =
        document.getElementById("listaMembros");

        lista.innerHTML = "";

        const ativosSnapshot =
        await db.collection("ativos").get();

        const ativos = [];

        ativosSnapshot.forEach(doc=>{

            ativos.push(doc.data().id);
        });

        snapshot.forEach(doc=>{

            const membro =
            doc.data();

            const online =
            ativos.includes(membro.id);

            const card =
            document.createElement("div");

            card.classList.add("membro-card");

            card.innerHTML = `

                <div class="${online ? 'online':'offline'}">

                    ${online ?
                    '🟢 ONLINE':
                    '🔴 OFFLINE'}

                </div>

                <h3>
                    👤 ${membro.nome}
                </h3>

                <p>
                    🪪 ${membro.id}
                </p>

                <p>
                    🎖 ${membro.cargo}
                </p>

                <div class="membro-actions">

                    <button
                    class="promover"
                    onclick="promoverMembro('${doc.id}')">

                    👑 Promover

                    </button>

                    <button
                    class="remover"
                    onclick="removerMembro('${doc.id}')">

                    🗑 Remover

                    </button>

                </div>

            `;

            lista.appendChild(card);
        });
    });
}

// PROMOVER

async function promoverMembro(docId){

    await db.collection("usuarios")
    .doc(docId)
    .update({

        cargo:"chefe"
    });

    alert("☣ Promovido");
}

// REMOVER

async function removerMembro(docId){

    const confirmar =
    confirm("Remover membro?");

    if(!confirmar) return;

    await db.collection("usuarios")
    .doc(docId)
    .delete();

    alert("☣ Removido");
}

// ADMIN

async function adicionarCurandeiro(){

    const nome =
    document.getElementById("novoNome").value;

    const id =
    document.getElementById("novoID").value;

    const senhaTemp =
    Math.floor(
        100000 + Math.random() * 900000
    ).toString();

    const senhaHash =
    await gerarHash(senhaTemp);

    await db.collection("usuarios")
    .add({

        nome,

        id,

        senha:senhaHash,

        cargo:"curandeiro",

        primeiroLogin:true
    });

    alert(

        `☣ Curandeiro criado

Senha provisória:
${senhaTemp}`
    );
}

// PDF

async function gerarPDFSemanal(){

    const container =
    document.getElementById("pdfTemplate");

    const printsDiv =
    document.getElementById("pdfPrints");

    printsDiv.innerHTML = "";

    const snapshot =
    await db.collection("registros")
    .where("id","==",usuarioAtual.id)
    .get();

    snapshot.forEach(doc=>{

        const item = doc.data();

        if(item.prints){

            item.prints.forEach((img,index)=>{

                const div =
                document.createElement("div");

                div.classList.add("pdf-print");

                div.innerHTML = `

                    <img src="${img}">

                    <span>
                        Atendimento #${index+1}
                    </span>

                `;

                printsDiv.appendChild(div);
            });
        }
    });

    document.getElementById("pdfNome")
    .innerText =
    usuarioAtual.nome;

    const canvas =
    await html2canvas(container,{

        scale:2
    });

    const imgData =
    canvas.toDataURL("image/png");

    const { jsPDF } =
    window.jspdf;

    const pdf =
    new jsPDF("p","mm","a4");

    const pdfWidth =
    pdf.internal.pageSize.getWidth();

    const pdfHeight =
    (canvas.height * pdfWidth)
    / canvas.width;

    pdf.addImage(

        imgData,

        "PNG",

        0,

        0,

        pdfWidth,

        pdfHeight
    );

    pdf.save(

        `Relatorio_${usuarioAtual.nome}.pdf`
    );
}

// MODAL

function abrirImagem(src){

    const modal =
    document.createElement("div");

    modal.classList.add("modal");

    modal.innerHTML =
    `<img src="${src}">`;

    modal.onclick = ()=>{

        modal.remove();
    };

    document.body.appendChild(modal);
}

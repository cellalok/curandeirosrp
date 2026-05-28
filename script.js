// FIREBASE CONFIG

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

// LOGIN

async function entrarSistema(){

    const id =
    document.getElementById("idLogin").value;

    const senha =
    document.getElementById("senhaLogin").value;

    const senhaHash =
    await gerarHash(senha);

    const snapshot =
    await db.collection("usuarios")
    .where("id","==",id)
    .where("senha","==",senhaHash)
    .get();

    if(snapshot.empty){

        alert("ID ou senha inválidos.");

        return;
    }

    usuarioAtual =
    snapshot.docs[0].data();

    document.querySelector(".login-card")
    .style.display = "none";

    document.getElementById("painel")
    .style.display = "block";

    document.getElementById("status")
    .innerHTML =

    `☣ Bem-vindo(a),
    ${usuarioAtual.nome}`;

    // ANTI FAKE CHEFE

    if(
        usuarioAtual.id === "TTT85985"
        &&
        usuarioAtual.cargo !== "chefe"
    ){

        alert("Violação detectada.");

        location.reload();
    }

    if(usuarioAtual.cargo === "chefe"){

        document.getElementById("adminPanel")
        .style.display = "block";

        document.getElementById("painelRealtime")
        .style.display = "block";

        iniciarRealtimePainel();
    }
}

// INICIAR EXPEDIENTE

async function iniciarExpediente(){

    imagens = [];

    atualizarPreview();

    inicioExpediente = new Date();

    document.getElementById("status")
    .innerHTML =

    `🟢 Entrada:
    ${inicioExpediente.toLocaleTimeString()}`;

    intervalo = setInterval(
        atualizarTimer,
        1000
    );

    await db.collection("ativos")
    .doc(usuarioAtual.id)
    .set({

        nome:usuarioAtual.nome,

        id:usuarioAtual.id,

        entrada:
        inicioExpediente.toLocaleTimeString(),

        entradaTimestamp:
        Date.now(),

        status:"online"
    });
}

// TIMER

function atualizarTimer(){

    if(!inicioExpediente) return;

    const agora = new Date();

    const diff = agora - inicioExpediente;

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

// FINALIZAR

async function finalizarExpediente(){

    clearInterval(intervalo);

    const agora = new Date();

    const registro = {

        nome:usuarioAtual.nome,

        id:usuarioAtual.id,

        entrada:
        inicioExpediente.toLocaleTimeString(),

        saida:
        agora.toLocaleTimeString(),

        data:
        agora.toLocaleDateString(),

        total:
        document.getElementById("timer")
        .innerText,

        prints:imagens,

        timestamp:Date.now()
    };

    await db.collection("registros")
    .add(registro);

    await db.collection("ativos")
    .doc(usuarioAtual.id)
    .delete();

    alert("Expediente salvo.");
}

// PRINTS

document
.getElementById("upload")
.addEventListener("change",function(e){

    for(const file of e.target.files){

        processarImagem(file);
    }
});

document.addEventListener("paste",(event)=>{

    const items =
    event.clipboardData.items;

    for(const item of items){

        if(item.type.indexOf("image") !== -1){

            const file =
            item.getAsFile();

            processarImagem(file);
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

    imagens.forEach((src,index)=>{

        const div =
        document.createElement("div");

        div.classList.add("preview-box");

        div.innerHTML = `

            <div class="preview-number">
                #${index+1}
            </div>

            <img src="${src}">

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

                item.prints.forEach((img,index)=>{

                    imagensHTML += `

                    <img
                    src="${img}"
                    onclick="abrirImagem('${img}')">

                    `;
                });
            }

            card.innerHTML = `

                <div class="online-badge">
                    🟢 ONLINE
                </div>

                <h3>
                    👤 ${item.nome}
                </h3>

                <p>
                    🪪 ${item.id}
                </p>

                <p>
                    📅 ${item.data}
                </p>

                <p>
                    🟢 ${item.entrada}
                </p>

                <p>
                    🔴 ${item.saida}
                </p>

                <p>
                    ⏱ ${item.total}
                </p>

                <div class="prints-grid">

                    ${imagensHTML}

                </div>

            `;

            lista.appendChild(card);
        });
    });

    db.collection("ativos")

    .onSnapshot(snapshot=>{

        snapshot.forEach(doc=>{

            const item = doc.data();

            atualizarTempoOnline(
                item.id,
                item.entradaTimestamp
            );
        });
    });
}

// TEMPO ONLINE

function atualizarTempoOnline(id,timestamp){

    setInterval(()=>{

        const agora = Date.now();

        const diff = agora - timestamp;

        const horas =
        Math.floor(diff / 3600000);

        const minutos =
        Math.floor((diff % 3600000)/60000);

        const segundos =
        Math.floor((diff % 60000)/1000);

        const card =
        document.getElementById(`tempo-${id}`);

        if(card){

            card.innerText =

            `${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
        }

    },1000);
}

// MODAL IMAGEM

function abrirImagem(src){

    const modal =
    document.createElement("div");

    modal.classList.add("modal");

    modal.innerHTML = `

        <img src="${src}">

    `;

    modal.onclick = ()=>{

        modal.remove();
    };

    document.body.appendChild(modal);
}

// PDF

async function gerarPDFSemanal(){

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF();

    pdf.setFontSize(22);

    pdf.text(
        "RELATÓRIO SEMANAL",
        20,
        20
    );

    const snapshot =
    await db.collection("registros")
    .where("id","==",usuarioAtual.id)
    .get();

    let y = 40;

    snapshot.forEach(doc=>{

        const item = doc.data();

        pdf.text(

            `${item.data} | ${item.total}`,

            20,

            y
        );

        y += 10;
    });

    pdf.save(

        `relatorio_${usuarioAtual.nome}.pdf`
    );
}

// ADICIONAR CURANDEIRO

async function adicionarCurandeiro(){

    if(usuarioAtual.cargo !== "chefe"){

        alert("Sem permissão.");

        return;
    }

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

        cargo:"curandeiro"
    });

    alert(

        `☣ Curandeiro criado.\nSenha provisória: ${senhaTemp}`
    );
}
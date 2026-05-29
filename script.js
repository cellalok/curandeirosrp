const firebaseConfig = {

    apiKey: "AIzaSyDobXJ_knDYZpmPAoktRzEU8U3GGB6t3cI",

    authDomain: "painel-curandeiros.firebaseapp.com",

    databaseURL: "https://painel-curandeiros-default-rtdb.firebaseio.com",
    
    projectId: "https://painel-curandeiros-default-rtdb.firebaseio.com",
    
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
        b.toString(16).padStart(2,"0"))
    .join("");
}

// LOGIN

async function entrarSistema(){

    try{

        const idDigitado =
        document.getElementById("idLogin")
        .value
        .trim()
        .toUpperCase();

        const senhaDigitada =
        document.getElementById("senhaLogin")
        .value
        .trim();

        console.log(
            "Tentando login:",
            idDigitado
        );

        // BUSCA TODOS

        const snapshot =
        await db.collection("usuarios")
        .get();

        console.log(
            "Usuários encontrados:",
            snapshot.size
        );

        let usuarioEncontrado = null;

        snapshot.forEach(doc=>{

            const dados = doc.data();

            console.log(
                "Documento:",
                dados
            );

            // TENTA TODOS OS CAMPOS POSSÍVEIS

            const idBanco =

                (
                    dados.id ||
                    dados.ID ||
                    dados.Id ||
                    dados.userId ||
                    ""
                )

                .toString()
                .trim()
                .toUpperCase();

            console.log(
                "ID banco:",
                idBanco
            );

            if(idBanco === idDigitado){

                usuarioEncontrado = {

                    ...dados,

                    docId:doc.id
                };
            }
        });

        if(!usuarioEncontrado){

            alert(
                "ID inválido"
            );

            return;
        }

        // HASH

        const senhaHash =
        await gerarHash(
            senhaDigitada
        );

        console.log(
            "Hash digitado:",
            senhaHash
        );

        console.log(
            "Hash banco:",
            usuarioEncontrado.senha
        );

        if(
            usuarioEncontrado.senha
            !== senhaHash
        ){

            alert(
                "Senha inválida"
            );

            return;
        }

        usuarioAtual =
        usuarioEncontrado;

        // LOGIN OK

        document.querySelector(
            ".login-card"
        ).style.display = "none";

        document.getElementById(
            "painel"
        ).style.display = "block";

        document.getElementById(
            "status"
        ).innerHTML =

        `☣ Bem-vindo(a),
        ${usuarioAtual.nome}`;

        // ONLINE

        await db.collection("ativos")
        .doc(usuarioAtual.docId)
        .set({

            nome:
            usuarioAtual.nome,

            id:
            usuarioAtual.id,

            cargo:
            usuarioAtual.cargo,

            online:true,

            ultimoLogin:
            new Date()
            .toLocaleString()
        });

        // PRIMEIRO LOGIN

        if(
            usuarioAtual.primeiroLogin
        ){

            document.getElementById(
                "trocarSenhaCard"
            ).style.display = "block";
        }

        // CHEFE

        if(
            usuarioAtual.cargo
            === "chefe"
        ){

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

        console.log(
            "LOGIN OK"
        );

    }catch(error){

        console.error(error);

        alert(
            "Erro no login. Veja F12."
        );
    }
}

// TROCAR SENHA

async function trocarSenha(){

    const novaSenha =
    document.getElementById(
        "novaSenha"
    ).value;

    if(novaSenha.length < 4){

        alert(
            "Senha muito curta"
        );

        return;
    }

    const senhaHash =
    await gerarHash(
        novaSenha
    );

    await db.collection("usuarios")
    .doc(usuarioAtual.docId)
    .update({

        senha:senhaHash,

        primeiroLogin:false
    });

    alert(
        "☣ Senha alterada"
    );

    document.getElementById(
        "trocarSenhaCard"
    ).style.display = "none";
}

// EXPEDIENTE

async function iniciarExpediente(){

    imagens = [];

    atualizarPreview();

    inicioExpediente =
    new Date();

    intervalo =
    setInterval(
        atualizarTimer,
        1000
    );

    document.getElementById(
        "status"
    ).innerHTML =

    `🟢 Entrada:
    ${inicioExpediente.toLocaleTimeString()}`;
}

function atualizarTimer(){

    const agora =
    new Date();

    const diff =
    agora - inicioExpediente;

    const horas =
    Math.floor(
        diff / 3600000
    );

    const minutos =
    Math.floor(
        (diff % 3600000)
        / 60000
    );

    const segundos =
    Math.floor(
        (diff % 60000)
        / 1000
    );

    document.getElementById(
        "timer"
    ).innerText =

    `${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
}

// FINALIZAR

async function finalizarExpediente(){

    clearInterval(intervalo);

    const agora =
    new Date();

    await db.collection(
        "registros"
    ).add({

        nome:
        usuarioAtual.nome,

        id:
        usuarioAtual.id,

        cargo:
        usuarioAtual.cargo,

        entrada:
        inicioExpediente
        .toLocaleTimeString(),

        saida:
        agora
        .toLocaleTimeString(),

        total:
        document.getElementById(
            "timer"
        ).innerText,

        data:
        agora
        .toLocaleDateString(),

        prints:imagens,

        timestamp:
        Date.now()
    });

    alert(
        "☣ Expediente salvo"
    );
}

// PRINTS

document
.getElementById("upload")
.addEventListener(
"change",
(e)=>{

    for(
        const file
        of e.target.files
    ){

        processarImagem(file);
    }
});

document.addEventListener(
"paste",
(event)=>{

    const items =
    event.clipboardData.items;

    for(
        const item
        of items
    ){

        if(
            item.type.indexOf(
                "image"
            ) !== -1
        ){

            processarImagem(
                item.getAsFile()
            );
        }
    }
});

function processarImagem(file){

    const reader =
    new FileReader();

    reader.onload =
    function(e){

        imagens.push(
            e.target.result
        );

        atualizarPreview();
    }

    reader.readAsDataURL(file);
}

function atualizarPreview(){

    const container =
    document.getElementById(
        "previewContainer"
    );

    container.innerHTML = "";

    imagens.forEach(
    (img,index)=>{

        const div =
        document.createElement(
            "div"
        );

        div.classList.add(
            "preview-box"
        );

        div.innerHTML = `

        <div class="preview-number">
            #${index+1}
        </div>

        <img src="${img}">

        `;

        container.appendChild(div);
    });
}

// js/main.js

// --- VARIABLES GLOBALES DEL LOBBY ---
let roomCode = null;
let myRole = null; // 'host' o 'guest'
let myName = "";
let rivalName = "";

// --- 1. GESTIÓN DE PANTALLAS ---
function showScreen(screenId) {
    const allScreens = ['start-screen', 'waiting-screen', 'setup-area', 'play-area', 'results-area'];
    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// --- 2. SISTEMA DE SALAS (LOBBY) ---

// Buscar salas activas (menos de 3 minutos de antigüedad y estado "esperando")
db.ref('salas').on('value', (snapshot) => {
    // Si ya estoy en una sala, ignoro esta lista
    if (roomCode) return; 

    const salas = snapshot.val() || {};
    const listaUI = document.getElementById('rooms-list');
    listaUI.innerHTML = ""; // Limpiar lista
    
    let salasDisponibles = 0;
    const ahora = Date.now();

    for (const [codigo, data] of Object.entries(salas)) {
        // Verificar que esté esperando y tenga menos de 3 minutos (180,000 ms)
        if (data.estado === "esperando" && (ahora - data.timestamp < 180000)) {
            salasDisponibles++;
            const btn = document.createElement('button');
            btn.className = "btn-success";
            btn.style.width = "100%";
            btn.style.marginBottom = "10px";
            btn.innerText = `Partida de ${data.hostName} (Unirse)`;
            btn.onclick = () => unirseSala(codigo, data.hostName);
            listaUI.appendChild(btn);
        }
    }

    if (salasDisponibles === 0) {
        listaUI.innerHTML = '<p class="empty-msg">No hay partidas abiertas. ¡Crea una!</p>';
    }
});

// Crear Sala
document.getElementById('btn-create-room').addEventListener('click', () => {
    const inputName = document.getElementById('my-name').value.trim();
    if (!inputName) { alert("¡Pon tu nombre primero!"); return; }

    myName = inputName;
    myRole = 'host';
    // Generar código aleatorio de 4 letras/números
    roomCode = Math.random().toString(36).substring(2, 6).toUpperCase(); 

    db.ref(`salas/${roomCode}`).set({
        hostName: myName,
        guestName: "",
        estado: "esperando",
        timestamp: Date.now()
    });

    document.getElementById('room-code-display').innerText = roomCode;
    showScreen('waiting-screen');

    // El Host se queda escuchando hasta que alguien entre a la sala
    db.ref(`salas/${roomCode}/guestName`).on('value', (snap) => {
        if (snap.val()) {
            rivalName = snap.val();
            // ¡Alguien entró! Desactivar este "oído" y arrancar el juego
            db.ref(`salas/${roomCode}/guestName`).off();
            iniciarSetup();
        }
    });
});

// Cancelar Sala
document.getElementById('btn-cancel-room').addEventListener('click', () => {
    if (roomCode) db.ref(`salas/${roomCode}`).remove();
    roomCode = null;
    showScreen('start-screen');
});

// Unirse a Sala
function unirseSala(codigo, hostNombre) {
    const inputName = document.getElementById('my-name').value.trim();
    if (!inputName) { alert("¡Pon tu nombre primero!"); return; }

    myName = inputName;
    myRole = 'guest';
    roomCode = codigo;
    rivalName = hostNombre;

    // Actualizar la sala avisando que ya entré
    db.ref(`salas/${roomCode}`).update({
        guestName: myName,
        estado: "configurando"
    });

    iniciarSetup();
}

// --- 3. CONFIGURACIÓN COMPARTIDA ---
function iniciarSetup() {
    showScreen('setup-area');
    document.getElementById('score-board').classList.remove('hidden');
    document.getElementById('label-p1').innerText = `${myName}:`;
    document.getElementById('label-p2').innerText = `${rivalName}:`;
    
    // Nombres en la tabla de resultados
    document.getElementById('th-p1').innerText = myName;
    document.getElementById('th-p2').innerText = rivalName;

    if (myRole === 'host') {
        document.getElementById('host-settings').classList.remove('hidden');
        document.getElementById('guest-waiting').classList.add('hidden');
    } else {
        document.getElementById('host-settings').classList.add('hidden');
        document.getElementById('guest-waiting').classList.remove('hidden');
        document.getElementById('host-name-display').innerText = rivalName;
    }

    // Empezamos a escuchar los movimientos de la partida
    escucharEstadoJuego();
}

// Mostrar opciones custom de mazo (Solo afecta UI del Host)
document.getElementById('mazo-select').addEventListener('change', (e) => {
    document.getElementById('custom-mazo-area').classList.toggle('hidden', e.target.value !== 'custom');
});

// --- 4. INICIO DE RONDA Y SINCRONIZACIÓN ---

// Botón Start (SOLO EL HOST PUEDE TOCARLO)
document.getElementById('btn-start').addEventListener('click', () => {
    // 1. Host configura el mazo localmente
    const selectMazo = document.getElementById('mazo-select').value;
    if (selectMazo === 'custom') {
        const customText = document.getElementById('custom-categories').value;
        const customCats = customText.split(',').map(c => c.trim()).filter(c => c !== "");
        if (typeof validarMazoCustom === 'function' && validarMazoCustom(customCats)) {
            mazoActual = customCats;
        } else { alert("El mazo custom debe tener entre 5 y 10 categorías."); return; }
    } else {
        mazoActual = mazosPredefinidos[selectMazo];
    }
    puntajeMeta = parseInt(document.querySelector('input[name="goal"]:checked').value);

    const nuevaLetra = elegirLetraAzar();
    
    // 2. Subir configuración a Firebase para que la descargue el Guest
    db.ref(`salas/${roomCode}/config`).set({ mazo: mazoActual, meta: puntajeMeta });
    db.ref(`salas/${roomCode}/respuestas`).remove(); 
    
    // 3. Avisar que arranca el juego
    db.ref(`salas/${roomCode}/actual`).set({
        letra: nuevaLetra,
        estado: 'jugando',
        timestamp: Date.now()
    });
});

// EL "OÍDO" PRINCIPAL DEL JUEGO (Escuchan ambos)
function escucharEstadoJuego() {
    db.ref(`salas/${roomCode}/actual`).on('value', (snap) => {
        const data = snap.val();
        if (!data) return;

        // A) Arranca la ronda
        if (data.estado === 'jugando' && letraActual !== data.letra) {
            letraActual = data.letra;
            document.getElementById('current-letter').innerText = letraActual;
            document.getElementById('current-letter').classList.remove('hidden');

            if (myRole === 'guest') {
                // El Guest descarga las reglas que puso el Host
                db.ref(`salas/${roomCode}/config`).once('value', (configSnap) => {
                    const config = configSnap.val();
                    mazoActual = config.mazo;
                    puntajeMeta = config.meta;
                    prepararRondaLocal();
                });
            } else {
                prepararRondaLocal();
            }
        } 
        // B) Alguien tocó Stop
        else if (data.estado === 'stop') {
            finalizarYMostrarVAR();
        }
    });
}

function prepararRondaLocal() {
    indiceCategoriaActual = 0;
    respuestasJugador = {};
    setTimeout(() => {
        showScreen('play-area');
        actualizarInterfazCategoria();
    }, 800);
}

// --- 5. LÓGICA DURANTE EL JUEGO (Local) ---
function guardarRespuestaActual() {
    const input = document.getElementById('user-input');
    const catNombre = mazoActual[indiceCategoriaActual];
    if (catNombre) respuestasJugador[catNombre] = input.value.trim();
    input.value = "";
}

document.getElementById('btn-next').addEventListener('click', () => {
    guardarRespuestaActual();
    if (indiceCategoriaActual < mazoActual.length - 1) {
        indiceCategoriaActual++;
        actualizarInterfazCategoria();
    } else { alert("¡Última categoría! Presiona TUTTI FRUTTI."); }
});

document.getElementById('btn-skip').addEventListener('click', () => {
    document.getElementById('user-input').value = ""; 
    guardarRespuestaActual();
    if (indiceCategoriaActual < mazoActual.length - 1) {
        indiceCategoriaActual++;
        actualizarInterfazCategoria();
    }
});

function actualizarInterfazCategoria() {
    document.getElementById('category-name').innerText = mazoActual[indiceCategoriaActual];
    document.getElementById('user-input').focus();
}

// --- 6. FINALIZAR RONDA (Stop / VAR) ---
document.getElementById('btn-stop').addEventListener('click', () => {
    db.ref(`salas/${roomCode}/actual/estado`).set('stop');
});

document.getElementById('btn-force-end').addEventListener('click', () => {
    if (confirm("¿Forzar el final de la ronda?")) {
        db.ref(`salas/${roomCode}/actual/estado`).set('stop');
    }
});

async function finalizarYMostrarVAR() {
    guardarRespuestaActual(); 
    showScreen('results-area');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('results-content').classList.add('hidden');

    const rivalRole = myRole === 'host' ? 'guest' : 'host';

    // Subir mis respuestas
    await db.ref(`salas/${roomCode}/respuestas/${myRole}`).set(respuestasJugador);

    // Escuchar las del rival
    const respuestasRef = db.ref(`salas/${roomCode}/respuestas/${rivalRole}`);
    respuestasRef.on('value', async (snapshot) => {
        const respuestasRival = snapshot.val();
        if (respuestasRival) {
            respuestasRef.off(); // Apagar oído para que no se repita
            await mostrarRevision(respuestasJugador, respuestasRival);
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('results-content').classList.remove('hidden');
        }
    });
}

// --- 7. CONFIRMAR RESULTADOS Y SUMAR ---
document.getElementById('btn-confirm-round').addEventListener('click', () => {
    const filas = document.querySelectorAll('#results-body tr');
    let totalRonda = 0;

    filas.forEach(fila => {
        const pts = parseInt(fila.querySelector('td[id^="pts-"]').innerText);
        totalRonda += pts;
    });

    scoreP1 += totalRonda; // scoreP1 de gameLogic ahora me representa a "mí"
    document.getElementById('score-p1').innerText = scoreP1;

    // TODO: En el futuro, podemos cruzar scores por Firebase para ver el de Lau en tiempo real
    // document.getElementById('score-p2').innerText = scoreP2; 

    if (scoreP1 >= puntajeMeta) {
        confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
        setTimeout(() => {
            alert(`¡PARTIDA TERMINADA! ¡Ganaste!`);
            if(myRole === 'host') db.ref(`salas/${roomCode}`).remove(); // Host limpia
            location.reload();
        }, 1500);
    } else {
        showScreen('setup-area');
        document.getElementById('current-letter').innerText = "?";
        document.getElementById('current-letter').classList.add('hidden');
    }
});
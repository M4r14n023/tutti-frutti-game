// js/main.js

let roomCode = null;
let myRole = null; 
let myName = "";
let rivalName = "";
let puntosSumadosEnEstaRonda = false; 
let yoGriteStop = false; 
let scoreP1 = 0; // Agregamos la variable de puntaje principal aquí para evitar errores

// --- 1. GESTIÓN DE PANTALLAS ---
function showScreen(screenId) {
    const allScreens = ['start-screen', 'waiting-screen', 'countdown-screen', 'play-area', 'results-area', 'final-screen'];
    
    if (screenId === 'start-screen') {
        document.body.classList.add('lobby-active');
    } else {
        document.body.classList.remove('lobby-active');
    }

    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.remove('hidden');
}

// --- 2. SISTEMA DE SALAS (LOBBY) ---
db.ref('salas').on('value', (snapshot) => {
    if (roomCode) return; 

    const salas = snapshot.val() || {};
    const listaUI = document.getElementById('rooms-list');
    if (!listaUI) return;
    
    listaUI.innerHTML = ""; 
    let salasDisponibles = 0;
    const ahora = Date.now();

    for (const [codigo, data] of Object.entries(salas)) {
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
    if (salasDisponibles === 0) listaUI.innerHTML = '<p class="empty-msg">No hay partidas abiertas.</p>';
});

document.getElementById('mazo-select')?.addEventListener('change', (e) => {
    document.getElementById('custom-mazo-area')?.classList.toggle('hidden', e.target.value !== 'custom');
});

function limpiarMazo(mazoArray) {
    return mazoArray.map(cat => cat.replace(/[.#$/\[\]]/g, '-'));
}

// CREAR SALA
document.getElementById('btn-create-room')?.addEventListener('click', () => {
    const inputName = document.getElementById('my-name');
    if (!inputName) return;
    
    myName = inputName.value.trim();
    if (!myName) { alert("Pon tu nombre primero."); return; }
    
    myRole = 'host';
    roomCode = Math.random().toString(36).substring(2, 6).toUpperCase(); 

    const selectMazo = document.getElementById('mazo-select').value;
    let mazoElegido = selectMazo === 'custom' ? document.getElementById('custom-categories').value.split(',').map(c => c.trim()) : mazosPredefinidos[selectMazo];
    
    mazoActual = limpiarMazo(mazoElegido);

    db.ref(`salas/${roomCode}`).set({
        hostName: myName,
        guestName: "",
        estado: "esperando",
        config: { mazo: mazoActual },
        timestamp: Date.now()
    });

    const displayCode = document.getElementById('room-code-display');
    if (displayCode) displayCode.innerText = roomCode;
    
    showScreen('waiting-screen');

    db.ref(`salas/${roomCode}/guestName`).on('value', (snap) => {
        if (snap.val()) {
            rivalName = snap.val();
            db.ref(`salas/${roomCode}/guestName`).off();
            prepararYDispararCountdown(); 
        }
    });
});

document.getElementById('btn-cancel-room')?.addEventListener('click', () => {
    if (roomCode) db.ref(`salas/${roomCode}`).remove();
    roomCode = null;
    showScreen('start-screen');
});

// UNIRSE
function unirseSala(codigo, hostNombre) {
    const inputName = document.getElementById('my-name');
    if (!inputName) return;

    myName = inputName.value.trim();
    if (!myName) { alert("Pon tu nombre primero."); return; }

    myRole = 'guest';
    roomCode = codigo;
    rivalName = hostNombre;

    db.ref(`salas/${roomCode}`).update({ guestName: myName });
    db.ref(`salas/${roomCode}/config`).once('value', (snap) => {
        if (snap.val() && snap.val().mazo) mazoActual = snap.val().mazo; 
    });

    escucharEstadoJuego(); 
}

// --- 3. SECUENCIA (Countdown) ---
function prepararYDispararCountdown() {
    const letra = elegirLetraAzar();
    if (!letra) { db.ref(`salas/${roomCode}/actual/estado`).set('finished'); return; }

    db.ref(`salas/${roomCode}/respuestas`).remove();
    db.ref(`salas/${roomCode}/actual`).set({
        letra: letra,
        estado: 'countdown',
        timestamp: Date.now()
    });
    
    if(myRole === 'host') escucharEstadoJuego();
}

function escucharEstadoJuego() {
    db.ref(`salas/${roomCode}/actual`).on('value', (snap) => {
        const data = snap.val();
        if (!data) return;

        if (data.estado === 'countdown') {
            document.getElementById('modal-tablas')?.classList.add('hidden'); 
            iniciarAnimacionCountdown(data.letra);
        } 
        else if (data.estado === 'jugando') {
            document.getElementById('modal-tablas')?.classList.add('hidden');
        }
        else if (data.estado === 'tablas') {
            const modal = document.getElementById('modal-tablas');
            if(modal) modal.classList.remove('hidden');
            
            const msgTablas = document.getElementById('tablas-msg');
            const prop = document.getElementById('tablas-controls-proposer');
            const rec = document.getElementById('tablas-controls-receiver');
            
            if (data.propuestoPor === myRole) {
                if(msgTablas) msgTablas.innerText = `Esperando a que ${rivalName} acepte las tablas...`;
                if(prop) prop.classList.remove('hidden');
                if(rec) rec.classList.add('hidden');
            } else {
                if(msgTablas) msgTablas.innerText = `¡${rivalName} propone dejar esta letra en Tablas! ¿Aceptas?`;
                if(prop) prop.classList.add('hidden');
                if(rec) rec.classList.remove('hidden');
            }
        }
        else if (data.estado === 'stop') {
            document.getElementById('modal-tablas')?.classList.add('hidden');
            const resArea = document.getElementById('results-area');
            if (resArea && resArea.classList.contains('hidden')) {
                manejarCorteDeRonda();
            }
        }
        else if (data.estado === 'finished') {
            mostrarSumaFinal();
        }
        else if (data.estado === 'solicitar_nueva' && myRole === 'host') {
            prepararYDispararCountdown();
        }
    });
}

function iniciarAnimacionCountdown(letra) {
    sumarPuntosSeguros(); 
    yoGriteStop = false; 

    // Blindaje anti-nulos
    const thP1 = document.getElementById('th-p1');
    const thP2 = document.getElementById('th-p2');
    if (thP1) thP1.innerText = myName;
    if (thP2) thP2.innerText = rivalName;

    showScreen('countdown-screen');
    
    const msg = document.getElementById('challenge-msg');
    if(msg) msg.innerText = `¡${rivalName} está listo!`;
    
    const numDisplay = document.getElementById('countdown-number');
    const letDisplay = document.getElementById('letra-revelada');
    
    if (numDisplay) numDisplay.classList.remove('hidden');
    if (letDisplay) letDisplay.classList.add('hidden');

    let contador = 3;
    if (numDisplay) numDisplay.innerText = contador;

    const intervalo = setInterval(() => {
        contador--;
        if (contador > 0) {
            if (numDisplay) numDisplay.innerText = contador;
        } else if (contador === 0) {
            if (numDisplay) numDisplay.innerText = "¡YA!";
        } else {
            clearInterval(intervalo);
            if (numDisplay) numDisplay.classList.add('hidden');
            if (letDisplay) {
                letDisplay.innerText = letra;
                letDisplay.classList.remove('hidden');
            }
            
            setTimeout(() => {
                letraActual = letra;
                const currLet = document.getElementById('current-letter-display');
                if (currLet) currLet.innerText = letra;
                prepararRondaLocal();
            }, 1000);
        }
    }, 1000);
}

function prepararRondaLocal() {
    puntosSumadosEnEstaRonda = false;
    indiceCategoriaActual = 0;
    respuestasJugador = {};
    
    const btnNext = document.getElementById('btn-next');
    const btnSkip = document.getElementById('btn-skip');
    const userInput = document.getElementById('user-input');
    
    if (btnNext) btnNext.disabled = false;
    if (btnSkip) btnSkip.disabled = false;
    if (userInput) userInput.style.borderColor = "#ff00ff";
    
    showScreen('play-area');
    actualizarInterfazCategoria();
}

// --- 4. LÓGICA DURANTE EL JUEGO ---
function guardarRespuestaActual() {
    const input = document.getElementById('user-input');
    if (!input) return;
    const catNombre = mazoActual[indiceCategoriaActual];
    if (catNombre) {
        respuestasJugador[catNombre] = input.value.trim();
    }
}

function estanTodasCompletas() {
    for (let cat of mazoActual) {
        if (!respuestasJugador[cat] || respuestasJugador[cat].trim() === "") {
            return false;
        }
    }
    return true;
}

function irAProximaCategoriaVacia() {
    for (let i = 1; i <= mazoActual.length; i++) {
        let nextIndex = (indiceCategoriaActual + i) % mazoActual.length;
        let catNombre = mazoActual[nextIndex];
        
        if (!respuestasJugador[catNombre] || respuestasJugador[catNombre].trim() === "") {
            indiceCategoriaActual = nextIndex;
            actualizarInterfazCategoria();
            return;
        }
    }
}

document.getElementById('btn-next')?.addEventListener('click', () => {
    guardarRespuestaActual();
    if (estanTodasCompletas()) {
        yoGriteStop = true;
        db.ref(`salas/${roomCode}/actual/estado`).set('stop');
    } else {
        irAProximaCategoriaVacia();
    }
});

document.getElementById('btn-skip')?.addEventListener('click', () => {
    guardarRespuestaActual();
    irAProximaCategoriaVacia();
});

function actualizarInterfazCategoria() {
    const catNombre = mazoActual[indiceCategoriaActual];
    const catDisplay = document.getElementById('category-name');
    if (catDisplay) catDisplay.innerText = catNombre;
    
    const input = document.getElementById('user-input');
    if (input) {
        input.value = respuestasJugador[catNombre] || ""; 
        input.focus();
    }
}

// --- 5. VAR Y TABLAS ---
document.getElementById('btn-stop')?.addEventListener('click', () => {
    guardarRespuestaActual(); 
    if (estanTodasCompletas()) {
        yoGriteStop = true; 
        db.ref(`salas/${roomCode}/actual/estado`).set('stop');
    } else {
        alert("¡No podés gritar Tutti Frutti! Te faltan categorías por completar.");
        actualizarInterfazCategoria(); 
    }
});

document.getElementById('btn-tablas')?.addEventListener('click', () => {
    guardarRespuestaActual(); 
    db.ref(`salas/${roomCode}/actual`).update({
        estado: 'tablas',
        propuestoPor: myRole
    });
});

window.cancelarTablas = function() {
    db.ref(`salas/${roomCode}/actual`).update({ estado: 'jugando' });
};

window.rechazarTablas = function() {
    db.ref(`salas/${roomCode}/actual`).update({ estado: 'jugando' });
    db.ref(`salas/${roomCode}/actual/rechazo`).set(Date.now()); 
};

window.aceptarTablas = function() {
    yoGriteStop = true; 
    db.ref(`salas/${roomCode}/actual`).update({ estado: 'stop' });
};

function manejarCorteDeRonda() {
    const input = document.getElementById('user-input');
    const inputActual = input ? input.value.trim() : "";
    
    if (!yoGriteStop && inputActual.length >= 2) {
        const catName = document.getElementById('category-name');
        if (catName) {
            catName.innerText = "¡TIEMPO! 3 segundos...";
            catName.style.color = "red";
        }
        if (input) input.style.borderColor = "red";
        
        const btnNext = document.getElementById('btn-next');
        const btnSkip = document.getElementById('btn-skip');
        if (btnNext) btnNext.disabled = true;
        if (btnSkip) btnSkip.disabled = true;
        
        setTimeout(() => {
            finalizarYMostrarVAR();
        }, 3000);
    } else {
        finalizarYMostrarVAR();
    }
}

async function finalizarYMostrarVAR() {
    guardarRespuestaActual(); 
    showScreen('results-area');
    
    const loader = document.getElementById('loader');
    const resContent = document.getElementById('results-content');
    if (loader) loader.classList.remove('hidden');
    if (resContent) resContent.classList.add('hidden');

    const rivalRole = myRole === 'host' ? 'guest' : 'host';
    const payload = { completado: true, data: respuestasJugador || {} };

    await db.ref(`salas/${roomCode}/respuestas/${myRole}`).set(payload);

    const respuestasRef = db.ref(`salas/${roomCode}/respuestas/${rivalRole}`);
    respuestasRef.on('value', async (snapshot) => {
        const payloadRival = snapshot.val();
        if (payloadRival && payloadRival.completado) {
            respuestasRef.off(); 
            const respuestasRival = payloadRival.data || {};
            await mostrarRevision(respuestasJugador, respuestasRival);
            
            if (loader) loader.classList.add('hidden');
            if (resContent) resContent.classList.remove('hidden');
        }
    });
}

// --- 6. SUMA DE PUNTOS ---
function sumarPuntosSeguros() {
    if (puntosSumadosEnEstaRonda) return; 
    
    const filas = document.querySelectorAll('#results-body tr');
    let totalRonda = 0;
    filas.forEach(fila => {
        const tdPuntos = fila.querySelector('td[id^="pts-"]');
        const pts = parseInt(tdPuntos?.innerText || 0);
        totalRonda += pts;
    });

    scoreP1 += totalRonda; 
    const scoreUI = document.getElementById('score-p1');
    if (scoreUI) scoreUI.innerText = scoreP1;
    
    puntosSumadosEnEstaRonda = true;
}

document.getElementById('btn-next-round')?.addEventListener('click', () => {
    sumarPuntosSeguros();
    db.ref(`salas/${roomCode}/actual/estado`).set('solicitar_nueva'); 
});

document.getElementById('btn-end-game')?.addEventListener('click', () => {
    sumarPuntosSeguros();
    db.ref(`salas/${roomCode}/scores/${myRole}`).set(scoreP1).then(() => {
        db.ref(`salas/${roomCode}/actual/estado`).set('finished');
    });
});

function mostrarSumaFinal() {
    sumarPuntosSeguros();
    showScreen('final-screen');
    
    db.ref(`salas/${roomCode}/scores/${myRole}`).set(scoreP1);

    const scoresRef = db.ref(`salas/${roomCode}/scores`);
    scoresRef.on('value', (snap) => {
        const scores = snap.val();
        
        if (scores && scores.host !== undefined && scores.guest !== undefined) {
            scoresRef.off(); 
            
            const miScoreFinal = myRole === 'host' ? scores.host : scores.guest;
            const rivalScoreFinal = myRole === 'host' ? scores.guest : scores.host;
            
            const lP1 = document.getElementById('label-final-p1');
            const scMe = document.getElementById('final-score-me');
            const lP2 = document.getElementById('label-final-p2');
            const scRival = document.getElementById('final-score-rival');
            
            if (lP1) lP1.innerText = myName;
            if (scMe) scMe.innerText = miScoreFinal;
            if (lP2) lP2.innerText = rivalName;
            if (scRival) scRival.innerText = rivalScoreFinal;

            const titulo = document.getElementById('winner-announcement');
            if (titulo) {
                if (miScoreFinal > rivalScoreFinal) {
                    titulo.innerText = "🏆 ¡GANASTE!";
                    if (typeof confetti === 'function') confetti({ particleCount: 400, spread: 120, origin: { y: 0.6 } });
                } else if (miScoreFinal < rivalScoreFinal) {
                    titulo.innerText = `😢 Ganó ${rivalName}`;
                } else {
                    titulo.innerText = "🤝 ¡EMPATE ÉPICO!";
                }
            }

            if(myRole === 'host') {
                setTimeout(() => db.ref(`salas/${roomCode}`).remove(), 5000);
            }
        } else {
            const tit = document.getElementById('winner-announcement');
            if(tit) tit.innerText = "Esperando al rival...";
        }
    });
}
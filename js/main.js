// js/main.js

let roomCode = null;
let myRole = null; 
let myName = "";
let rivalName = "";
let puntosSumadosEnEstaRonda = false; 
let yoGriteStop = false; 
// Eliminamos el 'let' de scoreP1 porque ya está en gameLogic.js
scoreP1 = 0;

// --- 1. GESTIÓN DE PANTALLAS ---
function showScreen(screenId) {
    const allScreens = ['start-screen', 'waiting-screen', 'countdown-screen', 'play-area', 'results-area', 'final-screen'];
    
    // Magia para ocultar el cuadro blanco en el inicio
    if (screenId === 'start-screen' || screenId === 'waiting-screen') {
        document.body.classList.add('lobby-active');
    } else {
        document.body.classList.remove('lobby-active');
    }

    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// --- 2. SISTEMA DE SALAS (LOBBY) ---
db.ref('salas').on('value', (snapshot) => {
    if (roomCode) return; 

    const salas = snapshot.val() || {};
    const listaUI = document.getElementById('rooms-list');
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

document.getElementById('mazo-select').addEventListener('change', (e) => {
    document.getElementById('custom-mazo-area').classList.toggle('hidden', e.target.value !== 'custom');
});

function limpiarMazo(mazoArray) {
    return mazoArray.map(cat => cat.replace(/[.#$/\[\]]/g, '-'));
}

// CREAR SALA (HOST) - ARRANQUE AUTOMÁTICO AL UNIRSE
document.getElementById('btn-create-room').addEventListener('click', () => {
    myName = document.getElementById('my-name').value.trim();
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

    document.getElementById('room-code-display').innerText = roomCode;
    showScreen('waiting-screen');

    db.ref(`salas/${roomCode}/guestName`).on('value', (snap) => {
        if (snap.val()) {
            rivalName = snap.val();
            db.ref(`salas/${roomCode}/guestName`).off();
            prepararYDispararCountdown(); // Arranca solito
        }
    });
});

document.getElementById('btn-cancel-room').addEventListener('click', () => {
    if (roomCode) db.ref(`salas/${roomCode}`).remove();
    roomCode = null;
    showScreen('start-screen');
});

// UNIRSE (GUEST)
function unirseSala(codigo, hostNombre) {
    myName = document.getElementById('my-name').value.trim();
    if (!myName) { alert("Pon tu nombre primero."); return; }

    myRole = 'guest';
    roomCode = codigo;
    rivalName = hostNombre;

    db.ref(`salas/${roomCode}`).update({ guestName: myName });
    db.ref(`salas/${roomCode}/config`).once('value', (snap) => {
        mazoActual = snap.val().mazo; 
    });

    escucharEstadoJuego(); 
}

// --- 3. SECUENCIA AUTOMÁTICA (Countdown) ---
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
            // Si alguien rechaza las tablas o las cancela, se oculta el modal
            document.getElementById('modal-tablas')?.classList.add('hidden');
        }
        else if (data.estado === 'tablas') {
            // LÓGICA DE TABLAS (Mostrar Modal)
            const modal = document.getElementById('modal-tablas');
            if(modal) modal.classList.remove('hidden');
            
            if (data.propuestoPor === myRole) {
                document.getElementById('tablas-msg').innerText = `Esperando a que ${rivalName} acepte las tablas...`;
                document.getElementById('tablas-controls-proposer').classList.remove('hidden');
                document.getElementById('tablas-controls-receiver').classList.add('hidden');
            } else {
                document.getElementById('tablas-msg').innerText = `¡${rivalName} propone dejar esta letra en Tablas! ¿Aceptas?`;
                document.getElementById('tablas-controls-proposer').classList.add('hidden');
                document.getElementById('tablas-controls-receiver').classList.remove('hidden');
            }
        }
        else if (data.estado === 'stop') {
            document.getElementById('modal-tablas')?.classList.add('hidden');
            if (document.getElementById('results-area').classList.contains('hidden')) {
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

    document.getElementById('th-p1').innerText = myName;
    document.getElementById('th-p2').innerText = rivalName;

    showScreen('countdown-screen');
    document.getElementById('challenge-msg').innerText = `¡${rivalName} está listo!`;
    document.getElementById('countdown-number').classList.remove('hidden');
    document.getElementById('letra-revelada').classList.add('hidden');

    let contador = 3;
    document.getElementById('countdown-number').innerText = contador;

    const intervalo = setInterval(() => {
        contador--;
        if (contador > 0) {
            document.getElementById('countdown-number').innerText = contador;
        } else if (contador === 0) {
            document.getElementById('countdown-number').innerText = "¡YA!";
        } else {
            clearInterval(intervalo);
            document.getElementById('countdown-number').classList.add('hidden');
            document.getElementById('letra-revelada').innerText = letra;
            document.getElementById('letra-revelada').classList.remove('hidden');
            
            setTimeout(() => {
                letraActual = letra;
                document.getElementById('current-letter-display').innerText = letra;
                prepararRondaLocal();
            }, 1000);
        }
    }, 1000);
}

function prepararRondaLocal() {
    puntosSumadosEnEstaRonda = false;
    indiceCategoriaActual = 0;
    respuestasJugador = {};
    
    document.getElementById('btn-next').disabled = false;
    document.getElementById('btn-skip').disabled = false;
    document.getElementById('user-input').style.borderColor = "#ddd";
    
    showScreen('play-area');
    actualizarInterfazCategoria();
}

// --- 4. LÓGICA DURANTE EL JUEGO ---
function guardarRespuestaActual() {
    const input = document.getElementById('user-input');
    const catNombre = mazoActual[indiceCategoriaActual];
    if (catNombre) {
        respuestasJugador[catNombre] = input.value.trim();
    }
}

function estanTodasCompletas() {
    for (let cat of mazoActual) {
        const resp = respuestasJugador[cat] || "";
        // Si no existe o tiene menos de 3 letras, no está completa
        if (resp.trim().length < 3) {
            return false;
        }
    }
    return true;
}

function irAProximaCategoriaVacia() {
    for (let i = 1; i <= mazoActual.length; i++) {
        let nextIndex = (indiceCategoriaActual + i) % mazoActual.length;
        let catNombre = mazoActual[nextIndex];
        
        const resp = respuestasJugador[catNombre] || "";
        // Si la categoría tiene menos de 3 letras, salta hacia ella
        if (resp.trim().length < 3) {
            indiceCategoriaActual = nextIndex;
            actualizarInterfazCategoria();
            return;
        }
    }
}

document.getElementById('btn-next').addEventListener('click', () => {
    guardarRespuestaActual();
    
    if (estanTodasCompletas()) {
        yoGriteStop = true;
        db.ref(`salas/${roomCode}/actual/estado`).set('stop');
    } else {
        irAProximaCategoriaVacia();
    }
});

document.getElementById('btn-skip').addEventListener('click', () => {
    guardarRespuestaActual();
    irAProximaCategoriaVacia();
});

function actualizarInterfazCategoria() {
    const catNombre = mazoActual[indiceCategoriaActual];
    document.getElementById('category-name').innerText = catNombre;
    
    const input = document.getElementById('user-input');
    input.value = respuestasJugador[catNombre] || ""; 
    input.focus();
}

// --- 5. VAR, STOP Y TIEMPO DE GRACIA ---
document.getElementById('btn-stop').addEventListener('click', () => {
    guardarRespuestaActual(); 
    
    if (estanTodasCompletas()) {
        yoGriteStop = true; 
        db.ref(`salas/${roomCode}/actual/estado`).set('stop');
    } else {
        alert("¡No podés gritar Tutti Frutti! Te faltan categorías por completar. Si se traban, ofreceles Tablas a tu rival.");
        actualizarInterfazCategoria(); 
    }
});

function manejarCorteDeRonda() {
    const inputActual = document.getElementById('user-input').value.trim();
    
    if (!yoGriteStop && inputActual.length >= 2) {
        document.getElementById('category-name').innerText = "¡TIEMPO! 3 segundos...";
        document.getElementById('category-name').style.color = "red";
        document.getElementById('user-input').style.borderColor = "red";
        document.getElementById('btn-next').disabled = true;
        document.getElementById('btn-skip').disabled = true;
        
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
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('results-content').classList.add('hidden');

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
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('results-content').classList.remove('hidden');
        }
    });
}

// --- 6. TABLAS (EMPATE) ---
document.getElementById('btn-tablas').addEventListener('click', () => {
    guardarRespuestaActual(); 
    db.ref(`salas/${roomCode}/actual`).update({
        estado: 'tablas',
        propuestoPor: myRole
    });
});

// Nota: Estas 3 funciones deben llamarse desde el HTML (onclick="cancelarTablas()", etc.)
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

// --- 7. SUMA DE PUNTOS Y FINALIZACIÓN ---
function sumarPuntosSeguros() {
    if (puntosSumadosEnEstaRonda) return; 
    
    const filas = document.querySelectorAll('#results-body tr');
    let totalRonda = 0;
    filas.forEach(fila => {
        const pts = parseInt(fila.querySelector('td[id^="pts-"]')?.innerText || 0);
        totalRonda += pts;
    });

    scoreP1 += totalRonda; 
    puntosSumadosEnEstaRonda = true;
}

document.getElementById('btn-next-round').addEventListener('click', () => {
    sumarPuntosSeguros();
    db.ref(`salas/${roomCode}/actual/estado`).set('solicitar_nueva'); 
});

document.getElementById('btn-end-game').addEventListener('click', () => {
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
            
            document.getElementById('label-final-p1').innerText = myName;
            document.getElementById('final-score-me').innerText = miScoreFinal;
            document.getElementById('label-final-p2').innerText = rivalName;
            document.getElementById('final-score-rival').innerText = rivalScoreFinal;

            const titulo = document.getElementById('winner-announcement');
            if (miScoreFinal > rivalScoreFinal) {
                titulo.innerText = "🏆 ¡GANASTE!";
                confetti({ particleCount: 400, spread: 120, origin: { y: 0.6 } });
            } else if (miScoreFinal < rivalScoreFinal) {
                titulo.innerText = `😢 Ganó ${rivalName}`;
            } else {
                titulo.innerText = "🤝 ¡EMPATE ÉPICO!";
            }

            if(myRole === 'host') {
                setTimeout(() => db.ref(`salas/${roomCode}`).remove(), 5000);
            }
        } else {
            document.getElementById('winner-announcement').innerText = "Esperando al rival...";
        }
    });
}
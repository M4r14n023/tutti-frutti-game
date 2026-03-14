// js/main.js

let roomCode = null;
let myRole = null; 
let myName = "";
let rivalName = "";
let puntosSumadosEnEstaRonda = false; 
let yoGriteStop = false; // Para saber quién cortó el juego

// --- 1. GESTIÓN DE PANTALLAS ---
function showScreen(screenId) {
    const allScreens = ['start-screen', 'waiting-screen', 'countdown-screen', 'play-area', 'results-area', 'final-screen'];
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

// Función para limpiar caracteres prohibidos en Firebase
function limpiarMazo(mazoArray) {
    return mazoArray.map(cat => cat.replace(/[.#$/\[\]]/g, '-'));
}

// CREAR SALA (HOST)
document.getElementById('btn-create-room').addEventListener('click', () => {
    myName = document.getElementById('my-name').value.trim();
    if (!myName) { alert("Pon tu nombre primero."); return; }
    
    myRole = 'host';
    roomCode = Math.random().toString(36).substring(2, 6).toUpperCase(); 

    const selectMazo = document.getElementById('mazo-select').value;
    let mazoElegido = selectMazo === 'custom' ? document.getElementById('custom-categories').value.split(',').map(c => c.trim()) : mazosPredefinidos[selectMazo];
    
    // FIX BUG 1: Limpiamos los nombres de las categorías antes de usarlos
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
            prepararYDispararCountdown(); 
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
        mazoActual = snap.val().mazo; // El mazo ya viene limpio del Host
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
            iniciarAnimacionCountdown(data.letra);
        } 
        else if (data.estado === 'stop') {
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

    // Solo actualizamos los nombres en la tabla del VAR, ignoramos el header
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
    
    // Habilitar botones por si venimos de un tiempo de gracia previo
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
    if (catNombre) respuestasJugador[catNombre] = input.value.trim();
    input.value = "";
}

document.getElementById('btn-next').addEventListener('click', () => {
    guardarRespuestaActual();
    if (indiceCategoriaActual < mazoActual.length - 1) {
        indiceCategoriaActual++;
        actualizarInterfazCategoria();
    }
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

// --- 5. VAR, STOP Y TIEMPO DE GRACIA ---
document.getElementById('btn-stop').addEventListener('click', () => {
    yoGriteStop = true; // Fui yo
    db.ref(`salas/${roomCode}/actual/estado`).set('stop');
});

// FIX BUG 2: La lógica del tiempo extra para el que va atrasado
function manejarCorteDeRonda() {
    const inputActual = document.getElementById('user-input').value.trim();
    
    // Si NO fui yo quien gritó stop, y tengo al menos 2 letras escritas
    if (!yoGriteStop && inputActual.length >= 2) {
        document.getElementById('category-name').innerText = "¡TIEMPO! 3 segundos...";
        document.getElementById('category-name').style.color = "red";
        document.getElementById('user-input').style.borderColor = "red";
        document.getElementById('btn-next').disabled = true;
        document.getElementById('btn-skip').disabled = true;
        
        // Le damos 3 segundos y luego lo forzamos al VAR
        setTimeout(() => {
            finalizarYMostrarVAR();
        }, 3000);
    } else {
        // Si fui yo quien gritó, o si tenía la caja vacía, corto de una
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

// --- 6. SUMA DE PUNTOS Y CONTINUACIÓN ---
function sumarPuntosSeguros() {
    if (puntosSumadosEnEstaRonda) return; 
    
    const filas = document.querySelectorAll('#results-body tr');
    let totalRonda = 0;
    filas.forEach(fila => {
        const pts = parseInt(fila.querySelector('td[id^="pts-"]')?.innerText || 0);
        totalRonda += pts;
    });

    scoreP1 += totalRonda; // Seguimos sumando matemáticamente por detrás
    // Borramos la línea que intentaba mostrarlo en la pantalla
    puntosSumadosEnEstaRonda = true;
}

document.getElementById('btn-next-round').addEventListener('click', () => {
    sumarPuntosSeguros();
    db.ref(`salas/${roomCode}/actual/estado`).set('solicitar_nueva'); 
});

// Botón de Suma Final
document.getElementById('btn-end-game').addEventListener('click', () => {
    sumarPuntosSeguros();
    
    // Subo mi score final a la base de datos
    db.ref(`salas/${roomCode}/scores/${myRole}`).set(scoreP1).then(() => {
        // Le aviso al rival que el juego terminó
        db.ref(`salas/${roomCode}/actual/estado`).set('finished');
    });
});

// La función que corona al ganador
function mostrarSumaFinal() {
    sumarPuntosSeguros();
    showScreen('final-screen');
    
    // Por las dudas, me aseguro de subir mi score si el botón lo apretó el rival
    db.ref(`salas/${roomCode}/scores/${myRole}`).set(scoreP1);

    // Me quedo escuchando hasta que estén los dos puntajes en Firebase
    const scoresRef = db.ref(`salas/${roomCode}/scores`);
    scoresRef.on('value', (snap) => {
        const scores = snap.val();
        
        // Si ya están los puntajes del host y del guest
        if (scores && scores.host !== undefined && scores.guest !== undefined) {
            scoresRef.off(); // Apago el oído
            
            // Asigno quién es quién
            const miScoreFinal = myRole === 'host' ? scores.host : scores.guest;
            const rivalScoreFinal = myRole === 'host' ? scores.guest : scores.host;
            
            // Muestro los nombres y puntajes en pantalla
            document.getElementById('label-final-p1').innerText = myName;
            document.getElementById('final-score-me').innerText = miScoreFinal;
            document.getElementById('label-final-p2').innerText = rivalName;
            document.getElementById('final-score-rival').innerText = rivalScoreFinal;

            // Anuncio del Ganador
            const titulo = document.getElementById('winner-announcement');
            if (miScoreFinal > rivalScoreFinal) {
                titulo.innerText = "🏆 ¡GANASTE!";
                confetti({ particleCount: 400, spread: 120, origin: { y: 0.6 } });
            } else if (miScoreFinal < rivalScoreFinal) {
                titulo.innerText = `😢 Ganó ${rivalName}`;
            } else {
                titulo.innerText = "🤝 ¡EMPATE ÉPICO!";
            }

            // El Host limpia la sala para no dejar basura en Firebase
            if(myRole === 'host') {
                setTimeout(() => db.ref(`salas/${roomCode}`).remove(), 5000);
            }
        } else {
            document.getElementById('winner-announcement').innerText = "Esperando al rival...";
        }
    });
}
// js/main.js

// --- VARIABLES GLOBALES ---
let miID = "p1"; 
let rivalID = "p2";

// --- 1. GESTIÓN DE PANTALLAS ---
function showScreen(screenId) {
    const allScreens = ['start-screen', 'setup-area', 'play-area', 'results-area'];
    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// --- 2. ESCUCHAR A FIREBASE (El "oído" del juego en tiempo real) ---
db.ref('partida/actual').on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // A) Alguien eligió una letra nueva -> Empezar a jugar
    if (data.estado === 'jugando' && letraActual !== data.letra) {
        letraActual = data.letra;
        document.getElementById('current-letter').innerText = letraActual;
        
        // Reseteamos variables para la nueva ronda
        indiceCategoriaActual = 0;
        respuestasJugador = {};
        
        showScreen('play-area');
        actualizarInterfazCategoria();
    }

    // B) Alguien gritó TUTTI FRUTTI -> Frenar a todos
    if (data.estado === 'stop') {
        finalizarYMostrarVAR();
    }
});


// --- 3. CONFIGURACIÓN INICIAL (Botón Listos) ---
document.getElementById('btn-ready').addEventListener('click', () => {
    // Definir quién soy según los nombres (Si el primer cuadro dice "Tú", asumo que soy P1)
    const nombreInput = document.getElementById('name-p1').value;
    if (nombreInput === "Tú" || nombreInput === "Jugador 1") {
        miID = "p1"; rivalID = "p2";
    } else {
        miID = "p2"; rivalID = "p1";
    }

    // Configurar marcador visual
    const name1 = document.getElementById('name-p1').value || "P1";
    const name2 = document.getElementById('name-p2').value || "P2";
    document.getElementById('label-p1').innerText = `${name1}:`;
    document.getElementById('label-p2').innerText = `${name2}:`;

    // Configurar Mazo
    const selectMazo = document.getElementById('mazo-select').value;
    if (selectMazo === 'custom') {
        const customText = document.getElementById('custom-categories').value;
        const customCats = customText.split(',').map(c => c.trim()).filter(c => c !== "");
        if (typeof validarMazoCustom === 'function' && validarMazoCustom(customCats)) {
            mazoActual = customCats;
        } else {
            alert("El mazo debe tener entre 5 y 10 categorías.");
            return;
        }
    } else {
        mazoActual = mazosPredefinidos[selectMazo];
    }

    // Configurar Meta y Limpiar Base de Datos (Si soy P1, limpio la mesa)
    puntajeMeta = parseInt(document.querySelector('input[name="goal"]:checked').value);
    if (miID === "p1") {
        db.ref('partida').remove(); 
    }

    showScreen('setup-area');
});


// --- 4. INICIAR RONDA (Botón Elegir Letra) ---
document.getElementById('btn-start').addEventListener('click', () => {
    const nuevaLetra = elegirLetraAzar();
    
    // Limpiamos las respuestas de la ronda anterior en la base de datos
    db.ref('partida/respuestas').remove(); 

    // Avisamos a Firebase que arranca la ronda (Esto dispara el Listener del paso 2 a ambos)
    db.ref('partida/actual').set({
        letra: nuevaLetra,
        estado: 'jugando',
        timestamp: Date.now()
    });
});


// --- 5. LÓGICA DURANTE EL JUEGO (Local) ---
function guardarRespuestaActual() {
    const input = document.getElementById('user-input');
    const catNombre = mazoActual[indiceCategoriaActual];
    if (catNombre) {
        respuestasJugador[catNombre] = input.value.trim();
    }
    input.value = "";
}

document.getElementById('btn-next').addEventListener('click', () => {
    guardarRespuestaActual();
    if (indiceCategoriaActual < mazoActual.length - 1) {
        indiceCategoriaActual++;
        actualizarInterfazCategoria();
    } else {
        alert("¡Última categoría completada! Presiona TUTTI FRUTTI.");
    }
});

document.getElementById('btn-skip').addEventListener('click', () => {
    document.getElementById('user-input').value = ""; // Dejar en blanco
    guardarRespuestaActual();
    if (indiceCategoriaActual < mazoActual.length - 1) {
        indiceCategoriaActual++;
        actualizarInterfazCategoria();
    }
});


// --- 6. FINALIZAR RONDA (Botones de Stop) ---
document.getElementById('btn-stop').addEventListener('click', () => {
    // Le avisamos a Firebase que se acabó el tiempo.
    // Esto disparará la función finalizarYMostrarVAR() para AMBOS jugadores al mismo tiempo.
    db.ref('partida/actual/estado').set('stop');
});

document.getElementById('btn-force-end').addEventListener('click', () => {
    if (confirm("¿Estás seguro de forzar el final para ambos?")) {
        db.ref('partida/actual/estado').set('stop');
    }
});


// --- 7. EL VAR Y SINCRONIZACIÓN DE RESPUESTAS ---
async function finalizarYMostrarVAR() {
    guardarRespuestaActual(); // Guardar lo que estaba escribiendo justo en el corte
    
    showScreen('results-area');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('results-content').classList.add('hidden');

    // Subir mis respuestas a Firebase
    await db.ref(`partida/respuestas/${miID}`).set(respuestasJugador);

    // Escuchar a Firebase hasta que el rival suba las suyas
    const respuestasRef = db.ref(`partida/respuestas/${rivalID}`);
    respuestasRef.on('value', async (snapshot) => {
        const respuestasLau = snapshot.val();

        if (respuestasLau) {
            console.log("¡El rival subió sus respuestas!");
            respuestasRef.off(); // Apagamos el "oído" para esta ronda

            // Comparamos usando la función del diccionario
            await mostrarRevision(respuestasJugador, respuestasLau);

            // Quitamos pantalla de carga
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('results-content').classList.remove('hidden');
        } else {
            console.log("Esperando respuestas del rival...");
        }
    });
}


// --- 8. CONFIRMAR RESULTADOS Y SUMAR ---
document.getElementById('btn-confirm-round').addEventListener('click', () => {
    const filas = document.querySelectorAll('#results-body tr');
    let totalRonda = 0;

    filas.forEach(fila => {
        const pts = parseInt(fila.querySelector('td[id^="pts-"]').innerText);
        totalRonda += pts;
    });

    // Actualizamos el score local
    if (miID === "p1") {
        scoreP1 += totalRonda;
        document.getElementById('score-p1').innerText = scoreP1;
    } else {
        scoreP2 += totalRonda;
        // Asumiendo que tú ves tu puntaje en el 'score-p1' de tu pantalla
        // Si quieres verlo cruzado, lo ideal es usar Firebase, pero esto funciona para empezar.
        document.getElementById('score-p2').innerText = scoreP2; 
    }

    // Verificar si gané
    const miScoreActual = miID === "p1" ? scoreP1 : scoreP2;
    if (miScoreActual >= puntajeMeta) {
        confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
        setTimeout(() => {
            alert(`¡PARTIDA TERMINADA! ¡Ganaste!`);
            db.ref('partida').remove(); // Limpiar todo el juego
            location.reload();
        }, 1500);
    } else {
        showScreen('setup-area');
        document.getElementById('current-letter').innerText = "?";
    }
});


// --- UTILIDADES ---
function actualizarInterfazCategoria() {
    document.getElementById('category-name').innerText = mazoActual[indiceCategoriaActual];
    const input = document.getElementById('user-input');
    input.focus();
}

document.getElementById('mazo-select').addEventListener('change', (e) => {
    document.getElementById('custom-mazo-area').classList.toggle('hidden', e.target.value !== 'custom');
});
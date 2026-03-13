// js/main.js

// --- 1. GESTIÓN DE PANTALLAS ---
function showScreen(screenId) {
    // Lista de IDs de secciones del index.html
    const allScreens = ['start-screen', 'setup-area', 'play-area', 'results-area'];
    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// --- 2. CONFIGURACIÓN INICIAL (Inicio a Preparación) ---
document.getElementById('btn-ready').addEventListener('click', () => {
    // Configurar nombres
    const name1 = document.getElementById('name-p1').value || "Tú";
    const name2 = document.getElementById('name-p2').value || "Lau";
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

    // Configurar Meta de puntos
    puntajeMeta = parseInt(document.querySelector('input[name="goal"]:checked').value);

    showScreen('setup-area');
});

// --- 3. INICIAR RONDA (Elegir Letra) ---
document.getElementById('btn-start').addEventListener('click', () => {
    letraActual = elegirLetraAzar();
    document.getElementById('current-letter').innerText = letraActual;
    
    // Reset de variables de ronda
    indiceCategoriaActual = 0;
    respuestasJugador = {};
    
    // Pequeño delay para que vean la letra antes de saltar al juego
    setTimeout(() => {
        showScreen('play-area');
        actualizarInterfazCategoria();
    }, 1000);
});

// --- 4. LÓGICA DURANTE EL JUEGO ---
function guardarRespuestaActual() {
    const input = document.getElementById('user-input');
    const catNombre = mazoActual[indiceCategoriaActual];
    respuestasJugador[catNombre] = input.value.trim();
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
    document.getElementById('user-input').value = ""; // Limpiar
    guardarRespuestaActual();
    if (indiceCategoriaActual < mazoActual.length - 1) {
        indiceCategoriaActual++;
        actualizarInterfazCategoria();
    }
});

// --- 5. FINALIZAR RONDA (VAR y Revisión) ---
document.getElementById('btn-stop').addEventListener('click', finalizarYMostrarVAR);

document.getElementById('btn-force-end').addEventListener('click', () => {
    if (confirm("¿Lau acepta terminar la ronda ahora?")) {
        finalizarYMostrarVAR();
    }
});

async function finalizarYMostrarVAR() {
    guardarRespuestaActual(); // Asegurar que se guarde lo último escrito
    showScreen('results-area');
    
    // Mostrar Loader (Árbitro revisando)
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('results-content').classList.add('hidden');

    // Efecto de suspenso (2 segundos)
    await new Promise(r => setTimeout(r, 2000));

    // Simulación de respuestas de Lau para test
    let respuestasLau = {};
    mazoActual.forEach(c => respuestasLau[c] = "Test");

    await mostrarRevision(respuestasJugador, respuestasLau);

    // Ocultar Loader y mostrar tabla
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('results-content').classList.remove('hidden');
}

// --- 6. CONFIRMAR RESULTADOS Y SUMAR ---
document.getElementById('btn-confirm-round').addEventListener('click', () => {
    const filas = document.querySelectorAll('#results-body tr');
    let totalRonda = 0;

    filas.forEach(fila => {
        const pts = parseInt(fila.querySelector('td[id^="pts-"]').innerText);
        totalRonda += pts;
    });

    scoreP1 += totalRonda;
    document.getElementById('score-p1').innerText = scoreP1;

    // Verificar si ganó
    if (scoreP1 >= puntajeMeta) {
        // ¡Efecto Confeti!
        confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
        setTimeout(() => {
            alert(`¡PARTIDA TERMINADA! Has alcanzado la meta.`);
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
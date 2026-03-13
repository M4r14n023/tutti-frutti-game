// js/gameLogic.js

// Variables de estado del juego
let mazoActual = []; 
let letrasUsadas = [];
let letraActual = "";
let indiceCategoriaActual = 0;
let respuestasJugador = {};
let puntajeMeta = 500;
let scoreP1 = 0;
let scoreP2 = 0;

const abecedario = "ABCDEFGHIJKLMNÑOPQRSTUVWYZ".split("");

// 1. Función para elegir letra al azar
function elegirLetraAzar() {
    const disponibles = abecedario.filter(l => !letrasUsadas.includes(l));
    
    if (disponibles.length === 0) {
        alert("¡Se acabaron las letras! Reiniciando abecedario.");
        letrasUsadas = [];
        return elegirLetraAzar();
    }

    const indice = Math.floor(Math.random() * disponibles.length);
    letraActual = disponibles[indice];
    letrasUsadas.push(letraActual);
    
    return letraActual;
}

// 2. Función para avanzar de categoría
function siguienteCategoria() {
    if (indiceCategoriaActual < mazoActual.length - 1) {
        indiceCategoriaActual++;
        actualizarInterfazCategoria(); // Esta función vive en main.js
    } else {
        alert("¡Llegaste a la última categoría! Puedes presionar TUTTI FRUTTI.");
    }
}

// 3. Función para saltar
function saltarCategoria() {
    siguienteCategoria();
}

// 4. Lógica de Puntos con Validación de Letra inicial
async function procesarPuntosFinales(p1Word, p2Word) {
    const w1 = p1Word.trim().toLowerCase();
    const w2 = p2Word.trim().toLowerCase();

    // Si no escribió nada
    if (!w1) return 0; 

    // VALIDACIÓN CRÍTICA: ¿Empieza con la letra correcta?
    if (w1[0].toUpperCase() !== letraActual) {
        console.log(`Palabra incorrecta: debe empezar con ${letraActual}`);
        return -2; 
    }

    // Validación Ortográfica Automática (llamando a dictionary.js)
    const existe = await validarPalabraAutomatica(w1);
    
    if (existe === false) {
        console.log("Error ortográfico detectado: -2 puntos");
        return -2; 
    }

    // Comparación lógica de puntos
    if (w1 === w2) {
        return 5;  // Iguales
    } else if (w2 === "") {
        return 20; // Solo P1 puso palabra
    } else {
        return 10; // Diferentes y válidas
    }
}

// 5. Control de Ganador
function verificarGanador() {
    if (scoreP1 >= puntajeMeta || scoreP2 >= puntajeMeta) {
        const name1 = document.getElementById('name-p1').value || "Tú";
        const name2 = document.getElementById('name-p2').value || "Lau";
        const ganador = scoreP1 >= puntajeMeta ? name1 : name2;
        
        alert(`¡PARTIDA TERMINADA!\n${ganador} ha alcanzado el objetivo de ${puntajeMeta} puntos.`);
        reiniciarJuegoCompleto();
        return true;
    }
    return false;
}

function reiniciarJuegoCompleto() {
    scoreP1 = 0;
    scoreP2 = 0;
    letrasUsadas = [];
    document.getElementById('score-p1').innerText = "0";
    document.getElementById('score-p2').innerText = "0";
    location.reload(); // Recarga para volver a la pantalla de inicio
}
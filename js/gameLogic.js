// js/gameLogic.js

// Variables de estado del juego
let mazoActual = []; 
let letrasUsadas = [];
let letraActual = "";
let indiceCategoriaActual = 0;
let respuestasJugador = {};
let scoreP1 = 0; // Tu puntuación acumulada local

const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWYZ".split("");

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
        // Esta función vive en main.js
        if (typeof actualizarInterfazCategoria === "function") {
            actualizarInterfazCategoria(); 
        }
    } else {
        alert("¡Llegaste a la última categoría! Puedes presionar TUTTI FRUTTI.");
    }
}

// 3. Función para saltar
function saltarCategoria() {
    siguienteCategoria();
}

// 4. NUEVA LÓGICA: Reglas Oficiales 5 - 10 - 20 (Sistema de Honor)
async function procesarPuntosFinales(p1Word, p2Word) {
    const w1 = p1Word.trim().toLowerCase();
    const w2 = p2Word.trim().toLowerCase();
    const letra = letraActual.toLowerCase();

    // Validamos si las palabras existen y si empiezan con la letra correcta
    const v1 = w1 && w1[0] === letra;
    const v2 = w2 && w2[0] === letra;

    // 1. Si dejaste el espacio vacío o te equivocaste de letra (Trampa/Error)
    if (!v1) {
        return (w1 === "") ? 0 : -2; // 0 si está vacío, -2 si arranca con otra letra
    }

    // 2. Si TU palabra es válida, evaluamos qué hizo el rival:
    if (!v2) {
        return 20; // El rival la dejó vacía o se equivocó de letra
    }
    
    // 3. Ambos pusieron palabras válidas con la letra correcta
    if (w1 === w2) {
        return 5;  // Ambos pusieron exactamente la misma palabra
    }
    
    return 10; // Ambos pusieron palabras distintas y válidas
}
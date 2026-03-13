// js/dictionary.js

// Estructura para guardar los debates y evitar repetir discusiones
let historialDebates = [];

/**
 * Valida si una palabra existe usando una API externa con memoria de debates previos.
 */
async function validarPalabraAutomatica(palabra) {
    if (!palabra || palabra.length < 2) return false;
    
    const palabraLimpia = palabra.trim().toLowerCase();

    // 1. Revisar memoria de debates previos
    const debatePrevio = historialDebates.find(d => d.palabra === palabraLimpia);
    if (debatePrevio) {
        return debatePrevio.resultado === 'valida';
    }

    // 2. Consultar API
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/es/${palabraLimpia}`);
        
        if (response.ok) {
            return true; // La palabra existe
        } else if (response.status === 404) {
            return false; // La palabra no existe
        }
        return null; // Error de servidor o rate limit
    } catch (error) {
        console.warn("API Offline. Se requiere arbitraje manual.");
        return null; 
    }
}

/**
 * Genera la tabla de revisión al finalizar la ronda.
 */
async function mostrarRevision(p1, p2) {
    const body = document.getElementById('results-body');
    body.innerHTML = "";
    
    for (let cat of mazoActual) {
        const w1 = p1[cat] || "";
        const w2 = p2[cat] || "";
        const pts = await procesarPuntosFinales(w1, w2);
        
        body.innerHTML += `
            <tr>
                <td>${cat}</td>
                <td class="${pts === -2 ? 'error-text' : ''}">${w1}</td>
                <td>${w2}</td>
                <td id="pts-${cat}">${pts}</td>
                <td>
                    ${pts === -2 ? `<button onclick="abrirDebate('${w1}', '${cat}')">⚖️</button>` : '✅'}
                </td>
            </tr>`;
    }
}

/**
 * Abre el modal del tribunal.
 */
function abrirDebate(palabra, cat) {
    window.categoriaEnDebate = cat;
    document.getElementById('disputed-word').innerText = palabra;
    document.getElementById('debate-title').innerText = "⚖️ Tribunal: Lau no te cree...";
    document.getElementById('modal-debate').classList.remove('hidden');
}

/**
 * Cierra el debate, aplica puntos y guarda en memoria.
 */
function cerrarDebate(resultado) {
    const categoria = window.categoriaEnDebate;
    const palabra = document.getElementById('disputed-word').innerText.toLowerCase();
    const argumento = document.getElementById('argumento-debate').value;
    const ptsElement = document.getElementById(`pts-${categoria}`);

    if (resultado === 'valida') {
        ptsElement.innerText = "10";
        ptsElement.style.color = "#27ae60";
        ptsElement.style.fontWeight = "bold";
        alert("¡Lau tiene que aceptarlo, la palabra es válida!");
    } else {
        ptsElement.innerText = "-2";
        ptsElement.style.color = "#e74c3c";
        alert("Justicia divina: esa palabra no existe.");
    }

    // Guardar en historial para no repetir el debate
    historialDebates.push({
        palabra: palabra,
        argumento: argumento,
        resultado: resultado
    });

    document.getElementById('argumento-debate').value = "";
    document.getElementById('modal-debate').classList.add('hidden');
}

function exportarDebates() {
    localStorage.setItem('tutti_frutti_debates', JSON.stringify(historialDebates));
    alert("Historial de debates guardado en el navegador.");
}
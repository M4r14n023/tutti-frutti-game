// js/dictionary.js

/**
 * Genera la tabla de revisión al finalizar la ronda evaluando con el Sistema de Honor.
 */
async function mostrarRevision(misRespuestas, respuestasRival) {
    const body = document.getElementById('results-body');
    body.innerHTML = "";
    
    for (let cat of mazoActual) {
        const w1 = misRespuestas[cat] || "";
        const w2 = respuestasRival[cat] || "";
        
        const pts = await procesarPuntosFinales(w1, w2);
        
        body.innerHTML += `
            <tr>
                <td>${cat}</td>
                <td class="${pts === -2 ? 'error-text' : ''}">${w1 || '-'}</td>
                <td>${w2 || '-'}</td>
                <td id="pts-${cat}"><b>${pts}</b></td>
                <td>
                    <button class="secondary" onclick="abrirDebate('${cat}')">⚖️ VAR</button>
                </td>
            </tr>`;
    }
}

/**
 * Abre el modal del tribunal.
 */
function abrirDebate(cat) {
    window.categoriaEnDebate = cat;
    document.getElementById('modal-debate').classList.remove('hidden');
}

/**
 * Cierra el debate y aplica los puntos seleccionados manualmente.
 */
function cerrarDebate(pts) {
    if (pts === 'cancelar') {
        document.getElementById('modal-debate').classList.add('hidden');
        return;
    }

    const categoria = window.categoriaEnDebate;
    const ptsElement = document.getElementById(`pts-${categoria}`);

    // Aplicar el nuevo puntaje
    ptsElement.innerText = pts;

    // Cambiar el color según si son puntos positivos, neutros o negativos
    if (pts > 0) {
        ptsElement.style.color = "#27ae60"; // Verde
    } else if (pts < 0) {
        ptsElement.style.color = "#e74c3c"; // Rojo
    } else {
        ptsElement.style.color = "#7f8c8d"; // Gris
    }

    document.getElementById('modal-debate').classList.add('hidden');
}
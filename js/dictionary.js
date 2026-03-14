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
        
        // Calculamos los puntos (5, 10, 20, -2, o 0)
        const pts = await procesarPuntosFinales(w1, w2);
        
        body.innerHTML += `
            <tr>
                <td>${cat}</td>
                <td class="${pts === -2 ? 'error-text' : ''}">${w1 || '-'}</td>
                <td>${w2 || '-'}</td>
                <td id="pts-${cat}"><b>${pts}</b></td>
                <td>
                    <button class="secondary" onclick="abrirDebate('${w1}', '${cat}')">⚖️ VAR</button>
                </td>
            </tr>`;
    }
}

/**
 * Abre el modal del tribunal.
 */
function abrirDebate(palabra, cat) {
    window.categoriaEnDebate = cat;
    document.getElementById('disputed-word').innerText = palabra || "(Vacío)";
    
    // Un título dinámico para meter presión
    const nombreRival = typeof rivalName !== 'undefined' && rivalName ? rivalName : "Tu rival";
    document.getElementById('debate-title').innerText = `⚖️ Tribunal: ¿${nombreRival} no te cree?`;
    
    document.getElementById('modal-debate').classList.remove('hidden');
}

/**
 * Cierra el debate y aplica los puntos manualmente.
 */
function cerrarDebate(resultado) {
    const categoria = window.categoriaEnDebate;
    const ptsElement = document.getElementById(`pts-${categoria}`);

    if (resultado === 'valida') {
        // Si la defiendes con éxito, te devuelve 10 puntos estándar
        ptsElement.innerText = "10";
        ptsElement.style.color = "#27ae60";
    } else {
        // Si aceptas que es inventada o trampa, castigo
        ptsElement.innerText = "-2";
        ptsElement.style.color = "#e74c3c";
    }

    // Limpiamos y cerramos
    document.getElementById('argumento-debate').value = "";
    document.getElementById('modal-debate').classList.add('hidden');
}
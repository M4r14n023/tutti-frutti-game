// js/mazos.js
const mazosPredefinidos = {
    clasico: ["Nombre", "Color", "Fruta/Verdura", "País/Ciudad", "Animal", "Cosa"],
    viajero: ["Destino", "Aerolínea", "Comida Típica", "Objeto de Valija", "Idioma/Dialecto"],
    cultura: ["Pelicula/Serie", "Cantante/Banda", "Libro", "Personaje Histórico", "Marca"]
};

// Función para validar mazo custom
function validarMazoCustom(categorias) {
    if (categorias.length < 5 || categorias.length > 10) {
        console.error("El mazo debe tener entre 5 y 10 categorías");
        return false;
    }
    return true;
}
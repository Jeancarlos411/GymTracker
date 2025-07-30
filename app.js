// --- Manejo de vistas (secciones) ---
const buttons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('main section');

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

// --- Funciones de LocalStorage ---
const STORAGE_KEY = 'gym-tracker-sesiones';

function getRutinas() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveRutinas(rutinas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rutinas));
}

// --- Renderizar resumen e historial ---
function renderResumen() {
  const total = getRutinas().length;
  document.getElementById('total-sesiones').textContent = total;
}

function renderHistorial() {
  const lista = document.getElementById('lista-rutinas');
  lista.innerHTML = '';
  getRutinas().forEach((r, i) => {
    const li = document.createElement('li');
    li.textContent = `${r.fecha}: ${r.ejercicio} - ${r.reps} reps @ ${r.peso}kg`;
    lista.appendChild(li);
  });
}

// --- Guardar nueva rutina ---
document.getElementById('form-rutina').addEventListener('submit', e => {
  e.preventDefault();
  const nueva = {
    fecha: document.getElementById('fecha').value,
    ejercicio: document.getElementById('ejercicio').value,
    reps: Number(document.getElementById('reps').value),
    peso: Number(document.getElementById('peso').value),
  };
  const rutinas = getRutinas();
  rutinas.push(nueva);
  saveRutinas(rutinas);
  e.target.reset();
  renderResumen();
  renderHistorial();
});

// --- Botón Reset ---
document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('¿Borrar todos los datos?')) {
    localStorage.removeItem(STORAGE_KEY);
    renderResumen();
    renderHistorial();
  }
});

// --- Inicialización al cargar página ---
renderResumen();
renderHistorial();
import { format, addDays, parse, isWeekend, getDay } from 'date-fns';
import { es } from 'date-fns/locale/es/index.js';

// Horarios Clínica DIMA
const HORARIOS = {
  // Lunes a Viernes
  weekday: { inicio: 7, fin: 18 },
  // Sábado
  saturday: { inicio: 8, fin: 12 },
  // Domingo = cerrado
};

// Duración de citas en minutos
const DURACION_CITA = {
  mamografia: 30,
  densitometria: 20
};

// Slots por hora (simplificado)
const SLOTS_POR_HORA = 2;

export function getHorarioDelDia(fecha) {
  const dia = getDay(fecha); // 0 = domingo, 6 = sábado
  
  if (dia === 0) return null; // Domingo cerrado
  if (dia === 6) return HORARIOS.saturday;
  return HORARIOS.weekday;
}

export async function getDisponibilidad(prisma, fechaStr, servicio) {
  const fecha = fechaStr ? new Date(fechaStr) : new Date();
  const slots = [];
  
  // Revisar próximos 14 días
  for (let i = 0; i < 14; i++) {
    const dia = addDays(fecha, i);
    const horario = getHorarioDelDia(dia);
    
    if (!horario) continue; // Día cerrado
    
    const slotsDelDia = await getSlotsDisponibles(prisma, dia, horario, servicio);
    
    if (slotsDelDia.length > 0) {
      slots.push({
        fecha: format(dia, 'yyyy-MM-dd'),
        fechaDisplay: format(dia, "EEEE d 'de' MMMM", { locale: es }),
        slots: slotsDelDia
      });
    }
  }
  
  return slots;
}

async function getSlotsDisponibles(prisma, fecha, horario, servicio) {
  // Obtener citas existentes para ese día
  const startOfDay = new Date(fecha);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(fecha);
  endOfDay.setHours(23, 59, 59, 999);
  
  const citasExistentes = await prisma.cita.findMany({
    where: {
      fecha: { gte: startOfDay, lte: endOfDay },
      estado: { not: 'cancelada' }
    },
    select: { hora: true }
  });
  
  const horasOcupadas = new Set(citasExistentes.map(c => c.hora));
  
  // Generar slots disponibles
  const slots = [];
  for (let hora = horario.inicio; hora < horario.fin; hora++) {
    for (let min = 0; min < 60; min += 30) {
      const horaStr = `${hora.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      
      if (!horasOcupadas.has(horaStr)) {
        slots.push(horaStr);
      }
    }
  }
  
  return slots;
}

export function parseFechaColoquial(texto) {
  const hoy = new Date();
  const lower = texto.toLowerCase();
  
  if (lower.includes('hoy')) return hoy;
  if (lower.includes('mañana')) return addDays(hoy, 1);
  if (lower.includes('pasado mañana')) return addDays(hoy, 2);
  
  // Días de la semana
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  for (let i = 0; i < dias.length; i++) {
    if (lower.includes(dias[i])) {
      const diaActual = hoy.getDay();
      let diasHasta = i - diaActual;
      if (diasHasta <= 0) diasHasta += 7; // Próxima semana
      return addDays(hoy, diasHasta);
    }
  }
  
  if (lower.includes('próxima semana') || lower.includes('la semana que viene')) {
    return addDays(hoy, 7);
  }
  
  // Intentar parsear fecha específica
  // Formatos: "15 de febrero", "15/02", "15-02-2026"
  const matchDiaMes = lower.match(/(\d{1,2})\s*de\s*(\w+)/);
  if (matchDiaMes) {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dia = parseInt(matchDiaMes[1]);
    const mesIdx = meses.findIndex(m => matchDiaMes[2].includes(m));
    if (mesIdx !== -1) {
      const fecha = new Date(hoy.getFullYear(), mesIdx, dia);
      if (fecha < hoy) fecha.setFullYear(fecha.getFullYear() + 1);
      return fecha;
    }
  }
  
  return null;
}

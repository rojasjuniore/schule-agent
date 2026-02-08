import Anthropic from '@anthropic-ai/sdk';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es/index.js';
import { getDisponibilidad, parseFechaColoquial } from './disponibilidad.js';

const anthropic = new Anthropic();

const ESTADOS = {
  INICIO: 'inicio',
  SERVICIO: 'servicio',
  FECHA: 'fecha',
  NOMBRE: 'datos_nombre',
  TIPO_DOC: 'datos_tipo_doc',
  NUM_DOC: 'datos_num_doc',
  NACIMIENTO: 'datos_nacimiento',
  SEXO: 'datos_sexo',
  TELEFONO: 'datos_telefono',
  EPS: 'datos_eps',
  DIRECCION: 'datos_direccion',
  EMAIL: 'datos_email',
  CONFIRMACION: 'confirmacion'
};

export async function handleWhatsAppMessage(prisma, telefono, mensaje) {
  // Normalizar teléfono (quitar whatsapp:+)
  const tel = telefono.replace('whatsapp:', '').replace('+', '');
  
  // Buscar o crear conversación
  let conv = await prisma.conversacion.findFirst({
    where: { telefonoFrom: tel },
    orderBy: { updatedAt: 'desc' }
  });
  
  if (!conv || esConversacionVieja(conv)) {
    conv = await prisma.conversacion.create({
      data: { telefonoFrom: tel, estado: ESTADOS.INICIO }
    });
  }
  
  // Procesar según estado
  const resultado = await procesarEstado(prisma, conv, mensaje);
  
  // Actualizar conversación
  await prisma.conversacion.update({
    where: { id: conv.id },
    data: {
      estado: resultado.nuevoEstado,
      servicio: resultado.servicio || conv.servicio,
      fechaCita: resultado.fecha || conv.fechaCita,
      horaCita: resultado.hora || conv.horaCita,
      datosTemp: resultado.datos || conv.datosTemp
    }
  });
  
  return resultado.respuesta;
}

function esConversacionVieja(conv) {
  const horasDiff = (Date.now() - conv.updatedAt.getTime()) / (1000 * 60 * 60);
  return horasDiff > 24; // Más de 24 horas = nueva conversación
}

async function procesarEstado(prisma, conv, mensaje) {
  const msg = mensaje.toLowerCase().trim();
  
  switch (conv.estado) {
    case ESTADOS.INICIO:
      return procesarInicio(msg);
      
    case ESTADOS.SERVICIO:
      return procesarServicio(msg);
      
    case ESTADOS.FECHA:
      return await procesarFecha(prisma, msg, conv.servicio);
      
    case ESTADOS.NOMBRE:
      return procesarNombre(msg, conv);
      
    case ESTADOS.TIPO_DOC:
      return procesarTipoDoc(msg, conv);
      
    case ESTADOS.NUM_DOC:
      return procesarNumDoc(msg, conv);
      
    case ESTADOS.NACIMIENTO:
      return procesarNacimiento(msg, conv);
      
    case ESTADOS.SEXO:
      return procesarSexo(msg, conv);
      
    case ESTADOS.TELEFONO:
      return procesarTelefono(msg, conv);
      
    case ESTADOS.EPS:
      return procesarEps(msg, conv);
      
    case ESTADOS.DIRECCION:
      return procesarDireccion(msg, conv);
      
    case ESTADOS.EMAIL:
      return procesarEmail(msg, conv);
      
    case ESTADOS.CONFIRMACION:
      return procesarConfirmacion(prisma, msg, conv);
      
    default:
      return procesarInicio(msg);
  }
}

function procesarInicio(msg) {
  if (msg.includes('1') || msg.includes('agendar') || msg.includes('cita')) {
    return {
      nuevoEstado: ESTADOS.SERVICIO,
      respuesta: `¿Qué examen necesitas agendar?\n\n🩺 *Mamografía*\n🦴 *Densitometría*\n\nResponde con el nombre del examen.`
    };
  }
  
  return {
    nuevoEstado: ESTADOS.INICIO,
    respuesta: `¡Hola! Soy el asistente virtual de *Clínica DIMA* 🏥\n\n¿En qué puedo ayudarte?\n\n1️⃣ Agendar una cita\n2️⃣ Consultar una cita\n3️⃣ Cancelar una cita`
  };
}

function procesarServicio(msg) {
  if (msg.includes('mamograf')) {
    return {
      nuevoEstado: ESTADOS.FECHA,
      servicio: 'mamografia',
      respuesta: `Perfecto, *Mamografía* 🩺\n\n¿Para qué fecha te gustaría agendar?\n\nPuedes decirme:\n• "Mañana"\n• "El viernes"\n• "La próxima semana"\n• O una fecha específica`
    };
  }
  
  if (msg.includes('densito')) {
    return {
      nuevoEstado: ESTADOS.FECHA,
      servicio: 'densitometria',
      respuesta: `Perfecto, *Densitometría* 🦴\n\n¿Para qué fecha te gustaría agendar?\n\nPuedes decirme:\n• "Mañana"\n• "El viernes"\n• "La próxima semana"\n• O una fecha específica`
    };
  }
  
  return {
    nuevoEstado: ESTADOS.SERVICIO,
    respuesta: `No entendí. Por favor elige:\n\n🩺 *Mamografía*\n🦴 *Densitometría*`
  };
}

async function procesarFecha(prisma, msg, servicio) {
  const fecha = parseFechaColoquial(msg);
  
  if (!fecha) {
    const disponibilidad = await getDisponibilidad(prisma, null, servicio);
    const proximas = disponibilidad.slice(0, 3);
    
    return {
      nuevoEstado: ESTADOS.FECHA,
      respuesta: `No entendí la fecha. Próximas disponibles:\n\n${proximas.map(d => `📅 ${d.fechaDisplay}`).join('\n')}\n\n¿Cuál prefieres?`
    };
  }
  
  const disponibilidad = await getDisponibilidad(prisma, fecha, servicio);
  const diaDisponible = disponibilidad.find(d => d.fecha === format(fecha, 'yyyy-MM-dd'));
  
  if (!diaDisponible || diaDisponible.slots.length === 0) {
    const proximas = disponibilidad.slice(0, 3);
    return {
      nuevoEstado: ESTADOS.FECHA,
      respuesta: `No hay disponibilidad para esa fecha 😕\n\nPróximas opciones:\n\n${proximas.map(d => `📅 ${d.fechaDisplay}`).join('\n')}\n\n¿Cuál prefieres?`
    };
  }
  
  // Ofrecer primeros 4 horarios
  const horasDisplay = diaDisponible.slots.slice(0, 4).join(', ');
  
  return {
    nuevoEstado: ESTADOS.NOMBRE,
    fecha: fecha,
    hora: diaDisponible.slots[0], // Por ahora tomamos el primero
    respuesta: `✅ *${diaDisponible.fechaDisplay}* a las *${diaDisponible.slots[0]}*\n\nPara completar tu cita, necesito algunos datos.\n\n¿Cuál es tu *nombre completo*?`
  };
}

function procesarNombre(msg, conv) {
  if (msg.split(' ').length < 2) {
    return {
      nuevoEstado: ESTADOS.NOMBRE,
      respuesta: `Por favor ingresa tu nombre completo (nombre y apellido).`
    };
  }
  
  const datos = { ...(conv.datosTemp || {}), nombreCompleto: msg };
  
  return {
    nuevoEstado: ESTADOS.TIPO_DOC,
    datos,
    respuesta: `Gracias, *${msg}* 👋\n\n¿Cuál es tu tipo de documento?\n\n• CC - Cédula de Ciudadanía\n• CE - Cédula de Extranjería\n• PP - Pasaporte\n• TI - Tarjeta de Identidad`
  };
}

function procesarTipoDoc(msg, conv) {
  const tipos = ['cc', 'ce', 'pp', 'ti'];
  const tipo = tipos.find(t => msg.includes(t));
  
  if (!tipo) {
    return {
      nuevoEstado: ESTADOS.TIPO_DOC,
      respuesta: `Por favor elige: CC, CE, PP o TI`
    };
  }
  
  const datos = { ...(conv.datosTemp || {}), tipoDocumento: tipo.toUpperCase() };
  
  return {
    nuevoEstado: ESTADOS.NUM_DOC,
    datos,
    respuesta: `¿Cuál es tu número de *${tipo.toUpperCase()}*?`
  };
}

function procesarNumDoc(msg, conv) {
  const numero = msg.replace(/\D/g, '');
  
  if (numero.length < 6) {
    return {
      nuevoEstado: ESTADOS.NUM_DOC,
      respuesta: `El número de documento parece muy corto. Por favor verifica.`
    };
  }
  
  const datos = { ...(conv.datosTemp || {}), numeroDocumento: numero };
  
  return {
    nuevoEstado: ESTADOS.NACIMIENTO,
    datos,
    respuesta: `¿Cuál es tu *fecha de nacimiento*?\n\n(Ejemplo: 15 de marzo de 1985)`
  };
}

function procesarNacimiento(msg, conv) {
  const fecha = parseFechaColoquial(msg);
  
  // Si no se pudo parsear, intentar formato simple
  const match = msg.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  let fechaNac = fecha;
  
  if (match) {
    const [_, dia, mes, año] = match;
    const añoCompleto = año.length === 2 ? (parseInt(año) > 50 ? '19' + año : '20' + año) : año;
    fechaNac = new Date(parseInt(añoCompleto), parseInt(mes) - 1, parseInt(dia));
  }
  
  if (!fechaNac || fechaNac > new Date()) {
    return {
      nuevoEstado: ESTADOS.NACIMIENTO,
      respuesta: `No entendí la fecha. Intenta con formato: día/mes/año (ej: 15/03/1985)`
    };
  }
  
  const datos = { ...(conv.datosTemp || {}), fechaNacimiento: fechaNac.toISOString() };
  
  return {
    nuevoEstado: ESTADOS.SEXO,
    datos,
    respuesta: `¿Cuál es tu *sexo biológico*?\n\n• Femenino\n• Masculino`
  };
}

function procesarSexo(msg, conv) {
  let sexo = null;
  if (msg.includes('fem') || msg.includes('mujer') || msg === 'f') sexo = 'F';
  if (msg.includes('masc') || msg.includes('hombre') || msg === 'm') sexo = 'M';
  
  if (!sexo) {
    return {
      nuevoEstado: ESTADOS.SEXO,
      respuesta: `Por favor responde: Femenino o Masculino`
    };
  }
  
  const datos = { ...(conv.datosTemp || {}), sexo };
  
  return {
    nuevoEstado: ESTADOS.TELEFONO,
    datos,
    respuesta: `¿A qué *número de teléfono* podemos contactarte?\n\n(Si es el mismo de WhatsApp, escribe "este")`
  };
}

function procesarTelefono(msg, conv) {
  let telefono = msg.replace(/\D/g, '');
  
  if (msg.includes('este') || msg.includes('mismo')) {
    telefono = conv.telefonoFrom;
  }
  
  if (telefono.length < 10) {
    return {
      nuevoEstado: ESTADOS.TELEFONO,
      respuesta: `El número parece incompleto. Ingresa los 10 dígitos.`
    };
  }
  
  const datos = { ...(conv.datosTemp || {}), telefono };
  
  return {
    nuevoEstado: ESTADOS.EPS,
    datos,
    respuesta: `¿Cuál es tu *EPS o aseguradora*?\n\n(Si no tienes, escribe "Particular")`
  };
}

function procesarEps(msg, conv) {
  const datos = { ...(conv.datosTemp || {}), eps: msg };
  
  return {
    nuevoEstado: ESTADOS.DIRECCION,
    datos,
    respuesta: `¿Cuál es tu *dirección de residencia*?`
  };
}

function procesarDireccion(msg, conv) {
  const datos = { ...(conv.datosTemp || {}), direccion: msg };
  
  return {
    nuevoEstado: ESTADOS.EMAIL,
    datos,
    respuesta: `Por último, ¿cuál es tu *correo electrónico*?\n\n(Ahí te enviaremos la confirmación)`
  };
}

function procesarEmail(msg, conv) {
  if (!msg.includes('@') || !msg.includes('.')) {
    return {
      nuevoEstado: ESTADOS.EMAIL,
      respuesta: `Ese email no parece válido. Por favor verifica.`
    };
  }
  
  const datos = { ...(conv.datosTemp || {}), email: msg };
  const servicioDisplay = conv.servicio === 'mamografia' ? 'Mamografía' : 'Densitometría';
  const fechaDisplay = conv.fechaCita ? format(new Date(conv.fechaCita), "EEEE d 'de' MMMM", { locale: es }) : '';
  
  return {
    nuevoEstado: ESTADOS.CONFIRMACION,
    datos,
    respuesta: `✅ *Resumen de tu cita:*\n\n📋 Servicio: *${servicioDisplay}*\n📅 Fecha: *${fechaDisplay}*\n🕐 Hora: *${conv.horaCita}*\n\n👤 ${datos.nombreCompleto}\n🪪 ${datos.tipoDocumento} ${datos.numeroDocumento}\n📧 ${datos.email}\n\n¿Confirmas esta cita? (Sí/No)`
  };
}

async function procesarConfirmacion(prisma, msg, conv) {
  if (msg.includes('si') || msg.includes('sí') || msg.includes('confirmo') || msg.includes('ok')) {
    // Crear paciente y cita
    const datos = conv.datosTemp;
    
    let paciente = await prisma.paciente.findUnique({
      where: { numeroDocumento: datos.numeroDocumento }
    });
    
    if (!paciente) {
      paciente = await prisma.paciente.create({
        data: {
          nombreCompleto: datos.nombreCompleto,
          tipoDocumento: datos.tipoDocumento,
          numeroDocumento: datos.numeroDocumento,
          fechaNacimiento: new Date(datos.fechaNacimiento),
          sexo: datos.sexo,
          telefono: datos.telefono,
          eps: datos.eps,
          direccion: datos.direccion,
          email: datos.email
        }
      });
    }
    
    await prisma.cita.create({
      data: {
        servicio: conv.servicio,
        fecha: conv.fechaCita,
        hora: conv.horaCita,
        estado: 'confirmada',
        canalOrigen: 'whatsapp',
        pacienteId: paciente.id
      }
    });
    
    return {
      nuevoEstado: ESTADOS.INICIO,
      respuesta: `🎉 *¡Tu cita ha sido confirmada!*\n\nRecibirás un correo de confirmación en ${datos.email}\n\n📍 *Clínica DIMA*\n⏰ Recuerda llegar 15 minutos antes.\n\n¿Necesitas algo más?`
    };
  }
  
  if (msg.includes('no') || msg.includes('cancelar')) {
    return {
      nuevoEstado: ESTADOS.INICIO,
      respuesta: `Entendido, la cita no fue agendada.\n\n¿En qué más puedo ayudarte?`
    };
  }
  
  return {
    nuevoEstado: ESTADOS.CONFIRMACION,
    respuesta: `Por favor responde *Sí* para confirmar o *No* para cancelar.`
  };
}

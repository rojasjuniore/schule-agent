import express from 'express';
import { PrismaClient } from '@prisma/client';
import { handleWhatsAppMessage } from './whatsapp.js';
import { getDisponibilidad } from './disponibilidad.js';

const app = express();
const prisma = new PrismaClient();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'SchuleAgent - Clínica DIMA',
    version: '1.0.0'
  });
});

// Webhook WhatsApp (Twilio)
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { From, Body } = req.body;
    console.log(`📱 WhatsApp de ${From}: ${Body}`);
    
    const response = await handleWhatsAppMessage(prisma, From, Body);
    
    // Respuesta TwiML
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${response}</Message>
      </Response>
    `);
  } catch (error) {
    console.error('Error webhook:', error);
    res.status(500).send('Error');
  }
});

// API: Disponibilidad
app.get('/api/disponibilidad', async (req, res) => {
  const { fecha, servicio } = req.query;
  const slots = await getDisponibilidad(prisma, fecha, servicio);
  res.json({ slots });
});

// API: Citas del día
app.get('/api/citas', async (req, res) => {
  const { fecha } = req.query;
  const startOfDay = new Date(fecha);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(fecha);
  endOfDay.setHours(23, 59, 59, 999);
  
  const citas = await prisma.cita.findMany({
    where: {
      fecha: { gte: startOfDay, lte: endOfDay },
      estado: { not: 'cancelada' }
    },
    include: { paciente: true },
    orderBy: { hora: 'asc' }
  });
  
  res.json({ citas });
});

// API: Crear cita manual
app.post('/api/citas', async (req, res) => {
  try {
    const { servicio, fecha, hora, paciente } = req.body;
    
    // Buscar o crear paciente
    let pac = await prisma.paciente.findUnique({
      where: { numeroDocumento: paciente.numeroDocumento }
    });
    
    if (!pac) {
      pac = await prisma.paciente.create({ data: paciente });
    }
    
    const cita = await prisma.cita.create({
      data: {
        servicio,
        fecha: new Date(fecha),
        hora,
        canalOrigen: 'manual',
        pacienteId: pac.id
      }
    });
    
    res.json({ success: true, cita });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏥 SchuleAgent corriendo en puerto ${PORT}`);
});

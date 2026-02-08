# SchuleAgent - Clínica DIMA

Agente de agendamiento de citas médicas vía WhatsApp y llamadas.

## Servicios
- Mamografía
- Densitometría

## Flujo de Agendamiento

```
1. BIENVENIDA
   └── "Hola, soy el asistente de Clínica DIMA. ¿En qué puedo ayudarte?"

2. SERVICIO
   └── "¿Qué examen necesitas agendar?"
   └── Opciones: Mamografía | Densitometría

3. FECHA
   └── "¿Tienes alguna fecha preferida?"
   └── Negociar disponibilidad
   └── Confirmar fecha y hora

4. DATOS HC (Historia Clínica)
   └── Nombre completo
   └── Tipo de documento (CC, CE, PP, TI)
   └── Número de documento
   └── Fecha de nacimiento
   └── Sexo biológico
   └── Teléfono de contacto
   └── EPS o aseguradora
   └── Dirección de residencia
   └── Correo electrónico

5. CONFIRMACIÓN
   └── Resumen completo
   └── Solo se confirma cuando TODOS los datos estén completos
```

## Canales
- WhatsApp Business API
- Llamadas (Vapi.ai / Twilio Voice)

## Stack Propuesto
- **Backend:** Node.js + Express
- **WhatsApp:** Twilio / Meta Cloud API
- **Voice:** Vapi.ai (AI voice agent)
- **AI:** Claude API (conversación)
- **DB:** PostgreSQL
- **Hosting:** Railway

## Estado
- [x] Definición de flujo
- [ ] Setup proyecto
- [ ] Integración WhatsApp
- [ ] Integración Voice
- [ ] Panel admin DIMA

# Flujo: Agendar Cita

## Estados

### 1. INICIO
**Trigger:** Usuario inicia conversación
**Mensaje:**
> Hola, soy el asistente virtual de Clínica DIMA 🏥
> ¿En qué puedo ayudarte hoy?
> 
> 1️⃣ Agendar una cita
> 2️⃣ Consultar una cita existente
> 3️⃣ Cancelar una cita

**Siguiente:** Si elige 1 → SERVICIO

---

### 2. SERVICIO
**Mensaje:**
> ¿Qué examen necesitas agendar?
> 
> 🩺 Mamografía
> 🦴 Densitometría

**Validación:** Solo acepta estas dos opciones
**Siguiente:** FECHA

---

### 3. FECHA
**Mensaje:**
> ¿Tienes alguna fecha preferida para tu {servicio}?
> 
> Puedes decirme algo como "la próxima semana", "el viernes" o una fecha específica.

**Lógica:**
- Consultar disponibilidad
- Si no hay → ofrecer alternativas cercanas
- Confirmar fecha y hora seleccionada

**Siguiente:** DATOS_NOMBRE

---

### 4. DATOS_NOMBRE
**Mensaje:**
> Perfecto, tu cita sería el {fecha} a las {hora}.
> 
> Para completar tu registro, necesito algunos datos.
> ¿Cuál es tu nombre completo?

**Validación:** Mínimo 2 palabras
**Siguiente:** DATOS_DOCUMENTO

---

### 5. DATOS_DOCUMENTO
**Mensaje:**
> Gracias, {nombre}. 
> ¿Cuál es tu tipo de documento?
> 
> • CC - Cédula de Ciudadanía
> • CE - Cédula de Extranjería
> • PP - Pasaporte
> • TI - Tarjeta de Identidad

**Siguiente:** DATOS_NUMERO_DOC

---

### 6. DATOS_NUMERO_DOC
**Mensaje:**
> ¿Cuál es tu número de {tipo_documento}?

**Validación:** Solo números, longitud apropiada según tipo
**Siguiente:** DATOS_NACIMIENTO

---

### 7. DATOS_NACIMIENTO
**Mensaje:**
> ¿Cuál es tu fecha de nacimiento?
> (Ejemplo: 15 de marzo de 1985)

**Validación:** Fecha válida, no futura, edad razonable
**Siguiente:** DATOS_SEXO

---

### 8. DATOS_SEXO
**Mensaje:**
> ¿Cuál es tu sexo biológico?
> 
> • Femenino
> • Masculino

**Siguiente:** DATOS_TELEFONO

---

### 9. DATOS_TELEFONO
**Mensaje:**
> ¿A qué número de teléfono podemos contactarte?

**Validación:** Formato colombiano válido
**Siguiente:** DATOS_EPS

---

### 10. DATOS_EPS
**Mensaje:**
> ¿Cuál es tu EPS o aseguradora?
> (Si no tienes, escribe "Particular")

**Siguiente:** DATOS_DIRECCION

---

### 11. DATOS_DIRECCION
**Mensaje:**
> ¿Cuál es tu dirección de residencia?

**Siguiente:** DATOS_EMAIL

---

### 12. DATOS_EMAIL
**Mensaje:**
> Por último, ¿cuál es tu correo electrónico?
> (Ahí te enviaremos la confirmación)

**Validación:** Formato email válido
**Siguiente:** CONFIRMACION

---

### 13. CONFIRMACION
**Mensaje:**
> ✅ ¡Perfecto! Aquí está el resumen de tu cita:
> 
> 📋 **Servicio:** {servicio}
> 📅 **Fecha:** {fecha}
> 🕐 **Hora:** {hora}
> 
> 👤 **Nombre:** {nombre}
> 🪪 **Documento:** {tipo_doc} {numero_doc}
> 📧 **Email:** {email}
> 📱 **Teléfono:** {telefono}
> 
> ¿Confirmas esta cita?

**Si confirma:**
> 🎉 ¡Tu cita ha sido agendada exitosamente!
> 
> Recibirás un correo de confirmación en {email}.
> 
> Recuerda llegar 15 minutos antes.
> 📍 Clínica DIMA - [Dirección]
> 
> ¿Necesitas algo más?

---

## Manejo de Errores

**Dato inválido:**
> Hmm, no pude entender eso. {instrucción_específica}

**Usuario abandona:**
- Guardar progreso parcial
- Después de 24h sin respuesta → mensaje de seguimiento

**Usuario quiere reiniciar:**
> Sin problema, empecemos de nuevo. ¿Qué servicio necesitas?

---

## Datos Requeridos (Checklist)

```typescript
interface CitaData {
  servicio: 'mamografia' | 'densitometria';
  fecha: Date;
  hora: string;
  paciente: {
    nombreCompleto: string;
    tipoDocumento: 'CC' | 'CE' | 'PP' | 'TI';
    numeroDocumento: string;
    fechaNacimiento: Date;
    sexo: 'F' | 'M';
    telefono: string;
    eps: string;
    direccion: string;
    email: string;
  };
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  canalOrigen: 'whatsapp' | 'llamada';
}
```

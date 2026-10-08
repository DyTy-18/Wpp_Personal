# WP Persona

Programa mensajes de WhatsApp desde tu propio número: una sola vez, cada X tiempo o en días y horas fijos.

- **Next.js 16**: el panel, con login
- **Baileys**: la conexión con WhatsApp, en un worker aparte (`worker/index.mts`)
- **Prisma + SQLite**: mensajes, historial y estado de la conexión

## Puesta en marcha

```bash
npm install
cp .env.example .env            # y rellena SESSION_SECRET
npx prisma migrate dev          # crea la base de datos
npm run dev                     # panel (http://localhost:3000) + worker
```

Entra con **admin / admin12345** (se crea solo si no hay usuarios). El panel te obliga a cambiar la contraseña la primera vez; luego puedes cambiar usuario y contraseña en **Cuenta**.

¿Olvidaste la contraseña? `npm run user:create -- tu_usuario nueva_contraseña`

Después escanea el QR desde **WhatsApp → Dispositivos vinculados** y listo.

## Cómo funciona

- El panel guarda los mensajes en la base de datos con su `nextRunAt`.
- Cada 15 s el worker envía los mensajes que ya tocan y calcula la siguiente ejecución.
- La sesión de WhatsApp se guarda en `wa-auth/` (está en .gitignore, **no la compartas**).
- Si el worker estuvo apagado:
  - un mensaje de una sola vez con menos de 24 h de retraso se envía al volver;
  - los recurrentes saltan a su siguiente horario, sin mandar varios de golpe.

## Chats e historial

Cuando vinculas el dispositivo, WhatsApp manda el historial y el worker lo guarda en la base de datos (chats, contactos y mensajes de texto; de los archivos solo guarda el tipo y el pie de foto). Después también se guardan los mensajes nuevos que van llegando. Puedes verlo todo en **Chats**.

- El historial **solo se manda al vincular**. Para recuperarlo con una sesión ya conectada: **Desvincular** y escanear el QR otra vez.
- Cuánto historial manda depende de WhatsApp (normalmente meses, no todo). El teléfono debe estar encendido y con internet durante la sincronización.
- La base de datos `prisma/dev.db` guarda tus conversaciones: trátala como información privada.

## Producción

Se necesita un proceso siempre encendido (VPS, Railway, Render…), **no Vercel**:

```bash
npm run build && npm start
```

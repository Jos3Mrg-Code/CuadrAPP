# CuadrAPP

Aplicación de finanzas personales: registra ingresos y gastos, controla
presupuestos, persigue metas de ahorro y lleva el seguimiento de deudas.

Construida con Expo Router y Supabase, se publica como sitio web estático
en Vercel e instalable como PWA.

## Qué hace

**Movimientos y cuentas.** Registro de ingresos y gastos sobre varias cuentas
(efectivo, banco, crédito, ahorro, inversión), con categorías propias o
predeterminadas y saldo actualizado en cada operación.

**Presupuestos y metas.** Topes de gasto por categoría con alertas al
acercarse al límite, y metas de ahorro con seguimiento del avance.

**Deudas.** Préstamos, tarjetas e hipotecas con sus abonos y saldo pendiente.

**Calendario y recordatorios.** Pagos programados recurrentes y notificaciones
Web Push que llegan aunque la pestaña esté cerrada, enviadas por un cron que
invoca una Edge Function.

**Reportes.** Exportación a CSV y PDF, además de estadísticas y gráficas.

**Logros.** Rachas de registro, niveles y un catálogo de logros que premia la
constancia sin castigar los tropiezos.

**Planes.** Gratuito y premium, con los límites aplicados en la base de datos
—no en el cliente— y un panel de administración para gestionar usuarios.

**Registro rápido desde el celular.** Un endpoint permite crear movimientos
desde un atajo de iPhone sin abrir la aplicación, autenticado con un token
personal revocable que solo puede crear transacciones.

## Cómo está hecho

| Capa | Tecnología |
|---|---|
| Interfaz | React Native 0.86 y React 19 sobre `react-native-web` |
| Rutas | Expo Router 57 (basado en archivos, exportado como SPA) |
| Estado | Zustand |
| Datos y autenticación | Supabase: PostgreSQL con RLS, Auth y Edge Functions |
| Gráficas | `react-native-gifted-charts` |
| Alojamiento | Vercel (estático) |

### Estructura

```
src/
  app/              rutas de Expo Router
    (auth)/         inicio de sesión y registro
    (tabs)/         inicio, movimientos, cuentas, presupuestos, metas, ajustes
    *.tsx           pantallas modales: calendario, deudas, reportes, logros...
  hooks/            acceso a datos, un hook por dominio
  lib/              lógica pura y utilidades de plataforma
  store/            sesión y perfil
  types/            tipos del dominio
supabase/
  *.sql             esquema, políticas RLS y permisos por tabla
  functions/        Edge Functions (Deno)
public/             manifiesto PWA y service worker
```

### Seguridad

El acceso a los datos lo gobiernan las políticas RLS de PostgreSQL, no el
cliente. Dos decisiones que conviene conocer antes de tocar el esquema:

- El plan y el rol de administrador viven en `user_plans`, una tabla sobre la
  que el usuario solo tiene permiso de lectura y por columnas. No pueden ir en
  `profiles`, que sí es escribible por su dueño.
- Los límites del plan gratuito se aplican con disparadores, no solo con
  políticas, para que una inserción masiva no los esquive.

## Puesta en marcha

Requiere Node y un proyecto de Supabase.

```bash
npm install
cp .env.example .env    # rellena las tres variables
npm run web
```

El esquema se crea ejecutando los archivos de `supabase/` en el editor SQL del
proyecto. Cada tabla nueva necesita su `grant` explícito: sin él, PostgREST
responde con un 404 que parece un error de configuración de la API.

Las Edge Functions se despliegan por separado. `quick-add` no lleva verificación
de JWT porque se autentica con su propio token:

```bash
npx supabase functions deploy quick-add --no-verify-jwt
```

### Variables de entorno

Las tres de `.env.example` viajan en el bundle del navegador y no son secretas;
quien protege los datos es RLS. Los secretos reales —`VAPID_PRIVATE_KEY`,
`CRON_SECRET`, `ANTHROPIC_API_KEY`— se configuran como secrets de Supabase y
nunca entran al repositorio.

## Despliegue

```bash
npm run deploy
```

Construye la web y la publica en Vercel. El repositorio y Vercel están
desconectados: hacer `push` no despliega, y desplegar no sube nada al
repositorio.

## Licencia

Ver [LICENSE](LICENSE).

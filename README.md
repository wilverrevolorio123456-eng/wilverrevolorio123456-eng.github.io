# Portal de Viáticos — Educación Santa Rosa

Portal público y adaptable para enlazar al **Sistema de Liquidación de Reconocimiento de Viáticos** del Ministerio de Educación de Guatemala y la Dirección Departamental de Educación de Santa Rosa.

## Incluye

- Página pública compartible con diseño adaptable.
- Estado visible de enlace pendiente de configuración.
- Botón público que solo funciona cuando hay una URL configurada.
- Área administrativa con inicio y cierre de sesión.
- Edición de URL protegida por autenticación y token CSRF.
- Contraseñas almacenadas mediante bcrypt.
- Limitación de intentos de inicio de sesión.
- Cabeceras de seguridad, política de contenido y cookies de sesión HttpOnly/SameSite.
- La URL solo acepta HTTPS.

## Requisitos

- Node.js 20 o superior.
- npm.
- Para producción: dominio institucional o aprobado, HTTPS, almacenamiento persistente, copias de seguridad y un almacén de sesiones persistente.

## Instalación local

1. Instale Node.js 20+.
2. En la carpeta del proyecto ejecute:

   ```bash
   npm install
   ```

3. Copie `.env.example` como `.env`.
4. Genere un secreto para sesiones:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Pegue el secreto en `SESSION_SECRET` en `.env`. No lo comparta ni lo suba al repositorio.
6. Opcional: configure `SYSTEM_URL` solo si ya verificó la URL oficial. Si no, déjela vacía.
7. Cree una cuenta administrativa:

   ```bash
   npm run create-admin
   ```

   Use una contraseña única de al menos 14 caracteres. La contraseña se almacena como hash bcrypt.
8. Inicie el portal:

   ```bash
   npm start
   ```

9. Abra `http://localhost:3000`.

## Configurar el enlace después

1. Abra «Administrar enlace».
2. Inicie sesión con la cuenta creada.
3. Introduzca la URL oficial que empiece con `https://`.
4. Seleccione «Guardar enlace».

El enlace queda disponible para los visitantes. Para desactivarlo, borre el campo y guarde.

## Despliegue en producción — obligatorio antes de publicar

Este repositorio es una base funcional de aplicación, pero no está desplegado ni certificado por el Ministerio de Educación.

- Publicar detrás de HTTPS. Configure `NODE_ENV=production`.
- Establezca `SESSION_SECRET` desde el gestor de secretos del proveedor.
- Configure `TRUST_PROXY=true` solo si el proxy inverso está bajo su control y correctamente configurado.
- Sustituya el `MemoryStore` predeterminado de Express Session por un almacén persistente y respaldado (por ejemplo, Redis o un almacén compatible). MemoryStore no está diseñado para producción.
- Proteja `data/` con permisos restrictivos y volumen persistente. Haga copias de seguridad cifradas de la configuración y de las cuentas.
- Aplique actualizaciones de seguridad y monitoreo de registros; no registre contraseñas, tokens ni cookies.
- Considere MFA para administradores, rotación/revocación de sesiones y un proceso documentado de recuperación de cuentas.
- Verifique la URL final del sistema y la autorización de publicación con la institución.
- Reemplace los distintivos de texto «GT» y «SR» por logotipos oficiales autorizados en formatos accesibles, sin distorsionarlos.
- Agregue contactos institucionales solo cuando se hayan confirmado.
- Haga pruebas de seguridad, accesibilidad y recuperación antes de uso real.

## Límites de la versión inicial

- La configuración y las cuentas se guardan en archivos JSON locales; no es adecuada para varias instancias de servidor sin almacenamiento compartido y control de concurrencia.
- La aplicación gestiona el enlace público, no procesa liquidaciones ni almacena datos de viáticos.
- No incluye recuperación automática de contraseñas, MFA ni gestión de múltiples roles.
- La página utiliza marcas tipográficas provisionales, no logotipos oficiales.

# Economía y Sociedad · Unidad 4 — Participación en clase por QR

- **Frontend** (`docs/`): GitHub Pages. `index.html` = estudiantes · `docente.html` = panel docente.
- **Backend** (`apps-script/`): Google Apps Script como API; guarda todo en una planilla de Google.
- **IA**: Groq (corrección de respuestas abiertas). **PDF**: generados por Apps Script.

> ⚠️ **Nunca** escribas la API key de Groq ni tu clave dentro de los archivos: este repositorio es público.
> Van solo en *Propiedades del script* (paso 2).

## 1. Apps Script
1. https://script.google.com → **Nuevo proyecto**. Nómbralo «Economía U4».
2. Crea los archivos `Code.gs`, `Semilla.gs`, `Estudiantes.gs` y `Secretos.gs` (este último solo en Apps Script, nunca en GitHub) y pega el contenido de `apps-script/`.
   En ⚙️ *Configuración del proyecto* marca «Mostrar `appsscript.json`» y pega el contenido de `apps-script/appsscript.json`.
3. ⚙️ **Configuración del proyecto → Propiedades del script → Agregar**:
   | Propiedad | Valor |
   |---|---|
   | `DOC_CLAVE` | tu clave de docente |
   | `GROQ_API_KEY` | tu API key de Groq |
4. Selecciona la función **`instalar`** y pulsa ▶ Ejecutar. Acepta los permisos (planilla, Drive, conexión externa).
   Crea la planilla, la Sesión 1 (desde la ficha) y guarda tu clave cifrada (borra `DOC_CLAVE` en texto plano).
5. **Implementar → Nueva implementación → Aplicación web** · Ejecutar como: *Yo* · Quién tiene acceso: *Cualquier usuario*. Copia la URL que termina en `/exec`.
   Cada vez que cambies `Code.gs` debes hacer **Implementar → Administrar implementaciones → editar → Nueva versión**.

## 2. GitHub Pages
1. Edita `docs/js/config.js` y pega la URL `/exec`.
2. Sube el repositorio a GitHub → *Settings → Pages* → Branch `main`, carpeta `/docs`.
3. Tus páginas: `https://TU-USUARIO.github.io/TU-REPO/` (estudiantes) y `.../docente.html` (docente, solo pide la clave).

## 3. Uso en clase
1. Panel docente → **En vivo** → elige la sesión → proyecta el QR (botón «QR a pantalla completa»).
2. **Antes de la primera clase**: pestaña **Estudiantes** → pega tu lista (Correos · Curso · Nombre · Electivo). El RUT sale del correo. También puedes agregar, editar, quitar y renombrar cursos.
   Los estudiantes escanean, ingresan **solo con su RUT** y pulsan «Entrar a participar». Un RUT solo puede estar activo en un dispositivo a la vez.
   Al pulsar «Terminar» reciben por correo (desde tu cuenta) un comprobante formal con sus respuestas; tú también puedes enviarlos por sesión desde **Corrección → ✉ Enviar copias**.
3. Si un estudiante sale de la app, queda **suspendido**; tú lo ves en rojo y pulsas **Autorizar**.
4. **Corrección**: elige actividad → «Corregir con IA» → revisa/ajusta → «Aprobar». **Informes**: PDF individual o por curso.
5. **Sesiones**: crea/edita sesiones, presentaciones, actividades, material, videos y el **plazo** (apertura/cierre). Fuera del plazo solo se puede ver material.

## Novedades (v4)
- **Insignia** del colegio en toda la app, íconos y informes/correos. **App instalable**: se llama «Clases de Economía», abre a pantalla completa (Android: botón *Instalar*; iPhone: Compartir → Agregar a pantalla de inicio).
- **Ver como estudiante**: botón 👁 en el panel (arriba, en *En vivo* y en cada sesión). Abre una ventana con formato de celular. No guarda nada.
- **Subir archivos completos** (PDF, PowerPoint, Word, imágenes, videos; hasta 300 MB) en *Sesiones → Editar*: «A la presentación» (se ven como diapositivas) o «Al material y videos». Se guardan en tu Drive (carpeta «Material Economía U4»). Canva, Google Slides y YouTube: pega el enlace.
- Durante la actividad no se abren ventanas emergentes, se pide pantalla completa y al terminar vuelve a la pantalla normal.

## Novedades (v5)
- **Usuario ficticio**: cada estudiante recibe un alias (ej. «Delfín Audaz»). Todo lo que se proyecta o se muestra al curso (ranking, resultados) usa solo el alias. Ingresan con su RUT (privado); el alias no sirve para entrar, para que nadie pueda suplantar a otro viendo la pantalla.
- **Modo en vivo estilo Kahoot/Mentimeter**: pestaña **🎮 Control** (pensada para el celular). Activas «Modo en vivo» y avanzas con el botón grande (Lanzar → Cerrar → Resultados → Ranking → Siguiente). Preguntas con cronómetro y puntos por velocidad; nube de palabras, escala 1-5 y encuestas. «🖥 Proyectar» muestra la pantalla grande para el proyector.
- **IA**: «Analizar» resume cómo le fue al curso sin nombrar a nadie y propone una retroalimentación general que puedes mostrar a todos. «⚡ Corregir y devolver» corrige las preguntas abiertas y cada estudiante ve **su** retroalimentación individual.
- **Crear actividades con IA** (Sesiones → Editar): desde el tema, la sesión o un documento (PDF, Word, PowerPoint, TXT). Eliges cuáles agregar.
- **Lista de estudiantes**: pega `Lista.gs` en Apps Script (nunca en GitHub) y ejecuta `importarLista()`.
- **Informes por correo**: pestaña Informes → «✉ Enviar informe por correo».

## Novedades (v16)
- **Resultados atractivos**: al cerrar una pregunta se ve una tarjeta verde «Respuesta correcta», el % que acertó, la explicación y barras de colores con cada alternativa nombrada (también en la proyección).
- **Diseño respetado**: los estudiantes y la proyección reciben la diapositiva completa (tema, efectos, movimiento, video). El generador de clases con IA tiene «🎛 Diseño de las diapositivas» para fijar tema, disposición, efecto y movimiento.
- **Videos**: se corrigió el reproductor (referrer), se detectan videos bloqueados/privados con aviso y botón «Abrir en YouTube», y al agregar un video se comprueba que se pueda insertar.
- **Autorización rápida**: se autoriza al instante (sin esperar la planilla) y el estudiante vuelve en ~1,5 s. Al terminar la clase nadie queda bloqueado ni pide autorización.
- **🔁 Retomar clase**: en Control aparece «Retomar» para continuar una clase ya ejecutada desde el paso en que quedó (o «Empezar de cero»).

## Novedades (v15)
- **IA fiel al documento**: al generar clases o preguntas con un documento o texto pegado, usa solo ese contenido, cita la fuente de cada elemento y la verifica; marca lo que no se pudo respaldar y las cifras que no están en el documento (quedan sin marcar para revisar). Temperatura baja. Sin documento, avisa que usa conocimiento general.
- **Video en la proyección**: ya no se reinicia al cambiar el número de conectados; se reproduce solo y con audio si elegiste «audio solo en la proyección»; enlace de respaldo a YouTube.
- **🎬 Solo video**: diapositiva de pantalla completa sin título ni texto.

## Novedades (v14)
- **Formato de texto en las diapositivas**: barra sobre cada diapositiva con negrita, cursiva, subrayado, resaltado (5 colores de marcador), color de texto (11 colores), tamaño (A−, A, A+), viñetas y quitar formato. Se escribe y se ve igual que quedará. Se guarda como texto con marcas ({{b|...}}) y se muestra igual a estudiantes, proyección y miniaturas. Al pegar, entra como texto plano.

## Novedades (v13)
- **Movimiento inteligente** (✨ Efectos → 🪄): la IA reconoce qué muestra la imagen (barco, personas, ciudad, campo, transporte, dinero, gráfico…) y propone el movimiento acorde: navegar con olas, acercarse al grupo o rostro, subir en edificios, viento en cultivos, travelling en transporte, destello en dinero/comercio. Elige la mejor y muestra alternativas con el motivo. También en «Estilo de toda la presentación» (según cada imagen) y al generar una clase con IA. Si la IA de visión no está disponible, se basa en el texto de la diapositiva.
- **Control del docente**: muestra quién salió de la aplicación y quién pide autorización, con botón **Autorizar** (uno o todos) y aviso con vibración. El estudiante suspendido puede pulsar «Pedir autorización». **Nada de esto aparece en la proyección** (el servidor ni se lo envía). El informe PDF indica cuántas salidas tuvo cada estudiante.

## Novedades (v12)
- **Movimiento en imágenes** (subidas o por URL): paneo, oleaje, flotar, recorrido diagonal, zoom y «Navegar» (la foto se mece con olas animadas). Velocidad lenta/normal/rápida. **Objeto en movimiento**: un PNG con fondo transparente (p. ej. un barco recortado) que cruza la diapositiva.
- **Video de YouTube dentro de la diapositiva**, junto al texto, con audio a elección (sin audio / con audio / audio solo en la proyección), inicio, bucle y controles.
- **✏️ Título** del panel: cambia asignatura, unidad y establecimiento (también en estudiantes, informes y correos).
- **Sesiones**: total editable, «Crear las que faltan» y fecha opcional por sesión.

## Novedades (v11)
- **Retroalimentación visible sin bajar**: en el celular del estudiante queda fija al pie (se puede plegar); en el panel docente el análisis aparece en una hoja inferior con su propio desplazamiento; en la proyección se muestra al lado de los resultados.
- **Retroalimentación de contenido**: la IA parte de los resultados reales (qué alternativa eligió cada porcentaje del curso, valores, respuestas abiertas) y de tu explicación/pauta; explica el concepto y por qué falla el error más frecuente. Sin frases motivacionales ni nombres.
- **Diapositivas**: botón ✨ Efectos (3D inclinado/flotante/profundidad, polaroid, título en relieve, zoom suave; imagen en tarjeta/círculo/arco; filtros) y 🎨 Estilo de toda la presentación para rediseñar las ya creadas.

## Novedades (v10)
- **IA**: elige sola un modelo de Groq disponible en tu cuenta (si el configurado no existe). Déjalo vacío en Ajustes.
- **Avance en vivo más rápido**: el estado se guarda en una propiedad (no en la planilla) y el control recibe todo en una sola respuesta.
- **Diapositivas**: el texto se ajusta solo (no se corta), versión vertical para celular, 11 diseños y 10 colores (galería 🎨 Diseños, estilo Canva).
- **Proyección**: muestra la diapositiva completa, igual que los alumnos.

## Novedades (v9)
- Corregido: las pestañas superiores no respondían tras abrir el Control. Las ventanas (correo, proyección, vista previa) ahora siempre se pueden cerrar (✕, Esc o tocando fuera).
- **Correo de prueba**: escribe tu correo en Ajustes → «Correo del docente (para pruebas)».

## Novedades (v8)
- **Control simple para el celular**: flechas ◀ ▶ grandes al pie (también deslizar con el dedo o usar las flechas de un control remoto de presentaciones). La flecha ▶ hace todo en orden: lanzar pregunta → cerrar → resultados → siguiente.
- **Cronómetro** visible con -5 s / +10 s, contador de respondieron y lista de **quiénes faltan** y quiénes no se han conectado.
- Cuando **todos responden** aparece el aviso con «Ver resultados» y «Analizar ahora» (y se cierra solo si lo dejas activado).
- **Preguntas estilo Kahoot**: se escriben directamente sobre los recuadros de colores; ✓ marca la correcta.

## Novedades (v7)
- **Nombres reales** en rankings y pantallas (se eliminaron los alias de animales). La retroalimentación general sigue sin nombrar a nadie.
- **Editor de diapositivas visual**: se editan directamente sobre su aspecto final (diseño, tema, imagen). Buscador de imágenes libres (Wikimedia/Openverse) con crédito del autor, URL o subida propia.
- **Generar una clase completa con IA**: diapositivas atractivas con imágenes acordes + actividades intercaladas.
- **Control remoto móvil**: botones grandes fijos al pie; al mover se activa el modo en vivo; muestra cuántos estudiantes ven el mismo paso que tú. El QR solo aparece en la proyección al inicio y no en el celular.
- **Correos**: enlace de acceso por correo (sin QR), y **envío de prueba a tu correo** antes de enviar a todos (enlace, copias e informes).
- **Cursos**: se pueden renombrar y eliminar (moviendo o quitando a sus estudiantes).
## Límites que conviene conocer
- Una página web **no puede impedir** abrir otra app; lo que hace es **detectar** que el estudiante salió (cambio de app/pestaña, bloqueo de pantalla, cierre) o que dejó de enviar señal (~50 s) y **suspende** su participación hasta que lo autorices.
- Apps Script tiene cuotas (aprox. 30 ejecuciones simultáneas). Para cursos de ~40 estudiantes funciona; no lo uses con cientos a la vez.
- La ficha dice «Unidad 3»; aquí está configurada como **Unidad 4** (editable en Ajustes y en cada sesión).
- El enlace del video de la Sesión 1 es una búsqueda en YouTube: reemplázalo por la dirección exacta en Sesiones → Material.

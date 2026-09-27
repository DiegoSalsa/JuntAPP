import type { SeoCta, SeoPageModel } from './types';
import { SEO_EVENTS } from '../../lib/seo/event-names';

function register(section: string, label: string): SeoCta {
  return { href: '/registro', label, event: SEO_EVENTS.register, section };
}

function pricing(section: string): SeoCta {
  return { href: '/pricing', label: 'Ver planes', event: SEO_EVENTS.pricing, section };
}

export const COMMERCIAL_PAGES: SeoPageModel[] = [
  {
    path: '/software-juntas-de-vecinos',
    kind: 'commercial',
    keyword: 'software para juntas de vecinos',
    intent: 'BOFU',
    title: 'Software para juntas de vecinos en Chile',
    description: 'JuntAPP es un software para juntas de vecinos en Chile. Ordena socios, cuotas, tesorería, comunicaciones y consultas sin mezclar la información en cuadernos y chats.',
    h1: 'Software para juntas de vecinos en Chile',
    plaque: 'JUNTAPP · SOFTWARE VECINAL',
    kicker: 'Producto',
    answer: 'JuntAPP es un software web para la directiva de una junta de vecinos en Chile. Reúne el padrón de socios, el estado de las cuotas por domicilio, el libro de caja, los avisos y las consultas. No promete cumplir la ley por sí solo: ayuda a dejar registrada la información con la que la directiva ya trabaja.',
    showPlans: true,
    sections: [
      {
        heading: 'Qué se desordena cuando la junta crece',
        paragraphs: [
          'Al principio alcanza un cuaderno y un grupo de WhatsApp. El problema aparece cuando hay que responder, el mismo día, quién está al día, cuánto hay en caja y qué se acordó. Esa información suele vivir en personas distintas: tesorería en una planilla, secretaría en un acta y los avisos en un chat que no todos leen.',
          'Un software para juntas de vecinos sirve cuando la directiva necesita una sola ficha por vecino y un solo libro de movimientos, no cuando se busca “más tecnología” en abstracto.',
        ],
      },
      {
        heading: 'Qué resuelve JuntAPP',
        paragraphs: [
          'JuntAPP es la plataforma y {/gestion-socios-junta-de-vecinos|la gestión de socios} es uno de sus módulos. Desde el mismo acceso, la directiva también lleva {/cuotas-junta-de-vecinos|las cuotas}, la {/tesoreria-junta-de-vecinos|tesorería}, las {/comunicaciones-junta-de-vecinos|comunicaciones} y las {/consultas-votaciones-junta-de-vecinos|consultas}.',
        ],
        table: {
          caption: 'Módulos actuales de JuntAPP',
          headers: ['Trabajo de la directiva', 'Dónde queda en JuntAPP', 'Qué no hace'],
          rows: [
            ['Saber quién es socio', 'Padrón con nombre, RUT, dirección y contacto', 'No emite certificados de residencia'],
            ['Saber quién pagó', 'Estado de cuota por domicilio', 'No reemplaza la cuenta bancaria de la junta'],
            ['Registrar plata', 'Ingresos, egresos y reporte del mes', 'No genera un Excel certificado por SUBDERE'],
            ['Avisar', 'Comunicados y notificación al celular', 'El WhatsApp masivo todavía no está activo'],
            ['Preguntar a la asamblea', 'Consultas con alternativas', 'No es una elección de directiva ante la municipalidad'],
          ],
        },
      },
      {
        heading: 'Roles que ya existen',
        paragraphs: [
          'El producto distingue vecino y directiva. Dentro de la directiva, los cargos que se pueden asignar son presidente, secretario, tesorero y dirigente. Presidencia asigna secretario, tesorero y dirigente; esos tres cargos son únicos. La presidencia no se transfiere desde esa pantalla.',
          'Una solicitud de ingreso llega con un enlace de la junta. Secretaría, o presidencia si todavía no hay secretario, la revisa para comprobar los requisitos legales y estatutarios. Quien los cumple no puede quedar fuera por preferencia de la directiva. Un rechazo corresponde a un requisito que no se cumple. Si la revisión está conforme, la persona activa su acceso por correo.',
        ],
      },
      {
        heading: 'Página pública, aparte de la gestión',
        paragraphs: [
          'La gestión interna no es lo mismo que el sitio que ven los vecinos. Los planes con página incluyen un sitio autoadministrable, con plantillas, textos, colores, logo, portada, galería y noticias. El plan de gestión sin página no publica ese sitio.',
          'Ese sitio solo debería indexarse cuando la junta lo publicó y escribió contenido propio. Una plantilla vacía no ayuda al barrio ni a Google.',
        ],
      },
    ],
    faqs: [
      { question: '¿JuntAPP sirve para un condominio o una copropiedad?', answer: 'Está construido para juntas de vecinos y su directiva. La ley de copropiedad es otra norma y este producto no administra edificios ni gastos comunes de un condominio.' },
      { question: '¿Garantiza el cumplimiento de la Ley 19.418?', answer: 'No. Ayuda a ordenar padrón, cuotas, caja y comunicaciones. Los estatutos, las actas y los trámites municipales siguen siendo responsabilidad de la junta.' },
      { question: '¿Hay que instalar una aplicación de tienda?', answer: 'Se usa en el navegador y puede instalarse como aplicación web en el celular. Los avisos push dependen de que el vecino acepte las notificaciones en su dispositivo.' },
    ],
    cta: register('software', 'Digitalizar mi junta'),
    secondaryCta: pricing('software'),
    related: [
      { href: '/gestion-socios-junta-de-vecinos', label: 'Gestión de socios', description: 'Padrón, RUT, solicitudes y cargos.' },
      { href: '/cuotas-junta-de-vecinos', label: 'Cuotas de la junta', description: 'Estado de pago por domicilio y cobro manual o con Mercado Pago.' },
      { href: '/recursos', label: 'Guías para la directiva', description: 'Cómo registrar socios, cobrar cuotas y preparar una rendición.' },
    ],
    breadcrumbs: [],
    schema: 'software',
  },
  {
    path: '/gestion-socios-junta-de-vecinos',
    kind: 'commercial',
    keyword: 'gestión de socios junta de vecinos',
    intent: 'BOFU',
    title: 'Gestión de socios para una junta de vecinos',
    description: 'Administra el padrón de tu junta de vecinos: RUT, dirección, búsqueda, estado de cuota y solicitudes de ingreso. Mira qué hace hoy el módulo de socios de JuntAPP.',
    h1: 'Gestión de socios de una junta de vecinos',
    plaque: 'JUNTAPP · PADRÓN',
    kicker: 'Socios',
    answer: 'La gestión de socios en JuntAPP es el padrón de la junta: nombre, RUT validado, dirección, teléfono, correo y el estado de cuota que el software guarda por domicilio. La directiva busca personas y revisa solicitudes para comprobar requisitos, no para elegir a quién acepta. No existe hoy una exportación a Excel del padrón.',
    sections: [
      {
        heading: 'Qué datos quedan en la ficha',
        paragraphs: [
          'Al inscribir, la directiva pide nombre, RUT, dirección, celular y correo. El RUT se valida antes de enviar la invitación. La persona recibe un correo para activar su acceso. Si entra por el enlace público de la junta, la solicitud queda pendiente mientras se comprueban los requisitos. Quien los cumple no puede ser rechazado de forma arbitraria.',
          'El vecino, una vez dentro, ve su ficha y puede actualizar teléfono y correo. También ve el contacto de la directiva.',
        ],
        bullets: [
          'Búsqueda por nombre, dirección o RUT.',
          'Estado de cuota del domicilio: al día o pendiente.',
          'La cuota se lleva por domicilio, no como un pago suelto por cada integrante del mismo hogar.',
          'Eliminar a un vecino quita su acceso. Los movimientos de caja anteriores permanecen.',
        ],
      },
      {
        heading: 'Ingreso controlado, no una planilla abierta',
        paragraphs: [
          'Cada junta tiene un código y un enlace de solicitud. Secretaría revisa la bandeja. Si no hay secretario, la revisa presidencia o el titular de la cuenta. Esa revisión comprueba edad, residencia y lo que pidan los estatutos. Si está conforme, se envía la invitación. Un rechazo pide un motivo y corresponde a un requisito que no se cumple, no a una selección discrecional.',
          'Eso se parece al cuidado del {/recursos/como-llevar-registro-socios-junta-de-vecinos|registro de socios}, pero el módulo no es el libro foliado que la municipalidad revisa en una elección. Es el padrón operativo de la plataforma.',
        ],
      },
      {
        heading: 'Cargos de la directiva dentro del padrón',
        paragraphs: [
          'Presidencia puede asignar secretario, tesorero o dirigente a alguien que ya está en el padrón, cambiar ese cargo o devolver a la persona a vecino. Presidente, secretario y tesorero no se duplican. El detalle de funciones legales está en la guía de {/recursos/directiva-junta-de-vecinos|directiva de una junta de vecinos}.',
        ],
      },
    ],
    faqs: [
      { question: '¿Puedo cargar el padrón desde Excel?', answer: 'No en la versión actual. Cada inscripción se hace desde el formulario o mediante una solicitud de ingreso.' },
      { question: '¿El padrón reemplaza el registro que se entrega en una elección?', answer: 'No automáticamente. Sirve para tener la nómina al día. La comisión electoral y la municipalidad definen qué documento deben recibir.' },
      { question: '¿La directiva puede rechazar una solicitud?', answer: 'Puede registrar la revisión y un motivo. La Ley 19.418 no permite negar el ingreso a quien cumple los requisitos legales y estatutarios. El rechazo cabe cuando falta uno de esos requisitos.' },
      { question: '¿Un vecino ve los datos de todos?', answer: 'La directiva ve el padrón. El vecino ve su ficha y el contacto de la directiva, no el listado completo de RUT.' },
    ],
    cta: register('socios', 'Ordenar el padrón'),
    secondaryCta: pricing('socios'),
    related: [
      { href: '/libro-socios-digital', label: 'Libro de socios digital', description: 'Qué conviene guardar y qué parte cubre el software.' },
      { href: '/cuotas-junta-de-vecinos', label: 'Estado de las cuotas', description: 'El padrón muestra si el domicilio está al día.' },
      { href: '/recursos/como-llevar-registro-socios-junta-de-vecinos', label: 'Guía: registro de socios', description: 'Antes de digitalizar, qué datos importan.' },
    ],
    breadcrumbs: [],
    schema: 'software',
  },
  {
    path: '/cuotas-junta-de-vecinos',
    kind: 'commercial',
    keyword: 'cuotas junta de vecinos',
    intent: 'BOFU',
    title: 'Cuotas de una junta de vecinos',
    description: 'Controla las cuotas de tu junta de vecinos por domicilio: pago manual o con Mercado Pago, estado al día o pendiente, e ingreso automático en el libro de caja.',
    h1: 'Cuotas de una junta de vecinos',
    plaque: 'JUNTAPP · CUOTAS',
    kicker: 'Cuotas',
    answer: 'En JuntAPP el estado de la cuota se registra por domicilio y por período. Esa agrupación es del software, no una regla de la Ley 19.418: el monto y quién paga los definen los estatutos y la asamblea. El pago puede anotarse en efectivo, transferencia u otro medio, o hacerse con Mercado Pago si la junta conectó su cuenta. Al marcarlo, el ingreso queda en tesorería.',
    sections: [
      {
        heading: 'Cómo se registra un pago',
        paragraphs: [
          'Desde el padrón, la directiva abre “Gestionar cuota del domicilio”. Si está pendiente, elige el medio y la deja pagada. Ese acto crea el ingreso en el libro de caja. Si el pago fue manual y hubo un error, se puede volver a pendiente: la anulación queda visible.',
          'Si Mercado Pago ya confirmó el pago del domicilio, el botón manual se bloquea. El vecino puede recibir correo según el resultado del pago: aprobado, rechazado o reembolsado.',
        ],
        bullets: [
          'Estados visibles en la ficha: al día o pendiente.',
          'El monto de la cuota pertenece a la configuración de la junta, no a un valor inventado en esta página.',
          'El cobro de la suscripción de JuntAPP es otro pago: es el plan de la plataforma, no la cuota social de los vecinos.',
        ],
      },
      {
        heading: 'Qué problema de tesorería evita',
        paragraphs: [
          'El desorden típico es anotar el pago en un cuaderno y olvidar pasarlo a la planilla. Aquí el estado del socio y el ingreso de caja salen del mismo registro. La revisión del mes sigue en {/tesoreria-junta-de-vecinos|tesorería}, con ingresos, egresos y variación.',
          'La guía {/recursos/como-cobrar-cuotas-junta-de-vecinos|cómo cobrar cuotas} explica el acuerdo de asamblea. Esta página explica solo el registro dentro del software.',
        ],
      },
    ],
    faqs: [
      { question: '¿La ley obliga a cobrar una cuota?', answer: 'La Ley 19.418 permite que la organización fije cuotas ordinarias y extraordinarias. El monto y la forma de cobro los acuerda la propia junta. JuntAPP no decide ese monto.' },
      { question: '¿Puedo cobrar por WhatsApp desde JuntAPP?', answer: 'No hay envío masivo de WhatsApp activo. El vecino puede pagar en Mercado Pago si la junta conectó la cuenta, o la directiva registra el pago manual.' },
      { question: '¿Dos personas de la misma casa pagan dos cuotas?', answer: 'En JuntAPP, dos fichas del mismo domicilio comparten el estado de pago. Eso es el modelo del software. Si los estatutos cobran de otra forma, la junta tiene que resolverlo antes de usar ese estado como criterio formal.' },
    ],
    cta: { href: '/registro', label: 'Gestionar las cuotas con JuntAPP', event: SEO_EVENTS.register, section: 'cuotas' },
    secondaryCta: pricing('cuotas'),
    related: [
      { href: '/tesoreria-junta-de-vecinos', label: 'Tesorería', description: 'El pago de la cuota entra al libro de caja.' },
      { href: '/gestion-socios-junta-de-vecinos', label: 'Padrón de socios', description: 'Desde ahí se marca el domicilio.' },
      { href: '/recursos/como-cobrar-cuotas-junta-de-vecinos', label: 'Guía para cobrar', description: 'Acuerdo, registro y errores frecuentes.' },
    ],
    breadcrumbs: [],
    schema: 'software',
  },
  {
    path: '/tesoreria-junta-de-vecinos',
    kind: 'commercial',
    keyword: 'tesorería junta de vecinos',
    intent: 'BOFU',
    title: 'Tesorería para una junta de vecinos',
    description: 'Lleva la tesorería de tu junta de vecinos con ingresos, egresos, conciliación de Mercado Pago, reporte del mes y un repositorio de documentos.',
    h1: 'Tesorería de una junta de vecinos',
    plaque: 'JUNTAPP · TESORERÍA',
    kicker: 'Tesorería',
    answer: 'La tesorería de JuntAPP es el libro de caja de la junta: ingresos y egresos con descripción, monto y fecha; reporte del mes; y documentos PDF o imagen. Si la junta conecta Mercado Pago, los movimientos pueden quedar confirmados o conciliados. No sustituye la cuenta bancaria ni arma solo la rendición que pide un fondo público.',
    sections: [
      {
        heading: 'Qué se anota',
        paragraphs: [
          'La directiva registra un ingreso o un egreso. El pago de una cuota, cuando se marca en el padrón, crea su propio ingreso. El reporte del mes muestra ingresos brutos, gastos y comisiones, y la variación neta. También indica cuántos movimientos y documentos hay en ese período.',
        ],
        bullets: [
          'Medios manuales de cuota: efectivo, transferencia u otro.',
          'Un movimiento conciliado o confirmado por Mercado Pago se distingue de un registro manual.',
          'Las comisiones del pago pueden verse junto al movimiento.',
          'Subir un documento acepta PDF, JPG o PNG. Sirve para actas, rendiciones o cartolas que la directiva ya tiene.',
        ],
      },
      {
        heading: 'Transparencia hacia adentro',
        paragraphs: [
          'El repositorio está en el módulo de tesorería, para quienes entran a la junta. No publica solo esos archivos en Google. La {/recursos/transparencia-junta-de-vecinos|transparencia} hacia el barrio depende de qué decida mostrar la directiva, en asamblea o en su página.',
          'Para preparar la conversación de asamblea, la guía de {/recursos/rendicion-cuentas-junta-de-vecinos|rendición de cuentas} ordena ingresos, egresos y respaldo. El software entrega el resumen del mes y el archivo de documentos.',
        ],
      },
    ],
    faqs: [
      { question: '¿El reporte mensual se descarga como PDF oficial?', answer: 'Hoy se revisa en pantalla: ingresos, egresos y variación. No hay un PDF con formato de SUBDERE generado por el sistema.' },
      { question: '¿Puedo borrar un documento?', answer: 'La directiva puede quitar un archivo del repositorio. Conviene no borrar el único respaldo de una rendición ya presentada.' },
      { question: '¿La tesorería ve las cuotas pendientes?', answer: 'El estado al día o pendiente vive en el padrón, por domicilio. El libro de caja muestra el ingreso cuando ese pago se registra.' },
    ],
    cta: register('tesoreria', 'Abrir la tesorería'),
    secondaryCta: pricing('tesoreria'),
    related: [
      { href: '/cuotas-junta-de-vecinos', label: 'Cuotas', description: 'El origen más habitual de los ingresos.' },
      { href: '/recursos/rendicion-cuentas-junta-de-vecinos', label: 'Cómo rendir cuentas', description: 'Qué mostrar en asamblea y qué guardar.' },
      { href: '/pricing', label: 'Planes', description: 'La tesorería forma parte de los planes con gestión.' },
    ],
    breadcrumbs: [],
    schema: 'software',
  },
  {
    path: '/comunicaciones-junta-de-vecinos',
    kind: 'commercial',
    keyword: 'comunicaciones junta de vecinos',
    intent: 'BOFU',
    title: 'Comunicaciones de una junta de vecinos',
    description: 'Publica avisos de tu junta de vecinos por categoría y envía una notificación al celular de quien ya aceptó los avisos. Sin WhatsApp masivo todavía.',
    h1: 'Comunicaciones de una junta de vecinos',
    plaque: 'JUNTAPP · AVISOS',
    kicker: 'Comunicaciones',
    answer: 'Las comunicaciones de JuntAPP son anuncios de la directiva. Cada uno tiene categoría, título, mensaje, fecha y autor. Al publicarlo, el sistema intenta avisar a los celulares que ya aceptaron las notificaciones. El aviso queda en el historial aunque nadie tenga el push activo. El WhatsApp masivo no está disponible.',
    sections: [
      {
        heading: 'Qué se puede publicar hoy',
        paragraphs: [
          'Las categorías son urgente, asamblea, beneficio y general. El título y el mensaje tienen un largo mínimo y máximo. La directiva puede eliminar un comunicado. El vecino ve el listado dentro de su acceso.',
        ],
        bullets: [
          'No reemplaza la citación formal si tus estatutos exigen carta, correo o diario mural físico.',
          'Un aviso de asamblea en la plataforma no es, por sí solo, el acta ni la citación legal.',
          'La página pública de la junta, si el plan la incluye, tiene además noticias editables por la directiva.',
        ],
      },
      {
        heading: 'Por qué no basta el grupo de WhatsApp',
        paragraphs: [
          'El grupo mezcla avisos, ventas y opiniones. Un comunicado con categoría y fecha deja una copia que no depende de que alguien “haya estado conectado”. JuntAPP no lee ni archiva el WhatsApp de la junta.',
        ],
      },
    ],
    faqs: [
      { question: '¿Llega el aviso aunque el vecino no abra la aplicación?', answer: 'Solo si ese celular quedó suscrito a las notificaciones y el envío se entrega. Si no hay dispositivos suscritos, el comunicado igual queda publicado dentro de JuntAPP.' },
      { question: '¿Puedo mandar el mismo texto por WhatsApp?', answer: 'El envío masivo desde JuntAPP está marcado como próximamente. Hoy el canal activo es el comunicado y la notificación push.' },
    ],
    cta: register('comunicaciones', 'Publicar avisos con JuntAPP'),
    secondaryCta: pricing('comunicaciones'),
    related: [
      { href: '/consultas-votaciones-junta-de-vecinos', label: 'Consultas', description: 'Cuando el aviso necesita una respuesta, no solo lectura.' },
      { href: '/recursos/asamblea-junta-de-vecinos', label: 'Cómo citar una asamblea', description: 'El aviso no reemplaza la citación que pidan los estatutos.' },
      { href: '/software-juntas-de-vecinos', label: 'Ver el software completo', description: 'Socios, caja y avisos en la misma cuenta.' },
    ],
    breadcrumbs: [],
    schema: 'software',
  },
  {
    path: '/consultas-votaciones-junta-de-vecinos',
    kind: 'commercial',
    keyword: 'consultas y votaciones junta de vecinos',
    intent: 'BOFU',
    title: 'Consultas y votaciones de una junta de vecinos',
    description: 'Crea consultas para tu junta de vecinos, recibe propuestas de los vecinos y cierra la votación. No reemplaza una elección de directiva.',
    h1: 'Consultas y votaciones en una junta de vecinos',
    plaque: 'JUNTAPP · CONSULTAS',
    kicker: 'Participación',
    answer: 'JuntAPP permite una consulta con título, contexto y alternativas. La directiva la publica y la cierra. Un vecino puede proponer una consulta, pero no queda pública hasta que la directiva la aprueba. Cada persona vota una alternativa. Esto no es el acto de elección de directiva que se informa a la municipalidad.',
    sections: [
      {
        heading: 'Consulta y elección no son lo mismo',
        paragraphs: [
          'Una consulta sirve para una decisión acotada: un horario, una actividad, una prioridad del barrio. La {/recursos/elecciones-junta-de-vecinos|elección de directiva} tiene comisión electoral, voto secreto y un acta que se entrega al municipio. JuntAPP no arma esa comisión ni ese expediente.',
          'Usar la palabra votación dentro del producto se refiere a las alternativas de una consulta, no a sufragar por cargos.',
        ],
      },
      {
        heading: 'Cómo se mueve una propuesta',
        paragraphs: [
          'La directiva redacta la pregunta y las alternativas, o revisa una propuesta vecinal. Mientras está activa, se ve el estado. Al cerrarla, deja de recibir respuestas. El historial permanece para la directiva y los vecinos de esa junta.',
        ],
      },
    ],
    faqs: [
      { question: '¿El resultado de una consulta es un acuerdo de asamblea?', answer: 'No por el solo hecho de cerrarse en la plataforma. El acuerdo queda cuando la asamblea y los estatutos dicen que queda. La consulta puede servir de respaldo, no de reemplazo del acta.' },
      { question: '¿Se puede votar más de una vez?', answer: 'El producto registra si esa persona ya respondió la consulta. No está diseñado como un padrón electoral municipal.' },
    ],
    cta: register('consultas', 'Crear una consulta'),
    secondaryCta: pricing('consultas'),
    related: [
      { href: '/recursos/asamblea-junta-de-vecinos', label: 'Asambleas', description: 'Dónde se toman los acuerdos que la consulta no reemplaza.' },
      { href: '/recursos/elecciones-junta-de-vecinos', label: 'Elecciones de directiva', description: 'El trámite que este módulo no cubre.' },
      { href: '/comunicaciones-junta-de-vecinos', label: 'Avisar la consulta', description: 'Publica el llamado junto con la pregunta.' },
    ],
    breadcrumbs: [],
    schema: 'software',
  },
  {
    path: '/libro-socios-digital',
    kind: 'commercial',
    keyword: 'libro de socios digital',
    intent: 'BOFU',
    title: 'Libro de socios digital para una junta',
    description: 'Arma el libro de socios de tu junta con nombre, RUT, dirección y estado de cuota. JuntAPP guarda el padrón operativo; no folia un libro notarial.',
    h1: 'Libro de socios digital para una junta de vecinos',
    plaque: 'JUNTAPP · LIBRO DE SOCIOS',
    kicker: 'Padrón',
    answer: 'Un libro de socios digital, en JuntAPP, es el padrón que la directiva consulta: quién ingresó, con qué RUT y dirección, y si el domicilio está al día. No es un libro foliado ni un certificado municipal. Sirve para no reescribir la nómina cada vez que secretaría necesita responder.',
    sections: [
      {
        heading: 'Qué guarda y qué no imita',
        paragraphs: [
          'Guarda la ficha y el historial de acceso de esa persona. No numera hojas, no impide una corrección y no produce por sí solo el registro que la comisión electoral entrega en una elección. Si la municipalidad pide un formato, la directiva sigue siendo quien lo presenta.',
          'La diferencia con la {/gestion-socios-junta-de-vecinos|gestión de socios} es de tarea: esa página explica el trabajo diario de inscribir y buscar. Esta explica el padrón como el equivalente práctico del libro.',
        ],
        bullets: [
          'RUT validado al inscribir.',
          'Dirección, para ubicar la residencia. El estado de cuota del software se agrupa por domicilio; los estatutos definen si ese es el criterio de cobro.',
          'Solicitudes pendientes separadas de quienes ya son socios.',
          'Sin exportación a planilla en la versión actual.',
        ],
      },
      {
        heading: 'Cómo se relaciona con la guía',
        paragraphs: [
          'Antes de cargar nombres, conviene leer {/recursos/como-llevar-registro-socios-junta-de-vecinos|cómo llevar el registro de socios}: edad, residencia y qué dato no debería publicarse. El software no comprueba la residencia en la unidad vecinal. Esa verificación sigue en la directiva.',
        ],
      },
    ],
    faqs: [
      { question: '¿Puedo publicar el libro de socios en la página de la junta?', answer: 'No debes. El sitio público no está hecho para listar RUT ni teléfonos. El padrón permanece dentro del acceso de la junta.' },
      { question: '¿Borrar a un socio borra su historia de pagos?', answer: 'Quita la cuenta y el acceso. Los movimientos contables ya registrados se mantienen en el libro de caja.' },
    ],
    cta: register('libro-socios', 'Digitalizar el padrón'),
    secondaryCta: pricing('libro-socios'),
    related: [
      { href: '/gestion-socios-junta-de-vecinos', label: 'Gestión de socios', description: 'Inscripción, búsqueda y cargos.' },
      { href: '/recursos/como-llevar-registro-socios-junta-de-vecinos', label: 'Guía del registro', description: 'Qué exigir antes de anotar a alguien.' },
      { href: '/recursos/ley-19418-juntas-de-vecinos', label: 'Ley 19.418', description: 'El marco en el que existe el registro de socios.' },
    ],
    breadcrumbs: [],
    schema: 'software',
  },
];

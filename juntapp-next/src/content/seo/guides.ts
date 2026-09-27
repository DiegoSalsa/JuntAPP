import type { SeoCta, SeoPageModel } from './types';
import { BCN_JUNTAS, LEGAL_SOURCES, LEY_CHILE_19418, MANUAL_VILLARRICA } from './sources';
import { SEO_EVENTS } from '../../lib/seo/event-names';

function product(href: string, label: string, section: string): SeoCta {
  return { href, label, event: SEO_EVENTS.register, section };
}

export const GUIDE_PAGES: SeoPageModel[] = [
  {
    path: '/recursos/como-llevar-registro-socios-junta-de-vecinos',
    kind: 'guide',
    keyword: 'cómo llevar el registro de socios de una junta de vecinos',
    intent: 'MOFU',
    title: 'Cómo llevar el registro de socios',
    description: 'Qué anotar en el registro de socios de una junta de vecinos en Chile, quién puede integrarse y cómo pasar esa nómina a un padrón digital sin publicar datos.',
    h1: 'Cómo llevar el registro de socios de una junta de vecinos',
    plaque: 'JUNTAPP · REGISTRO DE SOCIOS',
    kicker: 'Guía',
    answer: 'El registro de socios es la nómina de quienes pertenecen a la junta. La guía de la Biblioteca del Congreso Nacional indica que, para integrarse, se necesita al menos 14 años y residencia en la unidad vecinal. En una elección, la comisión electoral debe entregar a la municipalidad un registro actualizado. El cuaderno o la planilla sirven si están completos, fechados y no se publican con RUT.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'La ley trata a la junta como una organización territorial de las personas que residen en la misma unidad vecinal. El “libro de socios” es el nombre que usan muchos estatutos y manuales municipales. La guía oficial de la BCN habla de registro de socios, sobre todo cuando hay que entregarlo actualizado después de una elección.',
          'No basta el grupo de WhatsApp. Estar en el chat no acredita la calidad de socio.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'La persona pide incorporarse. La directiva comprueba la residencia en el territorio de la junta y anota los datos que los estatutos pidan. Desde ese momento puede participar según su tipo de socio y su edad. La guía de la BCN reconoce voz y voto en asamblea a los integrantes; los estatutos de cada junta precisan si existe alguna distinción.',
          'Secretaría suele custodiar el registro. Tesorería lo necesita para saber a quién corresponde una cuota. Por eso el padrón y el estado de pago no deberían vivir en dos listas que nadie concilia.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Ten a mano los estatutos y el territorio de la unidad vecinal.',
          'Recibe la solicitud con nombre, RUT, dirección y un medio de contacto.',
          'Confirma que la dirección está dentro del territorio. Si no puedes confirmarla, no inventes el dato: déjalo pendiente.',
          'Anota la fecha de ingreso y quién recibió la solicitud.',
          'Separa a quienes ya son socios de las solicitudes todavía no aceptadas.',
          'Cuando haya elección, prepara una copia actualizada para la comisión electoral. No publiques esa copia en redes.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Anotar a todo el pasaje, aunque no haya pedido ser socio.',
          'Borrar una fila cuando alguien se va, sin dejar constancia de la fecha.',
          'Usar el registro como lista de difusión con teléfonos visibles para cualquiera.',
          'Tener una planilla de tesorería y otra de secretaría con nombres escritos distinto.',
        ],
        paragraphs: ['El error más caro es descubrir la diferencia el día de la elección o de una rendición.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Para el trabajo diario alcanza una ficha corta. Los documentos de respaldo, si los piden los estatutos, se guardan aparte y no en un muro público.'],
        table: {
          caption: 'Ficha mínima del registro',
          headers: ['Dato', 'Para qué sirve', '¿Se publica?'],
          rows: [
            ['Nombre', 'Identificar a la persona en asamblea y padrón', 'No en internet'],
            ['RUT', 'Evitar duplicados', 'No'],
            ['Dirección', 'Comprobar residencia en la unidad vecinal', 'No'],
            ['Correo y teléfono', 'Avisos y recuperación de acceso', 'No'],
            ['Fecha de ingreso', 'Antigüedad y elecciones', 'Solo si un trámite lo pide'],
            ['Estado de pago', 'Saber si la cuota que corresponda está al día', 'A la directiva, no al buscador'],
          ],
        },
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          '{/gestion-socios-junta-de-vecinos|JuntAPP guarda ese padrón}: valida el RUT y deja la solicitud pendiente mientras se revisa. Esa revisión comprueba requisitos. Quien cumple la ley y los estatutos no puede ser rechazado por preferencia de la directiva. El sistema no certifica la residencia ni reemplaza el registro municipal.',
        ],
      },
    ],
    faqs: [
      { question: '¿Desde qué edad se puede ser socio?', answer: 'La guía de la BCN señala al menos 14 años y residencia en la unidad vecinal. Para integrar el directorio, la misma guía exige mayoría de edad.' },
      { question: '¿Se puede rechazar a quien pide ser socio?', answer: 'Solo si no cumple un requisito legal o estatutario. JuntAPP permite anotar la revisión y el motivo. No convierte esa bandeja en una facultad para elegir vecinos.' },
      { question: '¿El registro digital elimina el libro de papel?', answer: 'No tiene por qué. Puedes mantener el soporte que pidan tus estatutos y usar el padrón digital para consultar y no reescribir.' },
    ],
    sources: LEGAL_SOURCES,
    cta: product('/gestion-socios-junta-de-vecinos', 'Ver la gestión de socios', 'guia-registro'),
    related: [
      { href: '/libro-socios-digital', label: 'Libro de socios en JuntAPP', description: 'Qué cubre el software y qué no folia.' },
      { href: '/recursos/elecciones-junta-de-vecinos', label: 'Elecciones', description: 'Cuándo ese registro tiene que estar actualizado.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/como-cobrar-cuotas-junta-de-vecinos',
    kind: 'guide',
    keyword: 'cómo cobrar cuotas de una junta de vecinos',
    intent: 'MOFU',
    title: 'Cómo cobrar las cuotas de una junta de vecinos',
    description: 'Cómo acordar y registrar las cuotas ordinarias y extraordinarias de una junta de vecinos, según la Ley 19.418, sin mezclarlas con la plata de la directiva.',
    h1: 'Cómo cobrar las cuotas de una junta de vecinos',
    plaque: 'JUNTAPP · CUOTAS SOCIALES',
    kicker: 'Guía',
    answer: 'La junta puede fijar cuotas ordinarias y extraordinarias. En el texto refundido de la Ley 19.418, publicado en Ley Chile, el monto y la forma de recaudación los determina la propia organización. Las cuotas extraordinarias financian proyectos o actividades ya definidos y se aprueban en asamblea extraordinaria por las tres cuartas partes de los afiliados presentes. Cobrar es anotar quién pagó, cuándo y con qué respaldo.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'La cuota no es un impuesto municipal. Es un aporte de los socios, ordinario o extraordinario, que pasa a formar parte del patrimonio de la organización cuando la asamblea lo acuerda, conforme a los estatutos. Los estatutos deben decir cómo se fijan.',
          'Una cuota extraordinaria no debería mezclarse con el gasto diario si fue aprobada para un fin concreto. Separar el concepto en el registro evita la pelea de fin de año.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Tesorería informa el período, recibe el pago y deja comprobante. Secretaría no necesita una libreta paralela: necesita ver el mismo estado. El vecino debería poder preguntar “¿mi casa está al día?” y obtener una sola respuesta.',
          'El medio puede ser efectivo, transferencia o un cobro en línea. El medio no cambia la obligación de registrar el ingreso.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Revisa qué dicen los estatutos sobre cuota ordinaria y extraordinaria.',
          'Si el monto no está vigente, llévalo a la asamblea que corresponda. La extraordinaria, con el quórum que indica la ley, es la vía de la cuota extraordinaria.',
          'Define el período: mes, semestre o el que hayan acordado.',
          'Anota el medio de pago. JuntAPP representa el estado de la cuota por domicilio. Antes de utilizar esa modalidad como criterio formal de cobro, la junta debe verificar que coincida con sus estatutos y acuerdos vigentes.',
          'Entrega o guarda el comprobante. En efectivo, el respaldo es todavía más necesario.',
          'Pasa el ingreso al libro de caja el mismo día, no “cuando haya tiempo”.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Cobrar un monto que nadie aprobó, porque “siempre se ha cobrado así”.',
          'Anotar el pago en el cuaderno y olvidar el ingreso.',
          'Marcar al día a una persona cuando pagó otra casa.',
          'Devolver un pago en efectivo sin dejar la anulación escrita.',
        ],
        paragraphs: ['Ninguno de esos errores se arregla con un discurso de transparencia. Se arregla con el registro.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Por cada cobro: período, monto, fecha, medio, quién recibió y la persona o grupo que los estatutos indiquen como deudor. Si hubo devolución, el motivo y la fecha. El saldo del período se explica con esa lista, no con la memoria del tesorero.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'En {/cuotas-junta-de-vecinos|JuntAPP} el estado de la cuota se muestra por domicilio. Eso es una forma de registro del producto, no una regla de la Ley 19.418. La directiva marca el pago en efectivo, transferencia u otro medio, y el ingreso aparece en tesorería. Si conectan Mercado Pago, un pago confirmado por esa vía no se edita a mano. El sistema no decide el monto ni reemplaza el acuerdo de asamblea.',
        ],
      },
    ],
    faqs: [
      { question: '¿Hay un monto legal de cuota?', answer: 'No uno universal. La ley deja el monto y el sistema de recaudación a la organización, dentro de sus estatutos y acuerdos.' },
      { question: '¿La cuota extraordinaria se vota igual que la ordinaria?', answer: 'No. El texto de Ley Chile exige asamblea extraordinaria y las tres cuartas partes de los afiliados presentes, y el destino debe estar determinado antes.' },
    ],
    sources: [LEY_CHILE_19418, BCN_JUNTAS],
    cta: product('/cuotas-junta-de-vecinos', 'Gestionar las cuotas con JuntAPP', 'guia-cuotas'),
    related: [
      { href: '/tesoreria-junta-de-vecinos', label: 'Tesorería', description: 'Dónde queda el ingreso después del cobro.' },
      { href: '/recursos/rendicion-cuentas-junta-de-vecinos', label: 'Rendición de cuentas', description: 'Cómo explicar el período, no solo cobrarlo.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/rendicion-cuentas-junta-de-vecinos',
    kind: 'guide',
    keyword: 'rendición de cuentas junta de vecinos',
    intent: 'MOFU',
    title: 'Rendición de cuentas de una junta de vecinos',
    description: 'Cómo preparar la rendición de cuentas de una junta de vecinos: ingresos, egresos, saldo y respaldos, sin presentar una cifra que nadie puede reconstruir.',
    h1: 'Rendición de cuentas de una junta de vecinos',
    plaque: 'JUNTAPP · RENDICIÓN',
    kicker: 'Guía',
    answer: 'Rendir cuentas es explicar, con documentos, qué plata entró, qué plata salió y qué saldo queda en un período. La guía de la BCN señala que la junta debe tener una cuenta bancaria a su nombre y presentar un balance anual. Una rendición útil no es un discurso: es una lista que otra persona puede rehacer.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'El balance anual que menciona la guía fácil de la BCN no es lo mismo que el comentario de tesorería en el grupo. Es una cuenta del período. Los fondos concursables y los municipios suelen pedir, además, su propio formato. Este texto no copia un formulario de un fondo determinado.',
          'La asamblea ordinaria es el lugar habitual para informar la gestión y la tesorería. El manual municipal de Villarrica resume así materias del artículo 17, incluida la rendición. Confirma el calendario en tus estatutos.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Tesorería ordena el período. Secretaría deja constancia en el acta de que la cuenta se presentó y de si se aprobó. El socio debería poder preguntar por un egreso concreto y ver fecha, concepto y respaldo.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Cierra una fecha de corte. No rindas “más o menos hasta la semana pasada”.',
          'Lista ingresos: cuotas, aportes y cualquier otro concepto acordado.',
          'Lista egresos con su comprobante. Si falta el respaldo, dilo; no lo completes de memoria.',
          'Resta y muestra el saldo. Compáralo con la cuenta bancaria si la junta la usa.',
          'Separa las comisiones de un medio de pago del gasto de la actividad.',
          'Lleva el resumen a la asamblea y archiva la versión que se informó.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Mostrar solo el saldo final.',
          'Mezclar plata personal de quien adelantó una compra con la caja de la junta, sin reembolso registrado.',
          'Rendirse con capturas de chat y sin fecha.',
          'Aprobar la cuenta en el acta sin que nadie haya visto el detalle.',
        ],
        paragraphs: ['El saldo solo no explica una pérdida ni un proyecto pagado a medias.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Por movimiento: fecha, tipo, descripción, monto y respaldo. Por período: total de ingresos, total de egresos, comisiones y variación. Guarda el archivo que se mostró, no solo el que se rehízo después.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'La {/tesoreria-junta-de-vecinos|tesorería de JuntAPP} calcula el mes: ingresos brutos, gastos y comisiones, y variación. La directiva puede subir el PDF o la imagen del respaldo. Eso ordena la carpeta. No redacta solo el balance anual ni el formulario de un fondo público.',
        ],
      },
    ],
    faqs: [
      { question: '¿Cada mes hay que rendir ante la municipalidad?', answer: 'La guía de la BCN habla de un balance anual y de una cuenta bancaria a nombre de la junta. Un municipio o un fondo pueden pedir informes adicionales. Revísalo en la convocatoria de ese fondo.' },
      { question: '¿Sirve una planilla sin firmas?', answer: 'Sirve para cuadrar. La constancia de que la asamblea recibió la cuenta queda en el acta, no en la planilla.' },
    ],
    sources: [BCN_JUNTAS, MANUAL_VILLARRICA, LEY_CHILE_19418],
    cta: product('/tesoreria-junta-de-vecinos', 'Ordenar la tesorería', 'guia-rendicion'),
    related: [
      { href: '/recursos/acta-junta-de-vecinos', label: 'Acta', description: 'Dónde queda escrito que la cuenta se presentó.' },
      { href: '/recursos/transparencia-junta-de-vecinos', label: 'Transparencia', description: 'Qué mostrar al socio y qué no publicar.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/acta-junta-de-vecinos',
    kind: 'guide',
    keyword: 'acta de junta de vecinos',
    intent: 'informacional',
    title: 'Acta de una junta de vecinos',
    description: 'Qué dejar por escrito en el acta de una junta de vecinos después de una asamblea, y cómo archivarla sin perder el acuerdo.',
    h1: 'Cómo hacer el acta de una junta de vecinos',
    plaque: 'JUNTAPP · ACTAS',
    kicker: 'Guía',
    answer: 'El acta es el relato fechado de qué se reunió, quiénes estaban en condiciones de acordar y qué se decidió. La guía de la BCN recuerda que, al constituir la junta, la copia del acta se entrega a la secretaría municipal y con eso la organización goza de personalidad jurídica. En la vida diaria, el acta evita que un acuerdo exista solo en el recuerdo de quien dirigió la mesa.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'No hay en esta guía un formulario único nacional para todas las actas ordinarias. Los estatutos y la municipalidad pueden pedir menciones propias. Sí hay actos en los que el acta no es opcional: la constitución y la elección son dos de ellos, según la guía de la BCN.',
          'Un aviso de WhatsApp no es un acta. Tampoco lo es la minuta si nadie la identifica como el registro de esa sesión.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Secretaría toma nota durante la sesión o justo después, mientras los acuerdos están frescos. Se lee o se circula la versión que quedará. Se guarda junto con la citación y la asistencia. Tesorería necesita la parte en que se aprobó un gasto o una cuota.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Encabeza con el nombre de la junta, la fecha, el lugar y si la asamblea es ordinaria o extraordinaria.',
          'Indica quién preside y quién actúa como secretario de acta.',
          'Deja constancia de la citación y del quórum que exigen tus estatutos. No copies un quórum de otra comuna.',
          'Resume cada materia en el orden en que se trató. El acuerdo va en una frase verificable.',
          'Si hay elección o constitución, sigue el listado de documentos que la municipalidad pide, no solo este esquema.',
          'Archiva el archivo definitivo. Si corriges después, conserva la versión anterior o deja la corrección fechada.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Escribir opiniones y no el acuerdo.',
          'Olvidar la fecha o el carácter de la asamblea.',
          'Aprobar una cuota extraordinaria sin decir monto y destino.',
          'Tener el acta solo en el computador de una persona.',
        ],
        paragraphs: ['Un acta breve y concreta sirve más que tres páginas de discurso.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Fecha, tipo de asamblea, asistencia o quórum según estatutos, tabla, acuerdos literales, responsables y documentos adjuntos. Para una elección, la BCN agrega el acta de la elección, el registro de socios, el registro de quiénes votaron, el acta de la comisión electoral y los certificados de antecedentes de los electos.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'JuntAPP no redacta el acta. En {/tesoreria-junta-de-vecinos|tesorería} la directiva puede guardar el PDF junto con la rendición. En {/comunicaciones-junta-de-vecinos|comunicaciones} puede avisar que el acta quedó disponible para los socios. El texto oficial sigue siendo el archivo que secretaría reconoce como acta.',
        ],
      },
    ],
    faqs: [
      { question: '¿El acta tiene que ir a la municipalidad siempre?', answer: 'La guía de la BCN lo exige para la constitución, dentro de 30 días, y describe los documentos de una elección que la comisión entrega en cinco días. Una asamblea ordinaria se archiva según estatutos y la práctica de tu municipio.' },
      { question: '¿Puedo firmar el acta solo con un mensaje de chat?', answer: 'Esta guía no convierte un chat en firma. Si tus estatutos o el municipio piden firma, usa ese soporte.' },
    ],
    sources: [BCN_JUNTAS, LEY_CHILE_19418],
    cta: product('/registro', 'Guardar los documentos de la junta', 'guia-acta'),
    related: [
      { href: '/recursos/asamblea-junta-de-vecinos', label: 'Asamblea', description: 'La reunión que el acta tiene que poder reconstruir.' },
      { href: '/recursos/elecciones-junta-de-vecinos', label: 'Elecciones', description: 'El expediente que no se resume en un párrafo.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/asamblea-junta-de-vecinos',
    kind: 'guide',
    keyword: 'asamblea de junta de vecinos',
    intent: 'informacional',
    title: 'Asamblea de una junta de vecinos',
    description: 'Diferencia entre asamblea ordinaria y extraordinaria de una junta de vecinos, cómo citarla y qué materias no deberían mezclarse.',
    h1: 'Asamblea de una junta de vecinos',
    plaque: 'JUNTAPP · ASAMBLEAS',
    kicker: 'Guía',
    answer: 'La asamblea es el órgano donde los socios deciden. Al crear la junta, en esa reunión se aprueban los estatutos y un directorio provisional, ante el ministro de fe que indica la guía de la BCN. Después, los estatutos definen la frecuencia de las ordinarias. Hay materias que el texto legal reserva a asamblea extraordinaria, entre ellas la reforma de estatutos, los bienes raíces y las cuotas extraordinarias.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'Ordinaria no significa “informal”. Significa la sesión prevista para informar la gestión, la cuenta y las materias que los estatutos y la ley dejan en ese espacio. Extraordinaria significa una sesión para materias que la ley enumera o que la necesidad de la organización exige tratar con esa formalidad.',
          'El manual de la Municipalidad de Villarrica resume materias ordinarias —informes, rendición, cuenta anual, proyectos y cuotas— citando el artículo 17. Úsalo como orientación municipal y contrástalo con tus estatutos y con Ley Chile.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Se cita con la anticipación y el medio que dicen los estatutos. Se verifica el quórum que la propia junta fijó, dentro del mínimo legal. Se trata la tabla. Se acuerda. Se acta. Cambiar el orden o agregar una materia sensible al final, sin haberla citado, es la forma más común de invalidar la confianza, aunque el papel parezca completo.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Escribe la tabla antes de citar. Separa lo informativo de lo que exige extraordinaria.',
          'Cita por el medio que exigen los estatutos. Un aviso en la plataforma puede sumar, no sustituir esa regla.',
          'Prepara asistencia, rendición y textos que se van a votar.',
          'Al empezar, recuerda el quórum de tus estatutos. No importes el de otra junta.',
          'Conduce materia por materia y cierra cada acuerdo en una frase.',
          'Encarga el acta el mismo día.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Citar “asamblea” sin decir si es ordinaria o extraordinaria.',
          'Aprobar una cuota extraordinaria en una reunión que no fue citada para eso.',
          'Contar como quórum a vecinos que no son socios.',
          'Cerrar la reunión sin repetir los acuerdos.',
        ],
        paragraphs: ['La citación clara evita la impugnación casera, que es la que más desgasta a una directiva.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Tabla enviada, fecha de la citación, medio, asistencia de socios, quórum aplicado, acuerdos y encargados. Guarda la citación junto con el acta. Si usas un aviso digital, conserva la fecha de publicación.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'JuntAPP puede publicar un aviso de categoría asamblea y abrir una {/consultas-votaciones-junta-de-vecinos|consulta} para una pregunta acotada. Ni el aviso ni la consulta son la asamblea. El acuerdo queda en el acta. La consulta no sustituye una elección de directiva.',
        ],
      },
    ],
    faqs: [
      { question: '¿Con cuántos socios se sesiona?', answer: 'El mínimo depende de la ley y de los estatutos de esa junta. No hay un número único que esta guía pueda aplicar a todas las comunas. Revisa el tuyo antes de citar.' },
      { question: '¿Se puede participar a distancia?', answer: 'Solo si tus estatutos y la normativa aplicable lo permiten. Un voto en una consulta de JuntAPP no equivale, por sí solo, a presencia en asamblea.' },
    ],
    sources: [BCN_JUNTAS, LEY_CHILE_19418, MANUAL_VILLARRICA],
    cta: product('/comunicaciones-junta-de-vecinos', 'Avisar a la junta', 'guia-asamblea'),
    related: [
      { href: '/recursos/acta-junta-de-vecinos', label: 'Acta', description: 'Lo que tiene que quedar después de sesionar.' },
      { href: '/recursos/como-cobrar-cuotas-junta-de-vecinos', label: 'Cuotas', description: 'Qué asamblea corresponde según el tipo de cuota.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/elecciones-junta-de-vecinos',
    kind: 'guide',
    keyword: 'elecciones de junta de vecinos',
    intent: 'informacional',
    title: 'Elecciones de una junta de vecinos',
    description: 'Qué informa la guía de la BCN sobre la elección de directiva de una junta de vecinos: voto, duración del cargo y documentos que se entregan al municipio.',
    h1: 'Elecciones de una junta de vecinos',
    plaque: 'JUNTAPP · ELECCIONES',
    kicker: 'Guía',
    answer: 'La directiva se elige por votación directa y secreta. La guía de la Biblioteca del Congreso Nacional dice que el directorio dura tres años, puede ser reelegido y tiene suplentes. La comisión electoral debe entregar a la municipalidad, en cinco días, el acta de la elección, el registro de socios actualizado, el registro de quienes votaron, el acta de instalación de la comisión y los certificados de antecedentes de las personas electas. Esa regla rige desde el 28 de agosto de 2019.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'Elegir directiva no es hacer una encuesta. Es un acto con padrón, comisión y expediente. La guía de la BCN exige un directorio de al menos tres integrantes mayores de 18 años, con presidencia, secretaría y tesorería. Los otros cargos los definen los estatutos.',
          'JuntAPP no organiza este acto. Conviene no llamar “elección” a una consulta interna.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Se convoca según los estatutos. La comisión electoral conduce el proceso y después informa al municipio con los cinco documentos de la guía. El registro de socios tiene que estar actualizado antes, no la noche anterior sin revisión.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Revisa la fecha de término del directorio y los estatutos de elección.',
          'Actualiza el registro: altas, bajas y dirección.',
          'Deja constituida la comisión electoral como indiquen los estatutos y la ley. No inventes aquí el número de integrantes.',
          'Informa a los socios la fecha, el lugar y la forma de voto secreto.',
          'Levanta el acta de la elección y la nómina de quiénes votaron.',
          'Entrega el expediente a la municipalidad dentro del plazo de cinco días que señala la guía de la BCN.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Votar con un padrón distinto del que secretaría reconoce.',
          'Permitir que vote quien no es socio.',
          'Elegir a alguien que no cumple la edad o la antigüedad que exigen la ley y los estatutos.',
          'Guardar el acta solo en un celular.',
        ],
        paragraphs: ['El certificado de antecedentes de los electos forma parte del paquete. No lo dejes para después del plazo.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Padrón usado, fecha de corte, nómina de votantes, resultado por cargo, acta de la comisión y fecha de entrega municipal. Esos datos no se publican con RUT en la página de la junta.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'El {/libro-socios-digital|padrón de JuntAPP} ayuda a llegar a la elección con nombres y direcciones ordenados. Las {/consultas-votaciones-junta-de-vecinos|consultas} no son esta votación. Después de electa la directiva, presidencia puede asignar en el sistema los cargos de secretario, tesorero y dirigente que el producto permite.'],
      },
    ],
    faqs: [
      { question: '¿Cuánto dura el cargo?', answer: 'Tres años, con posibilidad de reelección, según la guía fácil de la BCN. Los estatutos no pueden ignorar ese marco.' },
      { question: '¿JuntAPP cuenta los votos de la elección?', answer: 'No. No es el padrón electoral ni la urna de la comisión.' },
    ],
    sources: [BCN_JUNTAS, LEY_CHILE_19418],
    cta: product('/gestion-socios-junta-de-vecinos', 'Ordenar el padrón antes de elegir', 'guia-elecciones'),
    related: [
      { href: '/recursos/directiva-junta-de-vecinos', label: 'Directiva', description: 'Los cargos mínimos que salen de esa elección.' },
      { href: '/recursos/como-llevar-registro-socios-junta-de-vecinos', label: 'Registro de socios', description: 'El documento que la comisión tiene que entregar actualizado.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/directiva-junta-de-vecinos',
    kind: 'guide',
    keyword: 'directiva de una junta de vecinos',
    intent: 'informacional',
    title: 'Directiva de una junta de vecinos',
    description: 'Qué cargos mínimos tiene la directiva de una junta de vecinos según la guía de la BCN, y cómo se reparten en la práctica secretaría y tesorería.',
    h1: 'Directiva de una junta de vecinos',
    plaque: 'JUNTAPP · DIRECTIVA',
    kicker: 'Guía',
    answer: 'La junta se organiza según sus estatutos, pero la guía de la BCN exige un directorio de al menos tres miembros: presidencia, tesorería y secretaría. Deben ser mayores de 18 años, elegidos por votación directa y secreta, por tres años, con suplentes y posibilidad de reelección. Las tareas finas de cada cargo se precisan en los estatutos; un manual municipal no reemplaza ese texto.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'Directiva y directorio se usan a veces como sinónimos en la conversación vecinal. La guía oficial habla de directorio encabezado por un presidente, con secretario y tesorero. Otros cargos existen si los estatutos los crean.',
          'Colaborar no es lo mismo que ocupar el cargo. Quien firma, cita o rinde debería ser quien fue electo para eso, salvo el reemplazo que los estatutos prevean.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Presidencia conduce y representa en los márgenes que fijan la ley y los estatutos. Secretaría cuida actas, citaciones y el registro de socios. Tesorería cuida la caja, los respaldos y la cuenta que se presenta a la asamblea. El manual de Villarrica describe tareas habituales del tesorero —cobrar, llevar contabilidad y archivar comprobantes— como orientación práctica, no como artículo que esta página pueda citar de memoria.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Lee el artículo de tus estatutos sobre el directorio antes de repartir el trabajo.',
          'Deja por escrito quién ocupa presidencia, secretaría y tesorería.',
          'Entrega a tesorería los accesos de la cuenta bancaria de la junta, no una cuenta personal.',
          'Entrega a secretaría el registro y las actas anteriores.',
          'Acuerden qué decisiones puede tomar la mesa y cuáles vuelven a asamblea.',
          'Cuando cambie un cargo, actualiza el padrón interno y el aviso a socios.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Concentrar acta, caja y claves en una sola persona.',
          'Usar la cuenta personal de tesorería “por mientras”.',
          'Nombrar cargos que los estatutos no tienen y tratarlos como si fueran legales.',
          'No avisar al municipio cuando corresponde informar un cambio de directorio.',
        ],
        paragraphs: ['La guía de la BCN insiste en la cuenta bancaria a nombre de la junta. Esa separación protege a quien administra.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Nombre del cargo, persona, fecha de elección, fecha de término y suplente si existe. En el trabajo diario: quién puede inscribir socios, quién publica avisos y quién registra egresos. Esos permisos no deberían compartirse por comodidad.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'En el padrón de JuntAPP, presidencia asigna secretario, tesorero o dirigente. Esos cargos son únicos y la presidencia no se traspasa desde esa pantalla. Secretaría revisa las solicitudes para comprobar requisitos, no para seleccionar vecinos. El vecino ve el contacto de la directiva, no el padrón completo. El detalle está en {/gestion-socios-junta-de-vecinos|gestión de socios}.',
        ],
      },
    ],
    faqs: [
      { question: '¿Puede haber más de tres dirigentes?', answer: 'La guía de la BCN fija un mínimo de tres, con los tres cargos nombrados. Los estatutos pueden crear otros. No pueden dejar la junta sin presidente, secretario y tesorero.' },
      { question: '¿El tesorero de JuntAPP es el tesorero legal?', answer: 'Solo si esa persona fue electa o designada como dicen los estatutos. El cargo en el software no crea el cargo legal.' },
    ],
    sources: [BCN_JUNTAS, LEY_CHILE_19418, MANUAL_VILLARRICA],
    cta: product('/gestion-socios-junta-de-vecinos', 'Asignar los cargos en el padrón', 'guia-directiva'),
    related: [
      { href: '/recursos/elecciones-junta-de-vecinos', label: 'Elecciones', description: 'Cómo se llega a ocupar esos cargos.' },
      { href: '/recursos/rendicion-cuentas-junta-de-vecinos', label: 'Rendición', description: 'La cuenta que tesorería tiene que poder explicar.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/ley-19418-juntas-de-vecinos',
    kind: 'guide',
    keyword: 'Ley 19.418 juntas de vecinos',
    intent: 'informacional',
    title: 'Ley 19.418 y las juntas de vecinos',
    description: 'Lectura práctica de la Ley 19.418 para una directiva: qué es una junta de vecinos, cómo se constituye y qué marcos de cuotas, directiva y elecciones publica la BCN.',
    h1: 'Ley 19.418: qué necesita saber una junta de vecinos',
    plaque: 'JUNTAPP · LEY 19.418',
    kicker: 'Guía',
    answer: 'La Ley 19.418 regula las juntas de vecinos y las demás organizaciones comunitarias. Su texto refundido está en el Decreto 58, publicado en Ley Chile. La guía fácil de la Biblioteca del Congreso Nacional la resume para la ciudadanía: la junta promueve la integración y el desarrollo de los vecinos, se constituye con un mínimo de vecinos según el tamaño de la comuna y adquiere personalidad jurídica al depositar el acta en la secretaría municipal.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'Una junta de vecinos es territorial: representa a quienes residen en una unidad vecinal. No es un condominio ni una empresa. La guía de la BCN indica los mínimos para constituirla: 50 vecinos en comunas de hasta 10 mil habitantes, 100 hasta 30 mil, 150 hasta 100 mil y 200 si la comuna supera esa cifra. La asamblea constitutiva se hace ante un funcionario municipal designado por el alcalde, un notario o un oficial del Registro Civil.',
          'Esta página no comenta proyectos de ley ni sostiene que un software “cumpla la ley”. Cita la guía oficial y el texto refundido para las piezas que una directiva pregunta seguido.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Después de constituida, la vida de la junta sigue los estatutos dentro de la ley: socios, asambleas, directorio, patrimonio y disolución. SUBDERE conserva documentación de la ley. Para leer el artículo vigente, la fuente es Ley Chile, no un resumen de memoria.',
          'La guía de la BCN agrega dos obligaciones materiales que las directivas olvidan: cuenta bancaria a nombre de la junta y balance anual.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Si la junta todavía no existe, confirma el tramo de habitantes y el número mínimo de vecinos con la guía de la BCN o con tu municipio.',
          'Prepara estatutos. Deben incluir, entre otras materias, la administración del patrimonio y la forma de fijar cuotas.',
          'Realiza la asamblea constitutiva ante el ministro de fe que corresponde.',
          'Entrega la copia del acta en la secretaría municipal dentro de 30 días.',
          'Abre la cuenta a nombre de la organización y elige después el directorio definitivo en el plazo y la forma que indiquen la ley y los estatutos.',
          'Para el día a día, vuelve a las guías de socios, cuotas, asamblea y elección. Cada una cita su fuente.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Copiar estatutos de otra comuna sin leer el mínimo de socios ni el quórum.',
          'Tratar la Ley 21.442 de copropiedad como si rigiera a la junta.',
          'Creer que un grupo de WhatsApp ya es personalidad jurídica.',
          'Usar una cuenta personal mientras “sale el RUT de la junta”.',
        ],
        paragraphs: ['La personalidad jurídica llega con el depósito del acta, no con el logo ni con la página web.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Número y fecha del acta de constitución, fecha de ingreso a la secretaría municipal, RUT de la organización si ya lo tiene, banco y número de cuenta a su nombre, estatutos vigentes y fecha de la última elección. Esos datos identifican a la junta. No hace falta publicarlos todos en la portada.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'JuntAPP ordena padrón, cuotas, caja, avisos y consultas para una junta que ya existe. No constituye la personalidad jurídica, no protocoliza estatutos y no presenta el balance ante el municipio. Si buscas la herramienta, parte por {/software-juntas-de-vecinos|el software para juntas de vecinos}. Si buscas el marco, quédate en Ley Chile.',
        ],
      },
    ],
    faqs: [
      { question: '¿Dónde leo el texto vigente?', answer: 'En Ley Chile, Decreto 58, idNorma 70040. La guía fácil de la BCN sirve para orientarse. Si ambas parecen decir cosas distintas, manda el texto de la ley y la fecha de la versión.' },
      { question: '¿JuntAPP está certificado por SUBDERE?', answer: 'No. SUBDERE publica información de la ley. JuntAPP es un software privado desarrollado por PuroCode.' },
    ],
    sources: LEGAL_SOURCES,
    cta: product('/software-juntas-de-vecinos', 'Conocer el software', 'guia-ley'),
    related: [
      { href: '/recursos/directiva-junta-de-vecinos', label: 'Directiva', description: 'El mínimo de tres cargos.' },
      { href: '/recursos/como-cobrar-cuotas-junta-de-vecinos', label: 'Cuotas', description: 'Ordinaria, extraordinaria y el quórum de la segunda.' },
      { href: '/recursos/elecciones-junta-de-vecinos', label: 'Elecciones', description: 'El expediente de cinco días.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/transparencia-junta-de-vecinos',
    kind: 'guide',
    keyword: 'transparencia junta de vecinos',
    intent: 'informacional',
    title: 'Transparencia en una junta de vecinos',
    description: 'Qué puede mostrar una junta de vecinos a sus socios y qué datos del padrón no deberían quedar publicados en internet.',
    h1: 'Transparencia en una junta de vecinos',
    plaque: 'JUNTAPP · TRANSPARENCIA',
    kicker: 'Guía',
    answer: 'Transparencia, para una junta de vecinos, es que el socio pueda entender la cuenta y los acuerdos. No es publicar el padrón, los teléfonos ni los RUT. La guía de la BCN pide balance anual y una cuenta bancaria de la organización. El detalle de quién pagó la cuota se informa a quien corresponde, dentro de la junta.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'No existe en esta guía un portal único nacional donde todas las juntas suban sus gastos, como sí ocurre con los órganos públicos sujetos a la Ley de Transparencia. Confundir ambas cosas lleva a publicar datos de vecinos “para que se vea”. La rendición se muestra a los socios y se archiva. Otra cosa es el dato personal.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Una práctica sana tiene tres capas. La asamblea escucha la cuenta. El socio puede pedir el respaldo de un gasto. Internet recibe solo lo que la junta quiere que vea un desconocido: actividades, sede, horario, no la nómina.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Define qué documento se presenta en asamblea y con qué periodicidad.',
          'Guarda comprobantes junto con el movimiento, no en un chat que se borra.',
          'Entrega a cada socio el estado de pago que le corresponda, no la nómina completa del pasaje.',
          'Si publicas una página, revisa que no lleve RUT, teléfonos privados ni deudas con nombre.',
          'Cuando termine el período, archiva la versión que se rindió.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Subir la planilla completa a Facebook.',
          'Nombrar en un aviso a quien está moroso.',
          'Decir “estamos al día” sin mostrar ingresos y egresos.',
          'Borrar el historial cuando cambia la directiva.',
        ],
        paragraphs: ['La vergüenza pública no es un sistema de cobro. Además expone datos.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Movimientos con respaldo, acta en que la cuenta se presentó y la lista de qué archivos son internos. En la página pública: qué hace la junta, cómo participar y un contacto que la directiva controle.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          'Dentro de JuntAPP, la directiva ve la caja y el estado de cuota; el vecino ve su ficha. El repositorio de {/tesoreria-junta-de-vecinos|tesorería} guarda PDF e imágenes para ese círculo, no para el buscador. La página pública es otro módulo y no debería copiar el padrón.',
        ],
      },
    ],
    faqs: [
      { question: '¿Tengo que subir la rendición a internet?', answer: 'No por esta ley de juntas, en los términos que resume la guía de la BCN. Sí debes poder presentarla a los socios y cumplir el balance anual. Un fondo concursable puede exigir su propia publicación.' },
      { question: '¿El estado “al día” de mi vecino es público?', answer: 'No debería serlo. En JuntAPP la directiva lo ve en el padrón. El vecino ve el suyo.' },
    ],
    sources: [BCN_JUNTAS],
    cta: product('/tesoreria-junta-de-vecinos', 'Dejar la caja a la vista de la junta', 'guia-transparencia'),
    related: [
      { href: '/recursos/rendicion-cuentas-junta-de-vecinos', label: 'Rendición de cuentas', description: 'El contenido de lo que se muestra.' },
      { href: '/software-juntas-de-vecinos', label: 'Página pública y gestión', description: 'Por qué no son el mismo sitio.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
  {
    path: '/recursos/digitalizar-junta-de-vecinos',
    kind: 'guide',
    keyword: 'digitalizar una junta de vecinos',
    intent: 'MOFU',
    title: 'Cómo digitalizar una junta de vecinos',
    description: 'Por dónde empezar a digitalizar una junta de vecinos en Chile: padrón, cuotas y avisos, sin botar el archivo físico ni abrir una web vacía.',
    h1: 'Cómo digitalizar una junta de vecinos',
    plaque: 'JUNTAPP · DIGITALIZACIÓN',
    kicker: 'Guía',
    answer: 'Digitalizar una junta de vecinos es pasar a un registro compartido las tareas que hoy dependen de un cuaderno o de una persona. El orden que menos fracasa es padrón, luego cuotas y caja, después avisos. La página pública viene cuando hay algo que contar. No hace falta una web por comuna ni escanear diez años de papeles el primer día.',
    sections: [
      {
        heading: 'Qué significa y qué exige',
        paragraphs: [
          'No hay un trámite llamado “digitalización” en la guía de la BCN. La junta sigue debiendo lo mismo: socios reales, actas, cuenta y, cuando corresponda, elección. Lo digital es el soporte. Si el soporte nuevo está vacío o tiene datos inventados, la junta queda peor que con el cuaderno.',
        ],
      },
      {
        heading: 'Cómo funciona',
        paragraphs: [
          'Se elige un sistema, se cargan las personas que sí son socias y se registra desde una fecha de corte. Lo anterior puede quedar en PDF. A partir del corte, nadie anota un pago solo en papel. Esa disciplina importa más que la marca del software.',
        ],
      },
      {
        heading: 'Paso a paso',
        steps: [
          'Junta los estatutos, el último padrón y la última rendición.',
          'Acuerda una fecha de corte con tesorería y secretaría.',
          'Carga socios con nombre, RUT y dirección. No completes RUT de memoria.',
          'Empieza las cuotas del período siguiente en el sistema.',
          'Publica los avisos nuevos en el canal digital y mantén, si los estatutos lo piden, el medio físico.',
          'Recién entonces escribe la página pública, con textos de esa junta.',
        ],
      },
      {
        heading: 'Errores frecuentes',
        bullets: [
          'Partir por el logo y la página, sin padrón.',
          'Mantener la planilla y el sistema a la vez, sin decir cuál manda.',
          'Dar la clave de tesorería a toda la directiva.',
          'Escanear y subir cédulas de identidad a una carpeta compartida.',
        ],
        paragraphs: ['Digitalizar no es fotografiar el desorden. Es dejar de duplicarlo.'],
      },
      {
        heading: 'Qué información conviene registrar',
        paragraphs: ['Desde el corte: altas, bajas, cuotas del período, ingresos, egresos y avisos. Antes del corte: un PDF de la última nómina y de la última cuenta, guardado como archivo histórico, no reescrito.'],
      },
      {
        heading: 'Cómo puede ayudar una plataforma digital',
        paragraphs: [
          '{/software-juntas-de-vecinos|JuntAPP} está hecho para ese recorrido: padrón, cuota por domicilio, libro de caja, comunicados y consultas. Los planes con página agregan el sitio de la junta. No importa el Excel de años anteriores ni certifica el cumplimiento legal. Si la duda todavía es normativa, lee primero {/recursos/ley-19418-juntas-de-vecinos|la guía de la Ley 19.418}.',
        ],
      },
    ],
    faqs: [
      { question: '¿Hay que dejar el libro de papel?', answer: 'No el primer día, y no si tus estatutos lo exigen. Puedes conservar el soporte formal y usar el sistema como registro de trabajo desde la fecha de corte.' },
      { question: '¿Conviene una página por cada sede o población?', answer: 'No como estrategia de posicionamiento. Una junta, un sitio con contenido propio. Las páginas vacías no ayudan al vecino ni al buscador.' },
    ],
    sources: [BCN_JUNTAS],
    cta: product('/software-juntas-de-vecinos', 'Digitalizar mi junta', 'guia-digitalizar'),
    secondaryCta: { href: '/pricing', label: 'Ver planes', event: SEO_EVENTS.pricing, section: 'guia-digitalizar' },
    related: [
      { href: '/recursos/como-llevar-registro-socios-junta-de-vecinos', label: 'Registro de socios', description: 'El primer archivo que conviene ordenar.' },
      { href: '/cuotas-junta-de-vecinos', label: 'Cuotas', description: 'El segundo, para no duplicar la caja.' },
    ],
    breadcrumbs: [{ name: 'Recursos', path: '/recursos' }],
    schema: 'article',
  },
];

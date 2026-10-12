// Fictitious local data shared by the BEFORE and AFTER browser runs.
export const sessionSecret = 'ux-ui-v2-local-fixture-secret-not-for-production';
export const announcements = [
  { id: 91, category: 'urgente', title: 'Corte programado de agua', content: 'El jueves entre las 10:00 y las 14:00 habrá un corte de agua en el sector norte. Guarda agua con anticipación y comparte este aviso con tus vecinos.', date: '2026-10-11', author: 'Directiva de prueba' },
  { id: 92, category: 'asamblea', title: 'Conversemos sobre nuestra plaza', content: 'La próxima asamblea será el 24 de octubre a las 18:30 en la sede comunitaria. Revisaremos las propuestas para recuperar los espacios comunes.', date: '2026-10-10', author: 'Secretaría de prueba' },
  { id: 93, category: 'beneficio', title: 'Taller de huerto para todas las edades', content: 'Inscripciones abiertas en la sede para el taller comunitario de huerto. No necesitas experiencia previa.', date: '2026-10-09', author: 'Directiva de prueba' },
  { id: 94, category: 'general', title: 'Rendición de septiembre disponible', content: 'Ya puedes consultar los ingresos y gastos del mes en Tesorería. Gracias por aportar al cuidado de nuestro barrio.', date: '2026-10-08', author: 'Tesorería de prueba' },
].map(x => ({ ...x, junta_id: '11111111-1111-4111-8111-111111111111', created_at: `${x.date}T12:00:00Z` }));
export const polls = [
  { id: 'poll-fixture', junta_id: announcements[0].junta_id, active: true, title: '¿Qué mejoramos primero en la plaza?', description: 'Queremos elegir juntos la primera mejora del espacio que compartimos. Selecciona la propuesta que consideras más necesaria.', options: [{ id: 'option-a', text: 'Iluminación y seguridad' }, { id: 'option-b', text: 'Juegos infantiles' }, { id: 'option-c', text: 'Áreas verdes y bancos' }], created_at: '2026-10-08T12:00:00Z' },
  { id: 'poll-fixture-2', junta_id: announcements[0].junta_id, active: true, title: '¿Qué actividad organizamos en noviembre?', description: 'Elige la actividad comunitaria que te gustaría ver en la próxima jornada del barrio.', options: [{ id: 'option-d', text: 'Feria de intercambio' }, { id: 'option-e', text: 'Taller de reciclaje' }], created_at: '2026-10-09T12:00:00Z' },
];
export const proposals = [{ id: 'proposal-fixture', junta_id: announcements[0].junta_id, proposed_by: '22222222-2222-4222-8222-222222222222', title: 'Una feria de intercambio en el barrio', description: 'Propongo organizar una feria para intercambiar libros y plantas en la sede.', options: [{ id: 'p1', text: 'Sí' }, { id: 'p2', text: 'Más adelante' }], status: 'pending', created_at: '2026-10-10T12:00:00Z' }];
export const transactions = [
  { id: 301, type: 'ingreso', description: 'Cuotas sociales · octubre', amount: 180000, source: 'mercadopago', accounting_kind: 'income', category: 'cuota_social', fee_amount: 6500, net_amount: 173500, verification_status: 'provider_confirmed', is_immutable: true },
  { id: 302, type: 'egreso', description: 'Reparación de luminarias de la sede', amount: 42000, source: 'manual', accounting_kind: 'expense', category: 'otros', fee_amount: 0, net_amount: -42000, verification_status: 'manual' },
  { id: 303, type: 'ingreso', description: 'Aporte feria comunitaria', amount: 35000, source: 'manual', accounting_kind: 'income', category: 'otros', fee_amount: 0, net_amount: 35000, verification_status: 'manual' },
].map(x => ({ ...x, junta_id: announcements[0].junta_id, gross_amount: x.amount, date: '2026-10-10', created_at: '2026-10-10T12:00:00Z' }));
export const monthly = [
  { month_start: '2026-07-01', income: 180000, expenses: 80000, fees: 6000, balance: 100000, movement_count: 25 },
  { month_start: '2026-08-01', income: 210000, expenses: 98000, fees: 6200, balance: 112000, movement_count: 31 },
  { month_start: '2026-09-01', income: 190000, expenses: 150000, fees: 5900, balance: 40000, movement_count: 28 },
  { month_start: '2026-10-01', income: 215000, expenses: 48500, fees: 6500, balance: 166500, movement_count: 3 },
];
export const summary = { income: 215000, expenses: 48500, fees: 6500, balance: 166500 };
export const website = { junta_id: announcements[0].junta_id, template: 'comunidad', published: true, content: { title: 'Un barrio que crece contigo', subtitle: 'La comunidad de prueba comparte, participa y cuida sus espacios.', about: 'Somos una comunidad que trabaja unida por un barrio más cercano y seguro.', newsItems: [] }, theme: { primary: '#071b34', accent: '#f97316', background: '#fffaf0', text: '#172033' }, gallery: [] };

/* ==========================================================================
   JuntAPP Database Layer (Dual Mode: Supabase Cloud & Local Storage Fallback)
   ========================================================================== */

import { createClient } from '@supabase/supabase-js';

// Try loading environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient = null;
let isCloudActive = false;

console.log("🔍 debug - VITE_SUPABASE_URL:", supabaseUrl ? (supabaseUrl.startsWith("http") ? `Valid HTTP format (starts with ${supabaseUrl.substring(0, 15)}...)` : `INVALID format (starts with: ${supabaseUrl.substring(0, 15)}...)`) : "undefined/empty");
console.log("🔍 debug - VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? `Starts with: ${supabaseAnonKey.substring(0, 15)}...` : "undefined/empty");

if (supabaseUrl && supabaseAnonKey) {
  try {
    if (!supabaseUrl.startsWith("http")) {
      throw new Error(`supabaseUrl must start with http:// or https://. Current value starts with: "${supabaseUrl.substring(0, 15)}..."`);
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    isCloudActive = true;
    console.log("☁️ JuntAPP connected to Supabase Cloud Database!");
  } catch (err) {
    console.error("❌ Failed to initialize Supabase client:", err);
  }
} else {
  console.warn("⚠️ VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined. Falling back to Local Storage Simulation Mode.");
}

// Mock Data Defaults for Local Mode
const DEFAULT_SOCIOS = [
  { id: 1, name: "María José Ramírez Valdés", rut: "14.341.203-K", address: "Pasaje Los Aromos 345", phone: "+56 9 8765 4321", email: "maria.ramirez@correo.cl", cuotaStatus: "al_dia", role: "vecino" },
  { id: 2, name: "Pedro Ignacio Soto Contreras", rut: "9.403.220-4", address: "Avenida Los Girasoles 120", phone: "+56 9 7654 3210", email: "pedro.soto@correo.cl", cuotaStatus: "al_dia", role: "vecino" },
  { id: 3, name: "Carmen Gloria Valenzuela Toro", rut: "11.583.190-2", address: "Pasaje Las Lilas 45", phone: "+56 9 6543 2109", email: "carmen.valenzuela@correo.cl", cuotaStatus: "al_dia", role: "vecino" },
  { id: 4, name: "Luis Humberto Muñoz Henríquez", rut: "8.122.904-7", address: "Calle Principal 1024", phone: "+56 9 5432 1098", email: "luis.munoz@correo.cl", cuotaStatus: "pendiente", role: "vecino" },
  { id: 5, name: "Silvia Elena Díaz Castro", rut: "13.294.551-3", address: "Pasaje Los Aromos 380", phone: "+56 9 4321 0987", email: "silvia.diaz@correo.cl", cuotaStatus: "al_dia", role: "vecino" },
  { id: 6, name: "Jorge Andrés Riquelme Sepúlveda", rut: "16.892.404-5", address: "Avenida Los Girasoles 210", phone: "+56 9 3210 9876", email: "jorge.riquelme@correo.cl", cuotaStatus: "pendiente", role: "vecino" },
  { id: 7, name: "Lucía del Carmen Gómez Parra", rut: "10.450.312-8", address: "Calle Principal 1150", phone: "+56 9 2109 8765", email: "lucia.gomez@correo.cl", cuotaStatus: "al_dia", role: "dirigente" }
];

const DEFAULT_TRANSACTIONS = [
  { id: 1, type: "ingreso", desc: "Subsidio Municipal FONDEVE 2025", amount: 300000, date: "2026-05-02" },
  { id: 2, type: "egreso", desc: "Compra de ampolletas LED para plaza", amount: 15000, date: "2026-05-05" },
  { id: 3, type: "egreso", desc: "Cerradura nueva y copias llaves sede social", amount: 25000, date: "2026-05-10" },
  { id: 4, type: "ingreso", desc: "Aporte extraordinario bingo municipal", amount: 120000, date: "2026-05-12" },
  { id: 5, type: "egreso", desc: "Servicio de limpieza y desmalezado de jardines", amount: 25000, date: "2026-05-20" },
  { id: 6, type: "ingreso", desc: "Recaudación cuotas sociales del mes", amount: 65500, date: "2026-05-25" }
];

const DEFAULT_POLLS = [
  {
    id: "poll-fondeve-2026",
    title: "Consulta: Prioridad de Inversión FONDEVE 2026",
    description: "Este año postularemos al Fondo de Desarrollo Vecinal municipal (FONDEVE). ¿Cuál de las siguientes propuestas considera más prioritaria para el financiamiento de este fondo?",
    active: true,
    options: [
      { id: "opt-1", text: "Cámaras de Seguridad Vecinal de alta definición", votes: 24 },
      { id: "opt-2", text: "Repavimentación de pasajes interiores agrietados", votes: 12 },
      { id: "opt-3", text: "Nuevas luminarias LED ornamentales para la plaza principal", votes: 18 }
    ],
    voted: false
  },
  {
    id: "past-1",
    title: "Presupuesto Participativo 2025",
    description: "Priorización de fondos sobrantes del bingo 2025.",
    active: false,
    winner: "Canchas infantiles pintadas (62% de votos)",
    totalVotes: 58,
    options: []
  },
  {
    id: "past-2",
    title: "Elección de Directiva Vecinal",
    description: "Renovación oficial de directiva para el periodo 2025-2027.",
    active: false,
    winner: "Lista A - Directiva 'Juntos por el Barrio' (74% de votos)",
    totalVotes: 89,
    options: []
  }
];

const DEFAULT_ANNOUNCEMENTS = [
  { id: 1, category: "urgente", title: "Corte de agua programado", date: "2026-05-28", author: "Directiva JuntAPP", content: "Estimados vecinos: Esval informa que se realizará un corte de agua programado para todo el sector de Villa Los Jardines mañana Jueves 28 de mayo entre las 14:00 y las 18:00 hrs. Esto debido a la reparación de una matriz principal en el pasaje Los Aromos. Rogamos juntar agua con anticipación." },
  { id: 2, category: "asamblea", title: "Reunión Ordinaria Mensual de Coordinación", date: "2026-05-25", author: "Directiva JuntAPP", content: "Citamos a todos los socios a nuestra asamblea mensual presencial en la Sede Comunitaria el día Sábado 14 de Junio a las 18:00 hrs. Tabla a tratar: Rendición financiera de Mayo, avance de postulación FONDEVE y organización del día del niño. ¡Su asistencia es vital para cumplir el quórum!" },
  { id: 3, category: "beneficio", title: "Taller Gratuito: Alfabetización Digital para Adultos Mayores", date: "2026-05-20", author: "Comisión Social", content: "Nos alegra informar que nos hemos adjudicado un taller municipal para enseñar el uso de smartphones, trámites de Comisaría Virtual, BancoEstado y JuntAPP. Las clases comienzan el Martes 2 de Junio a las 16:00 hrs en la sede. Inscripciones directamente con la secretaria Lucía Gómez." }
];

const DEFAULT_NOTIFICATIONS = [
  { id: 1, type: "asamblea", title: "Asamblea Ordinaria", message: "Recordatorio: Asamblea mensual presencial Sábado 14 de Junio a las 18:00 hrs en sede social.", read: false, date: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, type: "cuota", title: "Cobro de Cuota Pendiente", message: "Estimado Luis, tu cuota de Mayo ($5.000) está disponible para pago electrónico seguro.", read: false, date: new Date(Date.now() - 14400000).toISOString(), action: "pay-cuota", targetSocioId: 4 }
];

const DEFAULT_DOCUMENTS = [
  { name: "Acta_Constitucion_V2.pdf", size: 1245000, date: "2026-05-15", url: "#" },
  { name: "Cartola_Bancaria_Mayo_2026.pdf", size: 450000, date: "2026-05-26", url: "#" },
  { name: "Plan_Desarrollo_Barrial_FONDEVE.pdf", size: 3200000, date: "2026-05-27", url: "#" }
];

export const db = {
  // Initialization
  init() {
    if (!localStorage.getItem("juntapp_socios")) {
      localStorage.setItem("juntapp_socios", JSON.stringify(DEFAULT_SOCIOS));
    }
    if (!localStorage.getItem("juntapp_transactions")) {
      localStorage.setItem("juntapp_transactions", JSON.stringify(DEFAULT_TRANSACTIONS));
    }
    if (!localStorage.getItem("juntapp_polls")) {
      localStorage.setItem("juntapp_polls", JSON.stringify(DEFAULT_POLLS));
    }
    if (!localStorage.getItem("juntapp_announcements")) {
      localStorage.setItem("juntapp_announcements", JSON.stringify(DEFAULT_ANNOUNCEMENTS));
    }
    if (!localStorage.getItem("juntapp_notifications")) {
      localStorage.setItem("juntapp_notifications", JSON.stringify(DEFAULT_NOTIFICATIONS));
    }
    if (!localStorage.getItem("juntapp_documents")) {
      localStorage.setItem("juntapp_documents", JSON.stringify(DEFAULT_DOCUMENTS));
    }
    if (!localStorage.getItem("juntapp_votes")) {
      localStorage.setItem("juntapp_votes", JSON.stringify([]));
    }
    if (!localStorage.getItem("juntapp_theme")) {
      localStorage.setItem("juntapp_theme", "light");
    }
  },

  isCloud() {
    return isCloudActive;
  },

  getTheme() {
    return localStorage.getItem("juntapp_theme") || "light";
  },

  saveTheme(theme) {
    localStorage.setItem("juntapp_theme", theme);
  },

  // ------------------------------------------------------------------------
  // AUTHENTICATION MODULE
  // ------------------------------------------------------------------------

  async getCurrentUser() {
    if (isCloudActive) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return null;
      
      // Fetch details from public.profiles
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error("Error fetching user profile:", error);
        return {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || "Vecino Registrado",
          rut: user.user_metadata?.rut || "11.111.111-1",
          role: "vecino",
          cuota_status: "pendiente"
        };
      }
      return profile;
    } else {
      // Local Simulation Current User
      const user = localStorage.getItem("juntapp_current_user");
      return user ? JSON.parse(user) : null;
    }
  },

  async login(emailOrRut, password) {
    if (isCloudActive) {
      // If user inputs a RUT, try to resolve their email first
      let email = emailOrRut;
      if (!emailOrRut.includes("@")) {
        const cleanRut = emailOrRut.replace(/[^0-9kK]/g, '').toUpperCase();
        // Look up profile email
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('email')
          .eq('rut', cleanRut)
          .maybeSingle();
        if (data && data.email) {
          email = data.email;
        }
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      
      // Fetch and return profile
      return await this.getCurrentUser();
    } else {
      // Local simulation login
      const cleanInput = emailOrRut.trim().toLowerCase();
      const socios = JSON.parse(localStorage.getItem("juntapp_socios")) || [];
      
      // Admin bypass
      if (cleanInput === "admin@juntapp.cl" && password === "password123") {
        const adminUser = {
          id: "admin-uuid-12345",
          name: "Directiva JuntAPP Admin",
          rut: "10.450.312-8",
          address: "Sede Comunitaria 10",
          phone: "+56 9 9999 8888",
          email: "admin@juntapp.cl",
          role: "dirigente",
          cuota_status: "al_dia"
        };
        localStorage.setItem("juntapp_current_user", JSON.stringify(adminUser));
        return adminUser;
      }

      // Find partner matching email or RUT
      const cleanRut = emailOrRut.replace(/[^0-9kK]/g, '').toUpperCase();
      const socio = socios.find(s => s.email.toLowerCase() === cleanInput || s.rut.replace(/[^0-9kK]/g, '').toUpperCase() === cleanRut);
      
      if (socio && password === "password123") {
        const loggedUser = {
          id: socio.id.toString(),
          name: socio.name,
          rut: socio.rut,
          address: socio.address,
          phone: socio.phone,
          email: socio.email,
          role: socio.role || "vecino",
          cuota_status: socio.cuotaStatus
        };
        localStorage.setItem("juntapp_current_user", JSON.stringify(loggedUser));
        return loggedUser;
      }
      
      throw new Error("Credenciales inválidas. Para la demo usa password123.");
    }
  },

  async signUp(name, rut, address, phone, email, password) {
    const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    
    if (isCloudActive) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            rut: cleanRut,
            address,
            phone
          }
        }
      });
      if (error) throw error;
      return data.user;
    } else {
      // Local Storage Register
      const socios = JSON.parse(localStorage.getItem("juntapp_socios")) || [];
      
      // Check if email or RUT exists
      if (socios.some(s => s.email.toLowerCase() === email.toLowerCase() || s.rut.replace(/[^0-9kK]/g, '').toUpperCase() === cleanRut)) {
        throw new Error("El RUT o correo electrónico ya se encuentra registrado.");
      }

      const newSocio = {
        id: Date.now(),
        name,
        rut: cleanRut,
        address,
        phone,
        email,
        cuotaStatus: "pendiente",
        role: "vecino"
      };

      socios.push(newSocio);
      localStorage.setItem("juntapp_socios", JSON.stringify(socios));
      return newSocio;
    }
  },

  async logout() {
    if (isCloudActive) {
      await supabaseClient.auth.signOut();
    } else {
      localStorage.removeItem("juntapp_current_user");
    }
  },

  // ------------------------------------------------------------------------
  // SOCIOS / PADRÓN VECINAL
  // ------------------------------------------------------------------------

  async getSocios() {
    if (isCloudActive) {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      
      // Map cloud model to local model
      return data.map(p => ({
        id: p.id,
        name: p.name,
        rut: p.rut,
        address: p.address,
        phone: p.phone,
        email: p.email,
        cuotaStatus: p.cuota_status,
        role: p.role
      }));
    } else {
      return JSON.parse(localStorage.getItem("juntapp_socios")) || [];
    }
  },

  async addSocio(socio) {
    if (isCloudActive) {
      // Needs admin or auth signUp flow to trigger profiles.
      // Since it is an admin adding a socio manually, we can perform a direct insert.
      const { data, error } = await supabaseClient
        .from('profiles')
        .insert({
          id: crypto.randomUUID(), // Dirigente creating a mock/unauthenticated profile
          name: socio.name,
          rut: socio.rut.replace(/[^0-9kK]/g, '').toUpperCase(),
          address: socio.address,
          phone: socio.phone,
          email: socio.email,
          cuota_status: socio.cuotaStatus,
          role: 'vecino'
        });
      if (error) throw error;
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_socios")) || [];
      const newSocio = {
        id: Date.now(),
        ...socio,
        cuotaStatus: socio.cuotaStatus || "pendiente",
        role: "vecino"
      };
      list.push(newSocio);
      localStorage.setItem("juntapp_socios", JSON.stringify(list));
      return newSocio;
    }
  },

  async updateSocioStatus(socioId, newStatus) {
    if (isCloudActive) {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ cuota_status: newStatus })
        .eq('id', socioId);
      if (error) throw error;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_socios")) || [];
      const idx = list.findIndex(s => s.id.toString() === socioId.toString());
      if (idx !== -1) {
        list[idx].cuotaStatus = newStatus;
        localStorage.setItem("juntapp_socios", JSON.stringify(list));
      }
    }
  },

  async updateSocioContact(socioId, phone, email) {
    if (isCloudActive) {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ phone, email })
        .eq('id', socioId);
      if (error) throw error;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_socios")) || [];
      const idx = list.findIndex(s => s.id.toString() === socioId.toString());
      if (idx !== -1) {
        list[idx].phone = phone;
        list[idx].email = email;
        localStorage.setItem("juntapp_socios", JSON.stringify(list));
      }
      
      const user = localStorage.getItem("juntapp_current_user");
      if (user) {
        const parsed = JSON.parse(user);
        if (parsed.id.toString() === socioId.toString()) {
          parsed.phone = phone;
          parsed.email = email;
          localStorage.setItem("juntapp_current_user", JSON.stringify(parsed));
        }
      }
    }
  },

  async deleteSocio(id) {
    if (isCloudActive) {
      const { error } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_socios")) || [];
      const filtered = list.filter(s => s.id.toString() !== id.toString());
      localStorage.setItem("juntapp_socios", JSON.stringify(filtered));
    }
  },

  // ------------------------------------------------------------------------
  // TRANSACTIONS / LIBRO DE CAJA
  // ------------------------------------------------------------------------

  async getTransactions() {
    if (isCloudActive) {
      const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      return JSON.parse(localStorage.getItem("juntapp_transactions")) || [];
    }
  },

  async addTransaction(tx) {
    if (isCloudActive) {
      const user = await this.getCurrentUser();
      const { data, error } = await supabaseClient
        .from('transactions')
        .insert({
          type: tx.type,
          description: tx.desc,
          amount: tx.amount,
          date: tx.date || new Date().toISOString().split('T')[0],
          created_by: user ? user.id : null
        });
      if (error) throw error;
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_transactions")) || [];
      const newTx = {
        id: Date.now(),
        ...tx
      };
      list.push(newTx);
      localStorage.setItem("juntapp_transactions", JSON.stringify(list));
      return newTx;
    }
  },

  // ------------------------------------------------------------------------
  // VOTACIONES / CONSULTAS DIGITALES
  // ------------------------------------------------------------------------

  async getPolls() {
    const user = await this.getCurrentUser();
    if (isCloudActive) {
      // Fetch polls
      const { data: polls, error: pErr } = await supabaseClient
        .from('polls')
        .select('*');
      if (pErr) throw pErr;

      // Results and participation are exposed through privacy-preserving RPCs.
      return Promise.all(polls.map(async p => {
        const [{ data: results, error: resultsError }, { data: hasVoted, error: participationError }] = await Promise.all([
          supabaseClient.rpc('poll_results', { p_poll_id: p.id }),
          user ? supabaseClient.rpc('has_poll_participated', { p_poll_id: p.id }) : Promise.resolve({ data: false, error: null })
        ]);
        if (resultsError) throw resultsError;
        if (participationError) throw participationError;
        const counts = new Map((results || []).map(row => [row.option_id, Number(row.votes)]));

        const mappedOptions = p.options.map(opt => {
          const voteCount = counts.get(opt.id) || 0;
          return {
            ...opt,
            votes: opt.votes + voteCount // Combine seed base votes + live votes
          };
        });

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          active: p.active,
          options: mappedOptions,
          voted: hasVoted
        };
      }));
    } else {
      let polls = JSON.parse(localStorage.getItem("juntapp_polls"));
      if (!Array.isArray(polls)) {
        polls = DEFAULT_POLLS;
        localStorage.setItem("juntapp_polls", JSON.stringify(DEFAULT_POLLS));
      }
      const userVotes = JSON.parse(localStorage.getItem("juntapp_votes")) || [];
      
      return polls.map(p => {
        const hasVoted = user ? userVotes.some(v => v.pollId === p.id && v.userId === user.id.toString()) : false;
        return {
          ...p,
          voted: hasVoted
        };
      });
    }
  },

  async vote(pollId, optionId) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Debes iniciar sesión para votar.");

    if (isCloudActive) {
      const { data, error } = await supabaseClient.rpc('cast_anonymous_vote', {
        p_poll_id: pollId,
        p_option_id: optionId
      });
      if (error) {
        if (error.code === '23505') throw new Error("Ya has emitido tu voto en esta consulta.");
        throw error;
      }
      return data;
    } else {
      const userVotes = JSON.parse(localStorage.getItem("juntapp_votes")) || [];
      const polls = JSON.parse(localStorage.getItem("juntapp_polls")) || [];

      // Check if voted
      if (userVotes.some(v => v.pollId === pollId && v.userId === user.id.toString())) {
        throw new Error("Ya has emitido tu voto en esta consulta.");
      }

      // Add vote
      userVotes.push({
        pollId,
        userId: user.id.toString(),
        optionId
      });
      localStorage.setItem("juntapp_votes", JSON.stringify(userVotes));

      // Increment vote count in poll options
      const pIdx = polls.findIndex(p => p.id === pollId);
      if (pIdx !== -1) {
        const oIdx = polls[pIdx].options.findIndex(o => o.id === optionId);
        if (oIdx !== -1) {
          polls[pIdx].options[oIdx].votes += 1;
          localStorage.setItem("juntapp_polls", JSON.stringify(polls));
        }
      }
    }
  },

  async addPoll(poll) {
    if (isCloudActive) {
      // Deactivate any currently active polls first
      try {
        await supabaseClient
          .from('polls')
          .update({ active: false })
          .eq('active', true);
      } catch (err) {
        console.warn("Failed to deactivate older active polls in Supabase:", err);
      }

      const { data, error } = await supabaseClient
        .from('polls')
        .insert({
          title: poll.title,
          description: poll.description,
          options: poll.options.map((opt, i) => ({ id: `opt-${i + 1}`, text: opt.text, votes: 0 })),
          active: true
        });
      if (error) throw error;
      return data;
    } else {
      const polls = JSON.parse(localStorage.getItem("juntapp_polls")) || [];
      
      // Deactivate all previous polls
      polls.forEach(p => p.active = false);

      const newPoll = {
        id: "poll-" + Date.now(),
        title: poll.title,
        description: poll.description,
        options: poll.options.map((opt, i) => ({ id: "opt-" + (i + 1), text: opt.text, votes: 0 })),
        active: true,
        voted: false
      };
      polls.unshift(newPoll);
      localStorage.setItem("juntapp_polls", JSON.stringify(polls));
      return newPoll;
    }
  },

  // ------------------------------------------------------------------------
  // ANNOUNCEMENTS / COMUNICADOS OFICIALES
  // ------------------------------------------------------------------------

  async getAnnouncements() {
    if (isCloudActive) {
      const { data, error } = await supabaseClient
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      return JSON.parse(localStorage.getItem("juntapp_announcements")) || [];
    }
  },

  async addAnnouncement(ann) {
    if (isCloudActive) {
      const { data, error } = await supabaseClient
        .from('announcements')
        .insert({
          category: ann.category,
          title: ann.title,
          content: ann.content,
          author: ann.author || 'Directiva JuntAPP'
        });
      if (error) throw error;
      
      // Dispatch Web Push Edge trigger (mock handles client notifications side)
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_announcements")) || [];
      const newAnn = {
        id: Date.now(),
        category: ann.category,
        title: ann.title,
        content: ann.content,
        author: ann.author || 'Directiva JuntAPP',
        date: new Date().toISOString().split('T')[0]
      };
      list.unshift(newAnn);
      localStorage.setItem("juntapp_announcements", JSON.stringify(list));
      return newAnn;
    }
  },

  async deleteAnnouncement(id) {
    if (isCloudActive) {
      const { error } = await supabaseClient
        .from('announcements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_announcements")) || [];
      const filtered = list.filter(a => a.id.toString() !== id.toString());
      localStorage.setItem("juntapp_announcements", JSON.stringify(filtered));
    }
  },

  // ------------------------------------------------------------------------
  // NOTIFICATIONS / AVISOS
  // ------------------------------------------------------------------------

  async getNotifications() {
    const user = await this.getCurrentUser();
    if (!user) return [];

    if (isCloudActive) {
      const { data, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_notifications")) || [];
      // Filter notifications targeting this user rut or generic ones
      return list;
    }
  },

  async addNotification(noti) {
    if (isCloudActive) {
      // If targeting a specific user RUT or user ID
      const user = await this.getCurrentUser();
      if (!user) return;
      
      const { data, error } = await supabaseClient
        .from('notifications')
        .insert({
          user_id: noti.userId || user.id,
          type: noti.type,
          title: noti.title,
          message: noti.message,
          action: noti.action || null,
          target_socio_id: noti.targetSocioId || null
        });
      if (error) throw error;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_notifications")) || [];
      const newNoti = {
        id: Date.now(),
        read: false,
        date: new Date().toISOString(),
        ...noti
      };
      list.unshift(newNoti);
      localStorage.setItem("juntapp_notifications", JSON.stringify(list));
      return newNoti;
    }
  },

  async markNotificationRead(id) {
    if (isCloudActive) {
      const { error } = await supabaseClient
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_notifications")) || [];
      const idx = list.findIndex(n => n.id.toString() === id.toString());
      if (idx !== -1) {
        list[idx].read = true;
        localStorage.setItem("juntapp_notifications", JSON.stringify(list));
      }
    }
  },

  // ------------------------------------------------------------------------
  // STORAGE BUCKET: TRANSPARENCY DOCUMENT CENTER
  // ------------------------------------------------------------------------

  async getDocuments() {
    if (isCloudActive) {
      // In production, we list files in the 'transparency_reports' bucket
      // and map them as document downloads.
      const { data, error } = await supabaseClient
        .storage
        .from('transparency_reports')
        .list('', {
          sortBy: { column: 'created_at', order: 'desc' }
        });
      if (error) {
        console.error("Storage list error:", error);
        return [];
      }

      return data.map(file => {
        const { data: urlData } = supabaseClient
          .storage
          .from('transparency_reports')
          .getPublicUrl(file.name);
          
        return {
          name: file.name,
          size: file.metadata?.size || 0,
          date: file.created_at ? file.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          url: urlData?.publicUrl || '#'
        };
      });
    } else {
      return JSON.parse(localStorage.getItem("juntapp_documents")) || [];
    }
  },

  async uploadDocument(file) {
    if (isCloudActive) {
      // Clean name: replace spaces
      const fileName = file.name.replace(/\s+/g, '_');
      const { data, error } = await supabaseClient
        .storage
        .from('transparency_reports')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });
      if (error) throw error;
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_documents")) || [];
      const newDoc = {
        name: file.name.replace(/\s+/g, '_'),
        size: file.size,
        date: new Date().toISOString().split('T')[0],
        url: "#" // Simulated Local Path
      };
      list.unshift(newDoc);
      localStorage.setItem("juntapp_documents", JSON.stringify(list));
      return newDoc;
    }
  },

  async deleteDocument(fileName) {
    if (isCloudActive) {
      const { data, error } = await supabaseClient
        .storage
        .from('transparency_reports')
        .remove([fileName]);
      if (error) throw error;
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem("juntapp_documents")) || [];
      const filtered = list.filter(d => d.name !== fileName);
      localStorage.setItem("juntapp_documents", JSON.stringify(filtered));
    }
  }
};

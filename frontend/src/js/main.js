/* ==========================================================================
   JuntAPP Entry Bootstrap Script
   Inicializa base de datos, enrutador, selectores de rol y componentes.
   ========================================================================== */

import { db } from "./db.js";
import { Router } from "./router.js";
import { authModule } from "./modules/auth.js";
import { dashboardModule } from "./modules/dashboard.js";
import { sociosModule } from "./modules/socios.js";
import { tesoreriaModule } from "./modules/tesoreria.js";
import { votacionesModule } from "./modules/votaciones.js";
import { comunicacionesModule } from "./modules/comunicaciones.js";
import { notificationsModule } from "./modules/notifications.js";
import { paymentModule } from "./modules/payment.js";
import { tourModule } from "./modules/tour.js";
import { utils } from "./utils.js";


// DOM references
utils.installSafeHtmlPolicy();
const bodyEl = document.body;
const themeToggleBtn = document.getElementById("themeToggle");
const themeToggleText = document.getElementById("themeToggleText");
const mobileThemeToggleBtn = document.getElementById("mobileThemeToggle");

// 1. Inicializar Base de Datos (mock fallback) & Auth
db.init();

// 2. Definir Enrutador SPA
const routes = {
  // Rutas públicas de la landing corporativa
  home: () => {},
  caracteristicas: () => {},
  pricing: () => {},
  faq: () => {},
  "sobre-nosotros": () => {},
  contacto: () => {},
  legal: () => {},

  // Rutas privadas del dashboard
  inicio: () => {
    dashboardModule.render();
    notificationsModule.render();
  },
  socios: () => {
    sociosModule.render();
    notificationsModule.render();
  },
  tesoreria: () => {
    tesoreriaModule.render();
    notificationsModule.render();
  },
  votaciones: () => {
    votacionesModule.render();
    notificationsModule.render();
  },
  comunicaciones: () => {
    comunicacionesModule.render();
    notificationsModule.render();
  }
};

const router = new Router(routes);

// 3. Inicializar módulos individuales
notificationsModule.init();
paymentModule.init();
sociosModule.init();
tesoreriaModule.init();
votacionesModule.init();
comunicacionesModule.init();

// 4. Configurar Tema (Claro / Oscuro)
function applyTheme(theme) {
  const landingMobileToggle = document.getElementById("landingMobileThemeToggleBtn");
  const textSpan = landingMobileToggle?.querySelector(".theme-text");

  if (theme === "dark") {
    bodyEl.setAttribute("data-theme", "dark");
    if (themeToggleText) themeToggleText.textContent = "Modo Claro";
    if (textSpan) textSpan.textContent = "Modo Claro";
  } else {
    bodyEl.removeAttribute("data-theme");
    if (themeToggleText) themeToggleText.textContent = "Modo Oscuro";
    if (textSpan) textSpan.textContent = "Modo Oscuro";
  }
}

function toggleTheme() {
  const current = db.getTheme();
  const next = current === "light" ? "dark" : "light";
  db.saveTheme(next);
  applyTheme(next);
}

if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);
if (mobileThemeToggleBtn) mobileThemeToggleBtn.addEventListener("click", toggleTheme);

const landingThemeToggleBtn = document.getElementById("landingThemeToggleBtn");
const landingMobileThemeToggleBtn = document.getElementById("landingMobileThemeToggleBtn");

if (landingThemeToggleBtn) {
  landingThemeToggleBtn.addEventListener("click", toggleTheme);
}
if (landingMobileThemeToggleBtn) {
  landingMobileThemeToggleBtn.addEventListener("click", toggleTheme);
}

// Aplicar tema inicial
applyTheme(db.getTheme());

// 6. Cierre general de modales (clics en data-close-modal y fondos)
document.querySelectorAll("[data-close-modal]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const modal = e.target.closest(".modal");
    if (modal) modal.classList.remove("active");
  });
});

window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.classList.remove("active");
  }
});

// 7. Arrancar enrutador
authModule.init().then(() => {
  router.start();
});

// 8. Advertencia de Cambios sin Guardar (Vercel Guidelines - beforeunload)
const formsAreDirty = {
  addSocioForm: false,
  addTransactionForm: false,
  addAnnouncementForm: false
};

// Escucha cambios en inputs para marcar formulario como modificado
document.getElementById("addSocioForm").addEventListener("input", () => {
  formsAreDirty.addSocioForm = true;
});
document.getElementById("addTransactionForm").addEventListener("input", () => {
  formsAreDirty.addTransactionForm = true;
});
document.getElementById("addAnnouncementForm").addEventListener("input", () => {
  formsAreDirty.addAnnouncementForm = true;
});

// Resetea estado al enviar el formulario
document.getElementById("addSocioForm").addEventListener("submit", () => {
  formsAreDirty.addSocioForm = false;
});
document.getElementById("addTransactionForm").addEventListener("submit", () => {
  formsAreDirty.addTransactionForm = false;
});
document.getElementById("addAnnouncementForm").addEventListener("submit", () => {
  formsAreDirty.addAnnouncementForm = false;
});

// Resetea estado al cerrar los modales
document.querySelectorAll(".modal").forEach(modal => {
  const form = modal.querySelector("form");
  if (!form) return;
  
  const resetFormDirty = () => {
    formsAreDirty[form.id] = false;
  };
  
  modal.querySelectorAll("[data-close-modal], .btn-ghost").forEach(btn => {
    btn.addEventListener("click", resetFormDirty);
  });
});

window.addEventListener("beforeunload", (e) => {
  const isDirty = Object.values(formsAreDirty).some(v => v === true);
  if (isDirty) {
    e.preventDefault();
    e.returnValue = "Tiene cambios sin guardar en un formulario. ¿Realmente desea salir?";
    return e.returnValue;
  }
});

// ==========================================================================
// JuntAPP Corporate Landing Page Interactive Elements
// ==========================================================================

// 1. Mobile Menu Toggle
const mobileNavToggleBtn = document.getElementById("mobileNavToggleBtn");
const mobileNavMenu = document.getElementById("mobileNavMenu");

if (mobileNavToggleBtn && mobileNavMenu) {
  mobileNavToggleBtn.addEventListener("click", () => {
    mobileNavToggleBtn.classList.toggle("open");
    mobileNavMenu.classList.toggle("open");
  });
}

// Close mobile menu on clicking links
document.querySelectorAll(".mobile-nav-link").forEach(link => {
  link.addEventListener("click", () => {
    mobileNavToggleBtn?.classList.remove("open");
    mobileNavMenu?.classList.remove("open");
  });
});

// 2. FAQ Accordion Toggle
document.querySelectorAll(".faq-question").forEach(question => {
  question.addEventListener("click", () => {
    const item = question.closest(".faq-item");
    const isExpanded = question.getAttribute("aria-expanded") === "true";
    
    // Close other items
    document.querySelectorAll(".faq-item").forEach(otherItem => {
      if (otherItem !== item) {
        otherItem.classList.remove("active");
        otherItem.querySelector(".faq-question")?.setAttribute("aria-expanded", "false");
      }
    });
    
    // Toggle current item
    item.classList.toggle("active");
    question.setAttribute("aria-expanded", !isExpanded);
  });
});

// 2b. FAQ Category Filtering
document.querySelectorAll(".faq-category-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // Remove active class from all category buttons
    document.querySelectorAll(".faq-category-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    const category = btn.getAttribute("data-category");
    
    document.querySelectorAll(".faq-item").forEach(item => {
      // Close active FAQs before filtering
      item.classList.remove("active");
      item.querySelector(".faq-question")?.setAttribute("aria-expanded", "false");
      
      const itemCategory = item.getAttribute("data-category");
      if (category === "all" || itemCategory === category) {
        item.classList.remove("hidden-faq");
      } else {
        item.classList.add("hidden-faq");
      }
    });
  });
});

// 3. Contact Form Submission (Mock)
const landingContactForm = document.getElementById("landingContactForm");
if (landingContactForm) {
  landingContactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("contactName")?.value || "";
    const email = document.getElementById("contactEmail")?.value || "";
    
    alert(`¡Gracias ${name}! Hemos recibido tu consulta. Nos contactaremos al correo ${email} a la brevedad.`);
    landingContactForm.reset();
  });
}

// 4. Billing Switch Toggle (Mensual / Anual)
const billingToggleBtn = document.getElementById("billingToggleBtn");
if (billingToggleBtn) {
  const billingMonthlyLabel = document.getElementById("billing-monthly-label");
  const billingAnnualLabel = document.getElementById("billing-annual-label");
  const pricePilot = document.getElementById("price-pilot");
  const priceActiva = document.getElementById("price-activa");
  const priceGrande = document.getElementById("price-grande");
  const periodPilot = document.getElementById("period-pilot");
  const periodActiva = document.getElementById("period-activa");
  const periodGrande = document.getElementById("period-grande");

  billingToggleBtn.addEventListener("click", () => {
    const isAnnual = billingToggleBtn.classList.toggle("active");
    
    if (isAnnual) {
      billingMonthlyLabel?.classList.remove("active");
      billingAnnualLabel?.classList.add("active");
      
      // Annual prices (discounted)
      if (pricePilot) pricePilot.textContent = "0";
      if (priceActiva) priceActiva.textContent = "10.390";
      if (priceGrande) priceGrande.textContent = "23.990";

      if (periodPilot) periodPilot.textContent = " / año";
      if (periodActiva) periodActiva.textContent = " / año";
      if (periodGrande) periodGrande.textContent = " / año";
    } else {
      billingMonthlyLabel?.classList.add("active");
      billingAnnualLabel?.classList.remove("active");
      
      // Monthly prices
      if (pricePilot) pricePilot.textContent = "0";
      if (priceActiva) priceActiva.textContent = "14.990";
      if (priceGrande) priceGrande.textContent = "29.990";

      if (periodPilot) periodPilot.textContent = " / mes";
      if (periodActiva) periodActiva.textContent = " / mes";
      if (periodGrande) periodGrande.textContent = " / mes";
    }
  });
}

// 5. Style Switcher Playground removed (Swiss Helvetica is now the default and only style)

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar Collapse Toggle
  const sidebarBrand = document.querySelector(".sidebar-brand");
  const sidebarToggleHandle = document.getElementById("sidebarCollapseHandleBtn");
  const appLayout = document.querySelector(".app-layout");
  
  if (appLayout) {
    const toggleSidebar = () => {
      appLayout.classList.toggle("collapsed-sidebar");
      if (appLayout.classList.contains("collapsed-sidebar")) {
        localStorage.setItem("juntapp_sidebar_collapsed", "true");
      } else {
        localStorage.setItem("juntapp_sidebar_collapsed", "false");
      }
    };

    if (sidebarBrand) {
      sidebarBrand.addEventListener("click", toggleSidebar);
    }
    if (sidebarToggleHandle) {
      sidebarToggleHandle.addEventListener("click", toggleSidebar);
    }

    // Restore state
    if (localStorage.getItem("juntapp_sidebar_collapsed") === "true") {
      appLayout.classList.add("collapsed-sidebar");
    }
  }

  // Initialize Walkthrough Tour
  tourModule.init();

  const listContainer = document.querySelector(".note-handwritten-list");

  const handwrittenNote = document.querySelector(".cork-handwritten-note");
  
  // Create stamp element if checklist exists
  let completedStamp = null;
  if (handwrittenNote) {
    completedStamp = document.createElement("div");
    completedStamp.className = "tasks-completed-stamp";
    completedStamp.textContent = "¡SEDE AL DÍA! 🌳";
    handwrittenNote.appendChild(completedStamp);
  }

  function checkAllTasksCompleted() {
    if (!listContainer || !completedStamp) return;
    const items = listContainer.querySelectorAll("li");
    const checkedItems = listContainer.querySelectorAll("li.checked");
    if (items.length > 0 && items.length === checkedItems.length) {
      completedStamp.classList.add("active");
    } else {
      completedStamp.classList.remove("active");
    }
  }

  if (listContainer) {
    // Initial check
    checkAllTasksCompleted();

    listContainer.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (li) {
        li.classList.toggle("checked");
        checkAllTasksCompleted();
      }
    });
  }

  // 8. Interactive Calendar Days
  const calendarGrid = document.querySelector(".sim-calendar-grid");
  const eventCallout = document.querySelector(".calendar-event-callout");
  if (calendarGrid && eventCallout) {
    calendarGrid.addEventListener("click", (e) => {
      const day = e.target;
      if (day && !day.classList.contains("cal-day-header") && day.textContent.trim() !== "" && !isNaN(day.textContent.trim())) {
        day.classList.toggle("circled");
        
        const circledDays = calendarGrid.querySelectorAll("div.circled");
        if (circledDays.length > 0) {
          // Get the last circled day or the clicked one if it's circled
          const activeDay = day.classList.contains("circled") ? day : circledDays[circledDays.length - 1];
          const dayText = activeDay.textContent.trim();
          
          let title = "Recordatorio";
          let desc = "";
          
          if (dayText === "4") {
            title = "⚠️ Corte de Agua";
            desc = "Corte programado para este jueves de 14:00 a 18:00 hrs en el pasaje Los Claveles por mantención de válvulas.";
          } else if (dayText === "6") {
            title = "📢 Asamblea";
            desc = "Reunión oficial este sábado a las 18:00 hrs en la Sede Comunitaria para definir la asignación de presupuestos.";
          } else if (dayText === "24") {
            title = "🎉 Día del Vecino";
            desc = "¡Actividad familiar especial en la plaza central desde las 15:00 hrs! Juegos, comida y música.";
          } else {
            title = `📌 Día ${dayText}`;
            desc = "Día marcado en el calendario. ¡Digitaliza los comunicados de tu junta con JuntAPP!";
          }
          
          eventCallout.innerHTML = `
            <strong>${title}</strong><br>
            <span>${desc}</span>
          `;
          eventCallout.classList.add("active");
        } else {
          // Hide callout
          eventCallout.classList.remove("active");
          eventCallout.innerHTML = "";
        }
      }
    });
  }

  // 8b. Pinned Notes Gravity Falling Interaction
  const pinnedNotes = document.querySelectorAll(".cork-pin-note-v3, .cork-polaroid-photo-v3");
  pinnedNotes.forEach(note => {
    const pin = note.querySelector(".pin-marker");
    if (pin) {
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        pin.style.opacity = "0";
        setTimeout(() => pin.style.display = "none", 200);
        note.classList.add("fallen-note");
      });
    }
  });

  // Tareas Sede Tape Falling (Requires both tapes removed to fall)
  if (handwrittenNote) {
    const tapeLeft = handwrittenNote.querySelector(".tape-top-left");
    const tapeRight = handwrittenNote.querySelector(".tape-top-right");
    let leftRemoved = false;
    let rightRemoved = false;

    if (tapeLeft) {
      tapeLeft.addEventListener("click", (e) => {
        e.stopPropagation();
        tapeLeft.style.opacity = "0";
        setTimeout(() => tapeLeft.style.display = "none", 200);
        leftRemoved = true;
        updateTapeState();
      });
    }

    if (tapeRight) {
      tapeRight.addEventListener("click", (e) => {
        e.stopPropagation();
        tapeRight.style.opacity = "0";
        setTimeout(() => tapeRight.style.display = "none", 200);
        rightRemoved = true;
        updateTapeState();
      });
    }

    function updateTapeState() {
      if (leftRemoved && rightRemoved) {
        handwrittenNote.classList.remove("dangling-left", "dangling-right");
        handwrittenNote.classList.add("fallen-note");
      } else if (leftRemoved) {
        handwrittenNote.classList.add("dangling-right");
      } else if (rightRemoved) {
        handwrittenNote.classList.add("dangling-left");
      }
    }
  }

  // Add Floating "Restaurar Mural" Button
  const corkboard = document.querySelector(".hero-corkboard-container-v3");
  if (corkboard) {
    const restoreBtn = document.createElement("button");
    restoreBtn.className = "restore-mural-btn";
    restoreBtn.innerHTML = "🔄";
    restoreBtn.title = "Reiniciar Mural";

    restoreBtn.addEventListener("click", () => {
      location.reload();
    });
    
    corkboard.appendChild(restoreBtn);
  }

  // 9. Interactive Bento Grid Widgets (Diario Mural Redesign)
  // Card 1: Search and Status toggle in Neighbors List
  const sociosSearch = document.getElementById("bento-socios-search");
  const sociosList = document.getElementById("bento-socios-list");
  if (sociosSearch && sociosList) {
    sociosSearch.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      const items = sociosList.querySelectorAll(".widget-socio-item-mural");
      items.forEach(item => {
        const name = item.getAttribute("data-name") || "";
        if (name.includes(query)) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    });
  }

  // Toggle socio status badge
  if (sociosList) {
    sociosList.addEventListener("click", (e) => {
      const badge = e.target.closest(".socio-status-badge");
      if (badge) {
        if (badge.classList.contains("status-active")) {
          badge.classList.remove("status-active");
          badge.classList.add("status-pending");
          badge.textContent = "Pendiente";
        } else {
          badge.classList.remove("status-pending");
          badge.classList.add("status-active");
          badge.textContent = "Al día";
        }
      }
    });
  }

  // Card 3: Interactive Poll Vote
  const bentoPoll = document.getElementById("bento-poll");
  const pollStatus = document.getElementById("bento-poll-status");
  if (bentoPoll && pollStatus) {
    bentoPoll.addEventListener("click", (e) => {
      const btn = e.target.closest(".poll-option-btn-mural");
      if (btn && !btn.classList.contains("selected") && !bentoPoll.classList.contains("voted")) {
        const option = btn.getAttribute("data-option");
        bentoPoll.classList.add("voted");
        
        // Add selected class to voted option
        btn.classList.add("selected");
        
        // Recalculate percentages to reflect the vote
        const opt1PctEl = document.getElementById("bento-poll-opt1-pct");
        const opt2PctEl = document.getElementById("bento-poll-opt2-pct");
        const opt1Fill = document.getElementById("bento-poll-opt1-fill");
        const opt2Fill = document.getElementById("bento-poll-opt2-fill");
        
        if (option === "1") {
          opt1PctEl.textContent = "79%";
          opt2PctEl.textContent = "21%";
          opt1Fill.style.width = "79%";
          opt2Fill.style.width = "21%";
        } else {
          opt1PctEl.textContent = "77%";
          opt2PctEl.textContent = "23%";
          opt1Fill.style.width = "77%";
          opt2Fill.style.width = "23%";
        }
        
        pollStatus.textContent = "¡Voto registrado con éxito! Gracias por participar.";
        pollStatus.style.color = "#0f172a";
        pollStatus.style.fontWeight = "700";
      }
    });
  }

  // Card 4: Push Notification Simulator
  const btnTriggerAlert = document.getElementById("btn-trigger-bento-alert");
  const notisContainer = document.getElementById("bento-phone-notifications");
  const simulatedAlerts = [
    {
      icon: "📢",
      app: "JuntAPP Alertas",
      title: "Campaña de Vacunación",
      body: "Este jueves desde las 9:00 hrs en el consultorio central municipal.",
      class: ""
    },
    {
      icon: "⚠️",
      app: "Seguridad Vecinal",
      title: "Simulacro de Sismo",
      body: "Viernes a las 20:00 hrs. Recuerda identificar tu zona segura.",
      class: "orange-noti"
    },
    {
      icon: "🎉",
      app: "Eventos Comunitarios",
      title: "Feria de Emprendedores",
      body: "Apoya el comercio local este sábado de 10:00 a 18:00 en la plaza.",
      class: ""
    },
    {
      icon: "🔧",
      app: "JuntAPP Reportes",
      title: "Luminarias Reparadas",
      body: "El departamento eléctrico municipal completó recambio de focos led.",
      class: ""
    }
  ];
  let currentAlertIdx = 0;

  if (btnTriggerAlert && notisContainer) {
    btnTriggerAlert.addEventListener("click", () => {
      const alertData = simulatedAlerts[currentAlertIdx];
      currentAlertIdx = (currentAlertIdx + 1) % simulatedAlerts.length;
      
      // Create element
      const card = document.createElement("div");
      card.className = `phone-notification-card ${alertData.class}`;
      card.innerHTML = `
        <div class="noti-icon">${alertData.icon}</div>
        <div class="noti-content">
          <div class="noti-header">
            <span class="noti-app">${alertData.app}</span>
            <span class="noti-time">Ahora</span>
          </div>
          <span class="noti-title">${alertData.title}</span>
          <span class="noti-body">${alertData.body}</span>
        </div>
      `;
      
      // Prepend to show at top
      notisContainer.insertBefore(card, notisContainer.firstChild);
      
      // Remove last if there are more than 2 to prevent overflowing screen mockup
      const cards = notisContainer.querySelectorAll(".phone-notification-card");
      if (cards.length > 2) {
        cards[cards.length - 1].style.opacity = "0";
        cards[cards.length - 1].style.transform = "scale(0.9) translateY(10px)";
        cards[cards.length - 1].style.transition = "all 0.3s ease";
        setTimeout(() => {
          cards[cards.length - 1].remove();
        }, 300);
      }
    });
  }
});

// MutationObserver to automatically lock/unlock background scroll
const scrollObserver = new MutationObserver(() => {
  const isModalActive = document.querySelector(".modal.active, .auth-overlay.active");
  const isMenuOpen = document.getElementById("mobileNavMenu")?.classList.contains("open");
  
  if (isModalActive || isMenuOpen) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
});

document.querySelectorAll(".modal, .auth-overlay, #mobileNavMenu").forEach(el => {
  scrollObserver.observe(el, { attributes: true, attributeFilter: ["class"] });
});

// Slider Logic Ends

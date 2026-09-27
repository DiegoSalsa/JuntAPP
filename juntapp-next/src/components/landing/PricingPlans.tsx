'use client';
import Link from 'next/link';
import { formatCLP, PLANS, type PlanId } from '@/lib/plans';

const details: Record<PlanId, string[]> = {
  juntapp: ['Hasta 500 vecinos activos', 'Socios, tesorería y caja', 'Consultas y comunicaciones', 'Administradores ilimitados'],
  juntapp_web: ['Todo JuntAPP Vecinal', 'Landing pública autoadministrable', 'Plantillas de sitio comunitario', 'Logo, fotos, textos y colores'],
  web: ['Landing pública autoadministrable', 'Plantillas de sitio comunitario', 'Gestor de imágenes y contenidos', 'Publicación con dirección propia'],
};

export default function PricingPlans() {
  return <div className="corporate-view active" id="corp-pricing">
    <section className="landing-section subpage-mural-section">
      <div className="landing-container">
        <div className="subpage-corkboard-container plans-page">
          {/* Brass plaque tag */}
          <div className="corkboard-brass-plaque">
            JUNTAPP · PLANES Y PRECIOS
          </div>

          <div className="subpage-corkboard-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
            <section className="plans-hero" style={{ maxWidth: 'none', margin: '0' }}>
              <span>PLANES TRANSPARENTES</span>
              <h1>Una solución para cada junta vecinal</h1>
              <p>Precios mensuales en pesos chilenos, IVA incluido. Sin contratos forzosos.</p>
            </section>
          </div>

          <section className="plans-grid" aria-label="Planes disponibles">
            {(Object.values(PLANS)).map((plan) => <article className={`plan-card plan-${plan.id} ${plan.id === 'juntapp_web' ? 'featured' : ''}`} key={plan.id}>
              {plan.id === 'juntapp_web' && <span className="plan-ribbon">MÁS CONVENIENTE</span>}
              <h2>{plan.name}</h2><p className="plan-audience">{plan.id === 'web' ? 'Para tener presencia pública simple y profesional.' : 'Para modernizar la gestión de la comunidad.'}</p>
              <div className="plan-price"><small>$</small><strong>{formatCLP(plan.price)}</strong><span>/ mes</span></div>
              <ul>{details[plan.id].map((item) => <li key={item}>✓ {item}</li>)}</ul>
              <Link className="plan-buy" href={`/registro?plan=${plan.id}`}>Elegir {plan.name}</Link>
            </article>)}
          </section>

          <div className="whatsapp-addon whatsapp-addon-upcoming"><input type="checkbox" disabled aria-label="WhatsApp masivo próximamente" /><span className="wa-icon">W</span><span><strong>WhatsApp masivo</strong><small>Envío de avisos, recordatorios y notificaciones a los vecinos.</small></span><b>PRÓXIMAMENTE</b></div>
          <p className="plans-note">El monto mostrado será exactamente el que autorices en Mercado Pago. Renovación mensual; puedes cancelar futuras renovaciones.</p>
        </div>
      </div>
    </section>
  </div>;
}

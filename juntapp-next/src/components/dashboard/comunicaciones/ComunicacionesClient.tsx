'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { Announcement, AnnouncementCategory, Profile } from '@/lib/types';

const labels: Record<AnnouncementCategory, string> = { urgente: 'Urgente', asamblea: 'Asamblea', beneficio: 'Beneficio', general: 'General' };

export default function ComunicacionesClient({ announcements, currentProfile }: { announcements: Announcement[]; currentProfile: Profile }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicationMessage, setPublicationMessage] = useState('');
  const router = useRouter();
  const isDirigente = currentProfile.role === 'dirigente';

  async function handlePublish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); setPublicationMessage(''); const form = new FormData(event.currentTarget); const category = form.get('category') as AnnouncementCategory; const title = String(form.get('title')).trim(); const content = String(form.get('content')).trim();
    const response = await fetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, title, content }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? 'No fue posible publicar el comunicado.'); setLoading(false); return; }
    const delivery = result.pushSubscriptions ? `${result.pushDelivered} de ${result.pushSubscriptions} dispositivo(s) recibieron el aviso.` : 'El comunicado quedó visible; aún no hay celulares suscritos al push.';
    setPublicationMessage(result.pushStatus === 'delivered' ? `Comunicado publicado. ${delivery}` : `Comunicado publicado. El aviso push quedó en reintento automático. ${delivery}`);
    setShowModal(false); setLoading(false); router.refresh();
  }

  async function deleteAnnouncement(id: number) { if (!confirm('¿Deseas eliminar este comunicado de forma permanente?')) return; const { error: deleteError } = await createClient().from('announcements').delete().eq('id', id); if (deleteError) alert(deleteError.message); else router.refresh(); }

  return <section className="app-view active" id="view-comunicaciones">
    <header className="view-header"><div><span className="view-subtitle">Canal de Noticias y Avisos Oficiales</span><h2 className="view-title">Anuncios Oficiales</h2></div><div className="view-actions"><button className="tour-help-btn"><span>?</span><span>Guía</span></button>{isDirigente && <button className="btn btn-primary" onClick={() => setShowModal(true)}>＋ Publicar Anuncio Oficial</button>}</div></header>
    {publicationMessage && <div className="publication-delivery-message" role="status">{publicationMessage}</div>}
    <div className="announcements-roster" aria-label="Avisos publicados">{announcements.map((announcement) => <article className={`announcement-card ${announcement.category === 'urgente' ? 'announcement-featured-urgent' : ''}`} key={announcement.id}><div className="announcement-header"><div className="announcement-meta-left"><span className={`announcement-cat-badge ${announcement.category}`}>{labels[announcement.category].toUpperCase()}</span><span className="announcement-date">Publicado el {formatDate(announcement.date)}</span></div><span className="announcement-author">Escrito por: {announcement.author}</span></div><h3 className="announcement-title"><strong>{announcement.title}</strong></h3><p className="announcement-body">{announcement.content}</p>{isDirigente && <div className="socio-actions announcement-admin-actions"><button className="btn btn-sm btn-secondary danger-action" onClick={() => deleteAnnouncement(announcement.id)}>Eliminar Publicación</button></div>}</article>)}{!announcements.length && <div className="empty-state shadow-box"><div className="empty-icon">📢</div><h3>No hay anuncios oficiales publicados</h3><p>Los comunicados de la directiva aparecerán aquí.</p></div>}</div>
    {showModal && <div className="modal active" role="dialog" aria-modal="true"><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h3 className="modal-title">Publicar Anuncio Oficial</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div><div className="modal-body"><form onSubmit={handlePublish}><div className="form-group"><label className="form-label">Categoría</label><select name="category" className="form-input">{(Object.keys(labels) as AnnouncementCategory[]).map((category) => <option key={category} value={category}>{labels[category]}</option>)}</select></div><div className="form-group"><label className="form-label">Título</label><input name="title" className="form-input" minLength={5} maxLength={160} required /></div><div className="form-group"><label className="form-label">Mensaje</label><textarea name="content" className="form-input" rows={6} minLength={10} maxLength={4000} required /></div>{error && <p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading ? 'Publicando…' : 'Publicar Comunicado'}</button></div></form></div></div></div></div>}
  </section>;
}

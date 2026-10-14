'use client';
/* User-provided media uses dynamic Supabase URLs. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FiArrowUpRight, FiCheck, FiChevronDown, FiEdit3, FiImage, FiLayout, FiMaximize2, FiMinimize2, FiMonitor, FiPlus, FiSave, FiSmartphone, FiTablet, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import { normalizeWebsiteContent, normalizeWebsiteTheme, readableColor, websiteImageUrl, WEBSITE_PALETTES, WEBSITE_TEMPLATES, type WebsiteContent, type WebsiteNewsItem, type WebsiteTemplate, type WebsiteTheme } from '@/lib/website';
import WebsitePreview from './WebsitePreview';

type PageData = { template?: WebsiteTemplate; content?: Partial<WebsiteContent>; theme?: Partial<WebsiteTheme>; logo_url?: string | null; hero_image_url?: string | null; gallery?: string[]; published?: boolean } | null;
type Draft = { template: WebsiteTemplate; content: WebsiteContent; theme: WebsiteTheme; logo: string; hero: string; gallery: string[] };
type Tab = 'design' | 'content' | 'news' | 'media';
const tabs = [{ id: 'design', label: 'Diseño', Icon: FiLayout }, { id: 'content', label: 'Textos', Icon: FiEdit3 }, { id: 'news', label: 'Noticias', Icon: FiPlus }, { id: 'media', label: 'Imágenes', Icon: FiImage }] as const;
const devices = [{ id: 'desktop', label: 'Escritorio', width: 1280, Icon: FiMonitor }, { id: 'tablet', label: 'Tablet', width: 768, Icon: FiTablet }, { id: 'mobile', label: 'Móvil', width: 390, Icon: FiSmartphone }] as const;
const colorMeta = { primary: 'Principal', accent: 'Acento', background: 'Fondo', text: 'Texto' } as const;

async function convertToWebP(file: File, maxDimension: number) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Selecciona una imagen de hasta 20 MB.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No fue posible procesar la imagen.');
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally { bitmap.close(); }
  const encode = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No fue posible convertir la imagen.')), 'image/webp', quality));
  let blob = await encode(.84);
  if (blob.size > 5_242_880) blob = await encode(.65);
  if (blob.size > 5_242_880) throw new Error('La imagen optimizada supera 5 MB. Prueba con una más pequeña.');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

export default function WebsiteBuilder({ juntaId, juntaName, slug, plan, initial }: { juntaId: string; juntaName: string; slug: string; plan: 'web' | 'juntapp_web'; initial: PageData }) {
  const [draft, setDraft] = useState<Draft>(() => ({
    template: WEBSITE_TEMPLATES.some((item) => item.id === initial?.template) ? initial!.template! : 'comunidad',
    content: normalizeWebsiteContent(initial?.content), theme: normalizeWebsiteTheme(initial?.theme ?? WEBSITE_PALETTES[0].colors),
    logo: websiteImageUrl(initial?.logo_url), hero: websiteImageUrl(initial?.hero_image_url),
    gallery: (initial?.gallery ?? []).map(websiteImageUrl).filter(Boolean).slice(0, 6),
  }));
  const [savedDraft, setSavedDraft] = useState(draft);
  const [hasSaved, setHasSaved] = useState(Boolean(initial));
  const [published, setPublished] = useState(initial?.published ?? false);
  const [tab, setTab] = useState<Tab>('design');
  const [filter, setFilter] = useState('Todas');
  const [device, setDevice] = useState<typeof devices[number]>(devices[0]);
  const [focused, setFocused] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(800);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const operationRef = useRef(false);
  const { template, content, theme, logo, hero, gallery } = draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const busy = saving || uploading;
  const url = `/sitio/${slug}`;
  const selected = WEBSITE_TEMPLATES.find((item) => item.id === template)!;
  const previewScale = Math.min(1, Math.max(280, availableWidth) / device.width);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!focused) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocused(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [focused]);

  function patchDraft(patch: Partial<Draft>) { setDraft((current) => ({ ...current, ...patch })); }
  function setField<K extends keyof WebsiteContent>(key: K, value: WebsiteContent[K]) { setDraft((current) => ({ ...current, content: { ...current.content, [key]: value } })); }
  function updateNews(id: string, patch: Partial<WebsiteNewsItem>) { setDraft((current) => ({ ...current, content: { ...current.content, newsItems: current.content.newsItems.map((item) => item.id === id ? { ...item, ...patch } : item) } })); }
  function addNews() {
    if (content.newsItems.length >= 12) return;
    const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type: string) => dateParts.find((item) => item.type === type)?.value;
    setField('newsItems', [{ id: crypto.randomUUID(), title: '', summary: '', date: `${part('year')}-${part('month')}-${part('day')}`, category: 'Comunidad', image: '' }, ...content.newsItems]);
  }

  async function uploadImage(file: File, target: 'logo' | 'hero' | 'gallery' | 'news', newsId?: string) {
    if (operationRef.current) return;
    if (!file.type.startsWith('image/')) { setMessage({ text: 'Selecciona un archivo de imagen.', error: true }); return; }
    if (target === 'gallery' && gallery.length >= 6) { setMessage({ text: 'La galería admite seis fotografías. Quita una para agregar otra.', error: true }); return; }
    operationRef.current = true; setUploading(true); setMessage({ text: 'Optimizando y subiendo imagen…' });
    try {
      const optimized = await convertToWebP(file, target === 'logo' ? 800 : 1920);
      const supabase = createClient();
      const path = `${juntaId}/${target}-${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage.from('website-media').upload(path, optimized, { contentType: 'image/webp', upsert: false });
      if (error) throw error;
      const publicUrl = supabase.storage.from('website-media').getPublicUrl(path).data.publicUrl;
      if (target === 'news' && newsId) updateNews(newsId, { image: publicUrl });
      else if (target === 'gallery') setDraft((current) => ({ ...current, gallery: [...current.gallery, publicUrl] }));
      else if (target === 'logo' || target === 'hero') patchDraft({ [target]: publicUrl });
      setMessage({ text: 'Imagen lista. Guarda los cambios para conservarla.' });
    } catch { setMessage({ text: 'No pudimos subir la imagen. Comprueba el archivo y tu conexión e inténtalo otra vez.', error: true }); }
    finally { setUploading(false); operationRef.current = false; }
  }

  async function save(mode: 'draft' | 'publish' | 'unpublish') {
    if (operationRef.current) return;
    if (mode !== 'unpublish' && (!content.title.trim() || content.newsItems.some((item) => !item.title.trim() || !item.summary.trim()))) {
      setMessage({ text: 'Completa el título de la portada y el título y contenido de cada noticia antes de guardar.', error: true }); return;
    }
    operationRef.current = true; setSaving(true); setMessage(null);
    const nextPublished = mode === 'unpublish' ? false : mode === 'publish' ? true : published;
    try {
      const supabase = createClient();
      const { error } = mode === 'unpublish'
        ? await supabase.from('website_pages').update({ published: nextPublished, updated_at: new Date().toISOString() }).eq('junta_id', juntaId)
        : await supabase.from('website_pages').upsert({ junta_id: juntaId, template, content, theme, logo_url: logo || null, hero_image_url: hero || null, gallery, published: nextPublished, updated_at: new Date().toISOString() }, { onConflict: 'junta_id' });
      if (error) throw error;
      setPublished(nextPublished); setConfirmUnpublish(false);
      if (mode !== 'unpublish') { setSavedDraft(draft); setHasSaved(true); }
      setMessage({ text: mode === 'unpublish' ? 'Página despublicada. Su contenido está conservado.' : nextPublished ? 'Cambios guardados. Tu página está publicada.' : 'Borrador guardado. Puedes seguir editando antes de publicar.' });
      // Announcements are separate from saving: only this explicit action sends one.
      if (mode === 'publish') {
        try {
          const response = await fetch('/api/notifications/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'general', title: `La web de ${juntaName} fue actualizada`.slice(0, 160), message: content.newsItems[0]?.title ? `Nueva publicación: ${content.newsItems[0].title}` : 'La directiva publicó novedades en el sitio comunitario.', action: url, eventKey: `website:${juntaId}:${crypto.randomUUID()}` }) });
          if (!response.ok) throw new Error('Notification unavailable');
          setMessage({ text: 'Página publicada. El aviso a la comunidad quedó preparado.' });
        } catch { setMessage({ text: 'La página está publicada, pero no pudimos preparar el aviso. Puedes enviarlo desde Comunicaciones.', error: true }); }
      }
    } catch { setMessage({ text: 'No pudimos guardar. Tus cambios siguen en el editor; revisa la conexión y vuelve a intentarlo.', error: true }); }
    finally { setSaving(false); operationRef.current = false; }
  }

  return <div className="builder-shell">
    <header className="builder-top"><div><div className="builder-eyebrow">TU COMUNIDAD EN INTERNET <span>{plan === 'web' ? 'Plan Web' : 'JuntAPP + Web'}</span></div><h1>Mi página web</h1><p>{juntaName}</p></div><div className="builder-top-right"><span className={`builder-publication-state ${published ? 'is-live' : ''}`}><i />{published ? 'Publicada' : 'Borrador'}</span>{published && <a href={url} target="_blank" rel="noopener noreferrer">Visitar sitio <FiArrowUpRight aria-hidden="true" /></a>}</div></header>
    <div className="builder-savebar"><div className="builder-save-state"><span className={dirty ? 'unsaved' : ''}><i />{saving ? 'Guardando…' : uploading ? 'Subiendo imagen…' : dirty ? 'Cambios sin guardar' : hasSaved ? 'Todos los cambios guardados' : 'Tu página está lista para personalizar'}</span><small>{published ? 'Al guardar, los cambios se muestran en tu sitio publicado.' : 'Tu página será visible cuando la publiques.'}</small></div><div className="builder-actions">{dirty && <button type="button" className="builder-reset" disabled={busy} onClick={() => { setDraft(savedDraft); setMessage(null); }}>Deshacer cambios</button>}<button type="button" disabled={busy || (!dirty && hasSaved)} onClick={() => void save('draft')}><FiSave aria-hidden="true" />{published ? 'Guardar cambios' : 'Guardar borrador'}</button><button type="button" className="publish" disabled={busy} onClick={() => void save('publish')}>{published ? 'Publicar y avisar' : 'Publicar página'}<FiArrowUpRight aria-hidden="true" /></button></div></div>
    {message && <div className={`builder-message ${message.error ? 'is-error' : ''}`} role={message.error ? 'alert' : 'status'}><span>{message.text}</span><button type="button" aria-label="Cerrar mensaje" onClick={() => setMessage(null)}><FiX /></button></div>}
    <div className="builder-workspace">
      <aside className="builder-panel" aria-label="Editor del sitio"><div className="builder-tabs" role="tablist" aria-label="Secciones del editor">{tabs.map(({ id, label, Icon }) => <button type="button" role="tab" id={`builder-tab-${id}`} aria-selected={tab === id} aria-controls="builder-tab-panel" className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}><Icon aria-hidden="true" /><span>{label}</span></button>)}</div>
        <fieldset disabled={busy} className="builder-controls" id="builder-tab-panel" role="tabpanel" aria-labelledby={`builder-tab-${tab}`}>
          {tab === 'design' && <><div className="builder-panel-heading"><span>01 / ELIGE TU ESTILO</span><h2>Un diseño para tu barrio</h2><p>Cambia de plantilla y conserva todo tu contenido.</p></div><div className="template-filters" aria-label="Filtrar plantillas">{['Todas', 'Comunidad', 'Información', 'Imagen'].map((item) => <button type="button" aria-pressed={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><div className="template-list">{WEBSITE_TEMPLATES.filter((item) => filter === 'Todas' || item.group === filter).map((item) => <button type="button" className={template === item.id ? 'selected' : ''} aria-pressed={template === item.id} onClick={() => patchDraft({ template: item.id })} key={item.id} title={item.note}><TemplateThumbnail template={item.id} colors={WEBSITE_PALETTES[item.palette].colors} /><span className="template-card-label"><strong>{item.name}</strong>{template === item.id && <FiCheck aria-hidden="true" />}</span><small>{item.note}</small></button>)}</div>
            <div className="builder-panel-heading color-section-title"><span>02 / DALE TU IDENTIDAD</span><h2>Colores que te representan</h2><p>Aplica una combinación o ajusta cada color.</p></div><div className="palette-list">{WEBSITE_PALETTES.map((palette) => <button type="button" onClick={() => patchDraft({ theme: palette.colors })} aria-label={`Aplicar paleta ${palette.name}`} aria-pressed={JSON.stringify(theme) === JSON.stringify(palette.colors)} key={palette.name}><span>{Object.values(palette.colors).map((color, index) => <i style={{ background: color }} key={index} />)}</span><small>{palette.name}</small></button>)}</div><button type="button" className="builder-suggested-palette" onClick={() => patchDraft({ theme: WEBSITE_PALETTES[selected.palette].colors })}>Usar colores de {selected.name}<FiArrowUpRight aria-hidden="true" /></button><div className="color-fields">{(Object.keys(colorMeta) as (keyof WebsiteTheme)[]).map((key) => <label className="builder-color-field" key={key}><input type="color" aria-label={`Selector de color ${colorMeta[key]}`} value={theme[key]} onChange={(event) => patchDraft({ theme: { ...theme, [key]: event.target.value } })} /><span>{colorMeta[key]}<ColorHex value={theme[key]} onChange={(value) => patchDraft({ theme: { ...theme, [key]: value } })} /></span></label>)}</div><div className="builder-palette-sample" style={{ background: theme.primary, color: readableColor(theme.primary) }}>Así se ve tu comunidad<span style={{ background: theme.accent, color: readableColor(theme.accent) }}>Participar ↗</span></div></>}
          {tab === 'content' && <><div className="builder-panel-heading"><span>LA VOZ DE TU JUNTA</span><h2>Cuenta tu historia</h2><p>Textos claros y cercanos para tus vecinos.</p></div><div className="content-fields"><EditorGroup title="Portada"><TextField label="Título principal" value={content.title} limit={80} onChange={(value) => setField('title', value)} /><TextField label="Bajada" value={content.subtitle} limit={180} multiline onChange={(value) => setField('subtitle', value)} /></EditorGroup><EditorGroup title="Nuestra junta"><TextField label="Título de nosotros" value={content.aboutTitle} onChange={(value) => setField('aboutTitle', value)} /><TextField label="Descripción" value={content.about} limit={1600} multiline onChange={(value) => setField('about', value)} /></EditorGroup><EditorGroup title="Iniciativas"><TextField label="Título de iniciativas" value={content.servicesTitle} onChange={(value) => setField('servicesTitle', value)} /><ServicesField value={content.services} onChange={(value) => setField('services', value)} /></EditorGroup><EditorGroup title="Noticias"><TextField label="Encabezado de noticias" value={content.newsTitle} onChange={(value) => setField('newsTitle', value)} /><TextField label="Introducción a noticias" value={content.news} multiline onChange={(value) => setField('news', value)} /></EditorGroup><EditorGroup title="Contacto y redes"><TextField label="Título de contacto" value={content.contactTitle} onChange={(value) => setField('contactTitle', value)} /><TextField label="Texto de contacto" value={content.contact} multiline onChange={(value) => setField('contact', value)} /><TextField label="Dirección de la sede" value={content.address} onChange={(value) => setField('address', value)} /><TextField label="WhatsApp" value={content.whatsapp} placeholder="+56 9 1234 5678" onChange={(value) => setField('whatsapp', value)} /><TextField label="Facebook" value={content.facebook} placeholder="Usuario o enlace" onChange={(value) => setField('facebook', value)} /><TextField label="Instagram" value={content.instagram} placeholder="@usuario o enlace" onChange={(value) => setField('instagram', value)} /><p className="builder-field-help">Solo se muestran las redes que completes.</p></EditorGroup></div></>}
          {tab === 'news' && <><div className="builder-panel-heading"><span>LO QUE PASA EN TU BARRIO</span><h2>Noticias y novedades</h2><p>{content.newsItems.length} de 12 publicaciones. La primera aparece destacada.</p></div><button type="button" className="builder-add-news" disabled={content.newsItems.length >= 12} onClick={addNews}><FiPlus aria-hidden="true" /> Agregar noticia</button>{!content.newsItems.length && <div className="builder-empty"><FiEdit3 aria-hidden="true" /><h3>Tu primera noticia</h3><p>Comparte una actividad, una asamblea o un avance de tu comunidad.</p></div>}{content.newsItems.map((item, index) => <article className="news-editor-card" key={item.id}><header><strong>Noticia {index + 1}</strong><button type="button" aria-label={`Eliminar noticia ${index + 1}`} onClick={() => setField('newsItems', content.newsItems.filter((news) => news.id !== item.id))}><FiTrash2 /></button></header><Upload label="Fotografía de noticia" value={item.image} onFile={(file) => void uploadImage(file, 'news', item.id)} onRemove={() => updateNews(item.id, { image: '' })} /><TextField label="Título de noticia" value={item.title} limit={100} onChange={(value) => updateNews(item.id, { title: value })} /><div className="news-field-row"><TextField label="Categoría" value={item.category} limit={30} onChange={(value) => updateNews(item.id, { category: value })} /><label className="builder-field">Fecha<input type="date" value={item.date} onChange={(event) => updateNews(item.id, { date: event.target.value })} /></label></div><TextField label="Contenido de noticia" value={item.summary} limit={360} multiline onChange={(value) => updateNews(item.id, { summary: value })} /></article>)}</>}
          {tab === 'media' && <><div className="builder-panel-heading"><span>LA IDENTIDAD DE TU BARRIO</span><h2>Imágenes con historia</h2><p>Fotografías propias hacen que tu sitio sea único. Las optimizamos al subirlas.</p></div><div className="media-fields"><Upload label="Logo de la junta" value={logo} help="Fondo transparente y formato cuadrado." onFile={(file) => void uploadImage(file, 'logo')} onRemove={() => patchDraft({ logo: '' })} /><Upload label="Imagen de portada" value={hero} help="Una foto horizontal de tu barrio o de una actividad." onFile={(file) => void uploadImage(file, 'hero')} onRemove={() => patchDraft({ hero: '' })} /><h3>Galería <small>{gallery.length}/6</small></h3><p className="builder-field-help">Momentos de la comunidad. La primera foto acompaña la sección Nosotros.</p><div className="media-gallery">{gallery.map((image, index) => <div key={image}><img src={image} alt={`Fotografía ${index + 1}`} /><button type="button" aria-label={`Quitar fotografía ${index + 1}`} onClick={() => patchDraft({ gallery: gallery.filter((_, itemIndex) => itemIndex !== index) })}><FiX /></button></div>)}</div>{gallery.length < 6 && <Upload label="Agregar a la galería" onFile={(file) => void uploadImage(file, 'gallery')} />}</div></>}
        </fieldset>
        {published && <div className="builder-unpublish">{confirmUnpublish ? <><p>La página dejará de ser visible. Su contenido se conserva.</p><button type="button" disabled={busy} onClick={() => void save('unpublish')}>Despublicar ahora</button><button type="button" onClick={() => setConfirmUnpublish(false)}>Cancelar</button></> : <button type="button" disabled={busy} onClick={() => setConfirmUnpublish(true)}>Despublicar página</button>}</div>}
      </aside>
      <section className={`builder-preview ${focused ? 'is-focused' : ''}`} aria-label="Vista previa"><div className="preview-toolbar"><div><span className="preview-live-dot" /> VISTA PREVIA <small>{selected.name}</small></div><div className="preview-devices" aria-label="Tamaño de la vista previa">{devices.map((item) => <button type="button" title={item.label} aria-label={item.label} aria-pressed={device.id === item.id} className={device.id === item.id ? 'active' : ''} onClick={() => setDevice(item)} key={item.id}><item.Icon /></button>)}</div><button type="button" className="preview-expand" aria-label={focused ? 'Cerrar vista ampliada' : 'Ampliar vista previa'} onClick={() => setFocused(!focused)}>{focused ? <FiMinimize2 /> : <FiMaximize2 />}</button></div><div className="preview-address"><span><i /><i /><i /></span><small>{url}</small><span>{device.width} px</span></div><div className="preview-canvas" ref={canvasRef}><div className="preview-scaled-space" style={{ width: device.width * previewScale, height: 900 * previewScale }}><div className="preview-scaled-site" style={{ width: device.width, transform: `scale(${previewScale})` }}><WebsitePreview onEscape={() => setFocused(false)} width={device.width} name={juntaName} template={template} content={content} theme={theme} logo={logo} hero={hero} gallery={gallery} /></div></div></div><p className="preview-footnote">Explora tu página. Los cambios aparecen aquí al instante.</p></section>
    </div>
  </div>;
}

function TextField({ label, value, onChange, multiline = false, limit = 160, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; limit?: number; placeholder?: string }) {
  return <label className="builder-field"><span>{label}</span>{multiline ? <textarea aria-label={label} value={value} maxLength={limit} onChange={(event) => onChange(event.target.value)} rows={4} /> : <input aria-label={label} value={value} maxLength={limit} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}<small>{value.length}/{limit}</small></label>;
}
function ServicesField({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [editing, setEditing] = useState({ text: value.join('\n'), value: value.join('\n') });
  return <label className="builder-field">Iniciativas (una por línea)<textarea aria-label="Iniciativas (una por línea)" value={value.join('\n') === editing.value ? editing.text : value.join('\n')} rows={5} onChange={(event) => { const services = event.target.value.split('\n').filter((item) => item.trim()).slice(0, 6); setEditing({ text: event.target.value, value: services.join('\n') }); onChange(services); }} /><small>Hasta seis iniciativas.</small></label>;
}
function EditorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="builder-editor-group" open><summary>{title}<FiChevronDown aria-hidden="true" /></summary><div>{children}</div></details>;
}
function ColorHex({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  return <input aria-label="Código hexadecimal" value={editing ?? value.toUpperCase()} maxLength={7} spellCheck={false} onChange={(event) => { setEditing(event.target.value); if (/^#[\da-f]{6}$/i.test(event.target.value)) onChange(event.target.value); }} onBlur={() => setEditing(null)} />;
}
function Upload({ label, value, help, onFile, onRemove }: { label: string; value?: string; help?: string; onFile: (file: File) => void; onRemove?: () => void }) {
  function select(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ''; if (file) onFile(file); }
  return <div className="builder-upload"><h3>{label}</h3>{help && <p className="builder-field-help">{help}</p>}{value ? <div className="media-current"><img src={value} alt={label} /><button type="button" onClick={onRemove} aria-label={`Quitar ${label.toLowerCase()}`}><FiTrash2 /> Quitar</button><label><FiUpload /> Reemplazar<input type="file" accept="image/*" aria-label={`Reemplazar ${label.toLowerCase()}`} onChange={select} /></label></div> : <label className="upload-drop"><FiUpload aria-hidden="true" /><span>Seleccionar imagen</span><small>Hasta 20 MB · conversión a WebP</small><input type="file" accept="image/*" aria-label={label} onChange={select} /></label>}</div>;
}
function TemplateThumbnail({ template, colors }: { template: WebsiteTemplate; colors: WebsiteTheme }) {
  return <span className={`template-thumbnail thumb-${template}`} aria-hidden="true" style={{ '--thumb-primary': colors.primary, '--thumb-accent': colors.accent, '--thumb-bg': colors.background } as React.CSSProperties}><i className="thumb-nav" /><span className="thumb-hero"><i className="thumb-copy"><b /><b /><b /><em /></i><i className="thumb-image" /></span><i className="thumb-links"><b /><b /><b /></i><i className="thumb-content"><b /><b /><b /></i></span>;
}

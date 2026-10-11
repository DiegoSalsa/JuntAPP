'use client';
/* User-provided Supabase media has dynamic URLs, so native img elements are intentional. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CONTENT, DEFAULT_THEME, type WebsiteContent, type WebsiteNewsItem, type WebsiteTemplate, type WebsiteTheme } from '@/lib/website';
import WebsiteRenderer from './WebsiteRenderer';

const templates: { id: WebsiteTemplate; name: string; note: string }[] = [
 { id: 'comunidad', name: 'Comunidad', note: 'Cálida, cercana y familiar' },
 { id: 'mural', name: 'Mural vecinal', note: 'Tablero de avisos y notas' },
 { id: 'institucional', name: 'Institucional', note: 'Menú lateral y presencia formal' },
 { id: 'noticias', name: 'Noticias', note: 'Portada de actualidad local' },
 { id: 'minimalista', name: 'Minimalista', note: 'Mucho aire y lectura directa' },
 { id: 'editorial', name: 'Revista barrial', note: 'Composición editorial asimétrica' },
 { id: 'fotografica', name: 'Fotográfica', note: 'Imágenes grandes e inmersivas' },
 { id: 'barrio', name: 'Barrio vivo', note: 'Bloques dinámicos y amigables' },
 { id: 'agenda', name: 'Agenda vecinal', note: 'Actividades en formato timeline' },
 { id: 'clasica', name: 'Clásica', note: 'Elegante, centrada y tradicional' },
 { id: 'portal', name: 'Portal ciudadano', note: 'Información densa y accesible' },
];
const colorMeta = {
 primary: { label: 'Color principal', help: 'Portada, noticias y fondos destacados' },
 accent: { label: 'Color de acento', help: 'Botones, etiquetas y líneas decorativas' },
 background: { label: 'Fondo general', help: 'Fondo de las secciones claras' },
 text: { label: 'Texto principal', help: 'Títulos y párrafos sobre fondos claros' },
} as const;
const palettes: { name: string; colors: WebsiteTheme }[] = [
 { name: 'Vecinal', colors: DEFAULT_THEME },
 { name: 'Costera', colors: { primary:'#075985',accent:'#06b6d4',background:'#f0f9ff',text:'#102a43' } },
 { name: 'Plaza', colors: { primary:'#285943',accent:'#e6a817',background:'#fffdf3',text:'#1c2b24' } },
 { name: 'Comunitaria', colors: { primary:'#5b235f',accent:'#e85d75',background:'#fff7f8',text:'#311b31' } },
 { name: 'Municipal', colors: { primary:'#173b67',accent:'#d97706',background:'#f8fafc',text:'#172033' } },
];
type PageData = {
 template?: WebsiteTemplate;
 content?: WebsiteContent;
 theme?: WebsiteTheme;
 logo_url?: string | null;
 hero_image_url?: string | null;
 gallery?: string[];
 published?: boolean;
 draft_template?: WebsiteTemplate | null;
 draft_content?: WebsiteContent | null;
 draft_theme?: WebsiteTheme | null;
 draft_logo_url?: string | null;
 draft_hero_image_url?: string | null;
 draft_gallery?: string[] | null;
} | null;
type WebsitePageUpsert = {
 junta_id: string;
 published: boolean;
 updated_at: string;
 template?: WebsiteTemplate;
 content?: WebsiteContent;
 theme?: WebsiteTheme;
 logo_url?: string | null;
 hero_image_url?: string | null;
 gallery?: string[];
 draft_template?: WebsiteTemplate | null;
 draft_content?: WebsiteContent | null;
 draft_theme?: WebsiteTheme | null;
 draft_logo_url?: string | null;
 draft_hero_image_url?: string | null;
 draft_gallery?: string[] | null;
};

function editorSnapshot(template: WebsiteTemplate, content: WebsiteContent, theme: WebsiteTheme, logo: string, hero: string, gallery: string[]) {
 return JSON.stringify({ template, content, theme, logo, hero, gallery });
}

async function convertToWebP(file: File, maxDimension = 1920) {
 const bitmap = await createImageBitmap(file);
 const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
 const width = Math.max(1, Math.round(bitmap.width * scale));
 const height = Math.max(1, Math.round(bitmap.height * scale));
 const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
 const context = canvas.getContext('2d'); if (!context) { bitmap.close(); throw new Error('No fue posible procesar la imagen.'); }
 context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
 const encode = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No fue posible convertir la imagen a WebP.')), 'image/webp', quality));
 let blob = await encode(.82); if (blob.size > 5_242_880) blob = await encode(.68);
 if (blob.size > 5_242_880) throw new Error('La imagen sigue superando 5 MB después de optimizarla.');
 return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

export default function WebsiteBuilder({ juntaId, juntaName, slug, plan, initial }: { juntaId: string; juntaName: string; slug: string; plan: 'web'|'juntapp_web'; initial: PageData }) {
 const initialContent = initial?.draft_content ?? initial?.content; const initialTheme = initial?.draft_theme ?? initial?.theme;
 const [template, setTemplate] = useState<WebsiteTemplate>(initial?.draft_template ?? initial?.template ?? 'comunidad'); const [content, setContent] = useState<WebsiteContent>({ ...DEFAULT_CONTENT, ...initialContent, newsItems: initialContent?.newsItems ?? [] });
 const [theme, setTheme] = useState<WebsiteTheme>({ ...DEFAULT_THEME, ...initialTheme }); const [logo, setLogo] = useState(initial?.draft_logo_url ?? initial?.logo_url ?? ''); const [hero, setHero] = useState(initial?.draft_hero_image_url ?? initial?.hero_image_url ?? '');
 const [selectedColor, setSelectedColor] = useState<keyof WebsiteTheme>('primary');
 const [gallery, setGallery] = useState<string[]>(initial?.draft_gallery ?? initial?.gallery ?? []); const [published, setPublished] = useState(initial?.published ?? false); const [tab, setTab] = useState<'design'|'content'|'news'|'media'>('design'); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
 const [savedSnapshot, setSavedSnapshot] = useState(() => editorSnapshot(template, content, theme, logo, hero, gallery));
 const currentSnapshot = editorSnapshot(template, content, theme, logo, hero, gallery);
 const hasUnsavedChanges = currentSnapshot !== savedSnapshot;
 const url = useMemo(() => `/sitio/${slug}`, [slug]);
 useEffect(() => {
  if (!hasUnsavedChanges) return;
  const handleBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
 }, [hasUnsavedChanges]);
 function setField<K extends keyof WebsiteContent>(key: K, value: WebsiteContent[K]) { setContent((current) => ({ ...current, [key]: value })); }
 async function uploadImage(file: File, target: 'logo'|'hero'|'gallery'|'news') { if (!file.type.startsWith('image/')) { setMessage('Selecciona un archivo de imagen válido.'); return null; } try { setMessage('Optimizando imagen a WebP…'); const optimized=await convertToWebP(file,target==='logo'?1200:1920); const supabase=createClient(); const path=`${juntaId}/${target}-${crypto.randomUUID()}.webp`; setMessage('Subiendo imagen optimizada…'); const { error }=await supabase.storage.from('website-media').upload(path,optimized,{contentType:'image/webp',upsert:false}); if(error){setMessage(error.message);return null;} const saved=Math.max(0,file.size-optimized.size); setMessage(`Imagen WebP agregada${saved?` · ${Math.round(saved/1024)} KB ahorrados`:''}. Guarda para conservar los cambios.`); return supabase.storage.from('website-media').getPublicUrl(path).data.publicUrl; } catch(error) { setMessage(error instanceof Error?error.message:'No fue posible optimizar la imagen.'); return null; } }
 async function upload(file: File, target: 'logo'|'hero'|'gallery') { const publicUrl=await uploadImage(file,target); if(!publicUrl)return; if(target==='logo')setLogo(publicUrl); else if(target==='hero')setHero(publicUrl); else setGallery((current)=>[...current,publicUrl].slice(0,6)); }
 function addNews(){const item:WebsiteNewsItem={id:crypto.randomUUID(),title:'Nueva noticia',summary:'Escribe aquí el contenido de la noticia para tus vecinos.',date:new Date().toISOString().slice(0,10),category:'Comunidad',image:''};setContent((current)=>({...current,newsItems:[item,...current.newsItems].slice(0,12)}));setTab('news');}
 function updateNews(id:string,patch:Partial<WebsiteNewsItem>){setContent((current)=>({...current,newsItems:current.newsItems.map((item)=>item.id===id?{...item,...patch}:item)}));}
 async function save(mode: 'draft'|'publish'|'unpublish') {
  setSaving(true); setMessage('Guardando…');
  const nextPublished = mode === 'publish' ? true : mode === 'unpublish' ? false : published;
  try {
   const draft = { draft_template:template, draft_content:content, draft_theme:theme, draft_logo_url:logo||null, draft_hero_image_url:hero||null, draft_gallery:gallery };
   const payload: WebsitePageUpsert = mode === 'draft'
    ? { junta_id:juntaId, ...draft, published:nextPublished, updated_at:new Date().toISOString() }
    : mode === 'publish'
      ? { junta_id:juntaId, template, content, theme, logo_url:logo||null, hero_image_url:hero||null, gallery, published:true, draft_template:null, draft_content:null, draft_theme:null, draft_logo_url:null, draft_hero_image_url:null, draft_gallery:null, updated_at:new Date().toISOString() }
      : { junta_id:juntaId, ...draft, published:false, updated_at:new Date().toISOString() };
   const { error } = await createClient().from('website_pages').upsert(payload, { onConflict:'junta_id' });
   if (error) { setMessage(error.message || 'No fue posible guardar los cambios.'); return; }
   setPublished(nextPublished); setSavedSnapshot(editorSnapshot(template, content, theme, logo, hero, gallery));
   if (mode === 'draft') { setMessage('Borrador guardado. La versión pública se mantiene.'); return; }
   if (mode === 'unpublish') { setMessage('Página despublicada.'); return; }
   const latestNews=content.newsItems[0];
   const response=await fetch('/api/notifications/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'general',title:`La web de ${juntaName} fue actualizada`,message:latestNews?.title?`Nueva publicación: ${latestNews.title}`:'La directiva publicó novedades en el sitio comunitario.',action:url,eventKey:`website:${juntaId}:${Date.now()}`})});
   const result=await response.json();
   if(!response.ok){setMessage(`Página publicada, pero no fue posible preparar el aviso: ${result.error??'reintenta desde el Centro de notificaciones.'}`);return;}
   setMessage(result.pushStatus==='delivered'?`Página publicada y aviso enviado a ${result.pushDelivered} dispositivo(s).`:'Página publicada; el aviso push quedó en reintento automático.');
  } catch { setMessage('No fue posible guardar la página. Revisa tu conexión e inténtalo nuevamente.'); }
  finally { setSaving(false); }
 }
 return <div className="builder-shell"><header className="builder-top"><div><span>CREADOR DE PÁGINAS · {plan==='web'?'PLAN SOLO PÁGINA':'JUNTAPP + PÁGINA'}</span><h1>La web de {juntaName}</h1></div><div className="builder-actions">{published&&<a href={url} target="_blank" rel="noreferrer">Ver página ↗</a>}<span className="builder-save-status" aria-live="polite">{hasUnsavedChanges ? 'Cambios sin guardar' : 'Guardado'}</span><button onClick={()=>void save('draft')} disabled={saving}>Guardar borrador</button>{published&&<button onClick={()=>void save('unpublish')} disabled={saving}>Despublicar</button>}<button className="publish" onClick={()=>void save('publish')} disabled={saving}>{published?'Actualizar publicación':'Publicar'}</button></div></header>
  <div className="builder-workspace"><aside className="builder-panel"><div className="builder-tabs"><button className={tab==='design'?'active':''} onClick={()=>setTab('design')}>Diseño</button><button className={tab==='content'?'active':''} onClick={()=>setTab('content')}>Textos</button><button className={tab==='news'?'active':''} onClick={()=>setTab('news')}>Noticias</button><button className={tab==='media'?'active':''} onClick={()=>setTab('media')}>Medios</button></div>
   {tab==='design'&&<><h2>Plantilla</h2><div className="template-list">{templates.map((item)=><button className={template===item.id?'selected':''} onClick={()=>setTemplate(item.id)} key={item.id}><i className={`template-thumb ${item.id}`} /><span><strong>{item.name}</strong><small>{item.note}</small></span></button>)}</div><div className="color-section-title"><div><h2>Colores del sitio</h2><small>Selecciona exactamente qué elemento quieres cambiar</small></div><button onClick={()=>setTheme(DEFAULT_THEME)}>Restaurar</button></div><div className="palette-list" aria-label="Combinaciones de colores">{palettes.map((palette)=><button key={palette.name} onClick={()=>setTheme(palette.colors)} title={`Aplicar paleta ${palette.name}`}><span>{Object.values(palette.colors).map((color)=><i style={{background:color}} key={color}/>)}</span><small>{palette.name}</small></button>)}</div><div className="color-fields">{(Object.keys(colorMeta) as (keyof WebsiteTheme)[]).map((key)=><div className={`color-control ${selectedColor===key?'selected':''}`} key={key} onClick={()=>setSelectedColor(key)}><button className="color-picker-button" type="button" onClick={()=>setSelectedColor(key)}><span className="color-swatch" style={{background:theme[key]}}/><span><strong>{colorMeta[key].label}</strong><small>{colorMeta[key].help}</small></span><b>{selectedColor===key?'EDITANDO':'EDITAR'}</b></button>{selectedColor===key&&<div className="color-editor"><label><span>Selector visual</span><input type="color" value={theme[key]} onChange={(e)=>setTheme({...theme,[key]:e.target.value})}/></label><label><span>Código de color</span><input className="hex-input" value={theme[key].toUpperCase()} maxLength={7} onChange={(e)=>{const value=e.target.value;if(/^#[0-9A-Fa-f]{6}$/.test(value))setTheme({...theme,[key]:value});}}/></label><div className="color-preview-strip" style={{background:theme[key],color:key==='background'?'#172033':'#fff'}}>Vista del {colorMeta[key].label.toLowerCase()}</div></div>}</div>)}</div></>}
   {tab==='content'&&<div className="content-fields"><label>Título principal<input value={content.title} onChange={(e)=>setField('title',e.target.value)} maxLength={80}/></label><label>Bajada<textarea value={content.subtitle} onChange={(e)=>setField('subtitle',e.target.value)} maxLength={180}/></label><label>Título “Nosotros”<input value={content.aboutTitle} onChange={(e)=>setField('aboutTitle',e.target.value)}/></label><label>Descripción<textarea value={content.about} onChange={(e)=>setField('about',e.target.value)}/></label><label>Servicios (uno por línea, hasta 6)<textarea value={content.services.join('\n')} onChange={(e)=>setField('services',e.target.value.split('\n').filter(Boolean).slice(0,6))}/></label><label>Encabezado de noticias<input value={content.newsTitle} onChange={(e)=>setField('newsTitle',e.target.value)}/></label><label>Introducción a noticias<textarea value={content.news} onChange={(e)=>setField('news',e.target.value)}/></label><div className="contact-editor-heading"><strong>Contacto y redes sociales</strong><small>Solo se mostrarán los datos que completes</small></div><label>Texto de contacto<textarea value={content.contact} onChange={(e)=>setField('contact',e.target.value)}/></label><label>Dirección<input value={content.address} onChange={(e)=>setField('address',e.target.value)}/></label><label>WhatsApp<input inputMode="tel" placeholder="Ej: +56 9 1234 5678" value={content.whatsapp} onChange={(e)=>setField('whatsapp',e.target.value)} /><small>Al publicar se convertirá automáticamente en un enlace directo.</small></label><label>Facebook<input placeholder="Usuario o enlace de Facebook" value={content.facebook} onChange={(e)=>setField('facebook',e.target.value)}/></label><label>Instagram<input placeholder="@usuario o enlace de Instagram" value={content.instagram} onChange={(e)=>setField('instagram',e.target.value)}/></label></div>}
   {tab==='news'&&<div className="news-manager"><div className="news-manager-head"><div><h2>Noticias publicadas</h2><small>Hasta 12 noticias con imagen</small></div><button onClick={addNews}>+ Nueva</button></div>{content.newsItems.length===0&&<div className="news-empty"><b>Aún no hay noticias</b><p>Publica actividades, cortes de servicios, asambleas o avances del barrio.</p><button onClick={addNews}>Crear primera noticia</button></div>}{content.newsItems.map((item)=><article className="news-editor-card" key={item.id}><div className="news-editor-image">{item.image?<><img src={item.image} alt=""/><button onClick={()=>updateNews(item.id,{image:''})}>Quitar</button></>:<label><input type="file" accept="image/*" onChange={async(e)=>{const file=e.target.files?.[0];if(file){const image=await uploadImage(file,'news');if(image)updateNews(item.id,{image});}}}/><span>+ Imagen</span></label>}</div><div className="news-editor-fields"><input aria-label="Título de noticia" value={item.title} maxLength={100} onChange={(e)=>updateNews(item.id,{title:e.target.value})}/><div><input aria-label="Categoría" value={item.category} maxLength={30} onChange={(e)=>updateNews(item.id,{category:e.target.value})}/><input aria-label="Fecha" type="date" value={item.date} onChange={(e)=>updateNews(item.id,{date:e.target.value})}/></div><textarea aria-label="Contenido de noticia" value={item.summary} maxLength={360} onChange={(e)=>updateNews(item.id,{summary:e.target.value})}/><button className="remove-news" onClick={()=>setContent((current)=>({...current,newsItems:current.newsItems.filter((news)=>news.id!==item.id)}))}>Eliminar noticia</button></div></article>)}</div>}
   {tab==='media'&&<div className="media-fields"><Upload label="Logo de la junta" value={logo} onFile={(f)=>void upload(f,'logo')} onRemove={()=>setLogo('')}/><Upload label="Imagen de portada" value={hero} onFile={(f)=>void upload(f,'hero')} onRemove={()=>setHero('')}/><h2>Galería (hasta 6)</h2><label className="upload-drop"><input type="file" accept="image/*" onChange={(e)=>e.target.files?.[0]&&void upload(e.target.files[0],'gallery')}/><b>+ Agregar fotografía</b><small>JPG, PNG, GIF o WebP · optimización automática</small></label><div className="media-gallery">{gallery.map((img)=><button onClick={()=>setGallery(gallery.filter((x)=>x!==img))} key={img}><img src={img} alt=""/><span>Quitar</span></button>)}</div></div>}
   {message&&<p className="builder-message">{message}</p>}
  </aside><section className="builder-preview"><div className="preview-bar"><span>Vista previa</span><small>{published?`Publicada en ${url}`:'Aún no publicada'}</small></div><div className="preview-frame"><WebsiteRenderer name={juntaName} template={template} content={content} theme={theme} logo={logo} hero={hero} gallery={gallery}/></div></section></div></div>;
}
function Upload({label,value,onFile,onRemove}:{label:string;value:string;onFile:(f:File)=>void;onRemove:()=>void}){return <div><h2>{label}</h2>{value?<div className="media-current"><img src={value} alt="Vista previa"/><button onClick={onRemove}>Quitar</button></div>:<label className="upload-drop"><input type="file" accept="image/*" onChange={(e)=>e.target.files?.[0]&&onFile(e.target.files[0])}/><b>+ Subir imagen</b><small>JPG, PNG, GIF o WebP · optimización automática</small></label>}</div>}

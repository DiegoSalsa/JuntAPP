'use client';
/* Images are dynamic user uploads stored in Supabase. */
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

export default function GalleryCarousel({ images, name }: { images: string[]; name: string }) {
 const [active, setActive] = useState(0);
 if(!images.length)return null;
 const visible = active % images.length;
 const move=(step:number)=>setActive((current)=>(current+step+images.length)%images.length);
 return <section className="site-section site-gallery-section" id="galeria" aria-label={`Galería de ${name}`}>
  <div className="site-gallery-heading"><span>NUESTRA COMUNIDAD</span><h2>Galería vecinal</h2><p>Actividades, encuentros y momentos que construimos juntos.</p></div>
  <div className="gallery-carousel"><div className="gallery-track" style={{transform:`translateX(-${visible*100}%)`}}>{images.map((image,index)=><figure key={image} aria-hidden={index!==visible}><img src={image} alt={`Fotografía ${index+1} de la comunidad ${name}`}/><figcaption>{index+1} / {images.length}</figcaption></figure>)}</div>{images.length>1&&<><button className="gallery-arrow previous" type="button" onClick={()=>move(-1)} aria-label="Imagen anterior">‹</button><button className="gallery-arrow next" type="button" onClick={()=>move(1)} aria-label="Imagen siguiente">›</button><div className="gallery-dots">{images.map((image,index)=><button type="button" className={index===visible?'active':''} onClick={()=>setActive(index)} aria-label={`Ver imagen ${index+1}`} aria-current={index===visible?'true':undefined} key={image}/>)}</div></>}</div>
 </section>;
}

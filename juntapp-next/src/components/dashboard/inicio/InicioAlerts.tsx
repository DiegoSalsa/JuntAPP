'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { deviceKey } from '@/lib/device-key';

type PushState = 'checking' | 'unsupported' | 'ios-install' | 'available' | 'subscribed' | 'denied' | 'error' | 'unconfigured';
type Platform = 'ios' | 'android' | 'desktop' | 'unknown';
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type DeliveryJob = { id: string; title: string; status: 'pending' | 'processing' | 'delivered' | 'partial' | 'failed'; subscription_count: number; delivered_count: number; failed_count: number; attempts: number; created_at: string };
type DeliveryStatus = {
  personal?: { devices: number; installed: boolean; subscriptions: number; notificationsEnabled: boolean };
  organization?: { members: number; installedUsers: number; subscribedUsers: number; devices: number; subscriptions: number; healthySubscriptions: number };
  jobs?: DeliveryJob[];
};

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function currentPlatform(): Platform {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  return /windows|macintosh|linux/i.test(navigator.userAgent) ? 'desktop' : 'unknown';
}

function isStandalone() {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

async function saveSubscription(subscription: PushSubscription, key: string, platform: Platform, installed: boolean) {
  const response = await fetch('/api/notifications/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...subscription.toJSON(), deviceKey: key, platform, installationStatus: installed ? 'installed' : 'browser' }),
  });
  if (!response.ok) throw new Error('No fue posible registrar este dispositivo.');
}

async function saveDeviceState(key: string, platform: Platform, installed: boolean, notificationsEnabled: boolean) {
  await fetch('/api/notifications/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceKey: key, platform, installationStatus: installed ? 'installed' : 'browser', notificationsEnabled }),
  });
}

const InstallIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg>;
const BellIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
const ShareIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V3m0 0L8 7m4-4 4 4M5 12v8h14v-8" /></svg>;
const AddIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10" /></svg>;

export default function InicioAlerts({ urgent, isDirigente }: { urgent?: string; isDirigente: boolean }) {
  const [showUrgent, setShowUrgent] = useState(Boolean(urgent));
  const [pushState, setPushState] = useState<PushState>('checking');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [key, setKey] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [status, setStatus] = useState<DeliveryStatus>({});
  const [centerMessage, setCenterMessage] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const response = await fetch('/api/notifications/push/status', { cache: 'no-store' });
    if (response.ok) setStatus(await response.json());
  }, []);

  useEffect(() => {
    let detectedPlatform: Platform = 'unknown';
    let detectedInstalled = false;
    let detectedKey = '';
    try {
      detectedPlatform = currentPlatform();
      detectedInstalled = isStandalone();
      detectedKey = deviceKey();
    } catch (error) {
      console.error('[inicio] Optional device setup failed', error);
      queueMicrotask(() => setPushState('error'));
      return;
    }
    queueMicrotask(() => {
      setPlatform(detectedPlatform);
      setInstalled(detectedInstalled);
      setKey(detectedKey);
      if (window.__juntAppInstallPrompt) setInstallPrompt(window.__juntAppInstallPrompt);
    });

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstallAvailable = () => {
      if (window.__juntAppInstallPrompt) setInstallPrompt(window.__juntAppInstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      delete window.__juntAppInstallPrompt;
      setCenterMessage('JuntAPP quedó instalada en este dispositivo.');
      void saveDeviceState(detectedKey, detectedPlatform, true, typeof Notification !== 'undefined' && Notification.permission === 'granted').catch((error) => console.error('[inicio] Device registration failed', error));
      void refreshStatus().catch((error) => console.error('[inicio] Push status unavailable', error));
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('juntapp-install-available', onInstallAvailable);
    window.addEventListener('appinstalled', onInstalled);

    let cancelled = false;
    async function inspectPush() {
      if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || typeof PushManager === 'undefined') {
        if (!cancelled) setPushState('unsupported');
        return;
      }
      if (detectedPlatform === 'ios' && !detectedInstalled) {
        if (!cancelled) setPushState('ios-install');
        try {
          await saveDeviceState(detectedKey, detectedPlatform, false, false);
          await refreshStatus();
        } catch (error) {
          console.error('[inicio] Push status unavailable', error);
        }
        return;
      }
      try {
        const configResponse = await fetch('/api/notifications/push/subscriptions', { cache: 'no-store' });
        const config = await configResponse.json() as { configured?: boolean; publicKey?: string | null };
        if (!configResponse.ok || !config.configured || !config.publicKey) {
          if (!cancelled) setPushState('unconfigured');
          return;
        }
        if (cancelled) return;
        setPublicKey(config.publicKey);
        if (Notification.permission === 'denied') {
          setPushState('denied');
          await saveDeviceState(detectedKey, detectedPlatform, detectedInstalled, false);
          await refreshStatus();
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration() ?? await navigator.serviceWorker.register('/sw.js');
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await saveSubscription(existing, detectedKey, detectedPlatform, detectedInstalled);
          if (!cancelled) setPushState('subscribed');
          await saveDeviceState(detectedKey, detectedPlatform, detectedInstalled, true);
        } else if (!cancelled) {
          setPushState('available');
          await saveDeviceState(detectedKey, detectedPlatform, detectedInstalled, false);
        }
        await refreshStatus();
      } catch (error) {
        console.error('[inicio] Push setup failed', error);
        if (!cancelled) setPushState('error');
      }
    }
    void inspectPush();
    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('juntapp-install-available', onInstallAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [refreshStatus]);

  async function installApp() {
    if (platform === 'ios') {
      setGuideOpen(true);
      return;
    }
    if (!installPrompt) {
      setCenterMessage(platform === 'android'
        ? 'En Android, abre el menú ⋮ de Chrome y toca “Instalar aplicación” o “Agregar a pantalla principal”.'
        : 'Abre el menú de tu navegador y elige “Instalar JuntAPP” o “Crear acceso directo”.');
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'dismissed') setCenterMessage('Puedes instalar JuntAPP más tarde desde este mismo botón.');
      setInstallPrompt(null);
      delete window.__juntAppInstallPrompt;
    } catch (error) {
      console.error('[inicio] Install prompt failed', error);
      setCenterMessage('No fue posible instalar JuntAPP desde este navegador.');
    }
  }

  async function activateNotifications() {
    if (!publicKey || !key) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState(permission === 'denied' ? 'denied' : 'available');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      await saveSubscription(subscription, key, platform, installed);
      await saveDeviceState(key, platform, installed, true);
      setPushState('subscribed');
      setCenterMessage('Notificaciones activadas. Este dispositivo ya recibirá los avisos de la directiva.');
      await registration.showNotification('JuntAPP activado', { body: 'Este dispositivo ya puede recibir avisos importantes de tu comunidad.', icon: '/icons/pwa/icon-192.png?v=rounded-j-20260812', badge: '/icons/notification-badge.png?v=rounded-j-20260812', tag: 'juntapp-push-enabled' });
      await refreshStatus();
    } catch {
      setPushState('error');
      setCenterMessage('No fue posible activar las notificaciones. Revisa los permisos del navegador.');
    }
  }

  async function deactivateNotifications() {
    if (!key || !('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/notifications/push/subscriptions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint, deviceKey: key }) });
        await subscription.unsubscribe();
      }
      await saveDeviceState(key, platform, installed, false);
      setPushState('available');
      setCenterMessage('Notificaciones desactivadas en este dispositivo.');
      await refreshStatus();
    } catch (error) {
      console.error('[inicio] Push deactivation failed', error);
      setPushState('error');
      setCenterMessage('No fue posible desactivar las notificaciones. Intenta nuevamente.');
    }
  }

  async function retryJob(jobId: string) {
    setRetrying(jobId);
    try {
      const response = await fetch('/api/notifications/push/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }) });
      setCenterMessage(response.ok ? 'Reintento procesado.' : 'No fue posible reintentar el envío.');
      await refreshStatus();
    } catch (error) {
      console.error('[inicio] Push retry failed', error);
      setCenterMessage('No fue posible reintentar el envío.');
    } finally {
      setRetrying(null);
    }
  }

  const installLabel = installed ? 'Instalada' : platform === 'ios' ? 'Ver guía visual' : installPrompt ? 'Instalar JuntAPP' : 'Cómo instalar';
  const pushLabel = pushState === 'subscribed' ? 'Activadas' : pushState === 'denied' ? 'Bloqueadas' : 'Activar notificaciones';
  const coverage = useMemo(() => status.organization?.members ? Math.round((status.organization.subscribedUsers / status.organization.members) * 100) : 0, [status.organization]);

  return <>
    {showUrgent && urgent && <div className="alert-banner"><div className="alert-icon">!</div><div className="alert-content"><strong>AVISO URGENTE:</strong> {urgent}</div><button className="alert-close" onClick={() => setShowUrgent(false)} aria-label="Cerrar alerta">×</button></div>}

    <section className="notification-center shadow-box" aria-labelledby="notification-center-title">
      <header className="notification-center-head"><div><span className="notification-center-kicker">JuntAPP en tu bolsillo</span><h3 id="notification-center-title">Instalación y notificaciones</h3><p>Instala una vez y recibe los avisos oficiales aunque JuntAPP esté cerrada.</p></div><span className={`notification-health ${pushState === 'subscribed' ? 'active' : ''}`}><i />{pushState === 'subscribed' ? 'Este dispositivo está conectado' : 'Falta completar la activación'}</span></header>
      <div className="notification-setup-grid">
        <article className={`setup-card ${installed ? 'complete' : ''}`}><div className="setup-card-icon"><InstallIcon /></div><div className="setup-card-copy"><span className="setup-eyebrow">Acceso rápido</span><h4>Instala JuntAPP</h4><p>{installed ? 'Se abre como una app y ya está disponible desde tu pantalla de inicio.' : platform === 'ios' ? 'Te mostramos visualmente dónde tocar en tu iPhone o iPad.' : 'Ábrela como una app, sin escribir la dirección cada vez.'}</p></div><button className={`btn ${installed ? 'btn-ghost' : 'btn-primary'}`} disabled={installed} onClick={() => void installApp()}>{installed ? '✓ Instalada' : installLabel}</button></article>
        <article className={`setup-card ${pushState === 'subscribed' ? 'complete' : ''}`}><div className="setup-card-icon"><BellIcon /></div><div className="setup-card-copy"><span className="setup-eyebrow">Avisos oficiales</span><h4>Activa las notificaciones</h4><p>{pushState === 'subscribed' ? 'Recibirás comunicados, consultas, asambleas y novedades de tu junta.' : pushState === 'unsupported' ? 'Las notificaciones no son compatibles con este navegador. Puedes seguir usando JuntAPP normalmente.' : pushState === 'ios-install' ? 'En iPhone se activan después de instalar JuntAPP.' : pushState === 'denied' ? 'El navegador las bloqueó; debes habilitarlas en la configuración del sitio.' : 'Tú decides: el permiso solo se solicita cuando presionas el botón.'}</p></div>{pushState === 'subscribed' ? <button className="btn btn-ghost" onClick={() => void deactivateNotifications()}>Desactivar aquí</button> : <button className="btn btn-primary" disabled={['checking', 'unsupported', 'unconfigured', 'ios-install'].includes(pushState)} onClick={() => void activateNotifications()}>{pushLabel}</button>}</article>
      </div>
      {centerMessage && <p className="notification-center-message" role="status">{centerMessage}</p>}

      {isDirigente && status.organization && <div className="delivery-dashboard"><div className="delivery-dashboard-head"><div><span className="setup-eyebrow">Vista de la directiva</span><h4>Cobertura de avisos</h4></div><strong>{coverage}% con push activo</strong></div><div className="delivery-metrics"><div><b>{status.organization.members}</b><span>vecinos</span></div><div><b>{status.organization.installedUsers}</b><span>instalaron la app</span></div><div><b>{status.organization.subscribedUsers}</b><span>activaron push</span></div><div><b>{status.organization.healthySubscriptions}</b><span>dispositivos sanos</span></div></div>{Boolean(status.jobs?.length) && <div className="delivery-jobs"><h5>Últimos envíos</h5>{status.jobs?.slice(0, 5).map((job) => <div className="delivery-job" key={job.id}><div><strong>{job.title}</strong><span>{job.delivered_count}/{job.subscription_count} dispositivos · {job.attempts} intento(s)</span></div><span className={`delivery-status ${job.status}`}>{job.status === 'delivered' ? 'Entregado' : job.status === 'processing' ? 'Enviando' : job.status === 'pending' ? 'Pendiente' : job.status === 'partial' ? 'Reintentará' : 'Falló'}</span>{['partial', 'failed'].includes(job.status) && <button className="btn btn-sm btn-ghost" disabled={retrying === job.id} onClick={() => void retryJob(job.id)}>{retrying === job.id ? 'Reintentando…' : 'Reintentar'}</button>}</div>)}</div>}</div>}
    </section>

    {guideOpen && <div className="modal active install-guide-modal" role="dialog" aria-modal="true" aria-labelledby="install-guide-title"><div className="modal-dialog install-guide-dialog"><div className="modal-content"><div className="modal-header"><div><span className="notification-center-kicker">Guía visual</span><h3 className="modal-title" id="install-guide-title">Lleva JuntAPP a tu iPhone</h3></div><button className="modal-close" onClick={() => setGuideOpen(false)} aria-label="Cerrar guía">×</button></div><div className="ios-guide-scene"><div className="iphone-frame" aria-hidden="true"><div className="iphone-island"/><div className="iphone-screen"><div className="iphone-app-preview"><Image src="/icons/pwa/icon-192.png" alt="" width={72} height={72}/><strong>JuntAPP</strong><small>Tu comunidad, siempre cerca</small></div><div className="safari-address">juntapp.cl</div><div className="safari-toolbar"><span>‹</span><span>›</span><b><ShareIcon /></b><span>▢</span><span>•••</span></div></div></div><div className="ios-guide-flow"><div className="ios-visual-card share"><span className="ios-action-icon"><ShareIcon /></span><div><strong>Toca Compartir</strong><small>El cuadrado con la flecha está abajo en Safari.</small></div></div><div className="ios-flow-arrow">↓</div><div className="ios-visual-card add"><span className="ios-action-icon"><AddIcon /></span><div><strong>Agregar a inicio</strong><small>Busca este símbolo en el menú que se abre.</small></div></div><div className="ios-flow-arrow">↓</div><div className="ios-visual-card ready"><Image src="/icons/pwa/icon-192.png" alt="Icono de JuntAPP" width={56} height={56}/><div><strong>Abre JuntAPP</strong><small>Vuelve a Inicio y activa la campana desde este centro.</small></div></div></div></div><div className="ios-guide-tip"><BellIcon /><span><strong>Importante:</strong> las notificaciones de iPhone aparecen después de abrir la app instalada y tocar “Activar notificaciones”.</span></div><div className="modal-footer"><button className="btn btn-primary" onClick={() => setGuideOpen(false)}>Entendido, voy a instalarla</button></div></div></div></div>}
  </>;
}

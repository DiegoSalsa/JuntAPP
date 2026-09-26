'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Junta, Notification, Profile } from '@/lib/types';
import { boardPositionLabel } from '@/lib/board';
import DashboardTour from './DashboardTour';
import BrandMark from '@/components/brand/BrandMark';

const navigation = [
  { route: 'inicio', label: 'Inicio', icon: 'home' },
  { route: 'socios', label: 'Registro de Socios', icon: 'users' },
  { route: 'tesoreria', label: 'Tesorería Transparente', icon: 'money' },
  { route: 'consultas', label: 'Consultas Comunitarias', icon: 'vote' },
  { route: 'comunicaciones', label: 'Anuncios Oficiales', icon: 'mail' },
  { route: 'mi-pagina', label: 'Mi Página Web', icon: 'website' },
] as const;

function NavIcon({ icon }: { icon: typeof navigation[number]['icon'] }) {
  const paths = {
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></>,
    money: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    vote: <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3,7 12,13 21,7"/></>,
    website: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></>,
  };
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[icon]}</svg>;
}

function BellIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}

export default function OriginalDashboardShell({ profile, junta, trialEndsAt, children }: { profile: Profile; junta: Junta | null; trialEndsAt: string | null; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentRoute = pathname.split('/')[1] || 'inicio';
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const hasWebsitePlan = ['web', 'juntapp_web'].includes(junta?.subscription_plan ?? '');
  const visibleNavigation = navigation
    .filter((item) => item.route === 'mi-pagina' ? hasWebsitePlan : junta?.subscription_plan !== 'web')
    .map((item) => item.route === 'mi-pagina' && profile.role === 'vecino'
      ? { ...item, label: 'Web de la Junta', href: `/sitio/${junta?.slug}` }
      : { ...item, href: `/${item.route}` });

  useEffect(() => {
    if (profile.role === 'dirigente' && junta?.subscription_plan === 'web' && pathname !== '/mi-pagina') router.replace('/mi-pagina');
    const supabase = createClient();
    async function loadNotifications() {
      try {
        const { data, error } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('date', { ascending: false }).limit(10);
        if (error) {
          console.error('[dashboard] Notifications unavailable', { route: pathname, code: error.code });
          return;
        }
        setNotifications(data ?? []);
      } catch (error) {
        console.error('[dashboard] Notifications unavailable', { route: pathname, error });
      }
    }
    void loadNotifications();
    const channel = supabase.channel(`notifications:${profile.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, (payload) => setNotifications((current) => [payload.new as Notification, ...current].slice(0, 10))).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [junta?.subscription_plan, pathname, profile.id, profile.role, router]);

  function toggleCollapsed() {
    setCollapsed((value) => {
      try { localStorage.setItem('juntapp_sidebar_collapsed', String(!value)); } catch { /* Sidebar state is optional. */ }
      return !value;
    });
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  async function markAllRead() {
    await createClient().from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }

  async function openNotification(notification: Notification) {
    if (!notification.read) {
      await createClient().from('notifications').update({ read: true }).eq('id', notification.id).eq('user_id', profile.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    }
    setNotificationsOpen(false);
    if (notification.action?.startsWith('/')) router.push(notification.action);
  }

  return <div className="original-dashboard-root">
    <DashboardTour />
    <a href="#mainContent" className="skip-link">Saltar al contenido principal</a>
    <div className={`app-layout ${collapsed ? 'collapsed-sidebar' : ''} ${junta?.subscription_plan === 'web' ? 'website-only-plan' : ''}`}>
      <aside className="app-sidebar">
        <button className="sidebar-collapse-handle" onClick={toggleCollapsed} aria-label="Contraer o expandir barra lateral" title="Contraer / Expandir menú lateral"><span aria-hidden="true">‹</span></button>
        <button className="sidebar-brand" onClick={toggleCollapsed} title="Contraer / Expandir menú lateral">
          <span className="logo-wrapper"><BrandMark className="brand-logo-img" size={48} /></span>
          <span className="brand-info"><span className="brand-name">Junt<strong>APP</strong></span><span className="brand-tagline">{junta?.subscription_plan === 'web' ? 'Creador de páginas' : junta?.name ?? 'Mi Junta'}</span></span>
        </button>
        <div className="sidebar-profile">
          <div className="sidebar-profile-main"><div className="sidebar-user-avatar" id="userAvatar">{profile.name.charAt(0).toUpperCase()}</div><div className="sidebar-user-copy"><strong id="userProfileName">{profile.name}</strong><span id="userProfileRole">{junta?.subscription_plan === 'web' ? 'Editor del sitio web' : profile.role === 'dirigente' ? boardPositionLabel(profile.board_position) : 'Vecino'}</span></div></div>
          <div className="sidebar-profile-meta"><span id="userProfileRut">RUT: {profile.rut}</span><button id="btnLogoutBtn" onClick={logout}>Cerrar Sesión</button></div>
        </div>
        <nav className="sidebar-nav" aria-label="Navegación del panel">
          {visibleNavigation.map((item) => <Link href={item.href} aria-label={item.label} title={item.label} className={`nav-item ${currentRoute === item.route ? 'active' : ''}`} id={`nav-${item.route}`} data-view={item.route} key={item.route}><NavIcon icon={item.icon}/><span>{item.label}</span>{item.route === 'comunicaciones' && unreadCount > 0 && <span className="badge badge-accent">{unreadCount}</span>}</Link>)}
        </nav>
        <div className="sidebar-footer">
          <button className="theme-btn notifications-bell-btn" id="bellToggle" onClick={() => setNotificationsOpen((value) => !value)}><span className="bell-icon-wrapper"><BellIcon />{unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}</span><span>Notificaciones</span></button>
          <button className="theme-btn dashboard-logout-btn" type="button" onClick={logout}><span aria-hidden="true">↪</span><span>Cerrar sesión</span></button>
          <div className="purocode-signature">Powered by <strong>PuroCode</strong></div>
        </div>
      </aside>
      <main className="app-main-content" id="mainContent">
        <header className="mobile-header"><div className="mobile-logo"><BrandMark size={36} /><span>Junt<strong>APP</strong></span></div><div className="mobile-header-actions"><button className="mobile-bell-btn" id="mobileBellToggle" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Ver notificaciones"><BellIcon />{unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}</button><button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen?'Cerrar menú':'Abrir menú'} aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen((value)=>!value)}><span/><span/><span/></button></div></header>
        {mobileMenuOpen&&<div className="mobile-navigation-menu" role="navigation" aria-label="Menú principal">{visibleNavigation.map((item)=><Link href={item.href} className={`mobile-navigation-link ${currentRoute===item.route?'active':''}`} key={item.route} onClick={()=>setMobileMenuOpen(false)}><NavIcon icon={item.icon}/><span>{item.label}</span></Link>)}<div className="mobile-menu-secondary"><button type="button" className="logout" onClick={logout}>Cerrar sesión</button></div></div>}
        {trialEndsAt && (
          <div className="mx-4 mt-4 border-4 border-black bg-[#fff4a3] px-4 py-3 text-[#071b34] shadow-[4px_4px_0_#000] sm:mx-6">
            <p className="text-xs font-black uppercase">Período gratuito hasta {new Intl.DateTimeFormat('es-CL').format(new Date(trialEndsAt))}</p>
            <p className="mt-1 text-xs font-bold">Al finalizar, Presidencia deberá activar la suscripción mensual con Mercado Pago para conservar el acceso.</p>
          </div>
        )}
        {children}
      </main>
    </div>
    <aside className={`notifications-panel ${notificationsOpen ? 'active' : ''}`} aria-live="polite"><div className="panel-header"><h3>Notificaciones Recientes</h3><button className="btn-clear-all" onClick={markAllRead}>Marcar todo como leído</button></div><div className="panel-list">{notifications.length ? notifications.map((notification) => <button type="button" onClick={() => openNotification(notification)} key={notification.id} className={`notification-item type-${notification.type} ${notification.read ? 'read' : 'unread'}`}><strong className="noti-title">{notification.title}</strong><p className="noti-message">{notification.message}</p></button>) : <div className="empty-notifications">No tienes notificaciones nuevas</div>}</div></aside>
  </div>;
}

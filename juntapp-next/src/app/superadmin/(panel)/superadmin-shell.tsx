'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  FiActivity,
  FiBarChart2,
  FiBell,
  FiCreditCard,
  FiHome,
  FiInbox,
  FiLogOut,
  FiMenu,
  FiShield,
  FiUsers,
  FiX,
} from 'react-icons/fi';

const navigation = [
  { href: '/superadmin', label: 'Resumen', icon: FiBarChart2 },
  { href: '/superadmin/juntas', label: 'Juntas', icon: FiHome },
  { href: '/superadmin/solicitudes-prueba', label: 'Pruebas', icon: FiInbox },
  { href: '/superadmin/usuarios', label: 'Usuarios', icon: FiUsers },
  { href: '/superadmin/suscripciones', label: 'Suscripciones', icon: FiCreditCard },
  { href: '/superadmin/operaciones', label: 'Operaciones', icon: FiActivity },
  { href: '/superadmin/comunicaciones', label: 'Comunicaciones', icon: FiBell },
];

export default function SuperadminShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const body = document.body;
    const previousClasses = body.className;
    body.classList.remove('style-swiss', 'logged-out', 'logged-in', 'role-vecino', 'role-dirigente');
    body.classList.add('superadmin-body');

    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      body.className = previousClasses;
      document.body.style.overflow = '';
    };
  }, [open]);

  async function logout() {
    await fetch('/api/auth/superadmin-logout', { method: 'POST' });
    router.replace('/superadmin/login');
    router.refresh();
  }

  return (
    <div className="superadmin-root min-h-screen bg-[#fffaf0] text-[#071b34] lg:flex">
      {open && <button aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r-4 border-black bg-white text-[#071b34] transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b-4 border-black bg-white p-5 text-[#071b34]">
          <Link href="/superadmin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-11 w-11 place-items-center border-2 border-black bg-[#071b34] text-white shadow-[3px_3px_0_#f97316]">
              <FiShield className="h-5 w-5" />
            </span>
            <span>
              <strong className="block text-xl font-black uppercase tracking-tighter">Superadmin</strong>
              <small className="block font-black uppercase tracking-[.16em] opacity-60">JuntAPP global</small>
            </span>
          </Link>
          <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center border-2 border-black bg-white text-black lg:hidden">
            <FiX />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.2em] text-[#071b34]/40">Plataforma</p>
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 border-2 px-4 py-3 text-sm font-black uppercase transition ${
                  active
                    ? 'translate-x-1 translate-y-1 border-black bg-[#f97316] text-[#071b34]'
                    : 'border-black bg-[#071b34] text-[#f97316] shadow-[3px_3px_0_#f97316] hover:bg-[#102b4c]'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t-4 border-black p-4">
          <div className="border-2 border-black bg-[#fff4c2] p-3 shadow-[2px_2px_0_#000]">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#f97316]">Cuenta protegida</p>
            <p className="mt-1 truncate font-black">{name}</p>
            <p className="truncate text-xs font-semibold text-[#071b34]/50">{email}</p>
          </div>
          <button onClick={logout} className="flex w-full items-center justify-center gap-2 border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase text-[#071b34] hover:bg-[#071b34] hover:text-white">
            <FiLogOut /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b-4 border-black bg-[#fff4c2] px-4 py-3 lg:px-8">
          <button aria-label="Abrir menú" onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center border-2 border-black bg-[#071b34] text-white shadow-[2px_2px_0_#f97316] lg:hidden">
            <FiMenu />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#071b34]/55">Centro de control · Vista global de la plataforma</p>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

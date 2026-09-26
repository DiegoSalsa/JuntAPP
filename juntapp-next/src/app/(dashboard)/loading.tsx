export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Cargando contenido" style={{ padding: 24, color: '#031636' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700 }}>Cargando panel</h2>
      <p>Espera un momento. Si el contenido no aparece, puedes recargar la página.</p>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <a href="/inicio">Recargar</a>
        <a href="/login">Ir al inicio de sesión</a>
      </div>
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-9 w-56 rounded-lg bg-gray-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl bg-gray-200" />)}
        </div>
      </div>
    </div>
  );
}

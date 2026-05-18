"use client";

import React, { useState, useEffect } from "react";
import { useApp, AppModule } from "@/lib/context/AppContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  Package,
  LineChart,
  Share2,
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  User,
  Shield,
  Bell,
  Check,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  XCircle,
  TrendingDown,
  History
} from "lucide-react";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  module: AppModule;
}

const sidebarItems: SidebarItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: TrendingUp, module: "ventas" },
  { name: "Punto de Venta (POS)", href: "/dashboard/ventas", icon: ShoppingBag, module: "ventas" },
  { name: "Ventas", href: "/dashboard/historial-ventas", icon: History, module: "ventas" },
  { name: "Inventario", href: "/dashboard/inventario", icon: Package, module: "inventario" },
  { name: "Finanzas & Reportes", href: "/dashboard/finanzas", icon: LineChart, module: "finanzas" },
  { name: "Hub Redes Sociales", href: "/dashboard/redes-sociales", icon: Share2, module: "redes-sociales" },
  { name: "Configuración", href: "/dashboard/configuracion", icon: Settings, module: "configuracion" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    exchangeRate,
    updateExchangeRate,
    permissions,
    hasPermission,
    logout,
    remoteRequests,
    approveRemoteRequest,
    rejectRemoteRequest,
    userOverrides
  } = useApp();

  const router = useRouter();
  const pathname = usePathname();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRate.toString());
  const [successToast, setSuccessToast] = useState("");

  // Redirigir a login si el usuario no está autenticado y ya terminó la hidratación de sesión
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Verificar permisos de la ruta actual (Rutas Protegidas en Tiempo Real)
  useEffect(() => {
    if (!user) return;
    
    const pathParts = pathname.split("/");
    // El formato de ruta esperado es /dashboard/modulo
    const moduleName = pathParts[2] as AppModule;
    
    if (moduleName && sidebarItems.some(item => item.module === moduleName)) {
      if (!hasPermission(moduleName, "ver")) {
        // Bloquear acceso y redirigir a la primera ruta autorizada
        const firstAllowed = sidebarItems.find(item => hasPermission(item.module, "ver"));
        if (firstAllowed) {
          router.push(firstAllowed.href);
          triggerToast(`Acceso denegado a /dashboard/${moduleName}. Redireccionando.`);
        } else {
          router.push("/login");
        }
      }
    }
  }, [pathname, permissions, userOverrides, user, router]);

  // Sincronizar tasa temporal con la tasa real cuando cambia
  useEffect(() => {
    setTempRate(exchangeRate.toString());
  }, [exchangeRate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Filtrar los items de navegación según los permisos dinámicos del usuario
  const allowedItems = sidebarItems.filter(item => hasPermission(item.module, "ver"));
  const isCarlos = user?.email === "carlosmtinez" || user?.email?.includes("carlos");
  const finalItems = isCarlos
    ? [...allowedItems, { name: "Consola SaaS", href: "/dashboard/saas", icon: Shield, module: "configuracion" as AppModule }]
    : allowedItems;

  // Guardar tasa nueva
  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(tempRate);
    if (!isNaN(rateNum) && rateNum > 0) {
      updateExchangeRate(rateNum);
      setEditingRate(false);
      triggerToast("Tasa oficial BCV actualizada en tiempo real");
    }
  };

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 3000);
  };

  return (
    <div className="min-h-screen flex bg-background text-slate-900 overflow-hidden">
      
      {/* Toast Notification Center */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl bg-white border border-border border-l-4 border-l-usd shadow-xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5 text-usd" />
          <span className="text-sm font-medium text-slate-900">{successToast}</span>
        </div>
      )}

      {/* SIDEBAR PARA ESCRITORIO */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-border flex-shrink-0">
        <div className="h-20 flex items-center gap-3 px-6 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-sm font-bold text-white tracking-wider">RB</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            RegioBiz
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted border border-border text-slate-500 font-mono">
            v1.0
          </span>
        </div>

        {/* Perfil del Usuario en Sidebar */}
        <div className="p-4 mx-3 my-4 rounded-2xl bg-muted/40 border border-border flex items-center gap-3">
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-10 h-10 rounded-full border border-border bg-white"
          />
          <div className="overflow-hidden">
            <h4 className="text-xs font-semibold text-slate-900 truncate">{user.name}</h4>
            <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider">
              <Shield className="w-2.5 h-2.5" />
              {user.role === "admin" ? "Directora" : user.role === "vendedor" ? "Vendedor" : "Marketing"}
            </span>
          </div>
        </div>

        {/* Items de Navegación */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {finalItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-primary text-white shadow-md shadow-primary/10"
                    : "text-slate-600 hover:text-primary hover:bg-muted"
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-white" : "text-slate-500 group-hover:text-primary"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar / Logout */}
        <div className="p-4 border-t border-border">
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 transition-all text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MENU MOVIL */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <aside className="w-64 bg-sidebar flex flex-col h-full animate-in slide-in-from-left duration-200">
            <div className="h-20 flex items-center justify-between px-6 border-b border-border">
              <span className="text-lg font-bold tracking-tight text-slate-900">RegioBiz</span>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-600 hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 mx-3 my-4 rounded-2xl bg-muted/40 border border-border flex items-center gap-3">
              <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full bg-muted border border-border" />
              <div>
                <h4 className="text-xs font-semibold text-slate-900 truncate">{user.name}</h4>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                  {user.role}
                </span>
              </div>
            </div>

            <nav className="flex-1 px-3 space-y-1">
              {finalItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:text-primary hover:bg-muted"
                  >
                    <Icon className="w-4 h-4 text-slate-500" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-border">
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 transition-all text-xs font-medium cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER SUPERIOR */}
        <header className="h-20 bg-sidebar/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-slate-600 hover:text-primary cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Título de Sección */}
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">Dashboard</span>
              <h2 className="text-md font-bold text-slate-900 capitalize">
                {pathname.split("/").pop() === "dashboard" ? "Inicio" : pathname.split("/").pop()?.replace("-", " ")}
              </h2>
            </div>
          </div>

          {/* ACCIONES DEL HEADER: Tasa BCV y Cola de Autorizaciones */}
          <div className="flex items-center gap-4">

            {/* Supabase Status Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-border shadow-sm text-[9px] font-extrabold uppercase tracking-wider text-slate-700 select-none">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              {isSupabaseConfigured() ? "Supabase: En Vivo" : "Sandbox Local"}
            </div>
            
            {/* WIDGET TASA DE CAMBIO BCV DEL DÍA (BIMONETARIA) */}
            <div className="relative premium-card px-4 py-2 flex items-center gap-3 border border-border shadow-sm bg-white max-w-xs">
              <TrendingUp className="w-4 h-4 text-usd animate-pulse-slow flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">Tasa Oficial BCV</span>
                {editingRate && user.role === "admin" ? (
                  <form onSubmit={handleSaveRate} className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="number"
                      step="0.01"
                      value={tempRate}
                      onChange={(e) => setTempRate(e.target.value)}
                      className="w-16 bg-white border border-border rounded px-1 text-xs text-slate-900 focus:outline-none focus:border-primary"
                      autoFocus
                    />
                    <button type="submit" className="p-0.5 bg-usd rounded text-white hover:bg-emerald-600">
                      <Check className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => setEditingRate(false)} className="p-0.5 bg-red-500 rounded text-white hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      1 $ = <span className="text-bs font-mono">{exchangeRate.toFixed(2)} Bs.</span>
                    </span>
                    {user.role === "admin" && (
                      <button
                        onClick={() => setEditingRate(true)}
                        className="text-[9px] bg-muted hover:bg-primary border border-border text-slate-600 hover:text-white px-1.5 py-0.5 rounded transition-all cursor-pointer"
                        title="Doble clic para editar tasa"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* NOTIFICACIÓN DE PERMISOS TEMPORALES (OVERRIDE DETECTOR) */}
            {userOverrides[user.id] && userOverrides[user.id].length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide uppercase animate-pulse">
                <Check className="w-3.5 h-3.5" />
                Permiso Remoto Temporal Activo
              </div>
            )}

            {/* PANEL DE AUTORIZACIÓN REMOTA EN TIEMPO REAL (Exclusivo Directora Alejandra) */}
            {user.role === "admin" && (
              <div className="relative group">
                <button className="p-2.5 rounded-xl bg-white border border-border text-slate-600 hover:text-primary hover:border-primary transition-all relative cursor-pointer">
                  <Bell className="w-4 h-4" />
                  {remoteRequests.filter(r => r.status === "pending").length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white font-mono text-[10px] font-extrabold flex items-center justify-center animate-bounce">
                      {remoteRequests.filter(r => r.status === "pending").length}
                    </span>
                  )}
                </button>

                {/* Dropdown de Notificaciones */}
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-border shadow-xl overflow-hidden hidden group-hover:block z-50">
                  <div className="p-4 border-b border-border flex justify-between items-center bg-muted/40">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Solicitudes de Permiso POS</h3>
                    <span className="text-[10px] bg-white text-slate-500 px-2 py-0.5 rounded-full font-mono border border-border">
                      Real-time
                    </span>
                  </div>

                  <div className="divide-y divide-border max-h-60 overflow-y-auto">
                    {remoteRequests.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        No hay solicitudes pendientes
                      </div>
                    ) : (
                      remoteRequests.map((req) => (
                        <div key={req.id} className="p-4 hover:bg-muted/30 transition-all space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold text-slate-900">{req.requesterName}</p>
                              <p className="text-[10px] text-slate-500">Solicitó desbloqueo de {req.action}</p>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              req.status === "pending"
                                ? "bg-amber-500/10 text-amber-400"
                                : req.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}>
                              {req.status}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-600 bg-muted/40 p-2 rounded-lg border border-border font-mono">
                            {req.details}
                          </p>

                          {req.status === "pending" && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => {
                                  approveRemoteRequest(req.id);
                                  triggerToast(`Solicitud de ${req.requesterName} aprobada.`);
                                }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-usd hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> Aprobar (15s)
                              </button>
                              <button
                                onClick={() => {
                                  rejectRemoteRequest(req.id);
                                  triggerToast(`Solicitud de ${req.requesterName} rechazada.`);
                                }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              >
                                <X className="w-3 h-3" /> Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* CONTENIDO DE LA PÁGINA */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

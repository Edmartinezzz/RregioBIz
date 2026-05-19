"use client";

import React, { useState, useEffect } from "react";
import { useApp, UserRole, AppModule, PermissionActions } from "@/lib/context/AppContext";
import { 
  Shield, 
  TrendingUp, 
  Settings2, 
  ToggleLeft, 
  ToggleRight, 
  Play,
  ArrowRight,
  RefreshCw,
  Info,
  CheckCircle,
  HelpCircle,
  Lock,
  Trash2,
  AlertTriangle,
  Users,
  Key,
  Mail
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ─── Helper: quick count of sub-users ───────────────────────────────────────
function SubUserSummary({ tenantId }: { tenantId: string }) {
  const [subs, setSubs] = useState<any[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem(`regiobiz_subusers_${tenantId}`);
    if (saved) { try { setSubs(JSON.parse(saved)); } catch { setSubs([]); } }
  }, [tenantId]);

  if (subs.length === 0) {
    return (
      <p className="text-[11px] text-slate-400 italic">
        No hay sub-usuarios creados todavía. Usa el botón de arriba para crear el primero.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
      {subs.map((s: any) => (
        <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-border">
          <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(s.name)}`} alt={s.name} className="w-7 h-7 rounded-full bg-white border border-border" />
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold text-slate-900 truncate">{s.name}</p>
            <span className={`text-[8px] font-bold uppercase ${ s.role === "vendedor" ? "text-emerald-600" : "text-indigo-600"}`}>{s.role}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helper: full directory of sub-users with credentials ───────────────────
function SubUserDirectory({ tenantId, adminUser }: { tenantId: string; adminUser: any }) {
  const [subs, setSubs] = useState<any[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem(`regiobiz_subusers_${tenantId}`);
    if (saved) { try { setSubs(JSON.parse(saved)); } catch { setSubs([]); } }
  }, [tenantId]);

  // Always show the company admin itself first
  const adminCard = {
    name: adminUser?.tenantName || adminUser?.name || "Administrador",
    email: adminUser?.email || "",
    role: "Admin Empresa",
    pass: "Tu contraseña de acceso",
    isAdmin: true,
  };

  if (subs.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DirectoryCard key={adminCard.email} u={adminCard} isSelf={true} />
        <div className="p-5 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-2 min-h-[140px]">
          <Users className="w-8 h-8 text-slate-300" />
          <p className="text-[10px] text-slate-400 font-semibold">Sin sub-usuarios<br />todavía</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <DirectoryCard key={adminCard.email} u={adminCard} isSelf={true} />
      {subs.map((s: any) => (
        <DirectoryCard key={s.id} u={{ name: s.name, email: s.email, role: s.role === "vendedor" ? "Vendedor / Cajero" : "Marketing", pass: s.password, isAdmin: false }} isSelf={false} />
      ))}
    </div>
  );
}

function DirectoryCard({ u, isSelf }: { u: any; isSelf: boolean }) {
  return (
    <div className={`p-5 rounded-2xl border transition-all flex flex-col items-center text-center space-y-3 ${ isSelf ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/10" : "bg-white border-border"}`}>
      <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.name)}`} alt={u.name} className="w-14 h-14 rounded-full border border-border bg-white" />
      <div>
        <h4 className="text-xs font-bold text-slate-900">{u.name}</h4>
        <p className="text-[10px] font-mono text-slate-500 mt-0.5">{u.email}</p>
      </div>
      <div className="space-y-2 w-full pt-1">
        <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${ u.isAdmin ? "bg-emerald-100 text-emerald-800" : u.role.includes("Vend") ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800"}`}>
          {u.role}
        </span>
        <div className="p-2.5 rounded-xl bg-slate-50 border border-border text-[9px] font-mono text-slate-600 space-y-1 text-left">
          <div className="flex items-center gap-1"><Key className="w-2.5 h-2.5" /><span className="font-bold">Clave:</span> {u.pass}</div>
          <div><span className="font-bold">Estado:</span> <span className="text-emerald-600 font-bold">Activo</span></div>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const { 
    user, 
    exchangeRate, 
    updateExchangeRate, 
    permissions, 
    updatePermission,
    requestRemotePermission 
  } = useApp();

  const [tasaInput, setTasaInput] = useState(exchangeRate.toString());
  const [updatingApi, setUpdatingApi] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState("");
  const [simulationResult, setSimulationResult] = useState<"success" | "rejected" | "">("");

  // Nombres descriptivos para roles y módulos en español
  const roleNames: Record<UserRole, string> = {
    admin: "Directora (Admin)",
    vendedor: "Cajera (Vendedor)",
    marketing: "Marketing (Hub Redes)",
  };

  const moduleNames: Record<AppModule, string> = {
    ventas: "Punto de Venta (POS)",
    inventario: "Inventario de Productos",
    finanzas: "Finanzas & Reportes",
    "redes-sociales": "Hub de Redes Sociales",
    configuracion: "Panel de Configuración",
  };

  const actions: (keyof PermissionActions)[] = ["ver", "crear", "editar", "eliminar"];

  // Actualizar tasa manualmente
  const handleSaveTasa = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tasaInput);
    if (!isNaN(val) && val > 0) {
      updateExchangeRate(val);
      setSimulationStatus("Tasa de cambio guardada y sincronizada.");
      setTimeout(() => setSimulationStatus(""), 3000);
    }
  };

  // Consultar API del BCV Simulado
  const handleConsultApi = () => {
    setUpdatingApi(true);
    // Simular retraso de API
    setTimeout(() => {
      // Simular una tasa que fluctúa de forma realista alrededor de 36-37
      const randomRate = parseFloat((36.20 + Math.random() * 0.8).toFixed(2));
      updateExchangeRate(randomRate);
      setTasaInput(randomRate.toString());
      setUpdatingApi(false);
      setSimulationStatus(`API consultada. Nueva tasa BCV: 1 $ = ${randomRate.toFixed(2)} Bs.`);
      setTimeout(() => setSimulationStatus(""), 4000);
    }, 1500);
  };

  // Simular envío de solicitud remota desde la cajera Valentina
  const triggerSimulation = async () => {
    setSimulationStatus("Vendedora Valentina está enviando solicitud de descuento de 10%...");
    setSimulationResult("");
    
    // Disparar la solicitud asíncrona
    try {
      const approved = await requestRemotePermission(
        "descuento", 
        "Descuento de 10% en Venta #1094 (Cliente RIF J-40892)"
      );

      if (approved) {
        setSimulationResult("success");
        setSimulationStatus("¡APROBADO! Cajera Valentina recibió el permiso temporal y desbloqueó el descuento.");
      } else {
        setSimulationResult("rejected");
        setSimulationStatus("RECHAZADO. La Directora denegó el descuento de la Cajera.");
      }
    } catch (err) {
      setSimulationStatus("Error en la transmisión remota.");
    }
  };

  // Borrar todo el inventario de esta empresa
  const handleClearInventory = async () => {
    if (!user) return;
    const confirmDelete = window.confirm(
      "¿ESTÁS COMPLETAMENTE SEGURO? Esta acción eliminará permanentemente todo el inventario de tu empresa en Supabase y localmente. Esta acción no se puede deshacer."
    );
    if (!confirmDelete) return;

    const confirmText = window.prompt("Por seguridad, escribe 'BORRAR INVENTARIO' para confirmar:");
    if (confirmText !== "BORRAR INVENTARIO") {
      alert("Confirmación incorrecta. No se borró el inventario.");
      return;
    }

    const tenantId = user.tenantId || "default";
    localStorage.removeItem(`regiobiz_products_${tenantId}`);

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase!
          .from("products")
          .delete()
          .like("code", `${tenantId}_%`);
        if (error) {
          console.error("Error al borrar inventario en Supabase:", error);
          alert("Error al sincronizar el borrado con Supabase.");
        } else {
          alert("¡Espectacular! Todo el inventario de tu empresa ha sido borrado permanentemente.");
        }
      } catch (err) {
        console.error("Error en conexión de Supabase:", err);
      }
    } else {
      alert("¡Sandbox local restablecido! Todo el inventario de tu empresa ha sido borrado.");
    }
  };

  // Restablecer todas las cuentas financieras de esta empresa a saldo cero
  const handleClearFinances = async () => {
    if (!user) return;
    const confirmDelete = window.confirm(
      "¿ESTÁS COMPLETAMENTE SEGURO? Esta acción restablecerá el balance de todas tus cuentas bancarias a $0.00 en Supabase y localmente. Esta acción no se puede deshacer."
    );
    if (!confirmDelete) return;

    const confirmText = window.prompt("Por seguridad, escribe 'RESTABLECER FINANZAS' para confirmar:");
    if (confirmText !== "RESTABLECER FINANZAS") {
      alert("Confirmación incorrecta. No se restablecieron las cuentas.");
      return;
    }

    const tenantId = user.tenantId || "default";
    const initialAccounts = [
      { id: "a1", name: "Caja Fuerte USD", bankName: "Efectivo Divisas", balance: 0, currency: "USD" },
      { id: "a2", name: "Zelle / BofA", bankName: "Bank of America", balance: 0, currency: "USD" },
      { id: "a3", name: "Banesco Corriente", bankName: "Banco Nacional", balance: 0, currency: "VES" },
      { id: "a4", name: "Pago Móvil Mercantil", bankName: "Mercantil Banco", balance: 0, currency: "VES" },
      { id: "a5", name: "Caja Chica Bs", bankName: "Efectivo Bolívares", balance: 0, currency: "VES" },
    ];
    localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(initialAccounts));

    if (isSupabaseConfigured()) {
      try {
        for (const acc of initialAccounts) {
          await supabase!
            .from("financial_accounts")
            .upsert({
              id: `${tenantId}_${acc.id}`,
              name: acc.name,
              bank: acc.bankName,
              balance_usd: 0,
              balance_bs: 0
            });
        }
        alert("¡Espectacular! Todas tus cuentas bancarias se han restablecido a $0.00 en Supabase y localmente.");
      } catch (err) {
        console.error("Error al restablecer finanzas en Supabase:", err);
        alert("Cuentas restablecidas localmente, pero hubo un error al sincronizar con Supabase.");
      }
    } else {
      alert("¡Sandbox local restablecido! Todas tus cuentas financieras tienen balance cero ($0.00).");
    }
  };

  // Borrar todo el historial de ventas de esta empresa
  const handleClearHistory = () => {
    if (!user) return;
    const confirmDelete = window.confirm(
      "¿ESTÁS COMPLETAMENTE SEGURO? Esta acción eliminará permanentemente todo el historial de ventas de tu empresa localmente. Esta acción no se puede deshacer."
    );
    if (!confirmDelete) return;

    const confirmText = window.prompt("Por seguridad, escribe 'BORRAR HISTORIAL' para confirmar:");
    if (confirmText !== "BORRAR HISTORIAL") {
      alert("Confirmación incorrecta. No se borró el historial.");
      return;
    }

    const tenantId = user.tenantId || "default";
    localStorage.removeItem(`regiobiz_sales_history_${tenantId}`);
    alert("¡Espectacular! Todo el historial de ventas de tu empresa ha sido borrado permanentemente.");
  };

  // Borrado global de todos los datos de la empresa
  const handleClearGlobal = async () => {
    if (!user) return;
    const confirmDelete = window.confirm(
      "⚠ ⚠ ADVERTENCIA CRÍTICA: Estás a punto de borrar absolutamente TODOS los datos de tu empresa (Inventario, Finanzas y Ventas). Esta acción destruirá toda la información registrada para esta cuenta de forma permanente e irreversible. ¿Deseas continuar?"
    );
    if (!confirmDelete) return;

    const tenantId = user.tenantId || "default";
    const confirmName = window.prompt(
      `Para validar tu responsabilidad y autorizar la destrucción de datos, escribe el ID de tu empresa ('${tenantId}'):`
    );
    if (confirmName !== tenantId) {
      alert("ID de empresa incorrecto. Se canceló la destrucción global de datos.");
      return;
    }

    const confirmDestruction = window.prompt(
      "CONFIRMACIÓN FINAL: Escribe 'DESTRUIR TODO EL SISTEMA' para proceder con el borrado global:"
    );
    if (confirmDestruction !== "DESTRUIR TODO EL SISTEMA") {
      alert("Confirmación incorrecta. No se borró ningún dato.");
      return;
    }

    // 1. Borrar Historial de Ventas
    localStorage.removeItem(`regiobiz_sales_history_${tenantId}`);

    // 2. Borrar Inventario
    localStorage.removeItem(`regiobiz_products_${tenantId}`);
    if (isSupabaseConfigured()) {
      try {
        await supabase!.from("products").delete().like("code", `${tenantId}_%`);
      } catch (e) {
        console.error(e);
      }
    }

    // 3. Borrar Finanzas
    const initialAccounts = [
      { id: "a1", name: "Caja Fuerte USD", bankName: "Efectivo Divisas", balance: 0, currency: "USD" },
      { id: "a2", name: "Zelle / BofA", bankName: "Bank of America", balance: 0, currency: "USD" },
      { id: "a3", name: "Banesco Corriente", bankName: "Banco Nacional", balance: 0, currency: "VES" },
      { id: "a4", name: "Pago Móvil Mercantil", bankName: "Mercantil Banco", balance: 0, currency: "VES" },
      { id: "a5", name: "Caja Chica Bs", bankName: "Efectivo Bolívares", balance: 0, currency: "VES" },
    ];
    localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(initialAccounts));
    if (isSupabaseConfigured()) {
      try {
        for (const acc of initialAccounts) {
          await supabase!
            .from("financial_accounts")
            .upsert({
              id: `${tenantId}_${acc.id}`,
              name: acc.name,
              bank: acc.bankName,
              balance_usd: 0,
              balance_bs: 0
            });
        }
      } catch (e) {
        console.error(e);
      }
    }

    alert("🚨 ¡DESTRUCCIÓN GLOBAL COMPLETADA! Todos los datos de tu empresa han sido borrados permanentemente. El sistema se recargará para iniciar en blanco.");
    window.location.reload();
  };

  // Guardia: master no debe ver esta página (tiene su propia consola SaaS)
  if (user?.isMaster) {
    return (
      <div className="premium-card p-8 text-center space-y-4 max-w-md mx-auto mt-12 bg-white">
        <Shield className="w-12 h-12 text-indigo-500 mx-auto" />
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Acceso Maestro</h2>
        <p className="text-xs text-slate-600 font-bold">
          Como Super-Usuario Master, tu panel de control es la <span className="text-primary">Consola SaaS</span>.
        </p>
      </div>
    );
  }

  // Solo el admin de la empresa puede ver esta página
  if (user?.role !== "admin") {
    return (
      <div className="premium-card p-8 text-center space-y-4 max-w-md mx-auto mt-12 bg-white">
        <Lock className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Acceso Restringido</h2>
        <p className="text-xs text-slate-600 font-bold">
          No tienes permisos suficientes para ver el panel de configuración. Solo el administrador de la empresa tiene acceso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Configuración Global del Sistema
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          Gestiona los permisos dinámicos en tiempo real, actualiza la tasa oficial y simula interacciones de seguridad.
        </p>
      </div>

      {simulationStatus && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all shadow-sm ${
          simulationResult === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : simulationResult === "rejected"
            ? "bg-red-50 border-red-200 text-red-600"
            : "bg-white border-border text-slate-800"
        }`}>
          <CheckCircle className="w-5 h-5 animate-pulse text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider">{simulationStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* INFO: permisos ahora son por sub-usuario */}
        <div className="premium-card p-6 xl:col-span-2 space-y-6 bg-white shadow-xl">
          <div className="border-b border-border pb-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Permisos de Sub-Usuarios (RBAC por persona)
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Los permisos ya no son globales por rol — ahora se configuran individualmente para cada sub-usuario desde su panel de gestión.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
            <p className="text-xs font-bold text-slate-700">
              🛡️ Cada vendedor o usuario de marketing tiene su propia matriz de permisos que tú controlas. Puedes activar o desactivar módulos individuales por persona.
            </p>
            <p className="text-xs text-slate-500">
              Ve a <strong className="text-primary">Sub-Usuarios</strong> en el menú lateral para crear usuarios y asignarles permisos granulares por módulo y acción (ver, crear, editar, eliminar).
            </p>
            <a
              href="/dashboard/sub-usuarios"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-600 transition-all cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              Ir a Gestión de Sub-Usuarios
            </a>
          </div>

          {/* Sub-user quick summary for this company */}
          <SubUserSummary tenantId={user?.tenantId || "default"} />
        </div>

        {/* COLUMNA LATERAL: GESTIÓN DE TASA BCV Y SIMULADOR REALTIME */}
        <div className="space-y-8">
          
          {/* CONTROL DE TASA OFICIAL */}
          <div className="premium-card p-6 space-y-6 bg-white shadow-xl">
            <div className="border-b border-border pb-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Tasa de Cambio del Día
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                La tasa centralizada sugerida para el POS y reportes bimonetarios.
              </p>
            </div>

            <form onSubmit={handleSaveTasa} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase block tracking-wider">Tasa Oficial (Bs / 1 USD)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={tasaInput}
                    onChange={(e) => setTasaInput(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white border border-border rounded-xl text-slate-900 font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm font-bold"
                  />
                  <button
                    type="submit"
                    className="px-5 bg-primary hover:bg-indigo-600 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer uppercase tracking-wider"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </form>

            <div className="pt-2">
              <button
                onClick={handleConsultApi}
                disabled={updatingApi}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-border hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                {updatingApi ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                )}
                Consultar Tasa BCV Oficial (API)
              </button>
            </div>
          </div>

          {/* SIMULADOR DE SEÑAL / SOLICITUD REALTIME */}
          <div className="premium-card p-6 space-y-6 bg-white shadow-xl">
            <div className="border-b border-border pb-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-500" />
                Simulador Real-Time
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Prueba el flujo de seguridad remota instantáneo de Vendedora a Directora.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                Al activar la simulación, simularás que la **Cajera Valentina** intenta aplicar un descuento en el POS y está bloqueada. Ella emitirá una alerta que verás en la campana de notificaciones de arriba.
              </p>
              
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-slate-700 flex items-start gap-2 font-medium">
                <Info className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p>Haz clic abajo, luego abre el menú de la campana (arriba a la derecha) para Aprobar o Rechazar en tiempo real.</p>
              </div>

              <button
                onClick={triggerSimulation}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-600 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 text-xs transition-all uppercase tracking-wider group cursor-pointer"
              >
                <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Simular Solicitud Cajera POS
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* DIRECTORIO DE SUB-USUARIOS ACTIVOS DE LA EMPRESA */}
      <div className="premium-card p-6 bg-white shadow-xl space-y-6">
        <div className="border-b border-border pb-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            Directorio de Accesos — {user?.tenantName}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Vista rápida de los sub-usuarios creados para esta empresa. Gestiona sus credenciales y permisos desde <strong className="text-primary">Sub-Usuarios</strong>.
          </p>
        </div>
        <SubUserDirectory tenantId={user?.tenantId || "default"} adminUser={user} />
      </div>

      {/* ZONA DE DESTRUCCIÓN Y CONTROL DE DATOS (ZONA DE PELIGRO) */}
      <div className="premium-card p-6 bg-red-50/30 border border-red-200 shadow-xl space-y-6">
        <div className="border-b border-red-200 pb-4">
          <h3 className="text-xs font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            Zona de Peligro Administrativa: Gestión y Borrado de Datos
          </h3>
          <p className="text-[11px] text-red-600 mt-1 font-semibold">
            Atención: Estas acciones eliminan permanentemente los datos asociados a tu empresa ({user?.tenantId || "default"}). Utilizar bajo tu total responsabilidad.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Borrar Inventario */}
          <div className="p-5 rounded-2xl border border-red-200 bg-white shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Trash2 className="w-4.5 h-4.5 text-red-600" />
                Borrar Inventario
              </h4>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                Elimina permanentemente todo el catálogo de productos y stock de tu empresa de la base de datos de Supabase y caché local.
              </p>
            </div>
            <button
              onClick={handleClearInventory}
              className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-700 font-bold rounded-xl text-xs transition-all cursor-pointer uppercase tracking-wider text-center"
            >
              Borrar Inventario
            </button>
          </div>

          {/* Restablecer Finanzas */}
          <div className="p-5 rounded-2xl border border-red-200 bg-white shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Trash2 className="w-4.5 h-4.5 text-red-600" />
                Restablecer Finanzas
              </h4>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                Establece el balance de todas tus cuentas bimonetarias a $0.00 en Supabase y localmente, manteniendo la estructura de tus cuentas.
              </p>
            </div>
            <button
              onClick={handleClearFinances}
              className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-700 font-bold rounded-xl text-xs transition-all cursor-pointer uppercase tracking-wider text-center"
            >
              Restablecer Finanzas
            </button>
          </div>

          {/* Borrar Historial de Ventas */}
          <div className="p-5 rounded-2xl border border-red-200 bg-white shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Trash2 className="w-4.5 h-4.5 text-red-600" />
                Historial de Ventas
              </h4>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                Elimina de forma permanente todo el historial de tickets, facturas fiscales y transacciones registradas localmente por tu empresa.
              </p>
            </div>
            <button
              onClick={handleClearHistory}
              className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-700 font-bold rounded-xl text-xs transition-all cursor-pointer uppercase tracking-wider text-center"
            >
              Borrar Historial
            </button>
          </div>

          {/* DESTRUCCIÓN GLOBAL */}
          <div className="p-5 rounded-2xl border-2 border-red-500 bg-red-50 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-black text-red-700 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle className="w-4.5 h-4.5 text-red-700 animate-bounce" />
                Destrucción Global
              </h4>
              <p className="text-[10px] text-red-600 mt-2 font-bold leading-relaxed">
                ADVERTENCIA CRÍTICA: Esta opción borra TODO (Inventario, Finanzas y Ventas) de forma simultánea. Se requiere triple validación de seguridad.
              </p>
            </div>
            <button
              onClick={handleClearGlobal}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-red-600/10 hover:shadow-red-600/20 transition-all cursor-pointer uppercase tracking-wider text-center"
            >
              Destruir Todo
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

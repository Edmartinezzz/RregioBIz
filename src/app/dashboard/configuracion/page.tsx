"use client";

import React, { useState } from "react";
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
  Lock
} from "lucide-react";

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

  // Solo permitir a la Directora ver esta interfaz
  if (user?.role !== "admin") {
    return (
      <div className="premium-card p-8 text-center space-y-4 max-w-md mx-auto mt-12 bg-white">
        <Lock className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Acceso Restringido</h2>
        <p className="text-xs text-slate-600 font-bold">
          No tienes permisos suficientes para ver el panel de configuración global. Solo usuarios directores autorizados.
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
        
        {/* PANEL MATRIZ DE PERMISOS DINÁMICA (RBAC) */}
        <div className="premium-card p-6 xl:col-span-2 space-y-6 bg-white shadow-xl">
          <div className="border-b border-border pb-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Matriz de Permisos Dinámica (RBAC)
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Activa o desactiva switches. Los cambios ocultan o muestran de inmediato los menús a los sub-usuarios.
            </p>
          </div>

          <div className="space-y-8 text-xs">
            {(["vendedor", "marketing"] as UserRole[]).map((role) => (
              <div key={role} className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                    Rol: {roleNames[role]}
                  </h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                        <th className="pb-3 text-[10px] tracking-wider">Módulo</th>
                        {actions.map(action => (
                          <th key={action} className="pb-3 text-center capitalize text-[10px] tracking-wider">{action}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(Object.keys(permissions[role]) as AppModule[]).map((module) => (
                        <tr key={module} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 font-black text-slate-800">{moduleNames[module]}</td>
                          {actions.map(action => {
                            const value = permissions[role][module][action];
                            return (
                              <td key={action} className="py-4 text-center">
                                <button
                                  onClick={() => updatePermission(role, module, action, !value)}
                                  className="focus:outline-none transition-all scale-105 inline-block cursor-pointer"
                                >
                                  {value ? (
                                    <ToggleRight className="w-9 h-6 text-primary" />
                                  ) : (
                                    <ToggleLeft className="w-9 h-6 text-slate-400" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
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

      {/* DIRECTORIO DE USUARIOS DEL SISTEMA (EXCLUSIVO DIRECTORA / MASTER) */}
      <div className="premium-card p-6 bg-white shadow-xl space-y-6">
        <div className="border-b border-border pb-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            Directorio de Cuentas y Personal Activo
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Listado de accesos autorizados y credenciales configuradas en el Active Directory de RegioBiz.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: "Carlos Martínez", email: "carlosmtinez321@gmail.com", role: "Super-Usuario Master", status: "Activo (Control Total)", pass: "2708", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Carlos" },
            { name: "Directora Alejandra", email: "alejandra@regiobiz.com", role: "Directora (Admin)", status: "Activo", pass: "Clave corporativa (>= 6 car.)", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Directora%20Alejandra" },
            { name: "Cajera Valentina", email: "valentina@regiobiz.com", role: "Cajera (Vendedor)", status: "Activo", pass: "Clave corporativa (>= 6 car.)", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Cajera%20Valentina" },
            { name: "Marketing Isabella", email: "isabella@regiobiz.com", role: "Marketing (Hub Redes)", status: "Activo", pass: "Clave corporativa (>= 6 car.)", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Marketing%20Isabella" }
          ].map((u) => (
            <div key={u.email} className={`p-5 rounded-2xl border transition-all flex flex-col items-center text-center space-y-3 ${
              u.email === user?.email ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/10" : "bg-white border-border"
            }`}>
              <img src={u.avatar} alt={u.name} className="w-14 h-14 rounded-full border border-border bg-white" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">{u.name}</h4>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{u.email}</p>
              </div>
              
              <div className="space-y-2 w-full pt-1">
                <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  u.role.includes("Master") ? "bg-indigo-100 text-indigo-800" : u.role.includes("Admin") ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                }`}>
                  {u.role}
                </span>
                
                <div className="p-2.5 rounded-xl bg-slate-50 border border-border text-[9px] font-mono text-slate-600 space-y-1 text-left">
                  <div><span className="font-bold">Clave:</span> {u.pass}</div>
                  <div><span className="font-bold">Estado:</span> <span className="text-emerald-600 font-bold">{u.status}</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

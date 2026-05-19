"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/context/AppContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { 
  Building2, 
  Users, 
  Plus, 
  ShieldCheck, 
  DollarSign, 
  Ban, 
  Activity, 
  X, 
  Check, 
  Lock, 
  Star, 
  CreditCard,
  AlertTriangle
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  rif: string;
  adminEmail: string;
  plan: "bronze" | "silver" | "gold" | "enterprise";
  status: "active" | "suspended" | "trial";
  cost: number;
  joinedDate: string;
}

const defaultTenants: Tenant[] = [];

export default function SaasConsolePage() {
  const { user } = useApp();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Campos de nueva empresa
  const [companyName, setCompanyName] = useState("");
  const [rif, setRif] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [plan, setPlan] = useState<"bronze" | "silver" | "gold" | "enterprise">("silver");

  // Plan pricing
  const planCosts = {
    bronze: 29.00,
    silver: 59.00,
    gold: 99.00,
    enterprise: 199.00
  };

  // ─── Cargar empresas: Supabase primero, localStorage como caché ───────────
  useEffect(() => {
    const loadTenants = async () => {
      // 1. Intentar Supabase (fuente de verdad)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase!
            .from("tenants")
            .select("*")
            .order("created_at", { ascending: false });

          if (!error && data) {
            const mapped: Tenant[] = data.map((row: any) => ({
              id: row.id,
              name: row.name,
              rif: row.rif,
              adminEmail: row.admin_email,
              plan: row.plan,
              status: row.status,
              cost: parseFloat(row.cost),
              joinedDate: row.joined_date,
            }));
            setTenants(mapped);
            // Actualizar cache local
            localStorage.setItem("regiobiz_tenants", JSON.stringify(mapped));
            return;
          }
        } catch (err) {
          console.error("Error cargando empresas desde Supabase:", err);
        }
      }

      // 2. Fallback: localStorage
      const saved = localStorage.getItem("regiobiz_tenants");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Tenant[];
          const hasMockData = parsed.some(t => t.id === "t1" || t.id === "t2" || t.id === "t3");
          if (hasMockData) {
            setTenants([]);
            localStorage.setItem("regiobiz_tenants", JSON.stringify([]));
          } else {
            setTenants(parsed);
          }
        } catch {
          setTenants([]);
        }
      } else {
        setTenants([]);
      }
    };

    loadTenants();
  }, []);

  // ─── Guardar en Supabase + localStorage ───────────────────────────────────
  const saveTenants = (newList: Tenant[]) => {
    setTenants(newList);
    localStorage.setItem("regiobiz_tenants", JSON.stringify(newList));
  };

  const saveTenantToSupabase = async (t: Tenant, adminPass: string) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase!
        .from("tenants")
        .upsert({
          id: t.id,
          name: t.name,
          rif: t.rif,
          admin_email: t.adminEmail,
          admin_pass: adminPass,
          plan: t.plan,
          status: t.status,
          cost: t.cost,
          joined_date: t.joinedDate,
        });
    } catch (err) {
      console.error("Error guardando empresa en Supabase:", err);
    }
  };

  const updateTenantStatusInSupabase = async (t: Tenant) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase!
        .from("tenants")
        .update({ status: t.status, cost: t.cost })
        .eq("id", t.id);
    } catch (err) {
      console.error("Error actualizando estado en Supabase:", err);
    }
  };

  // Crear empresa & Admin principal
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !rif || !adminEmail || !adminPass) return;

    // ID único basado en timestamp para evitar colisiones
    const newId = `t_${Date.now()}`;

    const newTenant: Tenant = {
      id: newId,
      name: companyName,
      rif: rif,
      adminEmail: adminEmail,
      plan: plan,
      status: "active",
      cost: planCosts[plan],
      joinedDate: new Date().toISOString().split("T")[0]
    };

    const updated = [newTenant, ...tenants];
    saveTenants(updated);

    // Guardar en Supabase (persistencia real)
    await saveTenantToSupabase(newTenant, adminPass);

    setSuccessMsg(`¡Empresa "${companyName}" dada de alta correctamente en la plataforma!`);
    setShowModal(false);
    setCompanyName(""); setRif(""); setAdminEmail(""); setAdminPass(""); setPlan("silver");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  // Activar / Suspender empresa
  const toggleTenantStatus = async (id: string) => {
    const updated = tenants.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === "active" ? "suspended" : "active";
        return { 
          ...t, 
          status: nextStatus as "active" | "suspended",
          cost: nextStatus === "active" ? planCosts[t.plan] : 0 
        };
      }
      return t;
    });
    saveTenants(updated);
    // Sincronizar cambio de estado en Supabase
    const changed = updated.find(t => t.id === id);
    if (changed) await updateTenantStatusInSupabase(changed);
  };

  // Seguridad estricta: Bloquear si no es Carlos Martínez (Master Super-Admin)
  const isCarlos = user?.email === "carlosmtinez" || user?.email?.includes("carlos");
  if (!user || !isCarlos) {
    return (
      <div className="premium-card p-12 text-center space-y-6 max-w-md mx-auto mt-20 bg-white">
        <Lock className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">SaaS Acceso Restringido</h2>
        <p className="text-xs text-slate-600 leading-relaxed font-bold">
          Esta consola está reservada exclusivamente para el Super-Administrador Master global del sistema de membresías RegioBiz.
        </p>
      </div>
    );
  }

  // Cálculos estadísticos en tiempo real
  const activeTenantsCount = tenants.filter(t => t.status === "active").length;
  const trialTenantsCount = tenants.filter(t => t.status === "trial").length;
  const mrr = tenants.reduce((acc, curr) => acc + (curr.status === "active" ? curr.cost : 0), 0);

  const getPlanBadge = (p: string) => {
    switch (p) {
      case "enterprise":
        return <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase tracking-wider">Enterprise</span>;
      case "gold":
        return <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">Oro</span>;
      case "silver":
        return <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 uppercase tracking-wider">Plata</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">Bronce</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Consola de Administración SaaS
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Módulo de Licencias, Membresías Multitenant y Creación de Cuentas Maestras.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer select-none"
        >
          <Plus className="w-4 h-4" />
          Registrar Nueva Empresa
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-wider shadow-sm animate-bounce">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* METRICAS GENERALES EN VIVO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* MRR */}
        <div className="premium-card p-6 bg-white shadow-xl flex items-center justify-between border-l-4 border-l-primary">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">MRR (Recurrente Mensual)</p>
            <h3 className="text-2xl font-black text-slate-900 font-mono">${mrr.toFixed(2)}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-primary">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* COMPAÑÍAS */}
        <div className="premium-card p-6 bg-white shadow-xl flex items-center justify-between border-l-4 border-l-emerald-500">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Licencias Activas</p>
            <h3 className="text-2xl font-black text-slate-900 font-mono">{activeTenantsCount} / {tenants.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* DEMOS ACTIVAS */}
        <div className="premium-card p-6 bg-white shadow-xl flex items-center justify-between border-l-4 border-l-amber-500">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Periodos de Prueba (Trials)</p>
            <h3 className="text-2xl font-black text-slate-900 font-mono">{trialTenantsCount} Demos</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* REJILLA DE EMPRESAS CLIENTE */}
      <div className="premium-card p-6 bg-white shadow-xl space-y-6">
        <div className="border-b border-border pb-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Directorio de Empresas Suscritas
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Revisa los accesos y controla la membresía activa de tus clientes.
          </p>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-3">Empresa / RIF</th>
                <th className="pb-3">Administrador Maestro</th>
                <th className="pb-3 text-center">Plan</th>
                <th className="pb-3 text-right">Costo Mensual</th>
                <th className="pb-3 text-center">Estado</th>
                <th className="pb-3 text-right">Acciones de Licencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  
                  {/* Nombre */}
                  <td className="py-4">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-slate-950 block">{t.name}</span>
                      <span className="text-[9px] font-mono text-slate-500">{t.rif}</span>
                    </div>
                  </td>

                  {/* Admin Maestro */}
                  <td className="py-4">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-slate-800 block">{t.adminEmail}</span>
                      <span className="text-[9px] text-slate-400">Alta: {t.joinedDate}</span>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="py-4 text-center">
                    {getPlanBadge(t.plan)}
                  </td>

                  {/* Costo */}
                  <td className="py-4 text-right font-mono font-bold text-slate-900">
                    ${t.cost.toFixed(2)}
                  </td>

                  {/* Estado */}
                  <td className="py-4 text-center">
                    <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      t.status === "active" 
                        ? "bg-emerald-100 text-emerald-800" 
                        : t.status === "trial"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {t.status === "active" ? "Activo" : t.status === "trial" ? "Prueba" : "Suspendido"}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="py-4 text-right">
                    <button
                      onClick={() => toggleTenantStatus(t.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black rounded-lg transition-all cursor-pointer ${
                        t.status === "active"
                          ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      {t.status === "active" ? (
                        <>
                          <Ban className="w-3 h-3" />
                          Suspender Licencia
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          Activar Licencia
                        </>
                      )}
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL REGISTRAR NUEVA EMPRESA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            
            {/* Header Modal */}
            <div className="px-6 py-5 bg-gradient-to-r from-primary to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5" />
                <h3 className="text-sm font-black uppercase tracking-wider">Alta de Nueva Empresa SaaS</h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4 text-xs">
              
              <div className="p-3 bg-slate-50 border border-border rounded-xl text-[10px] text-slate-600 leading-relaxed font-semibold flex gap-2">
                <AlertTriangle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <p>Al crear la empresa, el sistema aprovisionará de forma automática el correo administrativo inicial. El cliente usará esta cuenta para crear a sus propios cajeros y empleados.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nombre de la Empresa</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Bodegón Express"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-xs font-bold"
                  />
                </div>

                {/* RIF */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">RIF Corporativo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. J-12345678-0"
                    value={rif}
                    onChange={(e) => setRif(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Email Admin */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Correo Admin Corporativo</label>
                  <input
                    type="email"
                    required
                    placeholder="Ej. director@bodegon.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-xs font-bold"
                  />
                </div>

                {/* Contraseña Inicial */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contraseña Inicial Admin</label>
                  <input
                    type="password"
                    required
                    placeholder="Min. 6 caracteres"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Selector Plan */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Membresía / Plan a Contratar</label>
                <div className="grid grid-cols-4 gap-3">
                  {([
                    { key: "bronze", name: "Bronce", price: 29 },
                    { key: "silver", name: "Plata", price: 59 },
                    { key: "gold", name: "Oro", price: 99 },
                    { key: "enterprise", name: "Enterprise", price: 199 }
                  ] as const).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPlan(p.key)}
                      className={`p-3 rounded-2xl border transition-all text-center flex flex-col items-center justify-center space-y-1 cursor-pointer select-none ${
                        plan === p.key 
                          ? "border-primary bg-indigo-50/50 ring-2 ring-primary/10 text-slate-900 font-extrabold" 
                          : "border-border bg-white text-slate-600 hover:bg-slate-50 font-medium"
                      }`}
                    >
                      <span className="text-[10px] font-bold block">{p.name}</span>
                      <span className="text-[9px] font-mono text-slate-500">${p.price}/mes</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 border border-border hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer select-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer select-none uppercase tracking-wider"
                >
                  Dar de Alta
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

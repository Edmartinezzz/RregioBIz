"use client";

import React, { useState, useEffect } from "react";
import { useApp, UserRole, AppModule, PermissionActions } from "@/lib/context/AppContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  Users,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Lock,
  Mail,
  Key,
  User,
  CheckCircle,
  X,
  ShoppingBag,
  Package,
  LineChart,
  Share2,
  Settings,
} from "lucide-react";

interface SubUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "vendedor" | "marketing";
  permissions: Record<AppModule, PermissionActions>;
}

const defaultPermissions = (role: "vendedor" | "marketing"): Record<AppModule, PermissionActions> => {
  if (role === "vendedor") {
    return {
      ventas: { ver: true, crear: true, editar: false, eliminar: false },
      inventario: { ver: true, crear: false, editar: false, eliminar: false },
      finanzas: { ver: false, crear: false, editar: false, eliminar: false },
      "redes-sociales": { ver: false, crear: false, editar: false, eliminar: false },
      configuracion: { ver: false, crear: false, editar: false, eliminar: false },
    };
  }
  return {
    ventas: { ver: false, crear: false, editar: false, eliminar: false },
    inventario: { ver: true, crear: false, editar: false, eliminar: false },
    finanzas: { ver: false, crear: false, editar: false, eliminar: false },
    "redes-sociales": { ver: true, crear: true, editar: true, eliminar: true },
    configuracion: { ver: false, crear: false, editar: false, eliminar: false },
  };
};

const moduleLabels: Record<AppModule, { label: string; icon: React.ComponentType<any> }> = {
  ventas: { label: "Punto de Venta", icon: ShoppingBag },
  inventario: { label: "Inventario", icon: Package },
  finanzas: { label: "Finanzas", icon: LineChart },
  "redes-sociales": { label: "Redes Sociales", icon: Share2 },
  configuracion: { label: "Configuración", icon: Settings },
};

const actionLabels: (keyof PermissionActions)[] = ["ver", "crear", "editar", "eliminar"];

export default function SubUsuariosPage() {
  const { user } = useApp();

  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubUser | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Form fields
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"vendedor" | "marketing">("vendedor");

  const tenantId = user?.tenantId || "default";
  const storageKey = `regiobiz_subusers_${tenantId}`;

  // ── Sync a Supabase (upsert un sub-usuario individual) ────────────────────
  const syncSubUserToSupabase = async (su: SubUser) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase!
        .from("sub_users")
        .upsert({
          id: su.id,
          tenant_id: tenantId,
          name: su.name,
          email: su.email,
          password: su.password,
          role: su.role,
          permissions: su.permissions,
        });
    } catch (err) {
      console.error("Error sincronizando sub-usuario:", err);
    }
  };

  const deleteSubUserFromSupabase = async (id: string) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase!.from("sub_users").delete().eq("id", id);
    } catch (err) {
      console.error("Error eliminando sub-usuario de Supabase:", err);
    }
  };

  // Load sub-users — Supabase primero, localStorage como caché
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase!
            .from("sub_users")
            .select("*")
            .eq("tenant_id", tenantId);
          if (!error && data) {
            const mapped: SubUser[] = data.map((row: any) => ({
              id: row.id,
              name: row.name,
              email: row.email,
              password: row.password,
              role: row.role as "vendedor" | "marketing",
              permissions: row.permissions || defaultPermissions(row.role),
            }));
            setSubUsers(mapped);
            localStorage.setItem(storageKey, JSON.stringify(mapped));
            return;
          }
        } catch (err) {
          console.error("Error cargando sub-usuarios de Supabase:", err);
        }
      }
      // Fallback localStorage
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { setSubUsers(JSON.parse(saved)); } catch { setSubUsers([]); }
      }
    };

    load();
  }, [user]);

  const persist = (list: SubUser[]) => {
    setSubUsers(list);
    localStorage.setItem(storageKey, JSON.stringify(list));
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  // Create sub-user
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return;
    if (newPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (subUsers.some(u => u.email.toLowerCase() === newEmail.toLowerCase())) {
      alert("Ya existe un sub-usuario con ese correo electrónico.");
      return;
    }

    const created: SubUser = {
      id: `sub_${Date.now()}`,
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
      permissions: defaultPermissions(newRole),
    };

    const updated = [created, ...subUsers];
    persist(updated);
    syncSubUserToSupabase(created); // ← sync a Supabase
    setShowModal(false);
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("vendedor");
    showSuccess(`Sub-usuario "${created.name}" creado exitosamente.`);
  };

  // Delete sub-user
  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return;
    persist(subUsers.filter(u => u.id !== id));
    deleteSubUserFromSupabase(id); // ← eliminar de Supabase
    if (selectedUser?.id === id) setSelectedUser(null);
    showSuccess(`Usuario "${name}" eliminado.`);
  };

  // Toggle permission
  const togglePermission = (
    userId: string,
    module: AppModule,
    action: keyof PermissionActions
  ) => {
    const updated = subUsers.map(u => {
      if (u.id !== userId) return u;
      return {
        ...u,
        permissions: {
          ...u.permissions,
          [module]: {
            ...u.permissions[module],
            [action]: !u.permissions[module][action],
          },
        },
      };
    });
    persist(updated);
    // Sincronizar el usuario modificado a Supabase en tiempo real
    const fresh = updated.find(u => u.id === userId);
    if (fresh) {
      setSelectedUser(fresh);
      syncSubUserToSupabase(fresh); // ← sync permisos a Supabase
    }
  };

  // Block access for non-empresa admins
  if (!user || user.isMaster || user.role !== "admin") {
    return (
      <div className="premium-card p-8 text-center space-y-4 max-w-md mx-auto mt-12 bg-white">
        <Lock className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Acceso Restringido</h2>
        <p className="text-xs text-slate-600 font-bold">
          Solo el administrador de una empresa puede gestionar sub-usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* Toast */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl bg-white border border-border border-l-4 border-l-emerald-500 shadow-xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-sm font-semibold text-slate-900">{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestión de Sub-Usuarios</h1>
          <p className="text-sm text-slate-600 mt-2">
            Crea y administra los usuarios vendedores y de marketing de <span className="font-bold text-primary">{user.tenantName}</span>. Controla exactamente a qué módulos tiene acceso cada uno.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer select-none"
        >
          <Plus className="w-4 h-4" />
          Crear Sub-Usuario
        </button>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: User list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Usuarios Activos ({subUsers.length})
          </h2>

          {subUsers.length === 0 ? (
            <div className="premium-card p-8 text-center space-y-3 bg-white">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-400">Aún no has creado sub-usuarios.</p>
              <p className="text-[10px] text-slate-400">Haz clic en "Crear Sub-Usuario" para comenzar.</p>
            </div>
          ) : (
            subUsers.map(su => (
              <div
                key={su.id}
                onClick={() => setSelectedUser(su)}
                className={`premium-card p-4 bg-white cursor-pointer transition-all hover:border-primary/40 hover:shadow-md ${selectedUser?.id === su.id ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(su.name)}`}
                    alt={su.name}
                    className="w-10 h-10 rounded-full border border-border bg-white"
                  />
                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{su.name}</h4>
                    <p className="text-[10px] text-slate-500 truncate font-mono">{su.email}</p>
                    <span className={`inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${su.role === "vendedor" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {su.role === "vendedor" ? "Vendedor / Cajero" : "Marketing"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(su.id, su.name); }}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 hover:text-red-600 transition-all flex-shrink-0 cursor-pointer"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Permission matrix for selected user */}
        <div className="lg:col-span-2">
          {!selectedUser ? (
            <div className="premium-card p-10 bg-white text-center space-y-3 flex flex-col items-center justify-center min-h-[300px]">
              <Shield className="w-12 h-12 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Selecciona un sub-usuario de la lista</p>
              <p className="text-[10px] text-slate-400">Aquí podrás configurar sus permisos de acceso módulo por módulo.</p>
            </div>
          ) : (
            <div className="premium-card p-6 bg-white space-y-6">
              {/* Selected user header */}
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <img
                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(selectedUser.name)}`}
                  alt={selectedUser.name}
                  className="w-14 h-14 rounded-full border-2 border-primary/20 bg-white"
                />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
                  <span className={`inline-block mt-1 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${selectedUser.role === "vendedor" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
                    {selectedUser.role === "vendedor" ? "Vendedor / Cajero" : "Marketing"}
                  </span>
                </div>
                <div className="ml-auto p-3 rounded-xl bg-slate-50 border border-border">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contraseña</div>
                  <div className="text-xs font-mono font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                    <Key className="w-3 h-3 text-slate-400" />
                    {selectedUser.password}
                  </div>
                </div>
              </div>

              {/* Permission matrix */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-primary" />
                  Matriz de Permisos — Activa o desactiva módulos individuales
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                        <th className="pb-3 text-[10px]">Módulo</th>
                        {actionLabels.map(a => (
                          <th key={a} className="pb-3 text-center capitalize text-[10px]">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(Object.keys(selectedUser.permissions) as AppModule[]).map(module => {
                        const { label, icon: Icon } = moduleLabels[module];
                        return (
                          <tr key={module} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 font-black text-slate-800 flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-slate-400" />
                              {label}
                            </td>
                            {actionLabels.map(action => {
                              const val = selectedUser.permissions[module][action];
                              return (
                                <td key={action} className="py-4 text-center">
                                  <button
                                    onClick={() => togglePermission(selectedUser.id, module, action)}
                                    className="focus:outline-none transition-all scale-105 inline-block cursor-pointer"
                                    title={val ? "Quitar permiso" : "Dar permiso"}
                                  >
                                    {val ? (
                                      <ToggleRight className="w-9 h-6 text-primary" />
                                    ) : (
                                      <ToggleLeft className="w-9 h-6 text-slate-300" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-700 font-semibold">
                  💡 Los cambios de permisos se aplican en tiempo real. La próxima vez que el usuario inicie sesión verá solo los módulos que le hayas habilitado.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Sub-User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Crear Nuevo Sub-Usuario</h3>
                  <p className="text-[10px] text-slate-500">Empresa: {user.tenantName}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Ej: Valentina García"
                    className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correo corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="Ej: valentina@miempresa.com"
                    className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contraseña (mín. 6 caracteres)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Ej: clave123"
                    className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rol del usuario</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["vendedor", "marketing"] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${newRole === r ? "border-primary bg-primary/5 text-primary" : "border-border text-slate-600 hover:border-slate-300"}`}
                    >
                      {r === "vendedor" ? "🛒 Vendedor / Cajero" : "📢 Marketing"}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {newRole === "vendedor"
                    ? "Acceso predeterminado: Punto de Venta + vista de Inventario."
                    : "Acceso predeterminado: Hub Redes Sociales + vista de Inventario."}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

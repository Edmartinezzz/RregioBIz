"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../supabase";

// Tipados de Roles y Módulos
export type UserRole = "admin" | "vendedor" | "marketing";

export type AppModule = "ventas" | "inventario" | "finanzas" | "redes-sociales" | "configuracion";

export interface PermissionActions {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export type PermissionMatrix = Record<UserRole, Record<AppModule, PermissionActions>>;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  tenantId?: string;
  tenantName?: string;
  isMaster?: boolean; // true solo para carlosmtinez321@gmail.com
}

export interface RemoteRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  module: AppModule;
  action: "descuento" | "devolucion" | "editar_precio";
  details: string;
  status: "pending" | "approved" | "rejected";
  timestamp: Date;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  exchangeRate: number;
  permissions: PermissionMatrix;
  remoteRequests: RemoteRequest[];
  userOverrides: Record<string, string[]>; // user_id -> list of "module:action" overridden
  login: (email: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  updateExchangeRate: (newRate: number) => void;
  updatePermission: (role: UserRole, module: AppModule, action: keyof PermissionActions, value: boolean) => void;
  hasPermission: (module: AppModule, action: keyof PermissionActions) => boolean;
  requestRemotePermission: (action: "descuento" | "devolucion" | "editar_precio", details: string) => Promise<boolean>;
  approveRemoteRequest: (requestId: string) => void;
  rejectRemoteRequest: (requestId: string) => void;
}

const defaultPermissions: PermissionMatrix = {
  admin: {
    ventas: { ver: true, crear: true, editar: true, eliminar: true },
    inventario: { ver: true, crear: true, editar: true, eliminar: true },
    finanzas: { ver: true, crear: true, editar: true, eliminar: true },
    "redes-sociales": { ver: true, crear: true, editar: true, eliminar: true },
    configuracion: { ver: true, crear: true, editar: true, eliminar: true },
  },
  vendedor: {
    ventas: { ver: true, crear: true, editar: false, eliminar: false },
    inventario: { ver: true, crear: false, editar: false, eliminar: false }, // Ver solo sin costos
    finanzas: { ver: false, crear: false, editar: false, eliminar: false }, // Oculto
    "redes-sociales": { ver: false, crear: false, editar: false, eliminar: false }, // Oculto
    configuracion: { ver: false, crear: false, editar: false, eliminar: false }, // Oculto
  },
  marketing: {
    ventas: { ver: false, crear: false, editar: false, eliminar: false }, // Oculto
    inventario: { ver: true, crear: false, editar: false, eliminar: false }, // Ver sin costos
    finanzas: { ver: false, crear: false, editar: false, eliminar: false }, // Oculto
    "redes-sociales": { ver: true, crear: true, editar: true, eliminar: true },
    configuracion: { ver: false, crear: false, editar: false, eliminar: false }, // Oculto
  },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number>(36.45); // Tasa BCV inicial simulada
  const [permissions, setPermissions] = useState<PermissionMatrix>(defaultPermissions);
  const [remoteRequests, setRemoteRequests] = useState<RemoteRequest[]>([]);
  const [userOverrides, setUserOverrides] = useState<Record<string, string[]>>({});

  // Cargar estado inicial desde localStorage si existe (simula persistencia)
  useEffect(() => {
    const savedUser = localStorage.getItem("regiobiz_user");
    const savedRate = localStorage.getItem("regiobiz_rate");
    const savedPerms = localStorage.getItem("regiobiz_perms");

    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedRate) setExchangeRate(parseFloat(savedRate));
    if (savedPerms) setPermissions(JSON.parse(savedPerms));

    // Cargar tasa de cambio en vivo desde Supabase si está configurado
    if (isSupabaseConfigured()) {
      const fetchSupabaseRate = async () => {
        try {
          const { data, error } = await supabase!
            .from("bcv_rate")
            .select("rate")
            .eq("id", 1)
            .single();
          if (data && !error) {
            setExchangeRate(Number(data.rate));
          }
        } catch (err) {
          console.error("Error al cargar tasa en vivo de Supabase:", err);
        }
      };
      fetchSupabaseRate();
    }

    // Escuchador de eventos personalizados para simular sockets en la misma pestaña o múltiples
    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "RATE_UPDATE") {
        setExchangeRate(customEvent.detail.rate);
      } else if (customEvent.detail?.type === "PERM_UPDATE") {
        setPermissions(customEvent.detail.permissions);
      } else if (customEvent.detail?.type === "NEW_REQUEST") {
        setRemoteRequests((prev) => [customEvent.detail.request, ...prev]);
      } else if (customEvent.detail?.type === "REQUEST_APPROVED") {
        const { requestId, userId, permissionStr } = customEvent.detail;
        setRemoteRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: "approved" } : r))
        );
        setUserOverrides((prev) => ({
          ...prev,
          [userId]: [...(prev[userId] || []), permissionStr],
        }));
      } else if (customEvent.detail?.type === "REQUEST_REJECTED") {
        const { requestId } = customEvent.detail;
        setRemoteRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: "rejected" } : r))
        );
      }
    };

    window.addEventListener("regiobiz_realtime", handleRealtimeUpdate);
    setLoading(false);
    return () => window.removeEventListener("regiobiz_realtime", handleRealtimeUpdate);
  }, []);

  // Login con soporte multi-tenant — busca en Supabase primero
  const login = async (email: string, _providedRole: UserRole): Promise<boolean> => {
    const emailLower = email.toLowerCase();
    const isCarlos = emailLower.includes("carlos") || emailLower === "carlosmtinez321@gmail.com";
    
    let resolvedTenantId = "default";
    let resolvedTenantName = "RegioBIZ Demo";
    let resolvedName = "";
    // ─── IMPORTANTE: Siempre usamos null hasta que una fuente real lo confirme ───
    let resolvedRole: UserRole | null = null;

    if (isCarlos) {
      resolvedTenantId = "master";
      resolvedTenantName = "RegioBIZ Master";
      resolvedName = "Carlos Martínez";
      resolvedRole = "admin";
    } else {
      let foundInSupabase = false;

      if (isSupabaseConfigured()) {
        try {
          // ── 1A. Buscar primero en tenants (admin de empresa) ──────────────
          const { data: tenantData } = await supabase!
            .from("tenants")
            .select("*")
            .eq("admin_email", emailLower)
            .single();

          if (tenantData) {
            resolvedTenantId = tenantData.id;
            resolvedTenantName = tenantData.name;
            resolvedName = tenantData.name;
            resolvedRole = "admin"; // ← rol garantizado para admins de empresa
            foundInSupabase = true;
            // Actualizar caché local con los datos frescos de Supabase
            const saved = localStorage.getItem("regiobiz_tenants");
            const list = saved ? JSON.parse(saved) : [];
            const exists = list.some((t: any) => t.id === tenantData.id);
            if (!exists) {
              const mapped = {
                id: tenantData.id,
                name: tenantData.name,
                rif: tenantData.rif,
                adminEmail: tenantData.admin_email,
                plan: tenantData.plan,
                status: tenantData.status,
                cost: parseFloat(tenantData.cost),
                joinedDate: tenantData.joined_date,
              };
              localStorage.setItem("regiobiz_tenants", JSON.stringify([...list, mapped]));
            }
          }
        } catch (err) {
          console.error("Error buscando tenant en Supabase:", err);
        }
      }

      // ── 1B. Si Supabase no lo encontró como admin, revisar localStorage ANTES
      //        de buscar en sub_users — puede ser una empresa recién registrada
      //        cuya entrada de Supabase aún no llegó a la consulta ───────────
      if (!foundInSupabase) {
        const savedTenants = localStorage.getItem("regiobiz_tenants");
        const localTenants = savedTenants ? JSON.parse(savedTenants) : [];
        const matchedLocalTenant = localTenants.find(
          (t: any) => t.adminEmail.toLowerCase() === emailLower
        );

        if (matchedLocalTenant) {
          resolvedTenantId = matchedLocalTenant.id;
          resolvedTenantName = matchedLocalTenant.name;
          resolvedName = matchedLocalTenant.name;
          resolvedRole = "admin"; // ← también garantizado aquí
          foundInSupabase = true; // tratar como encontrado para no caer en demos
        }
      }

      // ── 2. Solo si tampoco estaba en localStorage como tenant admin,
      //        entonces buscar como sub-usuario ────────────────────────────
      if (!foundInSupabase) {
        if (isSupabaseConfigured()) {
          try {
            const { data: subData } = await supabase!
              .from("sub_users")
              .select("*, tenants(id, name)")
              .eq("email", emailLower)
              .single();

            if (subData) {
              resolvedTenantId = subData.tenant_id;
              resolvedTenantName = subData.tenants?.name || subData.tenant_id;
              resolvedName = subData.name;
              resolvedRole = subData.role as UserRole;
              foundInSupabase = true;
              if (subData.permissions) {
                const merged = {
                  ...defaultPermissions,
                  [subData.role]: subData.permissions,
                };
                setPermissions(merged);
                localStorage.setItem("regiobiz_perms", JSON.stringify(merged));
              }
            }
          } catch (err) {
            console.error("Error buscando sub-usuario en Supabase:", err);
          }
        }
      }

      // ── 3. Fallback a sub-usuarios en localStorage ────────────────────────
      if (!foundInSupabase) {
        const savedTenants = localStorage.getItem("regiobiz_tenants");
        const localTenants = savedTenants ? JSON.parse(savedTenants) : [];

        let foundSubuser: any = null;
        let foundTenant: any = null;

        for (const t of localTenants) {
          const savedSubs = localStorage.getItem(`regiobiz_subusers_${t.id}`);
          if (savedSubs) {
            const subs = JSON.parse(savedSubs);
            const match = subs.find((s: any) => s.email.toLowerCase() === emailLower);
            if (match) {
              foundSubuser = match;
              foundTenant = t;
              break;
            }
          }
        }

        if (foundSubuser && foundTenant) {
          resolvedTenantId = foundTenant.id;
          resolvedTenantName = foundTenant.name;
          resolvedName = foundSubuser.name;
          resolvedRole = foundSubuser.role as UserRole;
          foundInSupabase = true;
          if (foundSubuser.permissions) {
            const merged = {
              ...defaultPermissions,
              [foundSubuser.role]: foundSubuser.permissions,
            };
            setPermissions(merged);
            localStorage.setItem("regiobiz_perms", JSON.stringify(merged));
          }
        }
      }

      // ── 4. Último recurso: cuentas demo hardcodeadas ─────────────────────
      if (!foundInSupabase) {
        if (emailLower.includes("alejandra")) {
          resolvedTenantId = "default";
          resolvedTenantName = "RegioBIZ Demo";
          resolvedName = "Directora Alejandra";
          resolvedRole = "admin";
        } else if (emailLower.includes("valentina")) {
          resolvedTenantId = "default";
          resolvedTenantName = "RegioBIZ Demo";
          resolvedName = "Cajera Valentina";
          resolvedRole = "vendedor";
        } else if (emailLower.includes("isabella")) {
          resolvedTenantId = "default";
          resolvedTenantName = "RegioBIZ Demo";
          resolvedName = "Marketing Isabella";
          resolvedRole = "marketing";
        } else {
          // No se encontró en ninguna fuente → rechazar login
          console.warn("Usuario no encontrado en ninguna fuente:", emailLower);
          return false;
        }
      }
    } // end else (not master)

    // Seguridad: si por alguna razón el rol sigue siendo null, rechazar
    if (resolvedRole === null) {
      console.error("Rol no pudo resolverse para:", emailLower);
      return false;
    }

    const newUser: User = {
      id: isCarlos ? "usr_carlos" : `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: resolvedName || "Usuario",
      email: email,
      role: resolvedRole,
      tenantId: resolvedTenantId,
      tenantName: resolvedTenantName,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(resolvedName || "Usuario")}`,
      isMaster: isCarlos,
    };

    setUser(newUser);
    localStorage.setItem("regiobiz_user", JSON.stringify(newUser));
    return true;
  };

  // Cierre de sesión
  const logout = () => {
    setUser(null);
    localStorage.removeItem("regiobiz_user");
  };

  // Actualización centralizada de la tasa BCV del día
  const updateExchangeRate = async (newRate: number) => {
    setExchangeRate(newRate);
    localStorage.setItem("regiobiz_rate", newRate.toString());

    // Sincronizar con Supabase si está disponible
    if (isSupabaseConfigured()) {
      try {
        await supabase!
          .from("bcv_rate")
          .update({ rate: newRate, updated_at: new Date() })
          .eq("id", 1);
      } catch (err) {
        console.error("Error al actualizar tasa en Supabase:", err);
      }
    }
    
    // Despachar evento para simular sincronización real-time en UI
    window.dispatchEvent(
      new CustomEvent("regiobiz_realtime", {
        detail: { type: "RATE_UPDATE", rate: newRate },
      })
    );
  };

  // Actualizar permisos dinámicamente desde el panel del Administrador
  const updatePermission = (
    role: UserRole,
    module: AppModule,
    action: keyof PermissionActions,
    value: boolean
  ) => {
    const updated = {
      ...permissions,
      [role]: {
        ...permissions[role],
        [module]: {
          ...permissions[role][module],
          [action]: value,
        },
      },
    };

    setPermissions(updated);
    localStorage.setItem("regiobiz_perms", JSON.stringify(updated));

    // Despachar evento en tiempo real
    window.dispatchEvent(
      new CustomEvent("regiobiz_realtime", {
        detail: { type: "PERM_UPDATE", permissions: updated },
      })
    );
  };

  // Comprobar si el usuario actual tiene cierto permiso (evalúa RBAC + Overrides)
  const hasPermission = (module: AppModule, action: keyof PermissionActions): boolean => {
    if (!user) return false;
    
    // Los administradores (Directora) tienen siempre acceso total
    if (user.role === "admin") return true;

    // Verificar si hay una autorización temporal sobreescribiendo el permiso
    const userPermissionStr = `${module}:${action}`;
    if (userOverrides[user.id]?.includes(userPermissionStr)) {
      return true;
    }

    // De lo contrario, evaluar la matriz estándar
    return permissions[user.role]?.[module]?.[action] || false;
  };

  // Vendedora solicita permiso temporal a la Directora
  const requestRemotePermission = (
    action: "descuento" | "devolucion" | "editar_precio",
    details: string
  ): Promise<boolean> => {
    if (!user) return Promise.resolve(false);

    const newRequest: RemoteRequest = {
      id: `req_${Math.random().toString(36).substring(2, 9)}`,
      requesterId: user.id,
      requesterName: user.name,
      module: action === "devolucion" ? "finanzas" : "ventas",
      action: action,
      details: details,
      status: "pending",
      timestamp: new Date(),
    };

    // Agregar localmente
    setRemoteRequests((prev) => [newRequest, ...prev]);

    // Emitir en tiempo real
    window.dispatchEvent(
      new CustomEvent("regiobiz_realtime", {
        detail: { type: "NEW_REQUEST", request: newRequest },
      })
    );

    // Retorna una promesa que se resolverá cuando cambie el estado en localStorage
    return new Promise((resolve) => {
      const checkStatusInterval = setInterval(() => {
        setRemoteRequests((currentRequests) => {
          const match = currentRequests.find((r) => r.id === newRequest.id);
          if (match?.status === "approved") {
            clearInterval(checkStatusInterval);
            resolve(true);
          } else if (match?.status === "rejected") {
            clearInterval(checkStatusInterval);
            resolve(false);
          }
          return currentRequests;
        });
      }, 1000);

      // Timeout de 60 segundos si nadie aprueba la solicitud
      setTimeout(() => {
        clearInterval(checkStatusInterval);
        resolve(false);
      }, 60000);
    });
  };

  // Directora aprueba la solicitud
  const approveRemoteRequest = (requestId: string) => {
    const req = remoteRequests.find((r) => r.id === requestId);
    if (!req) return;

    // Determinar qué permiso de módulo se habilita
    let permissionStr = "ventas:editar"; // Descuento o cambio de precio
    if (req.action === "devolucion") {
      permissionStr = "finanzas:crear";
    }

    // Emitir aprobación en tiempo real
    window.dispatchEvent(
      new CustomEvent("regiobiz_realtime", {
        detail: {
          type: "REQUEST_APPROVED",
          requestId,
          userId: req.requesterId,
          permissionStr,
        },
      })
    );

    // Remover el override después de 15 segundos para simular transaccionalidad de un solo uso
    setTimeout(() => {
      setUserOverrides((prev) => {
        const userList = prev[req.requesterId] || [];
        return {
          ...prev,
          [req.requesterId]: userList.filter((p) => p !== permissionStr),
        };
      });
    }, 15000);
  };

  // Directora rechaza la solicitud
  const rejectRemoteRequest = (requestId: string) => {
    window.dispatchEvent(
      new CustomEvent("regiobiz_realtime", {
        detail: { type: "REQUEST_REJECTED", requestId },
      })
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        exchangeRate,
        permissions,
        remoteRequests,
        userOverrides,
        login,
        logout,
        updateExchangeRate,
        updatePermission,
        hasPermission,
        requestRemotePermission,
        approveRemoteRequest,
        rejectRemoteRequest,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp debe usarse dentro de un AppProvider");
  }
  return context;
}

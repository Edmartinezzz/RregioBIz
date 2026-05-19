"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/context/AppContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { 
  Coins, 
  Printer, 
  Lock, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Briefcase, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight,
  Plus,
  TrendingUp,
  Layers,
  X,
  CheckCircle,
  Edit,
  Trash2,
  Check
} from "lucide-react";

interface Account {
  id: string;
  name: string;
  bankName: string;
  balance: number; // Native currency balance
  currency: "USD" | "VES";
}

const initialAccounts: Account[] = [
  { id: "a1", name: "Caja Fuerte USD", bankName: "Efectivo Divisas", balance: 450.00, currency: "USD" },
  { id: "a2", name: "Zelle / BofA", bankName: "Bank of America", balance: 1100.00, currency: "USD" },
  { id: "a3", name: "Banesco Corriente", bankName: "Banco Nacional", balance: 4500.00, currency: "VES" },
  { id: "a4", name: "Pago Móvil Mercantil", bankName: "Mercantil Banco", balance: 6000.00, currency: "VES" },
  { id: "a5", name: "Caja Chica Bs", bankName: "Efectivo Bolívares", balance: 900.00, currency: "VES" },
];

export default function FinanzasPage() {
  const { user, exchangeRate } = useApp();

  // Estados de cuentas
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  
  // Cargar cuentas y ventas desde localStorage/Supabase (específico de inquilino)
  useEffect(() => {
    if (!user) return;
    const tenantId = user.tenantId || "default";

    const savedAccounts = localStorage.getItem(`regiobiz_accounts_${tenantId}`);
    if (savedAccounts) {
      setAccounts(JSON.parse(savedAccounts));
    } else {
      const localInitial = tenantId === "default" 
        ? initialAccounts 
        : initialAccounts.map(a => ({ ...a, balance: 0 }));
      localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(localInitial));
      setAccounts(localInitial);
    }

    const savedSales = localStorage.getItem(`regiobiz_sales_history_${tenantId}`);
    if (savedSales) {
      setSalesHistory(JSON.parse(savedSales));
    } else {
      setSalesHistory([]);
    }

    if (isSupabaseConfigured()) {
      const fetchSupabaseData = async () => {
        try {
          // Fetch accounts
          const { data: accData, error: accError } = await supabase!
            .from("financial_accounts")
            .select("*");
          
          // Fetch sales history
          const { data: salesData, error: salesError } = await supabase!
            .from("sales_history")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });

          if (salesData && !salesError) {
            const mappedSales = salesData.map((row: any) => ({
              id: row.id,
              totalUsd: parseFloat(row.total_usd),
              items: row.items,
              payments: { 
                cashUsd: row.payment_method.includes("Efectivo USD") ? parseFloat(row.total_usd) : 0, 
                zelle: row.payment_method.includes("Zelle") ? parseFloat(row.total_usd) : 0, 
                posBs: row.payment_method.includes("Punto") ? parseFloat(row.total_bs) : 0, 
                pagoMovil: row.payment_method.includes("Pago Móvil") ? parseFloat(row.total_bs) : 0, 
                cashBs: row.payment_method.includes("Efectivo Bolívares") ? parseFloat(row.total_bs) : 0 
              }
            }));
            setSalesHistory(mappedSales);
            localStorage.setItem(`regiobiz_sales_history_${tenantId}`, JSON.stringify(mappedSales));
          }

          if (accData && !accError) {
            const tenantAccounts = accData.filter((acc: any) => acc.id.startsWith(tenantId + "_"));
            
            // Si el inquilino no tiene cuentas en Supabase, inicializar sus cuentas por defecto
            if (tenantAccounts.length === 0) {
              const localInitial = tenantId === "default" || tenantId === "master"
                ? initialAccounts 
                : initialAccounts.map(a => ({ ...a, balance: 0 }));
              
              // Guardar las cuentas por defecto del inquilino en Supabase con su prefijo
              for (const acc of localInitial) {
                const isUsd = acc.currency === "USD";
                await supabase!
                  .from("financial_accounts")
                  .upsert({
                    id: `${tenantId}_${acc.id}`,
                    name: acc.name,
                    bank: acc.bankName,
                    balance_usd: isUsd ? acc.balance : 0,
                    balance_bs: isUsd ? 0 : acc.balance
                  });
              }
              
              setAccounts(localInitial);
              localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(localInitial));
            } else {
              const mapped: Account[] = tenantAccounts.map((acc: any) => {
                const cleanId = acc.id.replace(tenantId + "_", "");
                const isUsd = acc.balance_usd > 0 || cleanId.includes("usd") || acc.name.includes("USD") || acc.bank.includes("$") || acc.balance_bs === 0;
                return {
                  id: cleanId,
                  name: acc.name,
                  bankName: acc.bank,
                  balance: isUsd ? Number(acc.balance_usd) : Number(acc.balance_bs),
                  currency: isUsd ? "USD" : "VES"
                };
              });
              setAccounts(mapped);
              localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(mapped));
            }
          }
        } catch (err) {
          console.error("Error al cargar datos de Supabase:", err);
        }
      };
      fetchSupabaseData();
    }
  }, [user]);

  const saveAccountToSupabase = async (acc: Account) => {
    if (!isSupabaseConfigured()) return;
    try {
      const tenantId = user?.tenantId || "default";
      const isUsd = acc.currency === "USD";
      await supabase!
        .from("financial_accounts")
        .upsert({
          id: `${tenantId}_${acc.id}`,
          name: acc.name,
          bank: acc.bankName,
          balance_usd: isUsd ? acc.balance : 0,
          balance_bs: isUsd ? 0 : acc.balance
        });
    } catch (err) {
      console.error("Error al guardar cuenta en Supabase:", err);
    }
  };

  const deleteAccountFromSupabase = async (id: string) => {
    if (!isSupabaseConfigured()) return;
    try {
      const tenantId = user?.tenantId || "default";
      await supabase!
        .from("financial_accounts")
        .delete()
        .eq("id", `${tenantId}_${id}`);
    } catch (err) {
      console.error("Error al eliminar cuenta en Supabase:", err);
    }
  };

  // Restablecer todas las cuentas de esta empresa a saldo cero
  const handleClearAccounts = async () => {
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
    const resetAccs = accounts.map(a => ({ ...a, balance: 0 }));
    setAccounts(resetAccs);
    localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(resetAccs));

    if (isSupabaseConfigured()) {
      try {
        for (const acc of resetAccs) {
          const isUsd = acc.currency === "USD";
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
  
  // Modales y Formularios
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [newAccBalance, setNewAccBalance] = useState("");
  const [newAccCurrency, setNewAccCurrency] = useState<"USD" | "VES">("USD");

  // Estado de edición inline de cuenta
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState("");
  const [editAccBank, setEditAccBank] = useState("");

  // Estado de confirmación de eliminación premium
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState("");

  // Transferencia de dinero
  const [fromAccId, setFromAccId] = useState("");
  const [toAccId, setToAccId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferSuccess, setTransferSuccess] = useState("");

  // Gráfica de simulación interactiva
  const [chartCurrency, setChartCurrency] = useState<"USD" | "VES">("USD");
  
  // Reportes fiscales
  const [reportType, setReportType] = useState<"X" | "Z" | null>(null);
  const [spoolerStatus, setSpoolerStatus] = useState<"idle" | "sending" | "printing" | "success">("idle");
  const [isSystemLocked, setIsSystemLocked] = useState(false);

  // Totales acumulados simulados del día
  const cashUsdSales = 450.00;
  const zelleSales = 220.00;
  const cashBsSales = 180.00; // USD equivalent
  const pagoMovilSales = 240.00; // USD equivalent
  const posSales = 150.00; // USD equivalent
  const totalSalesUsd = cashUsdSales + zelleSales + cashBsSales + pagoMovilSales + posSales;

  // Impuestos acumulados
  const ivaAcumuladoUsd = totalSalesUsd * 0.11;
  const igtfAcumuladoUsd = cashUsdSales * 0.03;

  // Flujo diario de simulación (7 días)
  const baseChartData = [
    { day: "Lun", usd: 320 },
    { day: "Mar", usd: 410 },
    { day: "Mié", usd: 280 },
    { day: "Jue", usd: 520 },
    { day: "Vie", usd: 610 },
    { day: "Sáb", usd: 750 },
    { day: "Dom", usd: 450 },
  ];

  // Crear Cuenta Nueva
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccBank || !newAccBalance) return;

    const tenantId = user?.tenantId || "default";

    const newAcc: Account = {
      id: `a${accounts.length + 1}`,
      name: newAccName,
      bankName: newAccBank,
      balance: parseFloat(newAccBalance) || 0,
      currency: newAccCurrency
    };

    const updated = [...accounts, newAcc];
    setAccounts(updated);
    localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(updated));
    saveAccountToSupabase(newAcc);
    setShowAddAccountModal(false);

    // Limpiar campos
    setNewAccName("");
    setNewAccBank("");
    setNewAccBalance("");
    setNewAccCurrency("USD");
  };

  // Iniciar edición inline de una cuenta
  const handleStartEdit = (acc: Account) => {
    setEditingAccId(acc.id);
    setEditAccName(acc.name);
    setEditAccBank(acc.bankName);
    setTransferSuccess("");
    setTransferError("");
  };

  // Guardar edición inline
  const handleSaveEdit = (id: string) => {
    if (!editAccName || !editAccBank) return;

    const tenantId = user?.tenantId || "default";

    const updated = accounts.map(a => {
      if (a.id === id) {
        return { ...a, name: editAccName, bankName: editAccBank };
      }
      return a;
    });

    setAccounts(updated);
    localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(updated));
    const updatedAcc = updated.find(a => a.id === id);
    if (updatedAcc) saveAccountToSupabase(updatedAcc);
    setEditingAccId(null);
    setTransferSuccess("¡Cuenta modificada correctamente!");
  };

  // Iniciar flujo de eliminación premium
  const handleStartDelete = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setTransferSuccess("");
    setTransferError("");
  };

  // Confirmar eliminación de cuenta
  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;

    const tenantId = user?.tenantId || "default";

    const updated = accounts.filter(a => a.id !== deleteTargetId);
    setAccounts(updated);
    localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(updated));
    deleteAccountFromSupabase(deleteTargetId);
    
    // Limpiar selectores si usaban la cuenta eliminada
    if (fromAccId === deleteTargetId) setFromAccId("");
    if (toAccId === deleteTargetId) setToAccId("");

    setTransferSuccess(`Cuenta "${deleteTargetName}" eliminada exitosamente.`);
    setDeleteTargetId(null);
    setDeleteTargetName("");
  };

  // Realizar Transferencia Inteligente
  const handlePerformTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError("");
    setTransferSuccess("");

    if (!fromAccId || !toAccId || !transferAmount) {
      setTransferError("Por favor completa todos los campos.");
      return;
    }

    if (fromAccId === toAccId) {
      setTransferError("Las cuentas origen y destino no pueden ser la misma.");
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferError("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    const sourceAcc = accounts.find(a => a.id === fromAccId);
    const destAcc = accounts.find(a => a.id === toAccId);

    if (!sourceAcc || !destAcc) {
      setTransferError("Una de las cuentas seleccionadas no existe.");
      return;
    }

    if (sourceAcc.balance < amount) {
      setTransferError(`Fondos insuficientes en ${sourceAcc.name}. Balance actual: ${sourceAcc.balance.toFixed(2)} ${sourceAcc.currency}`);
      return;
    }

    // Calcular conversión
    let receivedAmount = amount;
    if (sourceAcc.currency === "USD" && destAcc.currency === "VES") {
      receivedAmount = amount * exchangeRate;
    } else if (sourceAcc.currency === "VES" && destAcc.currency === "USD") {
      receivedAmount = amount / exchangeRate;
    }

    // Actualizar balances
    const tenantId = user?.tenantId || "default";

    const updatedAccounts = accounts.map(a => {
      if (a.id === sourceAcc.id) {
        return { ...a, balance: a.balance - amount };
      }
      if (a.id === destAcc.id) {
        return { ...a, balance: a.balance + receivedAmount };
      }
      return a;
    });

    setAccounts(updatedAccounts);
    localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(updatedAccounts));
    const updatedSource = updatedAccounts.find(a => a.id === sourceAcc.id);
    const updatedDest = updatedAccounts.find(a => a.id === destAcc.id);
    if (updatedSource) saveAccountToSupabase(updatedSource);
    if (updatedDest) saveAccountToSupabase(updatedDest);
    setTransferSuccess(
      `¡Transferencia exitosa! Se debitaron ${amount.toFixed(2)} ${sourceAcc.currency} de ${sourceAcc.name} y se acreditaron ${receivedAmount.toFixed(2)} ${destAcc.currency} en ${destAcc.name}.`
    );
    setTransferAmount("");
  };

  // Gatillar emisión de reporte fiscal X o Z
  const handleTriggerFiscalReport = (type: "X" | "Z") => {
    setReportType(type);
    setSpoolerStatus("sending");
    
    setTimeout(() => {
      setSpoolerStatus("printing");
      
      const payload = {
        command: type === "X" ? "print_report_x" : "print_report_z",
        operator: user?.name || "Directora Alejandra",
        timestamp: new Date().toISOString(),
        totals: {
          total_usd: totalSalesUsd,
          tasa: exchangeRate
        }
      };

      console.log(`IMPRESIÓN FISCAL SENIAT ACTIVA:`, payload);

      setTimeout(() => {
        setSpoolerStatus("success");
        if (type === "Z") {
          setIsSystemLocked(true);
        }
      }, 1500);
    }, 1200);
  };

  const handleResetLock = () => {
    setIsSystemLocked(false);
    setSpoolerStatus("idle");
    setReportType(null);
  };

  // Calcular equivalentes informativos para el calculador de transferencia
  const getTransferPreview = () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0 || !fromAccId || !toAccId) return null;

    const sourceAcc = accounts.find(a => a.id === fromAccId);
    const destAcc = accounts.find(a => a.id === toAccId);

    if (!sourceAcc || !destAcc) return null;

    if (sourceAcc.currency === destAcc.currency) {
      return `Monto a recibir: ${amount.toFixed(2)} ${destAcc.currency}`;
    }

    if (sourceAcc.currency === "USD" && destAcc.currency === "VES") {
      const converted = amount * exchangeRate;
      return `Monto a recibir: ${converted.toFixed(2)} Bs. (Tasa cambio del día: ${exchangeRate.toFixed(2)} Bs/$)`;
    }

    if (sourceAcc.currency === "VES" && destAcc.currency === "USD") {
      const converted = amount / exchangeRate;
      return `Monto a recibir: $${converted.toFixed(2)} USD (Tasa cambio del día: ${exchangeRate.toFixed(2)} Bs/$)`;
    }

    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Finanzas & Centro de Liquidación
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Administra cuentas bimonetarias, realiza transferencias inteligentes y audita los cierres fiscales SENIAT en tiempo real.
          </p>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Botón Crear Cuenta */}
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" />
            Crear Cuenta Bancaria
          </button>

          {/* Borrar Todo Finanzas */}
          {user?.role === "admin" && (
            <button
              onClick={handleClearAccounts}
              className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 hover:bg-red-100 text-red-800 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer select-none"
              title="Restablecer Cuentas a Saldo Cero"
            >
              <Trash2 className="w-4.5 h-4.5 text-red-600 animate-pulse" />
              Restablecer Finanzas
            </button>
          )}
        </div>
      </div>

      {/* AVISO DE BLOQUEO DE SISTEMA (REPORTE Z EMITIDO) */}
      {isSystemLocked && (
        <div className="premium-card p-6 border border-red-200 bg-red-50 space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <Lock className="w-8 h-8 text-red-600 flex-shrink-0 animate-pulse" />
            <div>
              <h3 className="text-md font-bold uppercase tracking-wider">Sistema Cerrado y Bloqueado por Reporte Z</h3>
              <p className="text-xs text-red-500 mt-0.5">
                Por regulación fiscal, la emisión del Reporte Z cierra el ejercicio comercial del día. El POS de ventas se encuentra suspendido.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetLock}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            Reiniciar Jornada (Simulador)
          </button>
        </div>
      )}

      {/* SECCIÓN: CUENTAS BANCARIAS ACTIVAS (VISTA PREVIA MODERNA) */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" />
          Tus Cuentas Activas (Bimonetarias)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {accounts.map((acc) => {
            const isUsd = acc.currency === "USD";
            const isEditing = editingAccId === acc.id;
            return (
              <div 
                key={acc.id} 
                className="premium-card premium-card-hover p-5 relative overflow-hidden flex flex-col justify-between min-h-[170px] bg-white group transition-all"
              >
                {/* Panel de acciones (Editar y Eliminar) */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity z-20">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={() => handleStartEdit(acc)}
                        className="p-1 rounded bg-slate-50 hover:bg-slate-100 border border-border text-slate-500 hover:text-slate-800 cursor-pointer"
                        title="Editar nombre"
                      >
                        <Edit className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => handleStartDelete(acc.id, acc.name)}
                        className="p-1 rounded bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 hover:text-red-600 cursor-pointer"
                        title="Eliminar cuenta"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSaveEdit(acc.id)}
                        className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        title="Guardar"
                      >
                        <Check className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => setEditingAccId(null)}
                        className="p-1 rounded bg-slate-50 hover:bg-slate-100 border border-border text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </>
                  )}
                </div>

                <div className="flex justify-between items-start gap-2 pr-10">
                  <div className="w-full">
                    {isEditing ? (
                      <div className="space-y-1.5 pt-2">
                        <input
                          type="text"
                          value={editAccName}
                          onChange={(e) => setEditAccName(e.target.value)}
                          className="w-full px-2 py-0.5 text-xs bg-white border border-border rounded text-slate-900 focus:outline-none focus:border-primary"
                          placeholder="Nombre cuenta"
                          required
                        />
                        <input
                          type="text"
                          value={editAccBank}
                          onChange={(e) => setEditAccBank(e.target.value)}
                          className="w-full px-2 py-0.5 text-[9px] bg-white border border-border rounded text-slate-500 focus:outline-none focus:border-primary"
                          placeholder="Ente / Banco"
                          required
                        />
                      </div>
                    ) : (
                      <>
                        <h4 className="text-xs font-extrabold text-slate-800 line-clamp-1">{acc.name}</h4>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide block mt-0.5">
                          {acc.bankName}
                        </span>
                      </>
                    )}
                  </div>
                  
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md self-start ${
                    isUsd ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-sky-50 text-sky-600 border border-sky-200"
                  }`}>
                    {acc.currency}
                  </span>
                </div>

                <div className="pt-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Balance Disponible</span>
                  <p className={`text-lg font-extrabold font-mono mt-1 ${isUsd ? "text-usd" : "text-sky-700"}`}>
                    {isUsd ? "$" : ""}
                    {acc.balance.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {!isUsd ? " Bs." : ""}
                  </p>
                  
                  {/* Equivalencia cruzada en tiempo real */}
                  <span className="text-[10px] text-slate-400 font-bold block mt-1 font-mono">
                    {isUsd ? "" : "$"}
                    {isUsd 
                      ? `${(acc.balance * exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs. equiv` 
                      : `${(acc.balance / exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })} equiv`
                    }
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PANEL DE FLUIDEZ BANCARIA E HISTORIAL GRÁFICO (7 Columnas) */}
        <div className="premium-card p-6 lg:col-span-7 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Rendimiento y Flujo de Caja Semanal
                </h3>
                <p className="text-xs text-slate-500 mt-1">Comparativa de ingresos diarios de caja bimonetaria</p>
              </div>

              {/* Toggle de Monedas de Gráfica */}
              <div className="flex bg-muted p-1 rounded-lg border border-border">
                <button 
                  onClick={() => setChartCurrency("USD")}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    chartCurrency === "USD" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Ver en USD
                </button>
                <button 
                  onClick={() => setChartCurrency("VES")}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    chartCurrency === "VES" ? "bg-white text-sky-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Ver en Bs.
                </button>
              </div>
            </div>

            {/* GRÁFICA VECTORIAL SVG PERSONALIZADA DE ALTO IMPACTO (LIGHT MINT FLAT) */}
            <div className="relative pt-6 bg-muted/30 rounded-2xl border border-border/50 p-4">
              <div className="absolute top-2 left-4 flex gap-4 text-[9px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-primary rounded-full" /> Ventas</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-500 rounded-full" /> Proyección</span>
              </div>

              {/* Eje Y de referencia */}
              <div className="absolute right-4 top-2 text-[9px] font-bold text-slate-400 font-mono">
                Tasa del día: 1 $ = {exchangeRate.toFixed(2)} Bs.
              </div>

              {/* El Gráfico SVG */}
              <svg viewBox="0 0 500 160" className="w-full h-44 overflow-visible mt-4">
                {/* Cuadrícula de Fondo */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#bdecce" strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="#bdecce" strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#bdecce" strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="0" y1="140" x2="500" y2="140" stroke="#bdecce" strokeWidth="0.5" strokeDasharray="4 4" />

                {/* Línea de Ingresos */}
                {/* Lun(320), Mar(410), Mié(280), Jue(520), Vie(610), Sáb(750), Dom(450) */}
                <path
                  d={`M 30 ${140 - (baseChartData[0].usd / 800 * 120)} 
                     L 100 ${140 - (baseChartData[1].usd / 800 * 120)} 
                     L 170 ${140 - (baseChartData[2].usd / 800 * 120)} 
                     L 240 ${140 - (baseChartData[3].usd / 800 * 120)} 
                     L 310 ${140 - (baseChartData[4].usd / 800 * 120)} 
                     L 380 ${140 - (baseChartData[5].usd / 800 * 120)} 
                     L 450 ${140 - (baseChartData[6].usd / 800 * 120)}`}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Área bajo la curva con gradiente */}
                <path
                  d={`M 30 140 
                     L 30 ${140 - (baseChartData[0].usd / 800 * 120)} 
                     L 100 ${140 - (baseChartData[1].usd / 800 * 120)} 
                     L 170 ${140 - (baseChartData[2].usd / 800 * 120)} 
                     L 240 ${140 - (baseChartData[3].usd / 800 * 120)} 
                     L 310 ${140 - (baseChartData[4].usd / 800 * 120)} 
                     L 380 ${140 - (baseChartData[5].usd / 800 * 120)} 
                     L 450 ${140 - (baseChartData[6].usd / 800 * 120)} 
                     L 450 140 Z`}
                  fill="url(#grad)"
                  opacity="0.15"
                />

                {/* Definiciones para gradientes del SVG */}
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#ffffff" />
                  </linearGradient>
                </defs>

                {/* Nodos de datos individuales y etiquetas flotantes */}
                {baseChartData.map((d, idx) => {
                  const x = 30 + idx * 70;
                  const value = chartCurrency === "USD" ? d.usd : d.usd * exchangeRate;
                  const y = 140 - (d.usd / 800 * 120);

                  return (
                    <g key={d.day} className="group/node">
                      <circle
                        cx={x}
                        cy={y}
                        r="5"
                        fill="#ffffff"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        className="cursor-pointer transition-all hover:r-7"
                      />
                      
                      {/* Texto de valor en hover */}
                      <text
                        x={x}
                        y={y - 12}
                        textAnchor="middle"
                        fill="#065f46"
                        className="text-[9px] font-mono font-bold select-none"
                      >
                        {chartCurrency === "USD" ? `$${value.toFixed(0)}` : `${value.toFixed(0)} Bs.`}
                      </text>

                      {/* Texto de Día en eje X */}
                      <text
                        x={x}
                        y="155"
                        textAnchor="middle"
                        fill="#64748b"
                        className="text-[10px] font-bold select-none"
                      >
                        {d.day}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          
          {/* Desglose de Liquidación Fiscal Diario */}
          <div className="pt-6 border-t border-border space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Acumulados Fiscales en Caja</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">IVA 16%</span>
                <p className="text-sm font-extrabold text-slate-900 font-mono mt-1">${ivaAcumuladoUsd.toFixed(2)}</p>
                <span className="text-[9px] text-slate-500 font-mono block">{(ivaAcumuladoUsd * exchangeRate).toFixed(2)} Bs.</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">IGTF Recargo 3%</span>
                <p className="text-sm font-extrabold text-amber-600 font-mono mt-1">${igtfAcumuladoUsd.toFixed(2)}</p>
                <span className="text-[9px] text-slate-500 font-mono block">{(igtfAcumuladoUsd * exchangeRate).toFixed(2)} Bs.</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Ventas Exentas</span>
                <p className="text-sm font-extrabold text-emerald-700 font-mono mt-1">${(totalSalesUsd * 0.3).toFixed(2)}</p>
                <span className="text-[9px] text-slate-500 font-mono block">{((totalSalesUsd * 0.3) * exchangeRate).toFixed(2)} Bs.</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Ingreso Neto Total</span>
                <p className="text-sm font-extrabold text-usd font-mono mt-1">${totalSalesUsd.toFixed(2)}</p>
                <span className="text-[9px] text-bs font-mono block">{(totalSalesUsd * exchangeRate).toFixed(2)} Bs.</span>
              </div>
            </div>
          </div>
        </div>

        {/* MÓDULO DE TRANSFERENCIA DENTRO DE CUENTAS (5 Columnas) */}
        <div className="premium-card p-6 lg:col-span-5 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-border pb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-500" />
              Transferencia Inteligente
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Transfiere dinero al instante entre cuentas. El sistema detecta la moneda (USD vs. Bs.) y calcula la conversión en tiempo real a la tasa oficial del día.
            </p>

            <form onSubmit={handlePerformTransfer} className="space-y-4 text-xs">
              
              {/* Cuenta Origen */}
              <div className="space-y-1">
                <label className="text-slate-600 font-bold uppercase block">Cuenta Origen</label>
                <select
                  value={fromAccId}
                  onChange={(e) => {
                    setFromAccId(e.target.value);
                    setTransferError("");
                    setTransferSuccess("");
                  }}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary cursor-pointer capitalize"
                >
                  <option value="">Selecciona cuenta origen...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.balance.toFixed(2)} {a.currency})
                    </option>
                  ))}
                </select>
              </div>

              {/* Icono de Dirección */}
              <div className="flex justify-center py-1">
                <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-slate-500">
                  <ArrowRight className="w-4 h-4 rotate-90 lg:rotate-0" />
                </div>
              </div>

              {/* Cuenta Destino */}
              <div className="space-y-1">
                <label className="text-slate-600 font-bold uppercase block">Cuenta Destino</label>
                <select
                  value={toAccId}
                  onChange={(e) => {
                    setToAccId(e.target.value);
                    setTransferError("");
                    setTransferSuccess("");
                  }}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary cursor-pointer capitalize"
                >
                  <option value="">Selecciona cuenta destino...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.balance.toFixed(2)} {a.currency})
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto de la Transferencia */}
              <div className="space-y-1">
                <label className="text-slate-600 font-bold uppercase block">Monto a Transferir</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => {
                      setTransferAmount(e.target.value);
                      setTransferError("");
                      setTransferSuccess("");
                    }}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-border rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                    required
                  />
                  <div className="absolute left-3 top-3 text-slate-400 font-bold">
                    $
                  </div>
                </div>
              </div>

              {/* Vista Previa Conversión Cruzada en tiempo real */}
              {getTransferPreview() && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold font-mono text-[10px] animate-pulse">
                  {getTransferPreview()}
                </div>
              )}

              {/* Mensajes de error o éxito */}
              {transferError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 font-bold text-[10px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {transferError}
                </div>
              )}

              {transferSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  {transferSuccess}
                </div>
              )}

              {/* Botón Ejecutar */}
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                Confirmar Transferencia
              </button>
            </form>
          </div>

          {/* COMANDOS FISCALES IMPRESORA SENIAT */}
          <div className="pt-6 border-t border-border space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-slate-500" />
              Comandos Impresora Fiscal
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleTriggerFiscalReport("X")}
                disabled={spoolerStatus === "sending" || spoolerStatus === "printing" || isSystemLocked}
                className="py-2.5 px-3 bg-white border border-border hover:bg-slate-50 text-slate-700 rounded-lg text-[10px] font-extrabold transition-all disabled:opacity-50 flex flex-col items-center justify-center cursor-pointer gap-1"
              >
                Emitir Reporte X
                <span className="block text-[8px] font-mono text-slate-400 uppercase tracking-widest">(Arqueo Parcial)</span>
              </button>

              <button
                onClick={() => handleTriggerFiscalReport("Z")}
                disabled={spoolerStatus === "sending" || spoolerStatus === "printing" || isSystemLocked}
                className="py-2.5 px-3 bg-white border border-border hover:bg-red-50 hover:text-red-600 text-slate-700 rounded-lg text-[10px] font-extrabold transition-all disabled:opacity-50 flex flex-col items-center justify-center cursor-pointer gap-1"
              >
                Emitir Reporte Z
                <span className="block text-[8px] font-mono text-slate-400 uppercase tracking-widest">(Cierre SENIAT)</span>
              </button>
            </div>

            {/* Estado de Impresión Fiscal */}
            {spoolerStatus !== "idle" && reportType && (
              <div className="p-3 rounded-lg bg-muted border border-border space-y-1.5 text-[10px] text-slate-600">
                <div className="flex justify-between items-center">
                  <span>Impresora Fiscal (Reporte {reportType}):</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                    spoolerStatus === "success" ? "bg-emerald-100 text-emerald-800 animate-pulse" : "bg-primary/10 text-primary animate-bounce"
                  }`}>
                    {spoolerStatus === "sending" && "Transmitiendo..."}
                    {spoolerStatus === "printing" && "Imprimiendo..."}
                    {spoolerStatus === "success" && "Impreso OK"}
                  </span>
                </div>
                {spoolerStatus === "success" && (
                  <p className="text-[9px] text-emerald-600 font-mono text-center pt-1 font-bold">
                    *** REPORTE {reportType} CONFIRMADO ***
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL CREAR CUENTA BANCARIA */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="premium-card w-full max-w-md p-6 space-y-6 relative border border-primary/30 bg-white">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Nueva Cuenta Financiera
              </h3>
              <button 
                onClick={() => setShowAddAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase block">Nombre de la Cuenta</label>
                  <input
                    type="text"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    placeholder="Banesco Ahorros..."
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase block">Moneda Native</label>
                  <select
                    value={newAccCurrency}
                    onChange={(e) => setNewAccCurrency(e.target.value as "USD" | "VES")}
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="USD">Dólares ($ USD)</option>
                    <option value="VES">Bolívares (Bs. VES)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold uppercase block">Banco o Institución</label>
                <input
                  type="text"
                  value={newAccBank}
                  onChange={(e) => setNewAccBank(e.target.value)}
                  placeholder="Banesco Banco Universal..."
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold uppercase block">Balance Inicial</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="flex-1 py-2.5 border border-border hover:bg-slate-50 text-slate-600 font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-primary hover:bg-indigo-600 text-white font-bold rounded-lg cursor-pointer"
                >
                  Crear Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN PREMIUM (REEMPLAZA EL CONFIRM NATIVO) */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="premium-card w-full max-w-sm p-6 space-y-6 relative border border-red-200 bg-white">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                ¿Eliminar Cuenta?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente la cuenta <strong className="text-slate-900 font-extrabold">"{deleteTargetName}"</strong>? Esta acción es irreversible.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTargetId(null);
                  setDeleteTargetName("");
                }}
                className="flex-1 py-2.5 border border-border hover:bg-slate-50 text-slate-600 font-bold rounded-lg cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg cursor-pointer text-xs"
              >
                Eliminar Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORIAL DE VENTAS Y TRASLADOS EN TIEMPO REAL */}
      <div className="premium-card p-6 space-y-6 bg-white border border-border mt-8">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-500 animate-pulse" />
            Historial de Ventas y Liquidación de Fondos
          </h3>
          <p className="text-xs text-slate-500 mt-2">
            Control de flujo en tiempo real. Cada factura emitida traslada automáticamente el dinero a su cuenta de destino correspondiente según la conciliación de pagos.
          </p>
        </div>

        {/* Guía Visual de Destinos de Pago */}
        <div className="p-4 rounded-xl bg-slate-50 border border-border grid grid-cols-1 sm:grid-cols-5 gap-4 text-center">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-600 block">Efectivo Divisas ($)</span>
            <span className="text-[11px] font-bold text-slate-700 block">➡ Caja Fuerte USD (a1)</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-teal-600 block">Zelle ($)</span>
            <span className="text-[11px] font-bold text-slate-700 block">➡ Zelle / BofA (a2)</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-blue-600 block">Punto de Venta Bs.</span>
            <span className="text-[11px] font-bold text-slate-700 block">➡ Banesco Corriente (a3)</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-indigo-600 block">Pago Móvil Bs.</span>
            <span className="text-[11px] font-bold text-slate-700 block">➡ Pago Móvil Mercantil (a4)</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-sky-600 block">Efectivo Bolívares (Bs.)</span>
            <span className="text-[11px] font-bold text-slate-700 block">➡ Caja Chica Bs (a5)</span>
          </div>
        </div>

        {salesHistory.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-medium border border-dashed border-slate-200 rounded-xl">
            No se han procesado ventas en esta sesión. Abre el Punto de Venta (POS) y completa una venta para ver el traslado automático.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 font-extrabold text-slate-600 uppercase text-[9px] tracking-wider">
                  <th className="py-3 px-4">Factura ID</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4 text-center">Artículos</th>
                  <th className="py-3 px-4 text-right">Total Facturado</th>
                  <th className="py-3 px-4 text-center">Desglose de Liquidación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {salesHistory.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{sale.id}</td>
                    <td className="py-3 px-4 text-slate-500">{sale.date}</td>
                    <td className="py-3 px-4 text-slate-700">{sale.client}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-600">{sale.itemsCount}</td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold">
                      <div className="text-usd">${sale.totalUsd.toFixed(2)}</div>
                      <div className="text-bs text-[10px]">{sale.totalBs.toFixed(2)} Bs.</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {sale.payments?.cashUsd > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-bold">
                            Efectivo $: +${sale.payments.cashUsd.toFixed(2)} ➡ a1
                          </span>
                        )}
                        {sale.payments?.zelle > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-600 border border-teal-200 text-[9px] font-bold">
                            Zelle: +${sale.payments.zelle.toFixed(2)} ➡ a2
                          </span>
                        )}
                        {sale.payments?.posBs > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-bold">
                            Punto Bs: +{sale.payments.posBs.toFixed(2)} Bs. ➡ a3
                          </span>
                        )}
                        {sale.payments?.pagoMovil > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200 text-[9px] font-bold">
                            P.Móvil Bs: +{sale.payments.pagoMovil.toFixed(2)} Bs. ➡ a4
                          </span>
                        )}
                        {sale.payments?.cashBs > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-200 text-[9px] font-bold">
                            Efectivo Bs: +{sale.payments.cashBs.toFixed(2)} Bs. ➡ a5
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/context/AppContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { 
  Calendar, 
  Printer, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  Clock, 
  User, 
  Tag, 
  FileText, 
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Trash2
} from "lucide-react";

interface SaleRecord {
  id: string;
  controlNumber: string;
  date: string; // ISO or human format
  client: string;
  itemsCount: number;
  totalUsd: number;
  totalBs: number;
  items: Array<{ name: string; qty: number; price: number }>;
  payments: {
    cashUsd: number;
    zelle: number;
    posBs: number;
    pagoMovil: number;
    cashBs: number;
  };
}

const mockInitialSales: SaleRecord[] = [
  {
    id: "TKT-48116",
    controlNumber: "CTRL-90021",
    date: new Date().toISOString(), // Today
    client: "Carlos Mendoza (V-18.492.301)",
    itemsCount: 3,
    totalUsd: 145.00,
    totalBs: 5285.25,
    items: [
      { name: "Harina de Maíz Precocida 1Kg", qty: 5, price: 1.20 },
      { name: "Aceite Vegetal Mezcla 1L", qty: 2, price: 3.50 },
      { name: "Combo Parrillero Premium Regio", qty: 1, price: 132.00 }
    ],
    payments: {
      cashUsd: 50.00,
      zelle: 0,
      posBs: 3460.25, // Bs portion
      pagoMovil: 0,
      cashBs: 0
    }
  },
  {
    id: "TKT-48115",
    controlNumber: "CTRL-90020",
    date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    client: "María Corina (V-12.842.115)",
    itemsCount: 2,
    totalUsd: 65.50,
    totalBs: 2387.48,
    items: [
      { name: "Arroz Entero Tipo I 1Kg", qty: 10, price: 1.10 },
      { name: "Nutella Chocolate Spread 350g", qty: 5, price: 10.90 }
    ],
    payments: {
      cashUsd: 0,
      zelle: 65.50,
      posBs: 0,
      pagoMovil: 0,
      cashBs: 0
    }
  },
  {
    id: "TKT-48114",
    controlNumber: "CTRL-90019",
    date: new Date(Date.now() - 12000000).toISOString(), // Today early
    client: "Consumidor Final",
    itemsCount: 1,
    totalUsd: 18.00,
    totalBs: 656.10,
    items: [
      { name: "Café Molido Gourmet 500g", qty: 3, price: 6.00 }
    ],
    payments: {
      cashUsd: 10.00,
      zelle: 0,
      posBs: 0,
      pagoMovil: 291.60,
      cashBs: 0
    }
  },
  // Yesterday
  {
    id: "TKT-48108",
    controlNumber: "CTRL-90013",
    date: new Date(Date.now() - 86400000).toISOString(),
    client: "Pedro Pérez (V-9.302.405)",
    itemsCount: 4,
    totalUsd: 320.00,
    totalBs: 11664.00,
    items: [
      { name: "Whisky Escocés 12 Años 750ml", qty: 2, price: 45.00 },
      { name: "Queso Amarillo Madurado 1Kg", qty: 1, price: 12.00 },
      { name: "Combo Charcutero Familiar", qty: 1, price: 218.00 }
    ],
    payments: {
      cashUsd: 200.00,
      zelle: 0,
      posBs: 4374.00,
      pagoMovil: 0,
      cashBs: 0
    }
  },
  // Last week
  {
    id: "TKT-48092",
    controlNumber: "CTRL-89997",
    date: new Date(Date.now() - 5 * 86400000).toISOString(),
    client: "Sofía Delgado (V-24.301.291)",
    itemsCount: 2,
    totalUsd: 42.00,
    totalBs: 1530.90,
    items: [
      { name: "Refresco Cola Negra 2L", qty: 12, price: 2.00 },
      { name: "Mayonesa Clásica Doypack 500g", qty: 6, price: 3.00 }
    ],
    payments: {
      cashUsd: 0,
      zelle: 0,
      posBs: 0,
      pagoMovil: 1530.90,
      cashBs: 0
    }
  }
];

export default function HistorialVentasPage() {
  const { user, exchangeRate } = useApp();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([]);
  
  // Filtros
  const [filterType, setFilterType] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // Cargar historial
  useEffect(() => {
    if (!user) return;
    const tenantId = user.tenantId || "default";

    const loadHistory = async () => {
      // 1. Supabase (Fuente de verdad real)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase!
            .from("sales_history")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });

          if (!error && data) {
            const mapped = data.map((row: any) => ({
              id: row.id,
              controlNumber: row.invoice_num,
              date: row.created_at,
              client: row.client_name,
              itemsCount: row.items.reduce((sum: number, it: any) => sum + it.qty, 0),
              totalUsd: parseFloat(row.total_usd),
              totalBs: parseFloat(row.total_bs),
              items: row.items,
              payments: { 
                cashUsd: row.payment_method.includes("Efectivo USD") ? parseFloat(row.total_usd) : 0, 
                zelle: row.payment_method.includes("Zelle") ? parseFloat(row.total_usd) : 0, 
                posBs: row.payment_method.includes("Punto") ? parseFloat(row.total_bs) : 0, 
                pagoMovil: row.payment_method.includes("Pago Móvil") ? parseFloat(row.total_bs) : 0, 
                cashBs: row.payment_method.includes("Efectivo Bolívares") ? parseFloat(row.total_bs) : 0 
              }
            }));
            setSales(mapped);
            localStorage.setItem(`regiobiz_sales_history_${tenantId}`, JSON.stringify(mapped));
            return;
          }
        } catch (err) {
          console.error("Error cargando historial de Supabase:", err);
        }
      }

      // 2. Fallback local
      const saved = localStorage.getItem(`regiobiz_sales_history_${tenantId}`);
      if (saved) {
        setSales(JSON.parse(saved));
      } else {
        const initialData = tenantId === "default" ? mockInitialSales : [];
        localStorage.setItem(`regiobiz_sales_history_${tenantId}`, JSON.stringify(initialData));
        setSales(initialData);
      }
    };

    loadHistory();
  }, [user]);

  // Borrar todo el historial de ventas de esta empresa
  const handleClearSalesHistory = () => {
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

    // Borrar de Supabase
    if (isSupabaseConfigured()) {
      supabase!.from("sales_history").delete().eq("tenant_id", tenantId)
        .then(({ error }) => {
          if (error) console.error("Error borrando historial de Supabase:", error);
        });
    }

    setSales([]);
    localStorage.removeItem(`regiobiz_sales_history_${tenantId}`);
    alert("¡Espectacular! Todo el historial de ventas de tu empresa ha sido borrado permanentemente de la nube y localmente.");
  };

  // Parser de fecha seguro para evitar RangeError: Invalid time value
  const parseSafeDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    try {
      // Manejar formato "DD/MM/YYYY, HH:MM:MM" o "M/D/YYYY"
      const dateOnly = dateStr.split(",")[0].trim();
      const parts = dateOnly.split("/");
      if (parts.length === 3) {
        // Asumir DD/MM/YYYY
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        
        // Si el año es de 2 dígitos, convertir a 4
        if (year < 100) year += 2000;
        
        // Intercambiar si el mes parece ser mayor que 12
        if (month > 11) {
          const temp = day;
          day = month + 1;
          month = temp - 1;
        }
        
        const fallback = new Date(year, month, day);
        if (!isNaN(fallback.getTime())) {
          return fallback;
        }
      }
    } catch (err) {
      console.error("Error al parsear fecha local:", err);
    }
    return new Date();
  };

  // Aplicar filtros dinámicos
  useEffect(() => {
    let result = [...sales];

    // 1. Filtrar por fecha / período
    if (filterType === "day") {
      result = result.filter(sale => {
        const saleDateObj = parseSafeDate(sale.date);
        const saleDateStr = saleDateObj.toISOString().split("T")[0];
        return saleDateStr === selectedDate;
      });
    } else if (filterType === "week") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter(sale => parseSafeDate(sale.date) >= sevenDaysAgo);
    } else if (filterType === "month") {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      result = result.filter(sale => {
        const saleDate = parseSafeDate(sale.date);
        return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
      });
    }

    // 2. Filtrar por búsqueda query (ID o Cliente)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(sale => 
        sale.id.toLowerCase().includes(q) || 
        sale.client.toLowerCase().includes(q) ||
        sale.items.some(it => it.name.toLowerCase().includes(q))
      );
    }

    setFilteredSales(result);
  }, [sales, filterType, selectedDate, searchQuery]);

  // Recargar datos manual
  const handleReload = () => {
    const tenantId = user?.tenantId || "default";
    const saved = localStorage.getItem(`regiobiz_sales_history_${tenantId}`);
    if (saved) {
      setSales(JSON.parse(saved));
    }
  };

  // Calcular métricas del período filtrado
  const totalUsdPeriod = filteredSales.reduce((sum, s) => sum + s.totalUsd, 0);
  const totalBsPeriod = filteredSales.reduce((sum, s) => sum + s.totalBs, 0);
  const transactionsCount = filteredSales.length;

  const totalCashUsdCollected = filteredSales.reduce((sum, s) => sum + s.payments.cashUsd, 0);
  const totalZelleCollected = filteredSales.reduce((sum, s) => sum + s.payments.zelle, 0);
  const totalPosBsCollected = filteredSales.reduce((sum, s) => sum + s.payments.posBs, 0);
  const totalPagoMovilCollected = filteredSales.reduce((sum, s) => sum + s.payments.pagoMovil, 0);
  const totalCashBsCollected = filteredSales.reduce((sum, s) => sum + s.payments.cashBs, 0);

  // Formatear método de pago legible
  const getPaymentSummary = (payments: SaleRecord["payments"]) => {
    const active = [];
    if (payments.cashUsd > 0) active.push(`Efectivo $ (${payments.cashUsd.toFixed(2)})`);
    if (payments.zelle > 0) active.push(`Zelle (${payments.zelle.toFixed(2)})`);
    if (payments.posBs > 0) active.push(`Punto Bs. (${payments.posBs.toFixed(2)})`);
    if (payments.pagoMovil > 0) active.push(`Pago Móvil (${payments.pagoMovil.toFixed(2)})`);
    if (payments.cashBs > 0) active.push(`Efectivo Bs. (${payments.cashBs.toFixed(2)})`);
    return active.length > 0 ? active.join(" + ") : "Por definir";
  };

  // Generador de reporte PDF
  const handleGeneratePDFReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const todayStr = new Date().toLocaleDateString("es-VE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const periodStr = filterType === "day" 
      ? `DÍA: ${new Date(selectedDate + "T00:00:00").toLocaleDateString("es-VE")}`
      : filterType === "week"
      ? "ÚLTIMOS 7 DÍAS (SEMANA)"
      : "MES EN CURSO";

    const rowsHtml = filteredSales.map((sale, idx) => {
      const dateObj = parseSafeDate(sale.date);
      const timeStr = dateObj.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
      const dateStr = dateObj.toLocaleDateString("es-VE");
      const paymentSummaryStr = getPaymentSummary(sale.payments);

      // Listar productos
      const itemsList = sale.items.map(it => `${it.qty}x ${it.name}`).join(", ");

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-family: monospace; font-weight: bold; font-size: 11px;">${sale.id}</td>
          <td style="padding: 10px; font-size: 11px;">${dateStr} <br><span style="color: #64748b; font-size: 9px;">${timeStr}</span></td>
          <td style="padding: 10px; font-size: 11px;">${sale.client}</td>
          <td style="padding: 10px; font-size: 10.5px; color: #475569; max-width: 250px;">${itemsList}</td>
          <td style="padding: 10px; font-size: 11px; font-weight: 500;">${paymentSummaryStr}</td>
          <td style="padding: 10px; text-align: right; font-family: monospace; font-weight: bold; font-size: 11px; color: #0f766e;">$${sale.totalUsd.toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Ventas RegioBIZ</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 40px;
            background-color: #ffffff;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .logo-box {
            font-size: 24px;
            font-weight: 900;
            color: #10b981;
            letter-spacing: -0.5px;
          }
          .logo-sub {
            font-size: 10px;
            color: #64748b;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 2px;
          }
          .title-box {
            text-align: right;
          }
          .title-box h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
          }
          .title-box p {
            margin: 4px 0 0 0;
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
          }
          .metadata-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 30px;
            font-size: 12px;
          }
          .metadata-grid {
            display: flex;
            justify-content: space-between;
            gap: 20px;
          }
          .metadata-item span {
            display: block;
            font-size: 9px;
            color: #94a3b8;
            text-transform: uppercase;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .metadata-item strong {
            font-size: 12px;
            color: #334155;
          }
          .sales-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .sales-table th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 12px 10px;
            text-align: left;
            border-bottom: 2px solid #e2e8f0;
          }
          .summary-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 40px;
            margin-top: 20px;
            page-break-inside: avoid;
          }
          .treasury-box {
            flex: 1;
            background-color: #fafafa;
            border: 1px dashed #cbd5e1;
            border-radius: 12px;
            padding: 15px;
          }
          .treasury-box h4 {
            margin: 0 0 10px 0;
            font-size: 11px;
            font-weight: bold;
            color: #475569;
            text-transform: uppercase;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          .treasury-item {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 5px;
            font-family: monospace;
          }
          .totals-box {
            width: 280px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
          }
          .totals-item {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 6px;
            font-weight: 500;
          }
          .totals-item.grand {
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
            margin-top: 8px;
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
          }
          .footer-note {
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            margin-top: 50px;
            border-top: 1px solid #f1f5f9;
            padding-top: 15px;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <!-- ENCABEZADO -->
        <table class="header-table">
          <tr>
            <td>
              <div class="logo-box">RegioBiz</div>
              <div class="logo-sub">Sistema de Control de Ventas</div>
            </td>
            <td class="title-box">
              <h1>Reporte de Ingresos y Facturación</h1>
              <p>Generado: ${todayStr}</p>
            </td>
          </tr>
        </table>

        <!-- METADATOS DEL REPORTE -->
        <div class="metadata-card">
          <div class="metadata-grid">
            <div class="metadata-item">
              <span>Período Filtrado</span>
              <strong>${periodStr}</strong>
            </div>
            <div class="metadata-item">
              <span>Transacciones</span>
              <strong>${transactionsCount} Ventas Procesadas</strong>
            </div>
            <div class="metadata-item">
              <span>Tasa de Cambio del Reporte</span>
              <strong>1 $ = ${exchangeRate.toFixed(2)} Bs.</strong>
            </div>
          </div>
        </div>

        <!-- DETALLE DE VENTAS -->
        <table class="sales-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Fecha y Hora</th>
              <th>Cliente</th>
              <th>Productos Vendidos</th>
              <th>Método de Pago Conciliado</th>
              <th style="text-align: right;">Total (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">No se encontraron registros de ventas para el período seleccionado.</td></tr>'}
          </tbody>
        </table>

        <!-- TOTALES Y CONCILIACIÓN BANCARIA -->
        <div class="summary-container">
          <!-- Desglose por Cuenta Contable (Traslado de Fondos) -->
          <div class="treasury-box">
            <h4>Conciliación de Fondos y Arqueo</h4>
            <div class="treasury-item">
              <span>Efectivo Divisas ($) ➡ Caja Fuerte USD (a1):</span>
              <strong>$${totalCashUsdCollected.toFixed(2)}</strong>
            </div>
            <div class="treasury-item">
              <span>Zelle ($) ➡ Zelle / BofA (a2):</span>
              <strong>$${totalZelleCollected.toFixed(2)}</strong>
            </div>
            <div class="treasury-item text-sky-600">
              <span>Punto Bs. (Bs.) ➡ Banesco Corriente (a3):</span>
              <strong>${totalPosBsCollected.toFixed(2)} Bs.</strong>
            </div>
            <div class="treasury-item text-sky-600">
              <span>Pago Móvil (Bs.) ➡ P.Móvil Mercantil (a4):</span>
              <strong>${totalPagoMovilCollected.toFixed(2)} Bs.</strong>
            </div>
            <div class="treasury-item text-sky-600">
              <span>Efectivo Bs. (Bs.) ➡ Caja Chica Bs (a5):</span>
              <strong>${totalCashBsCollected.toFixed(2)} Bs.</strong>
            </div>
          </div>

          <!-- Cuadro de Totales Generales -->
          <div class="totals-box">
            <div class="totals-item">
              <span>Subtotal Acumulado:</span>
              <span>$${(totalUsdPeriod / 1.16).toFixed(2)}</span>
            </div>
            <div class="totals-item">
              <span>Impuesto IVA (16%):</span>
              <span>$${(totalUsdPeriod - (totalUsdPeriod / 1.16)).toFixed(2)}</span>
            </div>
            <div class="totals-item grand">
              <span>TOTAL DÓLARES:</span>
              <span style="color: #0f766e;">$${totalUsdPeriod.toFixed(2)}</span>
            </div>
            <div class="totals-item grand" style="border: none; padding: 0; margin: 2px 0 0 0; font-size: 11px;">
              <span>TOTAL BOLÍVARES:</span>
              <span style="color: #0284c7;">${totalBsPeriod.toFixed(2)} Bs.</span>
            </div>
          </div>
        </div>

        <div class="footer-note">
          DOCUMENTO OFICIAL DE CONTROL FINANCIERO INTERNO - REGIOBIZ ERP CRM
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Control de Ventas & Facturación
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Visualiza los ingresos del día, filtra por calendarios e intervalos, y genera reportes fiscales PDF premium para auditoría.
          </p>
        </div>

        {/* Botones de Acción Superiores */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReload}
            className="p-3 bg-white border border-border text-slate-600 hover:text-primary hover:border-primary rounded-xl transition-all cursor-pointer"
            title="Sincronizar ventas del POS"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleGeneratePDFReport}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all cursor-pointer uppercase tracking-wider"
          >
            <Printer className="w-4 h-4" />
            Generar Reporte PDF
          </button>

          {user?.role === "admin" && (
            <button
              onClick={handleClearSalesHistory}
              className="p-3 bg-red-50 border border-red-200 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title="Borrar Todo el Historial de Ventas"
            >
              <Trash2 className="w-4 h-4 text-red-600 animate-pulse" />
            </button>
          )}
        </div>
      </div>

      {/* SECCIÓN 1: TARJETAS DE MÉTRICAS DEL PERÍODO FILTRADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total USD */}
        <div className="premium-card p-5 bg-white flex flex-col justify-between min-h-[120px] animate-scale-in">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ventas Período ($)</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-black text-usd">${totalUsdPeriod.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Dinero en base imponible + recargos</p>
          </div>
        </div>

        {/* Total Bs */}
        <div className="premium-card p-5 bg-white flex flex-col justify-between min-h-[120px] animate-scale-in">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ventas Período (Bs)</span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-black text-sky-700">{totalBsPeriod.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs.</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Equivalencia a tasa oficial del día</p>
          </div>
        </div>

        {/* Cantidad Transacciones */}
        <div className="premium-card p-5 bg-white flex flex-col justify-between min-h-[120px] animate-scale-in">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transacciones</span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-black text-slate-900">{transactionsCount} Ventas</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Facturas de control y fiscales emitidas</p>
          </div>
        </div>

        {/* Promedio Ticket */}
        <div className="premium-card p-5 bg-white flex flex-col justify-between min-h-[120px] animate-scale-in">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Promedio por Ticket</span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-black text-indigo-700">
              ${transactionsCount > 0 ? (totalUsdPeriod / transactionsCount).toFixed(2) : "0.00"}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Gasto medio por cliente del período</p>
          </div>
        </div>

      </div>

      {/* SECCIÓN 2: CONTROLADORES DE FILTRO Y BÚSQUEDA */}
      <div className="premium-card p-6 bg-white space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Calendar Period Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterType("day")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === "day"
                  ? "bg-primary text-white shadow-md shadow-primary/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Filtrar por Día
            </button>
            
            <button
              onClick={() => setFilterType("week")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === "week"
                  ? "bg-primary text-white shadow-md shadow-primary/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Esta Semana (7D)
            </button>

            <button
              onClick={() => setFilterType("month")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === "month"
                  ? "bg-primary text-white shadow-md shadow-primary/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Mes en Curso
            </button>
          </div>

          {/* Selector de Calendario para "Día" */}
          {filterType === "day" && (
            <div className="flex items-center gap-2 text-xs font-bold animate-in slide-in-from-right-4 duration-200">
              <span className="text-slate-500 uppercase tracking-wider">Fecha Seleccionada:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-white border border-border rounded-xl text-slate-900 text-xs focus:outline-none focus:border-primary font-mono cursor-pointer"
              />
            </div>
          )}

          {/* Buscador Rápido */}
          <div className="relative w-full lg:w-72">
            <input
              type="text"
              placeholder="Buscar por ID, cliente, producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>

        </div>

      </div>

      {/* SECCIÓN 3: REJILLA O TABLA DE VENTAS REGISTRADAS */}
      <div className="premium-card p-6 bg-white space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-border pb-3">
          <Clock className="w-4 h-4 text-primary" />
          Registro Histórico del Período ({filteredSales.length} Ventas Encontradas)
        </h2>

        {filteredSales.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm font-bold text-slate-400">No se encontraron facturas o registros de venta.</p>
            <p className="text-xs text-slate-500">Prueba ajustando los filtros de fecha o escribiendo una palabra clave diferente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 font-extrabold text-slate-600 uppercase text-[9px] tracking-wider">
                  <th className="py-4 px-4 w-28">Factura ID</th>
                  <th className="py-4 px-4 w-32">Fecha y Hora</th>
                  <th className="py-4 px-4">Cliente</th>
                  <th className="py-4 px-4 text-center">Artículos</th>
                  <th className="py-4 px-4 text-right">Monto Total</th>
                  <th className="py-4 px-4 text-center">Medio de Pago Conciliado</th>
                  <th className="py-4 px-4 w-12">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSales.map((sale) => {
                  const isExpanded = expandedSaleId === sale.id;
                  const dateObj = parseSafeDate(sale.date);
                  const formattedDate = dateObj.toLocaleDateString("es-VE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                  });
                  const formattedTime = dateObj.toLocaleTimeString("es-VE", {
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <React.Fragment key={sale.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        {/* ID del Ticket */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-900 text-sm">
                          {sale.id}
                          <span className="block text-[8.5px] text-slate-400 font-mono mt-0.5">{sale.controlNumber}</span>
                        </td>
                        
                        {/* Fecha y Hora */}
                        <td className="py-4 px-4 text-slate-600">
                          <div className="font-semibold">{formattedDate}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{formattedTime}</div>
                        </td>

                        {/* Cliente */}
                        <td className="py-4 px-4 text-slate-950 font-semibold max-w-xs truncate">
                          {sale.client}
                        </td>

                        {/* Cantidad de ítems */}
                        <td className="py-4 px-4 text-center font-bold text-slate-600 text-sm">
                          {sale.itemsCount}
                        </td>

                        {/* Monto Total */}
                        <td className="py-4 px-4 text-right font-mono font-extrabold">
                          <div className="text-usd text-sm">${sale.totalUsd.toFixed(2)}</div>
                          <div className="text-bs text-[10px] mt-0.5">{sale.totalBs.toFixed(2)} Bs.</div>
                        </td>

                        {/* Medios de pago conciliados */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1.5 justify-center max-w-sm mx-auto">
                            {sale.payments.cashUsd > 0 && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-bold">
                                Efec $: +${sale.payments.cashUsd.toFixed(2)}
                              </span>
                            )}
                            {sale.payments.zelle > 0 && (
                              <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-600 border border-teal-100 text-[9px] font-bold">
                                Zelle: +${sale.payments.zelle.toFixed(2)}
                              </span>
                            )}
                            {sale.payments.posBs > 0 && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-bold">
                                Punto: +{sale.payments.posBs.toFixed(2)} Bs.
                              </span>
                            )}
                            {sale.payments.pagoMovil > 0 && (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-bold">
                                P.Móvil: +{sale.payments.pagoMovil.toFixed(2)} Bs.
                              </span>
                            )}
                            {sale.payments.cashBs > 0 && (
                              <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-600 border border-sky-100 text-[9px] font-bold">
                                Efec Bs: +{sale.payments.cashBs.toFixed(2)} Bs.
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Botón Detalles */}
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                            className="p-1 rounded-lg bg-slate-50 border border-border text-slate-500 hover:text-primary hover:border-primary transition-all cursor-pointer"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180 text-primary" : ""}`} />
                          </button>
                        </td>
                      </tr>

                      {/* DETALLE EXPANDIDO DE LA VENTA */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="p-4 border-t border-b border-dashed border-slate-200">
                            <div className="space-y-4 max-w-3xl animate-in slide-in-from-top-2 duration-200">
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-primary" />
                                Desglose de Productos Facturados en {sale.id}
                              </h4>
                              
                              <div className="border border-border rounded-xl bg-white overflow-hidden">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-border">
                                      <th className="py-2.5 px-3">Producto</th>
                                      <th className="py-2.5 px-3 text-center w-24">Cantidad</th>
                                      <th className="py-2.5 px-3 text-right w-32">Precio Unitario</th>
                                      <th className="py-2.5 px-3 text-right w-32">Monto Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-medium">
                                    {sale.items.map((it, itemIdx) => (
                                      <tr key={itemIdx} className="hover:bg-slate-50/30">
                                        <td className="py-2.5 px-3 text-slate-900 font-bold">{it.name}</td>
                                        <td className="py-2.5 px-3 text-center text-slate-600 font-bold">{it.qty}</td>
                                        <td className="py-2.5 px-3 text-right font-mono">${it.price.toFixed(2)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">${(it.qty * it.price).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

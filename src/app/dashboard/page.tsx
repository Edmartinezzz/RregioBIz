"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/lib/context/AppContext";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import jsQR from "jsqr";
import { 
  TrendingUp, 
  DollarSign, 
  Activity, 
  ShoppingBag, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight,
  RefreshCw,
  Plus,
  QrCode,
  Camera,
  X,
  Undo,
  Printer
} from "lucide-react";
import Link from "next/link";


export default function DashboardPage() {
  const router = useRouter();
  const { user, exchangeRate, remoteRequests, hasPermission, requestRemotePermission } = useApp();

  // Estados del Escáner QR de Dashboard
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedTicket, setScannedTicket] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const [refundStatus, setRefundStatus] = useState("");
  const [refundProcessing, setRefundProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Detener cámara y escaneo
  const stopQRScanner = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowQRScanner(false);
  }, []);

  // Iniciar cámara y escaneo QR
  const startQRScanner = () => {
    setScanError("");
    setScannedTicket(null);
    setRefundStatus("");
    setShowQRScanner(true);
  };

  // Loop de escaneo continuo
  const tick = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          try {
            const parsed = JSON.parse(code.data);
            if (parsed && parsed.id) {
              setScannedTicket(parsed);
              stopQRScanner();
              return;
            }
          } catch (e) {
            setScanError("El código QR escaneado no es un formato válido de factura RegioBiz.");
          }
        }
      }
    }
    scanLoopRef.current = requestAnimationFrame(tick);
  }, [stopQRScanner]);

  // Manejar el ciclo de vida del stream de la cámara basándose en showQRScanner
  useEffect(() => {
    if (showQRScanner) {
      let activeStream: MediaStream | null = null;
      
      const initCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
          });
          activeStream = stream;
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Configurar atributos nativos de compatibilidad móvil
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play().catch(err => console.error("Error al iniciar reproducción de video:", err));
            
            // Esperar un breve momento a que el video cargue datos
            setTimeout(() => {
              scanLoopRef.current = requestAnimationFrame(tick);
            }, 300);
          }
        } catch (err) {
          console.error("Error al arrancar cámara en Dashboard:", err);
          setScanError("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
        }
      };

      initCamera();

      return () => {
        if (scanLoopRef.current) {
          cancelAnimationFrame(scanLoopRef.current);
          scanLoopRef.current = null;
        }
        if (activeStream) {
          activeStream.getTracks().forEach(track => track.stop());
        }
        streamRef.current = null;
      };
    }
  }, [showQRScanner, tick]);

  // Gestionar devolución remota directo del Dashboard
  const handleRequestDashboardRefund = async () => {
    if (!scannedTicket) return;

    setRefundProcessing(true);
    setRefundStatus("Solicitando autorización de devolución a la Directora...");

    const refundDetails = `Devolución de Ticket #${scannedTicket.id} por $${scannedTicket.usd.toFixed(2)} / ${scannedTicket.bs.toFixed(2)} Bs. (${scannedTicket.itm.length} items)`;

    // Solicitar permiso remoto
    const approved = await requestRemotePermission("devolucion", refundDetails);

    setRefundProcessing(false);
    if (approved) {
      setRefundStatus("¡Devolución Autorizada con éxito! Caja e inventario ajustados.");
      
      // Limpiar ticket
      setTimeout(() => {
        setScannedTicket(null);
        setRefundStatus("");
      }, 4000);
    } else {
      setRefundStatus("Solicitud de Devolución rechazada por la Directora.");
    }
  };

  // Limpiar el escáner al desmontar
  useEffect(() => {
    return () => {
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);
  
  // Estados para cálculos en tiempo real
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; price: number }[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<{ name: string; code: string; stock: number }[]>([]);
  const [paymentMethodsStats, setPaymentMethodsStats] = useState<{ method: string; count: number; totalUsd: number }[]>([]);
  const [salesTodayUsd, setSalesTodayUsd] = useState(0);
  const [salesGrowth, setSalesGrowth] = useState("0.0% vs ayer");
  const [activeStockValueUsd, setActiveStockValueUsd] = useState(0);
  const [totalProductsCount, setTotalProductsCount] = useState(0);

  // Recalcular métricas a partir del historial y el inventario real
  useEffect(() => {
    const tenantId = user?.tenantId || "default";

    const fetchSalesAndCalculate = async () => {
      let history: any[] = [];
      
      // 1. Cargar historial de ventas desde Supabase primero
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase!
            .from("sales_history")
            .select("*")
            .eq("tenant_id", tenantId);
            
          if (!error && data) {
            history = data.map((row: any) => ({
              id: row.id,
              date: row.date || row.created_at,
              created_at: row.created_at,
              totalUsd: parseFloat(row.total_usd) || 0,
              totalBs: parseFloat(row.total_bs) || 0,
              pay_cash_usd: parseFloat(row.pay_cash_usd) || 0,
              pay_zelle: parseFloat(row.pay_zelle) || 0,
              pay_pos_bs: parseFloat(row.pay_pos_bs) || 0,
              pay_pago_movil: parseFloat(row.pay_pago_movil) || 0,
              pay_cash_bs: parseFloat(row.pay_cash_bs) || 0,
              items: row.items,
              payments: { 
                cashUsd: parseFloat(row.pay_cash_usd) || 0,
                zelle: parseFloat(row.pay_zelle) || 0,
                posBs: parseFloat(row.pay_pos_bs) || 0,
                pagoMovil: parseFloat(row.pay_pago_movil) || 0,
                cashBs: parseFloat(row.pay_cash_bs) || 0,
              }
            }));
            // Update local cache
            localStorage.setItem(`regiobiz_sales_history_${tenantId}`, JSON.stringify(history));
          }
        } catch (err) {
          console.error("Error fetching sales history for dashboard:", err);
        }
      }
      
      // Fallback a localStorage si Supabase falla o está vacío y hay caché
      if (history.length === 0) {
        const savedHistory = localStorage.getItem(`regiobiz_sales_history_${tenantId}`);
        history = savedHistory ? JSON.parse(savedHistory) : [];
      }
    
    // Calcular ventas totales de HOY y AYER para el crecimiento
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

    const todaySales = history.filter((rec: any) => {
      const d = (rec.created_at || rec.date || "");
      return d.slice(0, 10) === todayStr;
    });
    const yesterdaySales = history.filter((rec: any) => {
      const d = (rec.created_at || rec.date || "");
      return d.slice(0, 10) === yesterdayStr;
    });

    const totalSalesToday = todaySales.reduce((sum: number, rec: any) => sum + Number(rec.totalUsd || 0), 0);
    const totalSalesYesterday = yesterdaySales.reduce((sum: number, rec: any) => sum + Number(rec.totalUsd || 0), 0);

    setSalesTodayUsd(totalSalesToday || 0);

    let growthStr = "0.0% vs ayer";
    if (totalSalesYesterday > 0) {
      const growthValue = ((totalSalesToday - totalSalesYesterday) / totalSalesYesterday) * 100;
      growthStr = `${growthValue > 0 ? "+" : ""}${growthValue.toFixed(1)}% vs ayer`;
    } else if (totalSalesToday > 0) {
      growthStr = "+100% vs ayer";
    }
    setSalesGrowth(growthStr);

    // Calcular productos más vendidos
    const productSalesMap: Record<string, { qty: number; price: number }> = {};
    history.forEach((rec: any) => {
      if (rec.items && Array.isArray(rec.items)) {
        rec.items.forEach((it: any) => {
          const name = it.name || "Producto sin nombre";
          if (!productSalesMap[name]) {
            productSalesMap[name] = { qty: 0, price: it.price || 0 };
          }
          productSalesMap[name].qty += Number(it.qty || 0);
        });
      }
    });
    const sortedProducts = Object.entries(productSalesMap)
      .map(([name, data]) => ({ name, qty: data.qty, price: data.price }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    setTopProducts(sortedProducts);

    // Calcular métodos de pago más utilizados
    const paymentMap: Record<string, { count: number; totalUsd: number }> = {
      "Efectivo USD (💵)": { count: 0, totalUsd: 0 },
      "Zelle Transfer (💜)": { count: 0, totalUsd: 0 },
      "Pago Móvil (📱)": { count: 0, totalUsd: 0 },
      "Punto de Venta (💳)": { count: 0, totalUsd: 0 },
      "Efectivo Bolívares (🪙)": { count: 0, totalUsd: 0 }
    };
    
    history.forEach((rec: any) => {
      const pm = rec.payments || {};
      if (pm.cashUsd > 0) {
        paymentMap["Efectivo USD (💵)"].count += 1;
        paymentMap["Efectivo USD (💵)"].totalUsd += pm.cashUsd;
      }
      if (pm.zelle > 0) {
        paymentMap["Zelle Transfer (💜)"].count += 1;
        paymentMap["Zelle Transfer (💜)"].totalUsd += pm.zelle;
      }
      if (pm.pagoMovil > 0) {
        paymentMap["Pago Móvil (📱)"].count += 1;
        paymentMap["Pago Móvil (📱)"].totalUsd += pm.pagoMovil / exchangeRate;
      }
      if (pm.posBs > 0) {
        paymentMap["Punto de Venta (💳)"].count += 1;
        paymentMap["Punto de Venta (💳)"].totalUsd += pm.posBs / exchangeRate;
      }
      if (pm.cashBs > 0) {
        paymentMap["Efectivo Bolívares (🪙)"].count += 1;
        paymentMap["Efectivo Bolívares (🪙)"].totalUsd += pm.cashBs / exchangeRate;
      }
    });

    const pmStats = Object.entries(paymentMap)
      .map(([method, data]) => ({ method, count: data.count, totalUsd: data.totalUsd }))
      .sort((a, b) => b.totalUsd - a.totalUsd);
    setPaymentMethodsStats(pmStats);

    // 2. Cargar inventario
    let products: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase!
          .from("products")
          .select("*")
          .eq("tenant_id", tenantId);
        if (data && !error) {
          products = data.map((p: any) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            category: p.category ? (p.category.charAt(0).toUpperCase() + p.category.slice(1)) : "General",
            costUsd: Number(p.cost_usd || 0),
            priceUsd: Number(p.price_usd || 0),
            stock: Number(p.stock || 0),
            taxCategory: p.tax_category || "exempt"
          }));
          // Guardar en caché local
          localStorage.setItem(`regiobiz_products_${tenantId}`, JSON.stringify(products));
        }
      } catch (err) {
        console.error("Error al cargar productos para el dashboard desde Supabase:", err);
      }
    }

    if (products.length === 0) {
      const savedProducts = localStorage.getItem(`regiobiz_products_${tenantId}`);
      products = savedProducts ? JSON.parse(savedProducts) : [];
    }
    
    setTotalProductsCount(products.length);
    
    // Calcular valor total del stock
    const stockValue = products.reduce((sum: number, prod: any) => sum + ((prod.stock || 0) * (prod.priceUsd || 0)), 0);
    setActiveStockValueUsd(stockValue);

    // Calcular productos con bajo stock (< 5)
    const lowStock = products
      .filter((p: any) => p.stock > 0 && p.stock <= 5)
      .map((p: any) => ({ name: p.name, code: p.code, stock: p.stock }))
      .sort((a: any, b: any) => a.stock - b.stock)
      .slice(0, 5);
    setLowStockProducts(lowStock);
    };

    fetchSalesAndCalculate();
  }, [user]);
  

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Banner de Bienvenida Premium */}
      <div className="relative p-8 rounded-3xl overflow-hidden bg-gradient-to-r from-primary/10 via-indigo-600/5 to-transparent border border-primary/20">
        <div className="absolute top-[-20%] right-[-10%] w-[30vw] h-[30vw] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              ¡Hola de nuevo, {user?.name}!
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              Bienvenido a tu centro de control en RegioBiz. Todos los indicadores de ventas, inventarios y finanzas se recalculan en tiempo real usando la tasa BCV del día.
            </p>
          </div>
          
          <div className="flex gap-3">
            {hasPermission("ventas", "crear") && (
              <Link
                href="/dashboard/ventas"
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all group cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nueva Venta (POS)
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
            
            <button
              onClick={startQRScanner}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-extrabold rounded-xl shadow-sm hover:shadow-md transition-all group cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-slate-500 group-hover:scale-110 transition-transform" />
              Escanear Factura QR
            </button>
          </div>
        </div>
      </div>

      {/* REJILLA DE MÉTRICAS BIMONETARIAS EN TIEMPO REAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Ventas del Día */}
        <div className="premium-card premium-card-hover p-6 relative overflow-hidden group">
          <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ventas Totales Hoy</span>
          <div className="mt-4 space-y-1">
            {/* USD destacado */}
            <h3 className="text-2xl font-extrabold text-usd flex items-baseline gap-1 animate-pulse-slow">
              <span className="text-sm opacity-85">$</span>
              {salesTodayUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            {/* Bs. equivalente automático en tiempo real */}
            <p className="text-sm font-bold text-bs flex items-baseline gap-1">
              <span className="text-[10px] opacity-75">Bs.</span>
              {(salesTodayUsd * exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Tasa BCV: {exchangeRate.toFixed(2)}</span>
            <span className={`flex items-center gap-0.5 font-bold ${salesGrowth.startsWith("+") ? "text-emerald-500" : salesGrowth.startsWith("-") ? "text-red-500" : "text-slate-500"}`}>
              {salesGrowth}
            </span>
          </div>
        </div>

        {/* Valor de Inventario */}
        <div className="premium-card premium-card-hover p-6 relative overflow-hidden group">
          <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-usd/10 border border-usd/20 flex items-center justify-center text-usd group-hover:rotate-12 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Valor del Inventario</span>
          <div className="mt-4 space-y-1">
            <h3 className="text-2xl font-extrabold text-slate-900 flex items-baseline gap-1">
              <span className="text-sm opacity-75">$</span>
              {activeStockValueUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-sm font-bold text-slate-400 flex items-baseline gap-1">
              <span className="text-[10px] opacity-75">Bs.</span>
              {(activeStockValueUsd * exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>{totalProductsCount} productos activos</span>
            <span className="text-emerald-500 font-bold">Stock OK</span>
          </div>
        </div>

        {/* Tasa del Día BCV */}
        <div className="premium-card premium-card-hover p-6 relative overflow-hidden group bg-white">
          <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-bs/10 border border-bs/20 flex items-center justify-center text-bs group-hover:rotate-12 transition-transform">
            <Activity className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tasa Centralizada del Día</span>
          <div className="mt-4 space-y-1">
            <h3 className="text-2xl font-extrabold text-bs font-mono">
              {exchangeRate.toFixed(2)}
              <span className="text-xs font-semibold text-slate-400 ml-1">Bs / $</span>
            </h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Sugerida por Banco Central de Venezuela
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Actualizado: Hoy</span>
            <span className="text-slate-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin-slow" /> Real-time
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE ANALÍTICAS EN TIEMPO REAL: PRODUCTOS Y MÉTODOS DE PAGO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* WIDGET 1: PRODUCTOS MÁS VENDIDOS */}
        <div className="premium-card p-6 space-y-4">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Productos Más Vendidos
            </h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-wider">
              Top 5
            </span>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-2 border border-dashed border-border rounded-2xl bg-slate-50/50">
                <ShoppingBag className="w-8 h-8 text-slate-300" />
                <p className="text-xs text-slate-400 font-bold">Aún no hay ventas registradas.</p>
              </div>
            ) : (
              topProducts.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-950 block leading-tight">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">${p.price.toFixed(2)} c/u</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 font-extrabold text-emerald-700 text-[10px]">
                    {p.qty} u. sold
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* WIDGET 2: BAJO STOCK EN EL INVENTARIO */}
        <div className="premium-card p-6 space-y-4">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
              Bajo Stock / Reabastecer
            </h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 uppercase tracking-wider">
              Crítico (≤5)
            </span>
          </div>

          <div className="space-y-3">
            {lowStockProducts.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50/30 border border-dashed border-emerald-200 rounded-2xl space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Inventario Saludable</p>
                <p className="text-[9px] text-emerald-600 leading-normal">Todos tus productos registrados tienen un nivel de stock por encima de 5 unidades.</p>
              </div>
            ) : (
              lowStockProducts.slice(0, 5).map((p, idx) => (
                <div key={idx} className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-950 block truncate max-w-[150px]">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wider uppercase ${
                      p.stock === 0 
                        ? "bg-red-100 text-red-800 border border-red-200" 
                        : p.stock <= 2
                        ? "bg-red-50 text-red-700 border border-red-150 animate-pulse"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {p.stock === 0 ? "Agotado" : `${p.stock} Unidades`}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        p.stock === 0 ? "w-0" : p.stock <= 2 ? "bg-red-500 w-[20%]" : "bg-amber-500 w-[60%]"
                      }`} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* WIDGET 3: MÉTODO DE PAGO MÁS UTILIZADO */}
        <div className="premium-card p-6 space-y-4">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
              Canales de Pago Dominantes
            </h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 uppercase tracking-wider font-mono">
              USD / VES
            </span>
          </div>

          <div className="space-y-3">
            {paymentMethodsStats.length === 0 || paymentMethodsStats.every(s => s.totalUsd === 0) ? (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-2 border border-dashed border-border rounded-2xl bg-slate-50/50">
                <DollarSign className="w-8 h-8 text-slate-300" />
                <p className="text-[10px] text-slate-400 font-bold">Sin datos de canales de pago registrados.</p>
              </div>
            ) : (
              paymentMethodsStats.slice(0, 3).map((p, idx) => {
                const maxUsd = Math.max(...paymentMethodsStats.map(s => s.totalUsd)) || 1;
                const percentage = (p.totalUsd / maxUsd) * 100;
                return (
                  <div key={idx} className="space-y-1 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-950 block truncate max-w-[130px]">{p.method}</span>
                      <span className="font-bold text-slate-500 font-mono text-[10px]">
                        ${p.totalUsd.toFixed(2)} ({p.count} trans)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>


      {/* DETALLES DE LA FACTURA ESCANEADA POR QR */}
      {scannedTicket && !showQRScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col p-6 text-slate-900 font-mono text-xs">
            
            {/* Header Factura Escaneada */}
            <div className="w-full flex justify-between items-center pb-4 border-b border-dashed border-slate-300">
              <div>
                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                  ✓ Código QR Válido
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 mt-2">
                  FACTURA {scannedTicket.id}
                </h3>
              </div>
              <button 
                onClick={() => setScannedTicket(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer animate-in duration-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Datos Generales de la Venta */}
            <div className="py-4 space-y-2 border-b border-dashed border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Control:</span>
                <span className="text-slate-800 font-bold select-all">{scannedTicket.ctrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Fecha:</span>
                <span className="text-slate-600">{scannedTicket.dt}</span>
              </div>
              {scannedTicket.cli && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Cliente:</span>
                    <span className="text-slate-800 font-bold">{scannedTicket.cli.n}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Documento:</span>
                    <span className="text-slate-600 font-mono">{scannedTicket.cli.d}</span>
                  </div>
                </>
              )}
            </div>

            {/* Listado de Artículos */}
            <div className="py-4 border-b border-dashed border-slate-200 max-h-48 overflow-y-auto">
              <p className="font-extrabold text-slate-400 text-[10px] pb-2 uppercase">Artículos Comprados:</p>
              <div className="space-y-2">
                {scannedTicket.itm && scannedTicket.itm.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-slate-900">{item.n}</p>
                      <p className="text-[8.5px] text-slate-400 font-mono">Código: {item.c} | Cant.: {item.q}</p>
                    </div>
                    <span className="font-bold text-slate-700">${(item.p * item.q).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales Bimonetarios */}
            <div className="py-4 space-y-1.5 border-b border-dashed border-slate-200 bg-slate-50/50 -mx-6 px-6 my-2">
              <div className="flex justify-between font-extrabold text-xs text-slate-900">
                <span>TOTAL EN DIVISAS:</span>
                <span className="text-usd">${scannedTicket.usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-xs text-indigo-700">
                <span>TOTAL EN BOLÍVARES:</span>
                <span className="text-bs">{scannedTicket.bs.toFixed(2)} Bs.</span>
              </div>
            </div>

            {/* Estado del Reembolso / Estatus */}
            {refundStatus && (
              <div className="my-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 font-medium text-center animate-pulse">
                {refundStatus}
              </div>
            )}

            {/* Acciones del Ticket Escaneado */}
            <div className="mt-4 flex flex-col gap-2.5">
              {hasPermission("ventas", "editar") ? (
                <button
                  onClick={handleRequestDashboardRefund}
                  disabled={refundProcessing}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                >
                  <Undo className="w-4 h-4" />
                  {refundProcessing ? "Procesando Devolución..." : "Solicitar Devolución Directa"}
                </button>
              ) : (
                <div className="p-3 bg-slate-100 rounded-xl text-[10px] text-slate-500 text-center font-medium">
                  🔒 Tu rol actual no posee permisos para autorizar devoluciones desde el Dashboard.
                </div>
              )}

              <button
                onClick={() => setScannedTicket(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center uppercase"
              >
                Cerrar Consulta
              </button>
            </div>

          </div>
        </div>
      )}

      {/* VENTANA MODAL PARA ESCÁNER QR DE CÁMARA (WEBCAM) */}
      {showQRScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col items-center p-6 text-white text-center">
            
            {/* Inyección de estilos de animación para el láser del escáner */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes scannerLaser {
                0% { top: 10%; }
                50% { top: 90%; }
                100% { top: 10%; }
              }
              .animate-scanner-laser {
                animation: scannerLaser 3s infinite linear;
              }
            `}} />

            {/* Cabecera del Escáner */}
            <div className="w-full flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Lector de Facturas QR
                </h3>
              </div>
              <button 
                onClick={stopQRScanner}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subtítulo */}
            <p className="text-xs text-slate-400 mb-6">
              Apunta con la cámara de tu dispositivo al código QR de la factura impresa para verificar la transacción y gestionar su devolución.
            </p>

            {/* Video Viewport */}
            <div className="relative w-full aspect-square max-w-[280px] bg-black rounded-2xl overflow-hidden border-2 border-primary/40 shadow-inner group">
              <video 
                ref={videoRef} 
                playsInline
                muted
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Esquinas de Mira (Target corners) */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" />

              {/* Animación de línea de escaneo láser */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent top-1/2 animate-scanner-laser shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
            </div>

            {/* Canvas oculto para procesar jsqr */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Mensajes de Error */}
            {scanError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                {scanError}
              </div>
            )}

            {/* Estado o Instrucción */}
            <div className="mt-6 flex justify-center w-full gap-3">
              <button
                onClick={stopQRScanner}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer w-full"
              >
                Cancelar y Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

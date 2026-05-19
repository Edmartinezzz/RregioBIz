"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { useApp } from "@/lib/context/AppContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  CreditCard, 
  Printer, 
  AlertTriangle, 
  Plus, 
  Minus, 
  CheckCircle, 
  User, 
  FileText, 
  DollarSign, 
  Coins, 
  Undo,
  Smartphone,
  Eye,
  QrCode,
  Camera,
  X,
  ShieldCheck,
  ShieldX,
  Package,
  ChevronRight
} from "lucide-react";

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  priceUsd: number;
  taxCategory: "exempt" | "iva_16";
  stock: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function POSPage() {
  const { user, exchangeRate, requestRemotePermission, hasPermission } = useApp();
  
  // Catálogo y Carrito
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [tempPriceUsd, setTempPriceUsd] = useState("");
  const [showQuickPayModal, setShowQuickPayModal] = useState(false);

  // Cargar catálogo de productos dinámicamente de Supabase o LocalStorage
  useEffect(() => {
    if (isSupabaseConfigured()) {
      if (!user) return;
      const fetchSupabaseProductsForPOS = async () => {
        try {
          const { data, error } = await supabase!
            .from("products")
            .select("*");
          if (data && !error) {
            const tenantId = user.tenantId || "default";
            const tenantProducts = data.filter((p: any) => p.code.startsWith(tenantId + "_"));
            const mapped: Product[] = tenantProducts.map((p: any) => ({
              id: `p_${p.code.replace(tenantId + "_", "")}`,
              code: p.code.replace(tenantId + "_", ""),
              name: p.name,
              category: p.category.charAt(0).toUpperCase() + p.category.slice(1),
              priceUsd: Number(p.price_usd),
              taxCategory: "exempt",
              stock: Number(p.stock)
            }));
            setCatalog(mapped);
          }
        } catch (err) {
          console.error("Error al cargar inventario para POS de Supabase:", err);
        }
      };
      fetchSupabaseProductsForPOS();
    } else {
      if (user) {
        const tenantId = user.tenantId || "default";
        const saved = localStorage.getItem(`regiobiz_products_${tenantId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const mapped: Product[] = parsed.map((p: any) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              category: p.category,
              priceUsd: p.priceUsd,
              taxCategory: p.taxCategory,
              stock: p.stock
            }));
            setCatalog(mapped);
          } catch (e) {
            setCatalog([]);
          }
        } else {
          setCatalog([]);
        }
      }
    }
  }, [user]);
  
  // Datos del Cliente (Requerimiento Fiscal)
  const [isFiscalMode, setIsFiscalMode] = useState(false);
  const [clientDoc, setClientDoc] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Desglose de Pagos Mixtos
  const [payCashUsd, setPayCashUsd] = useState(0);
  const [payCashBs, setPayCashBs] = useState(0);
  const [payPagoMovil, setPayPagoMovil] = useState(0);
  const [payPosBs, setPayPosBs] = useState(0);
  const [payZelle, setPayZelle] = useState(0);

  // Estados de Transacción e Impresión Fiscal
  const [spoolerStatus, setSpoolerStatus] = useState<"idle" | "connecting" | "printing" | "success" | "failed">("idle");
  const [fiscalSerial, setFiscalSerial] = useState("");
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState<any>(null);
  const [modalQRDataUrl, setModalQRDataUrl] = useState("");
  
  // Estado de Devoluciones (Frozen)
  const [refundTicketId, setRefundTicketId] = useState("");
  const [refundStatus, setRefundStatus] = useState("");
  const [refundProcessing, setRefundProcessing] = useState(false);

  // Estado del Escáner QR Anti-Fraude
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedTicket, setScannedTicket] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Cálculos Básicos
  const [subtotalUsd, setSubtotalUsd] = useState(0);
  const [taxUsd, setTaxUsd] = useState(0);
  const [igtfUsd, setIgtfUsd] = useState(0);
  const [totalUsd, setTotalUsd] = useState(0);
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");

  // Sincronizar cálculos cada vez que cambie el carrito o el desglose de pago en USD en efectivo
  useEffect(() => {
    let sub = 0;
    let t = 0;
    cart.forEach(item => {
      const itemSub = item.product.priceUsd * item.quantity;
      sub += itemSub;
      if (item.product.taxCategory === "iva_16") {
        t += itemSub * 0.16;
      }
    });

    // Calcular IGTF 3% sobre el pago en efectivo USD
    const calculatedIgtf = payCashUsd * 0.03;

    setSubtotalUsd(sub);
    setTaxUsd(t);
    setIgtfUsd(calculatedIgtf);
    setTotalUsd(sub + t + calculatedIgtf);
  }, [cart, payCashUsd]);

  // Autocalcular el saldo pendiente
  const totalBs = totalUsd * exchangeRate;
  const totalPaidUsd = payCashUsd + payZelle + (payCashBs + payPagoMovil + payPosBs) / exchangeRate;
  const remainingUsd = Math.max(0, totalUsd - totalPaidUsd);
  const remainingBs = remainingUsd * exchangeRate;

  // Generar QR para el modal digital en pantalla cuando se crea una venta
  useEffect(() => {
    if (generatedTicket) {
      const qrPayload = JSON.stringify({
        v: 1,
        id: generatedTicket.id,
        ctrl: generatedTicket.controlNumber,
        dt: generatedTicket.date,
        usd: parseFloat(generatedTicket.totalUsd.toFixed(2)),
        bs: parseFloat(generatedTicket.totalBs.toFixed(2)),
        cli: generatedTicket.client ? {
          n: generatedTicket.client.name,
          d: generatedTicket.client.doc || "",
          t: generatedTicket.client.phone || ""
        } : null,
        itm: generatedTicket.items.map((i: any) => ({
          c: i.product.code || i.product.id,
          n: i.product.name,
          q: i.quantity,
          p: parseFloat(i.product.priceUsd.toFixed(2))
        }))
      });

      QRCode.toDataURL(qrPayload, {
        width: 160,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
        errorCorrectionLevel: "M"
      })
      .then(url => setModalQRDataUrl(url))
      .catch(err => console.error("Error al pre-generar QR de modal:", err));
    } else {
      setModalQRDataUrl("");
    }
  }, [generatedTicket]);

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

  // Iniciar cámara y Escáner QR
  const startQRScanner = () => {
    setScanError("");
    setScannedTicket(null);
    setShowQRScanner(true);
  };

  // Proceso continuo de escaneo de fotogramas
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
              setRefundTicketId(parsed.id);
              setRefundStatus(`Factura #${parsed.id} cargada vía QR con éxito.`);
              stopQRScanner();
              return;
            }
          } catch (e) {
            // Respaldar si es código directo o ticket crudo
            if (code.data && code.data.startsWith("TKT-")) {
              setRefundTicketId(code.data);
              setRefundStatus(`ID de Ticket ${code.data} detectado.`);
              stopQRScanner();
              return;
            }
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
          console.error("Error al arrancar cámara en POS:", err);
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

  // Filtrar productos
  const filteredProducts = catalog.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.includes(searchTerm)
  );

  // Agregar al carrito (Permite venta flexible con stock cero)
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  // Quitar / Restar (Permite venta flexible con stock cero)
  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  // Autocompletar la diferencia en Bolívares
  const handleAutoFillRemainingBs = (method: "cash_bs" | "pago_movil" | "pos") => {
    if (remainingBs <= 0) return;
    if (method === "cash_bs") setPayCashBs(parseFloat(remainingBs.toFixed(2)));
    if (method === "pago_movil") setPayPagoMovil(parseFloat(remainingBs.toFixed(2)));
    if (method === "pos") setPayPosBs(parseFloat(remainingBs.toFixed(2)));
  };

  // Limpiar POS
  const resetPOS = () => {
    setCart([]);
    setClientDoc("");
    setClientName("");
    setClientAddress("");
    setPayCashUsd(0);
    setPayCashBs(0);
    setPayPagoMovil(0);
    setPayPosBs(0);
    setPayZelle(0);
    setSpoolerStatus("idle");
    setFiscalSerial("");
  };

  // ─── Guardar venta en Supabase + localStorage ────────────────────────────
  const saveSaleToHistory = async (ticket: any) => {
    if (!user) return;
    const tenantId = user.tenantId || "default";

    // Construir el método de pago legible
    const methods: string[] = [];
    if (ticket.payments.cashUsd > 0) methods.push("Efectivo USD");
    if (ticket.payments.zelle > 0) methods.push("Zelle");
    if (ticket.payments.cashBs > 0) methods.push("Efectivo Bolívares");
    if (ticket.payments.pagoMovil > 0) methods.push("Pago Móvil");
    if (ticket.payments.posBs > 0) methods.push("Punto de Venta");
    const paymentMethod = methods.join(" + ") || "Sin especificar";

    const saleRecord = {
      id: ticket.id,
      tenant_id: tenantId,
      control_number: ticket.controlNumber || null,
      date: ticket.date,
      created_at: new Date().toISOString(),
      client_doc: ticket.client?.doc || null,
      client_name: ticket.client?.name || null,
      client_address: ticket.client?.address || null,
      client_phone: ticket.client?.phone || null,
      subtotal_usd: ticket.subtotalUsd,
      tax_usd: ticket.taxUsd,
      igtf_usd: ticket.igtfUsd,
      total_usd: ticket.totalUsd,
      total_bs: ticket.totalBs,
      exchange_rate: exchangeRate,
      pay_cash_usd: ticket.payments.cashUsd,
      pay_zelle: ticket.payments.zelle,
      pay_cash_bs: ticket.payments.cashBs,
      pay_pago_movil: ticket.payments.pagoMovil,
      pay_pos_bs: ticket.payments.posBs,
      payment_method: paymentMethod,
      items: ticket.items.map((i: any) => ({
        code: i.product.code,
        name: i.product.name,
        quantity: i.quantity,
        price_usd: i.product.priceUsd,
        tax_category: i.product.taxCategory,
      })),
      fiscal_serial: ticket.serial || null,
      is_fiscal: !!ticket.serial,
      seller_id: user.id,
      seller_name: user.name,
    };

    // 1. Guardar en Supabase
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase!
          .from("sales_history")
          .insert(saleRecord);
        if (error) console.error("Error guardando venta en Supabase:", error);
      } catch (err) {
        console.error("Error de red al guardar venta:", err);
      }
    }

    // 2. Guardar en localStorage (fuente de datos para modo sandbox + caché)
    const localKey = `regiobiz_sales_history_${tenantId}`;
    const existing = localStorage.getItem(localKey);
    const history = existing ? JSON.parse(existing) : [];
    // Insertar al inicio para que el historial más reciente aparezca primero
    const updated = [saleRecord, ...history].slice(0, 500); // máx 500 entradas
    localStorage.setItem(localKey, JSON.stringify(updated));
  };

  // Procesar Venta / Impresión Fiscal
  const handleProcessSale = async (forceComplete = false) => {
    if (cart.length === 0) return;

    if (!forceComplete && remainingUsd > 0.02) {
      setShowQuickPayModal(true);
      return;
    }
    
    if (isFiscalMode && (!clientDoc || !clientName || !clientAddress)) {
      alert("Para activar la facturación fiscal, debe ingresar Cédula/RIF, Razón Social y Dirección Fiscal.");
      return;
    }
    // Nota: El teléfono es opcional, no bloquea el procesamiento

    setSpoolerStatus("connecting");
    
    // Simular el Spooler de impresión local HTTPS
    setTimeout(() => {
      setSpoolerStatus("printing");
      
      // Simulación de payload JSON enviado a localhost
      const localSpoolerPayload = {
        command: "print_invoice",
        rif: clientDoc || "V-CONSUMIDOR-FINAL",
        name: clientName || "Consumidor Final",
        address: clientAddress || "Caracas, Venezuela",
        phone: clientPhone || "",
        items: cart.map(item => ({
          sku: item.product.code,
          name: item.product.name,
          qty: item.quantity,
          price_usd: item.product.priceUsd,
          taxable: item.product.taxCategory === "iva_16"
        })),
        totals: {
          subtotal_usd: subtotalUsd,
          iva_usd: taxUsd,
          igtf_usd: igtfUsd,
          total_usd: totalUsd,
          total_bs: totalBs,
          tasa_exchange: exchangeRate
        },
        payments: [
          { method: "cash_usd", val: payCashUsd },
          { method: "cash_bs", val: payCashBs },
          { method: "pago_movil_bs", val: payPagoMovil },
          { method: "pos_bs", val: payPosBs },
          { method: "zelle_usd", val: payZelle }
        ]
      };

      console.log("PAYLOAD TRANSMITIDO AL SPOOLER FISCAL LOCAL (https://localhost:12345/print):", localSpoolerPayload);

      setTimeout(() => {
        const serial = `TF${Math.floor(10000000 + Math.random() * 90000000)}`;
        setFiscalSerial(serial);
        setSpoolerStatus("success");
        
        // Registrar ticket generado para la vista de impresión y persistir
        const newTicket = {
          id: `TKT-${Math.floor(10000 + Math.random() * 90000)}`,
          controlNumber: `CTRL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(10000 + Math.random() * 90000)}`,
          date: new Date().toLocaleString(),
          client: (clientDoc || clientName) 
            ? { doc: clientDoc, name: clientName, address: clientAddress, phone: clientPhone } 
            : null,
          items: [...cart],
          subtotalUsd,
          taxUsd,
          igtfUsd,
          totalUsd,
          totalBs,
          serial: isFiscalMode ? serial : null,
          payments: {
            cashUsd: payCashUsd,
            cashBs: payCashBs,
            pagoMovil: payPagoMovil,
            posBs: payPosBs,
            zelle: payZelle
          }
        };
        setGeneratedTicket(newTicket);
        saveSaleToHistory(newTicket); // ← persistir en Supabase + localStorage
        setShowTicketModal(true);
      }, 1500);
    }, 1200);
  };

  // Completar pago pendiente rápidamente y facturar
  const handleQuickPayAndProcess = (method: "cash_usd" | "zelle" | "cash_bs" | "pago_movil" | "pos") => {
    let finalCashUsd = payCashUsd;
    let finalZelle = payZelle;
    let finalCashBs = payCashBs;
    let finalPagoMovil = payPagoMovil;
    let finalPosBs = payPosBs;
    let finalIgtf = igtfUsd;

    if (method === "cash_usd") {
      finalCashUsd += remainingUsd;
      finalIgtf = finalCashUsd * 0.03;
      setPayCashUsd(finalCashUsd);
    } else if (method === "zelle") {
      finalZelle += remainingUsd;
      setPayZelle(finalZelle);
    } else if (method === "cash_bs") {
      finalCashBs += remainingBs;
      setPayCashBs(finalCashBs);
    } else if (method === "pago_movil") {
      finalPagoMovil += remainingBs;
      setPayPagoMovil(finalPagoMovil);
    } else if (method === "pos") {
      finalPosBs += remainingBs;
      setPayPosBs(finalPosBs);
    }
    
    setShowQuickPayModal(false);
    
    const calculatedTotalUsd = subtotalUsd + taxUsd + finalIgtf;
    const calculatedTotalBs = calculatedTotalUsd * exchangeRate;
    
    // Ejecutar procesamiento con simulación de spooler
    setTimeout(() => {
      setSpoolerStatus("connecting");
      setTimeout(() => {
        setSpoolerStatus("printing");
        setTimeout(() => {
          const serial = `TF${Math.floor(10000000 + Math.random() * 90000000)}`;
          setFiscalSerial(serial);
          setSpoolerStatus("success");
          
          const quickTicket = {
            id: `TKT-${Math.floor(10000 + Math.random() * 90000)}`,
            controlNumber: `CTRL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(10000 + Math.random() * 90000)}`,
            date: new Date().toLocaleString(),
            client: (clientDoc || clientName)
              ? { doc: clientDoc, name: clientName, address: clientAddress, phone: clientPhone }
              : null,
            items: [...cart],
            subtotalUsd,
            taxUsd,
            igtfUsd: finalIgtf,
            totalUsd: calculatedTotalUsd,
            totalBs: calculatedTotalBs,
            serial: isFiscalMode ? serial : null,
            payments: {
              cashUsd: finalCashUsd,
              cashBs: finalCashBs,
              pagoMovil: finalPagoMovil,
              posBs: finalPosBs,
              zelle: finalZelle
            }
          };
          setGeneratedTicket(quickTicket);
          saveSaleToHistory(quickTicket); // ← persistir en Supabase + localStorage
          setShowTicketModal(true);
        }, 1500);
      }, 1200);
    }, 100);
  };

  // Generar factura corporativa en formato CARTA (Letter) Vertical para PDF o Impresora
  const handlePrintReceipt = async (ticket: any) => {
    // Construir payload compacto para el QR
    const qrPayload = JSON.stringify({
      v: 1,
      id: ticket.id,
      ctrl: ticket.controlNumber,
      dt: ticket.date,
      usd: parseFloat(ticket.totalUsd.toFixed(2)),
      bs: parseFloat(ticket.totalBs.toFixed(2)),
      cli: ticket.client ? {
        n: ticket.client.name,
        d: ticket.client.doc || "",
        t: ticket.client.phone || ""
      } : null,
      itm: ticket.items.map((i: any) => ({
        c: i.product.code,
        n: i.product.name,
        q: i.quantity,
        p: parseFloat(i.product.priceUsd.toFixed(2))
      }))
    });

    // Generar QR como Data URL (base64) para embeber en el HTML
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 140,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
        errorCorrectionLevel: "M"
      });
    } catch (e) {
      console.error("Error generando QR:", e);
    }

    // Abrir una pestaña limpia para la factura tamaño carta
    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      alert("Por favor permite los pop-ups en tu navegador para imprimir la factura.");
      return;
    }

    const itemsHtml = ticket.items.map((item: any, idx: number) => {
      const isExempt = item.product.taxCategory === "exempt";
      const totalItemUsd = item.product.priceUsd * item.quantity;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 10px; text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px; font-family: monospace; font-weight: 600; color: #334155;">${item.product.code}</td>
          <td style="padding: 10px; font-weight: 600; color: #0f172a;">${item.product.name}</td>
          <td style="padding: 10px; text-align: center;">
            <span style="font-size: 9px; font-weight: bold; padding: 2.5px 7px; border-radius: 6px; ${
              isExempt ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #fee2e2; color: #991b1b;'
            }">
              ${isExempt ? 'EXENTO' : 'IVA 16%'}
            </span>
          </td>
          <td style="padding: 10px; text-align: center; font-weight: 700; color: #0f172a;">${item.quantity}</td>
          <td style="padding: 10px; text-align: right; font-weight: 600; font-family: monospace; color: #334155;">$${item.product.priceUsd.toFixed(2)}</td>
          <td style="padding: 10px; text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">$${totalItemUsd.toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    const paymentsHtml = `
      ${ticket.payments.cashUsd > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
          <span style="color: #64748b; font-weight: 600; font-size: 10px;">💵 EFECTIVO DIVISAS (USD)</span>
          <span style="font-weight: bold; font-family: monospace; color: #0f172a; font-size: 11px;">$${ticket.payments.cashUsd.toFixed(2)}</span>
        </div>
      ` : ''}
      ${ticket.payments.zelle > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
          <span style="color: #64748b; font-weight: 600; font-size: 10px;">💜 TRANSFERENCIA ZELLE (USD)</span>
          <span style="font-weight: bold; font-family: monospace; color: #0f172a; font-size: 11px;">$${ticket.payments.zelle.toFixed(2)}</span>
        </div>
      ` : ''}
      ${ticket.payments.cashBs > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
          <span style="color: #64748b; font-weight: 600; font-size: 10px;">🪙 EFECTIVO BOLÍVARES (BS)</span>
          <span style="font-weight: bold; font-family: monospace; color: #0f172a; font-size: 11px;">${ticket.payments.cashBs.toFixed(2)} Bs. <span style="font-size: 9px; color: #94a3b8; font-weight: normal;">($${(ticket.payments.cashBs / exchangeRate).toFixed(2)})</span></span>
        </div>
      ` : ''}
      ${ticket.payments.pagoMovil > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
          <span style="color: #64748b; font-weight: 600; font-size: 10px;">📱 PAGO MÓVIL INTERBANCARIO</span>
          <span style="font-weight: bold; font-family: monospace; color: #0f172a; font-size: 11px;">${ticket.payments.pagoMovil.toFixed(2)} Bs. <span style="font-size: 9px; color: #94a3b8; font-weight: normal;">($${(ticket.payments.pagoMovil / exchangeRate).toFixed(2)})</span></span>
        </div>
      ` : ''}
      ${ticket.payments.posBs > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
          <span style="color: #64748b; font-weight: 600; font-size: 10px;">💳 PUNTO DE VENTA (TARJETA BS)</span>
          <span style="font-weight: bold; font-family: monospace; color: #0f172a; font-size: 11px;">${ticket.payments.posBs.toFixed(2)} Bs. <span style="font-size: 9px; color: #94a3b8; font-weight: normal;">($${(ticket.payments.posBs / exchangeRate).toFixed(2)})</span></span>
        </div>
      ` : ''}
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Factura Corporativa - ${ticket.id}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 15mm 15mm 15mm 15mm;
            }
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              background-color: #fff;
              font-size: 12px;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            .header-table td {
              vertical-align: top;
            }
            .client-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 15px;
              margin-top: 20px;
              margin-bottom: 25px;
            }
            .products-table th {
              background-color: #0f172a;
              color: #ffffff;
              font-weight: 700;
              font-size: 10px;
              text-transform: uppercase;
              padding: 10px;
              border: 1px solid #1e293b;
            }
            .products-table td {
              border: 1px solid #e2e8f0;
            }
            .totals-container {
              margin-top: 20px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
            }
            .payment-split-box {
              flex: 1;
              background-color: #fafafa;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
            }
            .totals-box {
              width: 320px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-usd { color: #0f766e; }
            .text-bs { color: #4f46e5; }
          </style>
        </head>
        <body>
          <div style="padding: 5px;">
            
            <!-- CABECERA CORPORATIVA DE DOS COLUMNAS -->
            <table class="header-table">
              <tr>
                <td style="width: 55%;">
                  <h1 style="margin: 0 0 5px 0; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    REGIO<span style="color: #0f766e;">BIZ</span>, C.A.
                  </h1>
                  <p style="margin: 2px 0; font-weight: 700; color: #475569; font-size: 11px;">RIF: J-40392812-0</p>
                  <p style="margin: 2px 0; color: #64748b; font-size: 10.5px;">Calle Las Mercedes, Centro Comercial Altiplano, Oficina POS-A</p>
                  <p style="margin: 2px 0; color: #64748b; font-size: 10.5px;">Caracas, Edo. Miranda, Venezuela. CP 1060</p>
                  <p style="margin: 2px 0; color: #64748b; font-size: 10.5px;">Contacto: (0212) 993-9922 | administracion@regiobiz.com</p>
                </td>
                <td style="width: 45%; text-align: right;">
                  <div style="display: inline-block; text-align: left; border: 2px solid #0f172a; border-radius: 10px; overflow: hidden; min-width: 250px;">
                    <div style="background-color: #0f172a; color: #fff; padding: 8px 15px; font-weight: 800; font-size: 13px; text-transform: uppercase; text-align: center; letter-spacing: 1px;">
                      ${ticket.serial ? 'Factura Fiscal SENIAT' : 'Control de Entrega Comercial'}
                    </div>
                    <div style="padding: 12px 15px; background-color: #fff; space-y: 4px;">
                      <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <span style="font-weight: 600; color: #64748b;">NRO DOCUMENTO:</span>
                        <span style="font-weight: bold; color: #ef4444; font-family: monospace; font-size: 12px;">${ticket.id}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px;">
                        <span style="font-weight: 600; color: #64748b;">FECHA EMISIÓN:</span>
                        <span style="font-weight: 700; color: #334155;">${ticket.date}</span>
                      </div>
                      ${ticket.serial ? `
                        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #f1f5f9;">
                          <span style="font-weight: 600; color: #059669;">S/N IMPRESORA:</span>
                          <span style="font-weight: bold; color: #059669; font-family: monospace;">${ticket.serial}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- DATOS DEL CLIENTE / RECEPTOR -->
            <div class="client-box">
              <h3 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
                Información del Adquiriente / Cliente Fiscal
              </h3>
              ${ticket.client ? `
                <table style="width: 100%; border: none;">
                  <tr>
                    <td style="width: 50%; padding: 2px 0;">
                      <span style="font-weight: 700; color: #475569; font-size: 10.5px;">NOMBRE / RAZÓN SOCIAL:</span> 
                      <span style="font-weight: 800; color: #0f172a; font-size: 11px;">${ticket.client.name}</span>
                    </td>
                    <td style="width: 50%; padding: 2px 0;">
                      <span style="font-weight: 700; color: #475569; font-size: 10.5px;">R.I.F. / CÉDULA:</span> 
                      <span style="font-weight: 800; color: #0f172a; font-family: monospace; font-size: 11.5px;">${ticket.client.doc || 'No indicado'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 50%; padding: 4px 0; vertical-align: top;">
                      <span style="font-weight: 700; color: #475569; font-size: 10.5px;">DIRECCIÓN FISCAL:</span> 
                      <span style="font-weight: bold; color: #1e293b; font-size: 11px;">${ticket.client.address || 'No indicada'}</span>
                    </td>
                    <td style="width: 50%; padding: 4px 0; vertical-align: top;">
                      ${ticket.client.phone ? `
                        <span style="font-weight: 700; color: #475569; font-size: 10.5px;">TELÉFONO:</span> 
                        <span style="font-weight: bold; color: #1e293b; font-size: 11px;">${ticket.client.phone}</span>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              ` : `
                <div style="font-style: italic; color: #64748b; font-weight: 600; font-size: 11px; display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #94a3b8; display: inline-block;"></span>
                  Emitido a nombre de Consumidor Final (No Fiscal - Detal)
                </div>
              `}
            </div>

            <!-- DETALLE DE CONCEPTOS FACTURADOS -->
            <table class="products-table">
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 15%;">Código/SKU</th>
                  <th style="width: 40%; text-align: left;">Descripción del Concepto</th>
                  <th style="width: 12%;">Impuesto</th>
                  <th style="width: 8%;">Cant</th>
                  <th style="width: 10%; text-align: right;">Unitario ($)</th>
                  <th style="width: 10%; text-align: right;">Subtotal ($)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <!-- SECCIÓN INFERIOR DE TOTALES Y PAGOS COMBINADOS -->
            <div class="totals-container">
              
              <!-- Detalles de Medios de Pago Utilizados (Bimonetario) -->
              <div class="payment-split-box">
                <h4 style="margin: 0 0 8px 0; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                  Conciliación de Medios de Pago Recibidos
                </h4>
                <div style="space-y: 2px;">
                  ${paymentsHtml}
                </div>
                
                <!-- Disclaimer de Términos -->
                <div style="margin-top: 15px; font-size: 8.5px; color: #94a3b8; line-height: 1.4; text-align: justify; font-weight: 500;">
                  <strong>Condiciones Generales:</strong> Este documento representa un registro de control comercial. Las transacciones en bolívares fueron procesadas de acuerdo al tipo de cambio oficial del BCV aplicable a la fecha. La mercancía recibida a entera conformidad no admite devoluciones pasados los 7 días de emisión.
                </div>
              </div>

              <!-- Código QR de Seguridad y Verificación (Anti-Fraude) -->
              <div style="width: 140px; text-align: center; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background-color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">
                <span style="font-size: 8px; font-weight: bold; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">QR de Seguridad</span>
                <img src="${qrDataUrl}" style="width: 120px; height: 120px; display: block; border: 1px solid #f1f5f9; border-radius: 4px;" alt="QR de Seguridad" />
                <span style="font-size: 7px; color: #94a3b8; font-weight: 600; display: block; margin-top: 6px; line-height: 1.2; text-align: center;">Escanee para validar devolución e inmutabilidad.</span>
              </div>

              <!-- Cuadro Resumen de Totales y Bases Imponibles -->
              <div class="totals-box">
                <table style="width: 100%; font-size: 11.5px; font-weight: 600; color: #475569;">
                  <tr>
                    <td style="padding: 4px 0;">Subtotal USD:</td>
                    <td style="padding: 4px 0; text-align: right; font-family: monospace;">$${ticket.subtotalUsd.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">IVA General (16%):</td>
                    <td style="padding: 4px 0; text-align: right; font-family: monospace;">$${ticket.taxUsd.toFixed(2)}</td>
                  </tr>
                  ${ticket.igtfUsd > 0 ? `
                    <tr style="color: #b45309;">
                      <td style="padding: 4px 0;">Recargo IGTF (3% Divisas):</td>
                      <td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: bold;">+$${ticket.igtfUsd.toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  
                  <!-- Gran Total USD -->
                  <tr style="border-top: 1px dashed #cbd5e1; font-size: 13px; font-weight: 800; color: #0f172a;">
                    <td style="padding: 8px 0 4px 0;">TOTAL EN DÓLARES:</td>
                    <td style="padding: 8px 0 4px 0; text-align: right; font-family: monospace; font-size: 14px; color: #0f766e;">
                      $${ticket.totalUsd.toFixed(2)}
                    </td>
                  </tr>

                  <!-- Gran Total Bolívares (Con conversión fiscal obligatoria) -->
                  <tr style="border-top: 1px solid #e2e8f0; font-size: 13px; font-weight: 800; color: #1e1b4b;">
                    <td style="padding: 6px 0 0 0;">TOTAL EN BOLÍVARES:</td>
                    <td style="padding: 6px 0 0 0; text-align: right; font-family: monospace; font-size: 14px; color: #4f46e5;">
                      ${ticket.totalBs.toFixed(2)} Bs.
                    </td>
                  </tr>
                </table>
              </div>

            </div>

            <!-- PIE DE PÁGINA COMERCIAL FISCAL -->
            <div style="margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; font-size: 9px; color: #94a3b8; font-weight: 600;">
              ${ticket.serial 
                ? '*** FACTURACIÓN FISCAL REGULADA BAJO NORMAS PROVIDENCIA SENIAT NRO. 00071 ***' 
                : 'DOCUMENTO EMITIDO POR REGIOBIZ CRM - SISTEMA BIMONETARIO VENEZOLANO'
              }
              <p style="margin: 4px 0 0 0; color: #b2f5ea; font-size: 8.5px; letter-spacing: 0.5px;">¡Gracias por preferir a RegioBiz, C.A.! Construyendo el futuro comercial de tu empresa.</p>
            </div>

          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Esperar a que el usuario termine con el diálogo antes de cerrar la ventana.
    // 'afterprint' se dispara cuando el usuario confirma, cancela o cierra el diálogo.
    printWindow.addEventListener("afterprint", () => {
      printWindow.close();
    });

    // Abrir el diálogo de impresión tras un breve delay para que el HTML cargue
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Solicitar devolución (Congelemiento de montos del mismo día)
  const handleRequestRefund = async () => {
    if (!refundTicketId) return;

    setRefundProcessing(true);
    setRefundStatus("Solicitando autorización de devolución a la Directora...");

    // Solicitar permiso remoto en tiempo real
    const approved = await requestRemotePermission(
      "devolucion",
      `Devolución de Ticket #${refundTicketId} por $15.50 / 565.00 Bs.`
    );

    setRefundProcessing(false);
    if (approved) {
      // Reincorporar productos al inventario
      if (scannedTicket && scannedTicket.items) {
        try {
          const tenantId = user?.tenantId || "default";
          const savedProducts = localStorage.getItem(`regiobiz_products_${tenantId}`);
          if (savedProducts) {
            const products = JSON.parse(savedProducts);
            const updatedProducts = products.map((prod: any) => {
              const returnedItem = scannedTicket.items.find((it: any) => it.product.code === prod.code || it.product.id === prod.id);
              if (returnedItem) {
                return {
                  ...prod,
                  stock: prod.stock + returnedItem.quantity
                };
              }
              return prod;
            });
            localStorage.setItem(`regiobiz_products_${tenantId}`, JSON.stringify(updatedProducts));

            // Sincronizar con Supabase
            if (isSupabaseConfigured()) {
              scannedTicket.items.forEach(async (it: any) => {
                try {
                  const newStock = it.product.stock + it.quantity;
                  await supabase!
                    .from("products")
                    .update({ stock: newStock })
                    .eq("code", `${tenantId}_${it.product.code}`);
                } catch (dbErr) {
                  console.error("Error al actualizar stock de devolución en Supabase:", dbErr);
                }
              });
            }
          }
        } catch (e) {
          console.error("Error al reincorporar inventario:", e);
        }
      }

      setRefundStatus("¡Autorización Aprobada! Devolución procesada. El inventario ha sido devuelto y la caja ajustada.");
      resetPOS();
    } else {
      setRefundStatus("Solicitud de Devolución rechazada por la Directora.");
    }
  };

  return (
    <div className="space-y-4 relative pb-20 xl:pb-0">
      
      {/* Selector de Pestañas Móvil */}
      <div className="flex xl:hidden border border-border bg-white sticky top-0 z-30 p-2 gap-2 rounded-2xl shadow-sm">
        <button
          onClick={() => setMobileTab("catalog")}
          className={`flex-1 py-3 text-center rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === "catalog"
              ? "bg-primary text-white shadow-md shadow-primary/10"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Package className="w-4 h-4" />
          Catálogo
        </button>
        <button
          onClick={() => setMobileTab("cart")}
          className={`flex-1 py-3 text-center rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 relative cursor-pointer ${
            mobileTab === "cart"
              ? "bg-primary text-white shadow-md shadow-primary/10"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Carrito ({cart.length})
          {cart.length > 0 && (
            <span className="absolute -top-1.5 -right-1 w-5 h-5 rounded-full bg-red-500 text-white font-mono text-[9px] font-extrabold flex items-center justify-center animate-pulse">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300">
        
        {/* SECCIÓN IZQUIERDA: BÚSQUEDA Y CATÁLOGO DE PRODUCTOS (7 columnas) */}
        <div className={`xl:col-span-7 space-y-6 ${mobileTab === "catalog" ? "block" : "hidden xl:block"}`}>
        
        {/* Barra de Búsqueda de Inventario */}
        <div className="premium-card p-4 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código de barra, SKU o nombre del producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 focus:ring-0"
          />
        </div>

        {/* Rejilla de Productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const priceBs = product.priceUsd * exchangeRate;
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="premium-card premium-card-hover p-4 text-left flex flex-col justify-between h-44 group cursor-pointer"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs bg-muted border border-border text-slate-600 font-mono px-2 py-0.5 rounded font-bold">
                      {product.code}
                    </span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded uppercase ${
                      product.taxCategory === "exempt" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                    }`}>
                      {product.taxCategory === "exempt" ? "Exento" : "IVA 16%"}
                    </span>
                  </div>
                  
                  <h4 className="text-base font-black text-slate-900 mt-3 group-hover:text-primary transition-colors line-clamp-2 tracking-tight">
                    {product.name}
                  </h4>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-900/50 flex justify-between items-end w-full">
                  <div>
                    {/* Precio Dual */}
                    <p className="text-base font-black text-usd">${product.priceUsd.toFixed(2)}</p>
                    <p className="text-xs font-bold text-bs font-mono mt-0.5">{priceBs.toFixed(2)} Bs.</p>
                  </div>
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded ${
                    product.stock <= 0 
                      ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                      : product.stock <= 10 
                      ? "bg-amber-500/10 text-amber-600" 
                      : "text-slate-600 bg-slate-100 border border-slate-200"
                  }`}>
                    Stock: {product.stock}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* MODULO 3: PANEL DE DEVOLUCIONES CONGELADAS */}
        <div className="premium-card p-6 space-y-4">
          <div className="border-b border-border pb-3 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Undo className="w-4 h-4 text-amber-500 animate-pulse" />
              Devoluciones del Mismo Día (Congelado)
            </h3>
            <span className="text-[10px] px-2 py-0.5 bg-muted border border-border text-slate-500 font-mono">
              Requiere Permiso Remoto
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Número de ticket (ej: TKT-12948)..."
                value={refundTicketId}
                onChange={(e) => setRefundTicketId(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-white border border-border rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 font-mono"
              />
              <button
                type="button"
                onClick={startQRScanner}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-amber-500 transition-colors focus:outline-none cursor-pointer"
                title="Escanear ticket por código QR"
              >
                <Camera className="w-5 h-5 animate-pulse" />
              </button>
            </div>
            <button
              onClick={handleRequestRefund}
              disabled={refundProcessing || !refundTicketId}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {refundProcessing ? "Procesando..." : "Solicitar Devolución"}
            </button>
          </div>

          {/* Vista previa de Factura Escaneada por QR */}
          {scannedTicket && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-border space-y-3 text-slate-900 animate-in slide-in-from-top-4 duration-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <p className="text-[10px] font-black text-slate-900 uppercase">Factura Detectada por QR</p>
                  <p className="text-[9px] text-slate-500 font-mono">{scannedTicket.id} | {scannedTicket.ctrl}</p>
                </div>
                <button 
                  onClick={() => {
                    setScannedTicket(null);
                    setRefundTicketId("");
                    setRefundStatus("");
                  }} 
                  className="text-slate-400 hover:text-red-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs space-y-1.5 font-mono">
                {scannedTicket.cli && (
                  <p className="text-[10px] text-slate-700">
                    <span className="font-bold">Cliente:</span> {scannedTicket.cli.n} ({scannedTicket.cli.d})
                  </p>
                )}
                <p className="text-[10px] text-slate-500">
                  <span className="font-bold">Fecha:</span> {scannedTicket.dt}
                </p>
                
                {/* Listado de items escaneados */}
                <div className="border-t border-b border-dashed border-slate-200 py-2 my-2 max-h-28 overflow-y-auto space-y-1">
                  {scannedTicket.itm && scannedTicket.itm.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[9px] text-slate-600">
                      <span>{item.q}x {item.n}</span>
                      <span className="font-bold">${(item.p * item.q).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-xs font-bold pt-1">
                  <span>Total Facturado:</span>
                  <span className="text-usd">${scannedTicket.usd.toFixed(2)} / {scannedTicket.bs.toFixed(2)} Bs.</span>
                </div>
              </div>
            </div>
          )}

          {refundStatus && (
            <p className="text-xs text-amber-400 font-mono p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
              {refundStatus}
            </p>
          )}
        </div>

      </div>

      {/* SECCIÓN DERECHA: CARRITO, FACTURACIÓN FISCAL Y PAGO MIXTO (5 columnas) */}
      <div className={`xl:col-span-5 space-y-6 ${mobileTab === "cart" ? "block" : "hidden xl:block"}`}>
        
        {/* PANEL DEL CARRITO DE COMPRAS */}
        <div className="premium-card p-6 flex flex-col justify-between min-h-[400px]">
          <div className="space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                Artículos a Facturar
              </h3>
              <span className="text-xs font-bold bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full">
                {cart.length} ítems
              </span>
            </div>

            {/* Lista del Carrito */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  El carrito está vacío. Agregue productos del catálogo.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/40 border border-border gap-3">
                    <button 
                      onClick={() => {
                        setEditingCartItem(item);
                        setTempPriceUsd(item.product.priceUsd.toString());
                      }}
                      className="flex-1 text-left hover:opacity-85 transition-opacity focus:outline-none cursor-pointer"
                      title="Hacer clic para ajustar precio de este producto"
                    >
                      <p className="text-xs font-bold text-slate-900 line-clamp-1 flex items-center gap-1 group">
                        {item.product.name}
                        <Plus className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-[10px] text-primary font-bold mt-0.5">
                        ${item.product.priceUsd.toFixed(2)} | {(item.product.priceUsd * exchangeRate).toFixed(2)} Bs.
                      </p>
                    </button>

                    <div className="flex items-center gap-2.5">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-slate-900 rounded text-slate-400">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono text-slate-900 font-extrabold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-slate-900 rounded text-slate-400">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totales del Carrito */}
          {cart.length > 0 && (
            <div className="pt-4 border-t border-border mt-6 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600 font-bold">
                <span>Subtotal USD:</span>
                <span>${subtotalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-bold">
                <span>IVA 16%:</span>
                <span>${taxUsd.toFixed(2)}</span>
              </div>
              {payCashUsd > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>IGTF 3% (Efectivo Divisas):</span>
                  <span>+${igtfUsd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-border text-slate-900">
                <span>TOTAL USD:</span>
                <span className="text-usd">${totalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>TOTAL BS EQUIV:</span>
                <span className="text-bs">{totalBs.toFixed(2)} Bs.</span>
              </div>
            </div>
          )}
        </div>

        {/* MODULO 4: INTEGRACIÓN IMPRESORA FISCAL & DATOS CLIENTE */}
        <div className="premium-card p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-400" />
              Facturación & Impresora Fiscal
            </h3>
            <button
              onClick={() => setIsFiscalMode(!isFiscalMode)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                isFiscalMode 
                  ? "bg-primary text-white border-primary" 
                  : "bg-muted text-slate-500 border-border"
              }`}
            >
              {isFiscalMode ? "Modo Fiscal: ON" : "Modo Fiscal: OFF"}
            </button>
          </div>

          {isFiscalMode && (
            <div className="space-y-3 animate-in slide-in-from-top duration-200">
              {/* Fila 1: Cédula/RIF y Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Cédula o RIF *</label>
                  <input
                    type="text"
                    placeholder="V-12345678-9..."
                    value={clientDoc}
                    onChange={(e) => setClientDoc(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="+58 412 000 0000"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              {/* Nombre / Razón Social */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Nombre y Apellido / Razón Social *</label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez o Inversiones XYZ C.A...."
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary"
                />
              </div>
              {/* Dirección */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Dirección Fiscal *</label>
                <input
                  type="text"
                  placeholder="Urb., Av., Calle, Edificio, Piso, Apto..."
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Formulario de cliente para modo NO fiscal (info básica opcional) */}
          {!isFiscalMode && (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-400 italic">Opcional: Registra los datos del cliente para personalizar el ticket.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre y Apellido</label>
                  <input
                    type="text"
                    placeholder="Ej: María González..."
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="+58 412 000 0000"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Estado de Spooler */}
          {spoolerStatus !== "idle" && (
            <div className="p-3.5 rounded-xl bg-white border border-border flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">Estado del Spooler Local:</span>
              <span className={`font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[10px] ${
                spoolerStatus === "connecting"
                  ? "bg-amber-500/10 text-amber-400 animate-pulse"
                  : spoolerStatus === "printing"
                  ? "bg-primary/10 text-primary animate-bounce"
                  : spoolerStatus === "success"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}>
                {spoolerStatus === "connecting" && "Conectando..."}
                {spoolerStatus === "printing" && "Imprimiendo..."}
                {spoolerStatus === "success" && "Impreso OK"}
                {spoolerStatus === "failed" && "Error Spooler"}
              </span>
            </div>
          )}
        </div>

        {/* MODULO 2: DESGLOSE DE PAGO MIXTO */}
        {cart.length > 0 && (
          <div className="premium-card p-6 space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-usd" />
                Desglose de Pago Combinado (Bimonetario)
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Registra ingresos en múltiples monedas. El saldo se recalcula en tiempo real.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              
              {/* Efectivo Divisas USD */}
              <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border">
                <div className="flex items-center gap-1.5 w-24 text-usd font-extrabold flex-shrink-0">
                  <DollarSign className="w-3.5 h-3.5" />
                  Efectivo $
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={payCashUsd || ""}
                  onChange={(e) => setPayCashUsd(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-white border border-border rounded px-2 py-1.5 font-mono text-slate-900 text-right text-xs"
                  placeholder="0.00"
                />
              </div>

              {/* Efectivo Bolívares Bs. */}
              <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border">
                <div className="flex items-center gap-1.5 w-24 text-bs font-extrabold flex-shrink-0">
                  <Coins className="w-3.5 h-3.5" />
                  Efectivo Bs.
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={payCashBs || ""}
                  onChange={(e) => setPayCashBs(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-white border border-border rounded px-2 py-1.5 font-mono text-slate-900 text-right text-xs"
                  placeholder="0.00"
                />
                <button
                  onClick={() => handleAutoFillRemainingBs("cash_bs")}
                  className="px-1.5 py-1 bg-muted hover:bg-primary rounded text-[9px] font-bold text-slate-500 hover:text-white border border-border"
                >
                  Saldo
                </button>
              </div>

              {/* Pago Móvil Bs. */}
              <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border">
                <div className="flex items-center gap-1.5 w-24 text-indigo-500 font-extrabold flex-shrink-0">
                  <Smartphone className="w-3.5 h-3.5" />
                  Pago Móvil
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={payPagoMovil || ""}
                  onChange={(e) => setPayPagoMovil(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-white border border-border rounded px-2 py-1.5 font-mono text-slate-900 text-right text-xs"
                  placeholder="0.00"
                />
                <button
                  onClick={() => handleAutoFillRemainingBs("pago_movil")}
                  className="px-1.5 py-1 bg-muted hover:bg-primary rounded text-[9px] font-bold text-slate-500 hover:text-white border border-border"
                >
                  Saldo
                </button>
              </div>

              {/* Punto de Venta Bs. */}
              <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border">
                <div className="flex items-center gap-1.5 w-24 text-sky-500 font-extrabold flex-shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                  Punto Bs.
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={payPosBs || ""}
                  onChange={(e) => setPayPosBs(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-white border border-border rounded px-2 py-1.5 font-mono text-slate-900 text-right text-xs"
                  placeholder="0.00"
                />
                <button
                  onClick={() => handleAutoFillRemainingBs("pos")}
                  className="px-1.5 py-1 bg-muted hover:bg-primary rounded text-[9px] font-bold text-slate-500 hover:text-white border border-border"
                >
                  Saldo
                </button>
              </div>

              {/* Zelle USD */}
              <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border">
                <div className="flex items-center gap-1.5 w-24 text-purple-500 font-extrabold flex-shrink-0">
                  <DollarSign className="w-3.5 h-3.5" />
                  Zelle $
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={payZelle || ""}
                  onChange={(e) => setPayZelle(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-white border border-border rounded px-2 py-1.5 font-mono text-slate-900 text-right text-xs"
                  placeholder="0.00"
                />
              </div>

              {/* Balance Restante */}
              <div className="p-3 rounded-xl bg-white border border-border mt-4 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-400">Saldo Restante USD:</span>
                  <span className={remainingUsd > 0 ? "text-amber-400" : "text-emerald-400"}>
                    ${remainingUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold font-mono text-[10px]">
                  <span className="text-slate-500">Saldo Restante Bs:</span>
                  <span className={remainingBs > 0 ? "text-amber-400" : "text-emerald-400"}>
                    {remainingBs.toFixed(2)} Bs.
                  </span>
                </div>
              </div>

              {/* Acciones de Cobro */}
              <div className="pt-2 flex gap-3">
                <button
                  onClick={resetPOS}
                  className="flex-1 py-3 border border-border hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Limpiar POS
                </button>
                
                <button
                  onClick={() => handleProcessSale(false)}
                  disabled={cart.length === 0 || spoolerStatus === "connecting" || spoolerStatus === "printing"}
                  className="flex-2 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {isFiscalMode ? "Procesar Factura Fiscal" : "Imprimir Ticket"}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* MODAL / TICKET DIGITAL EN VISTA TÉRMICA 80MM */}
      {showTicketModal && generatedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-2xl p-6 relative flex flex-col font-mono text-xs max-h-[90vh]">
            
            {/* Cabecera Ticket */}
            <div className="text-center space-y-1.5 pb-4 border-b border-dashed border-slate-300">
              <h3 className="text-lg font-extrabold tracking-widest uppercase">REGIOBIZ, C.A.</h3>
              <p className="text-[10px] text-slate-500 font-semibold">RIF: J-40392812-0</p>
              <p className="text-[9px] text-slate-500">Calle Las Mercedes, Caracas, Miranda</p>
              <p className="text-[9px] text-slate-500">Telf: (0212) 993-9922</p>
            </div>

            {/* Metadatos Transaccionales */}
            <div className="py-4 border-b border-dashed border-slate-300 space-y-1 text-[10px] text-slate-600">
              <div className="flex justify-between">
                <span>TICKET ID:</span>
                <span className="font-extrabold">{generatedTicket.id}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>{generatedTicket.date}</span>
              </div>
              
              {generatedTicket.client ? (
                <div className="pt-2 border-t border-slate-100 mt-2 space-y-1 text-[9px]">
                  <p className="font-extrabold text-slate-800">DATOS DEL CLIENTE:</p>
                  {generatedTicket.client.name && <p><span className="text-slate-500">NOMBRE:</span> <span className="font-bold">{generatedTicket.client.name}</span></p>}
                  {generatedTicket.client.doc && <p><span className="text-slate-500">CÉD/RIF:</span> {generatedTicket.client.doc}</p>}
                  {generatedTicket.client.address && <p><span className="text-slate-500">DIR:</span> {generatedTicket.client.address}</p>}
                  {generatedTicket.client.phone && <p><span className="text-slate-500">TELF:</span> {generatedTicket.client.phone}</p>}
                </div>
              ) : (
                <div className="pt-1 text-[9px] italic text-slate-400">
                  Consumidor Final (No Fiscal)
                </div>
              )}
            </div>

            {/* Listado de Artículos */}
            <div className="py-4 border-b border-dashed border-slate-300 space-y-2 flex-1 overflow-y-auto">
              <div className="grid grid-cols-12 font-bold text-slate-800 pb-1.5 border-b border-slate-100">
                <span className="col-span-6">CONCEPTO</span>
                <span className="col-span-2 text-center">CANT</span>
                <span className="col-span-4 text-right">TOTAL USD</span>
              </div>

              {generatedTicket.items.map((item: any, idx: number) => {
                const isExempt = item.product.taxCategory === "exempt";
                return (
                  <div key={idx} className="grid grid-cols-12 text-slate-700 font-semibold gap-1">
                    <span className="col-span-6 line-clamp-2">
                      {item.product.name} {isExempt ? "(E)" : "(G)"}
                    </span>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-4 text-right">${(item.product.priceUsd * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            {/* Totales y Desglose de Pago (Bimonetarios) */}
            <div className="py-4 border-b border-dashed border-slate-300 space-y-2 text-slate-800">
              <div className="flex justify-between text-slate-500">
                <span>SUBTOTAL USD:</span>
                <span>${generatedTicket.subtotalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IVA 16%:</span>
                <span>${generatedTicket.taxUsd.toFixed(2)}</span>
              </div>
              {generatedTicket.igtfUsd > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>IGTF 3% (Efectivo Divisas):</span>
                  <span>+${generatedTicket.igtfUsd.toFixed(2)}</span>
                </div>
              )}

              {/* Totales Destacados en Ambas Monedas */}
              <div className="flex justify-between font-extrabold text-sm border-t border-slate-100 pt-2 text-slate-900">
                <span>TOTAL A PAGAR USD:</span>
                <span>${generatedTicket.totalUsd.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between font-extrabold text-sm text-indigo-700">
                <span>TOTAL A PAGAR BS:</span>
                <span>{generatedTicket.totalBs.toFixed(2)} Bs.</span>
              </div>

              {/* Detalle del Desglose de Cómo Pagó */}
              <div className="pt-3 border-t border-slate-100 mt-2 space-y-1.5 text-[9px] text-slate-500 font-semibold">
                <p className="font-extrabold text-slate-700">DESGLOSE DE PAGO RECIBIDO:</p>
                {generatedTicket.payments.cashUsd > 0 && <p>EFECTIVO USD: ${generatedTicket.payments.cashUsd.toFixed(2)}</p>}
                {generatedTicket.payments.zelle > 0 && <p>ZELLE USD: ${generatedTicket.payments.zelle.toFixed(2)}</p>}
                {generatedTicket.payments.cashBs > 0 && <p>EFECTIVO BS: {generatedTicket.payments.cashBs.toFixed(2)} Bs. (${(generatedTicket.payments.cashBs / exchangeRate).toFixed(2)})</p>}
                {generatedTicket.payments.pagoMovil > 0 && <p>PAGO MÓVIL: {generatedTicket.payments.pagoMovil.toFixed(2)} Bs. (${(generatedTicket.payments.pagoMovil / exchangeRate).toFixed(2)})</p>}
                {generatedTicket.payments.posBs > 0 && <p>PUNTO BS: {generatedTicket.payments.posBs.toFixed(2)} Bs. (${(generatedTicket.payments.posBs / exchangeRate).toFixed(2)})</p>}
              </div>

              {/* AVISO IMPORTANTE: No se renderiza la tasa de cambio utilizada para evitar ruidos al cliente final. */}
              {/* Cumplimos la directriz de forma estricta. */}
            </div>

            {/* Código QR Antifraude en Pantalla */}
            {modalQRDataUrl && (
              <div className="py-3 border-t border-dashed border-slate-300 flex flex-col items-center gap-1 bg-slate-50/50 rounded-xl my-2 border border-slate-100 select-none">
                <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">Código QR de Seguridad (Anti-Fraude)</p>
                <img src={modalQRDataUrl} alt="QR de Factura" className="w-28 h-28 border border-slate-200 bg-white p-1 rounded-lg" />
                <p className="text-[7px] text-slate-400 text-center px-4 leading-normal">Válido para devoluciones instantáneas desde el lector de cámara del Dashboard.</p>
              </div>
            )}

            {/* Pie Fiscal o Comercial */}
            <div className="text-center pt-4 space-y-1.5 text-slate-500">
              {generatedTicket.serial ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-700">FACTURA FISCAL</p>
                  <p className="text-[9px]">S/N IMPRESORA: {generatedTicket.serial}</p>
                  <p className="text-[9px] font-bold text-emerald-600">*** CONFIRMADO POR IMPRESORA FISCAL SENIAT ***</p>
                </div>
              ) : (
                <p className="text-[9px]">TICKET DE CONTROL COMERCIAL</p>
              )}
              <p className="text-[9px] pt-2">¡Gracias por su compra en RegioBiz!</p>
            </div>

            {/* Botones de Acción del Ticket */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={() => handlePrintReceipt(generatedTicket)}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Printer className="w-4 h-4" />
                Imprimir Recibo / PDF
              </button>

              <button
                onClick={() => {
                  const tenantId = user?.tenantId || "default";

                  // Guardar venta en el historial de ventas
                  const savedHistory = localStorage.getItem(`regiobiz_sales_history_${tenantId}`);
                  const history = savedHistory ? JSON.parse(savedHistory) : [];
                  const newRecord = {
                    id: generatedTicket.id,
                    controlNumber: generatedTicket.controlNumber,
                    date: generatedTicket.date,
                    client: generatedTicket.client ? generatedTicket.client.name : "Consumidor Final",
                    itemsCount: generatedTicket.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
                    totalUsd: generatedTicket.totalUsd,
                    totalBs: generatedTicket.totalBs,
                    items: generatedTicket.items.map((it: any) => ({ name: it.product.name, qty: it.quantity, price: it.product.priceUsd, code: it.product.code })),
                    payments: generatedTicket.payments
                  };
                  history.unshift(newRecord);
                  localStorage.setItem(`regiobiz_sales_history_${tenantId}`, JSON.stringify(history));

                  // Sincronizar venta con Supabase
                  if (isSupabaseConfigured()) {
                    supabase!.from("sales_history").insert({
                      id: generatedTicket.id,
                      tenant_id: tenantId,
                      invoice_num: generatedTicket.controlNumber,
                      client_name: generatedTicket.client ? generatedTicket.client.name : "Consumidor Final",
                      client_id: generatedTicket.client ? generatedTicket.client.id : "",
                      total_usd: generatedTicket.totalUsd,
                      total_bs: generatedTicket.totalBs,
                      rate: 1, // You could pass the actual rate here
                      payment_method: generatedTicket.payments.map((p:any) => p.method).join(", "),
                      items: generatedTicket.items.map((it: any) => ({ name: it.product.name, qty: it.quantity, price: it.product.priceUsd, code: it.product.code })),
                      seller_name: user?.name || "Vendedor",
                      created_at: new Date(generatedTicket.date).toISOString()
                    }).then(({ error }) => {
                      if (error) console.error("Error guardando venta en Supabase:", error);
                    });
                  }

                  // DESCONTAR STOCK DEL INVENTARIO LOCAL Y NUBE
                  const savedProducts = localStorage.getItem(`regiobiz_products_${tenantId}`);
                  if (savedProducts) {
                    try {
                      const products = JSON.parse(savedProducts);
                      const updatedProducts = products.map((prod: any) => {
                        const soldItem = generatedTicket.items.find((it: any) => it.product.code === prod.code || it.product.id === prod.id);
                        if (soldItem) {
                          return {
                            ...prod,
                            stock: Math.max(0, prod.stock - soldItem.quantity)
                          };
                        }
                        return prod;
                      });
                      localStorage.setItem(`regiobiz_products_${tenantId}`, JSON.stringify(updatedProducts));
                      
                      // Sincronizar con Supabase si está disponible
                      if (isSupabaseConfigured()) {
                        generatedTicket.items.forEach(async (it: any) => {
                          try {
                            const newStock = Math.max(0, it.product.stock - it.quantity);
                            await supabase!
                              .from("products")
                              .update({ stock: newStock })
                              .eq("code", `${tenantId}_${it.product.code}`);
                          } catch (dbErr) {
                            console.error("Error al actualizar stock en Supabase:", dbErr);
                          }
                        });
                      }
                    } catch (e) {
                      console.error("Error al descontar inventario:", e);
                    }
                  }

                  // TRASLADO AUTOMÁTICO DE DINERO A CUENTAS BANCARIAS BIMONETARIAS
                  const savedAccounts = localStorage.getItem(`regiobiz_accounts_${tenantId}`);
                  const localInitial = tenantId === "default"
                    ? [
                        { id: "a1", name: "Caja Fuerte USD", bankName: "Efectivo Divisas", balance: 450.00, currency: "USD" },
                        { id: "a2", name: "Zelle / BofA", bankName: "Bank of America", balance: 1100.00, currency: "USD" },
                        { id: "a3", name: "Banesco Corriente", bankName: "Banco Nacional", balance: 4500.00, currency: "VES" },
                        { id: "a4", name: "Pago Móvil Mercantil", bankName: "Mercantil Banco", balance: 6000.00, currency: "VES" },
                        { id: "a5", name: "Caja Chica Bs", bankName: "Efectivo Bolívares", balance: 900.00, currency: "VES" }
                      ]
                    : [
                        { id: "a1", name: "Caja Fuerte USD", bankName: "Efectivo Divisas", balance: 0.00, currency: "USD" },
                        { id: "a2", name: "Zelle / BofA", bankName: "Bank of America", balance: 0.00, currency: "USD" },
                        { id: "a3", name: "Banesco Corriente", bankName: "Banco Nacional", balance: 0.00, currency: "VES" },
                        { id: "a4", name: "Pago Móvil Mercantil", bankName: "Mercantil Banco", balance: 0.00, currency: "VES" },
                        { id: "a5", name: "Caja Chica Bs", bankName: "Efectivo Bolívares", balance: 0.00, currency: "VES" }
                      ];
                  const accounts = savedAccounts ? JSON.parse(savedAccounts) : localInitial;

                  const updatedAccounts = accounts.map((acc: any) => {
                    if (acc.id === "a1" && generatedTicket.payments.cashUsd > 0) {
                      return { ...acc, balance: acc.balance + generatedTicket.payments.cashUsd };
                    }
                    if (acc.id === "a2" && generatedTicket.payments.zelle > 0) {
                      return { ...acc, balance: acc.balance + generatedTicket.payments.zelle };
                    }
                    if (acc.id === "a3" && generatedTicket.payments.posBs > 0) {
                      return { ...acc, balance: acc.balance + generatedTicket.payments.posBs };
                    }
                    if (acc.id === "a4" && generatedTicket.payments.pagoMovil > 0) {
                      return { ...acc, balance: acc.balance + generatedTicket.payments.pagoMovil };
                    }
                    if (acc.id === "a5" && generatedTicket.payments.cashBs > 0) {
                      return { ...acc, balance: acc.balance + generatedTicket.payments.cashBs };
                    }
                    return acc;
                  });
                  localStorage.setItem(`regiobiz_accounts_${tenantId}`, JSON.stringify(updatedAccounts));

                  setShowTicketModal(false);
                  resetPOS();
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs transition-all text-center tracking-wider cursor-pointer uppercase flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 hover:scale-[1.01]"
              >
                <CheckCircle className="w-4 h-4 text-white animate-pulse" />
                Venta lista
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR PRECIO EN CALIENTE */}
      {editingCartItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-slate-900">
            <div className="border-b border-border pb-3 text-left">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Ajustar Precio de Venta
              </h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-1 line-clamp-2">
                {editingCartItem.product.name}
              </p>
            </div>

            <div className="space-y-4 text-xs text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase block">
                  Precio en Dólares ($)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={tempPriceUsd}
                    onChange={(e) => setTempPriceUsd(e.target.value)}
                    className="w-full pl-7 pr-4 py-2.5 bg-white border border-border rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-primary"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              {/* Live Preview de Tasa en Bolívares */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Equivalente a tasa oficial ({exchangeRate.toFixed(2)} Bs.)
                </p>
                <p className="text-sm font-black text-indigo-700 font-mono">
                  {(parseFloat(tempPriceUsd || "0") * exchangeRate).toFixed(2)} Bs.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="flex-1 py-2.5 border border-border hover:bg-slate-50 text-slate-600 font-bold rounded-xl cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const newPrice = parseFloat(tempPriceUsd);
                  if (!isNaN(newPrice) && newPrice >= 0) {
                    setCart(cart.map(item => 
                      item.product.id === editingCartItem.product.id 
                        ? { ...item, product: { ...item.product, priceUsd: newPrice } }
                        : item
                    ));
                    setEditingCartItem(null);
                  } else {
                    alert("Por favor ingresa un precio numérico válido.");
                  }
                }}
                className="flex-1 py-2.5 bg-primary hover:bg-indigo-600 text-white font-bold rounded-xl cursor-pointer text-xs"
              >
                Actualizar Precio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VENTANA MODAL DE PAGO RÁPIDO AUTOMÁTICO */}
      {showQuickPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-slate-900 text-left">
            <div className="border-b border-border pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" />
                Saldo Pendiente de Cobro
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                La factura tiene un saldo restante por registrar de **${remainingUsd.toFixed(2)} USD** / **{remainingBs.toFixed(2)} Bs.** Selecciona un método de pago rápido para completar la venta:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => handleQuickPayAndProcess("cash_usd")}
                className="w-full flex justify-between items-center px-4 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                <span>💵 Cobrar todo en Efectivo $</span>
                <span className="font-mono text-sm">${remainingUsd.toFixed(2)}</span>
              </button>

              <button
                onClick={() => handleQuickPayAndProcess("zelle")}
                className="w-full flex justify-between items-center px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                <span>💜 Cobrar todo en Zelle $</span>
                <span className="font-mono text-sm">${remainingUsd.toFixed(2)}</span>
              </button>

              <button
                onClick={() => handleQuickPayAndProcess("pago_movil")}
                className="w-full flex justify-between items-center px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                <span>📱 Cobrar todo en Pago Móvil Bs.</span>
                <span className="font-mono text-sm">{remainingBs.toFixed(2)} Bs.</span>
              </button>

              <button
                onClick={() => handleQuickPayAndProcess("pos")}
                className="w-full flex justify-between items-center px-4 py-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                <span>💳 Cobrar todo en Punto Bs.</span>
                <span className="font-mono text-sm">{remainingBs.toFixed(2)} Bs.</span>
              </button>

              <button
                onClick={() => handleQuickPayAndProcess("cash_bs")}
                className="w-full flex justify-between items-center px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                <span>🪙 Cobrar todo en Efectivo Bs.</span>
                <span className="font-mono text-sm">{remainingBs.toFixed(2)} Bs.</span>
              </button>
            </div>

            <div className="flex pt-2">
              <button
                type="button"
                onClick={() => setShowQuickPayModal(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold rounded-xl cursor-pointer text-xs uppercase tracking-wider text-center"
              >
                Cerrar y ajustar pago manualmente
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
                  Escáner QR Antifraude
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

    {/* Barra de Acción Flotante en Móvil (Para ir al Carrito/Pago rápidamente) */}
    {cart.length > 0 && mobileTab === "catalog" && (
      <div className="fixed bottom-4 left-4 right-4 z-40 xl:hidden bg-gradient-to-r from-slate-900 to-indigo-950 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/20 relative">
            <ShoppingCart className="w-4 h-4 text-white" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white font-mono text-[9px] font-extrabold flex items-center justify-center">
              {cart.length}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Acumulado</p>
            <p className="text-sm font-extrabold text-white">${totalUsd.toFixed(2)} / <span className="text-[10.5px] text-sky-400">{totalBs.toFixed(2)} Bs.</span></p>
          </div>
        </div>
        
        <button
          onClick={() => setMobileTab("cart")}
          className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white text-[11px] font-black rounded-xl uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-primary/20 cursor-pointer"
        >
          Pagar Ahora
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    )}

    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/context/AppContext";
import { 
  Share2, 
  MessageSquare, 
  Send, 
  Sparkles, 
  Calendar, 
  Phone, 
  ShoppingBag, 
  Cpu, 
  Check,
  RefreshCw,
  Plus,
  BarChart3,
  Heart,
  MessageCircle,
  Bookmark,
  Users,
  Eye,
  Info,
  ExternalLink,
  CheckCircle2,
  TrendingUp
} from "lucide-react";

// Icono personalizado de Instagram
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

interface ChatThread {
  id: string;
  client: string;
  source: "whatsapp" | "instagram";
  lastMsg: string;
  time: string;
  unread: boolean;
  messages: { sender: "client" | "user", text: string, time: string }[];
}

const initialChats: ChatThread[] = [
  {
    id: "c1",
    client: "Carlos Mendoza",
    source: "whatsapp",
    lastMsg: "Hola, ¿tienen disponibilidad de Harina PAN? ¿A qué tasa la reciben hoy?",
    time: "Hace 5m",
    unread: true,
    messages: [
      { sender: "client", text: "Buenas tardes, quisiera consultar precios.", time: "10:15 AM" },
      { sender: "user", text: "¡Hola! Bienvenidos a RegioBiz. ¿En qué producto estás interesado?", time: "10:17 AM" },
      { sender: "client", text: "Hola, ¿tienen disponibilidad de Harina PAN? ¿A qué tasa la reciben hoy?", time: "10:20 AM" },
    ]
  },
  {
    id: "c2",
    client: "Sofía Rodríguez",
    source: "instagram",
    lastMsg: "¡Me encanta el post del café gourmet! ¿Hacen envíos a Las Mercedes?",
    time: "Hace 15m",
    unread: true,
    messages: [
      { sender: "client", text: "¡Me encanta el post del café gourmet! ¿Hacen envíos a Las Mercedes?", time: "10:05 AM" },
    ]
  },
  {
    id: "c3",
    client: "Pedro Gómez",
    source: "whatsapp",
    lastMsg: "Perfecto, te paso el capture del Pago Móvil.",
    time: "Hace 2h",
    unread: false,
    messages: [
      { sender: "client", text: "Quisiera comprar 2 refrescos.", time: "8:30 AM" },
      { sender: "user", text: "Excelente Pedro, serian $3.60 o su equivalente a la tasa BCV de hoy.", time: "8:32 AM" },
      { sender: "client", text: "Perfecto, te paso el capture del Pago Móvil.", time: "8:35 AM" },
    ]
  }
];

interface MarketingProduct {
  code: string;
  name: string;
  priceUsd: number;
  stock: number;
}

const marketingProducts: MarketingProduct[] = [
  { code: "75910001", name: "Harina PAN 1kg", priceUsd: 1.20, stock: 150 },
  { code: "75910002", name: "Café Fama de América 250g", priceUsd: 2.50, stock: 8 },
  { code: "75910003", name: "Refresco Coca-Cola 2L", priceUsd: 1.80, stock: 120 },
  { code: "75910005", name: "Nutella 350g", priceUsd: 5.00, stock: 3 },
];

interface InstagramPost {
  id: string;
  caption: string;
  likes: number;
  comments: number;
  saves: number;
  reach: number;
  imageUrl: string;
  postedDate: string;
}

const initialPosts: InstagramPost[] = [
  {
    id: "p1",
    caption: "¡Café Fama de América ☕! El aroma que despierta a Venezuela. Disponible hoy en sucursal y con delivery rápido a toda Caracas. Pagos en USD y Bs. #CafeVenezolano #RegioBiz",
    likes: 412,
    comments: 89,
    saves: 45,
    reach: 3120,
    imageUrl: "☕",
    postedDate: "Ayer 09:00 AM"
  },
  {
    id: "p2",
    caption: "¡Tu Harina PAN de siempre 🌽! No te quedes sin hacer tus arepas calientes hoy. Recibimos Pago Móvil y efectivo al instante. ¡Consulta tasa oficial en bio! #HarinaPAN #DesayunoCriollo",
    likes: 310,
    comments: 112,
    saves: 78,
    reach: 2800,
    imageUrl: "🌽",
    postedDate: "Hace 3 días"
  },
  {
    id: "p3",
    caption: "🔥 SUPER PROMO SEMANAL 🔥: Nutella de 350g a precio inigualable de fábrica. ¡Pocas unidades en inventario! Escríbenos al directo para reservar tu frasco. #NutellaLovers #PromoCaracas",
    likes: 620,
    comments: 145,
    saves: 92,
    reach: 4500,
    imageUrl: "🍫",
    postedDate: "Hace 5 días"
  }
];

export default function RedesSocialesPage() {
  const { exchangeRate } = useApp();

  // Tab principal
  const [activeTab, setActiveTab] = useState<"analytics" | "inbox" | "creative">("analytics");

  // Chats
  const [chats, setChats] = useState<ChatThread[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState<string>("c1");
  const [replyText, setReplyText] = useState("");

  // Estados del generador IA
  const [selectedProductCode, setSelectedProductCode] = useState("75910001");
  const [aiTone, setAiTone] = useState("creative");
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyCopied, setCopyCopied] = useState(false);

  // Simulación de posts de Instagram
  const [posts, setPosts] = useState<InstagramPost[]>(initialPosts);
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
  const [instagramAccountConnected, setInstagramAccountConnected] = useState(true);

  // Mensaje chat activo
  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  // Enviar mensaje en chat simulado
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText) return;

    const newMsg = {
      sender: "user" as const,
      text: replyText,
      time: "Hace unos instantes"
    };

    setChats(chats.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          lastMsg: replyText,
          unread: false,
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));

    setReplyText("");
  };

  // Generador de Copy comercial asistido por IA (Bimonetario)
  const handleGenerateAICopy = () => {
    setGeneratingCopy(true);
    setCopyCopied(false);
    
    const prod = marketingProducts.find(p => p.code === selectedProductCode);
    if (!prod) return;

    const priceBs = prod.priceUsd * exchangeRate;
    
    setTimeout(() => {
      let copy = "";
      if (aiTone === "creative") {
        copy = `✨ ¡El sabor que nos une todos los días! ✨\n\nAdquiere hoy tu ${prod.name} al mejor precio del mercado.\n\n💵 Precio: $${prod.priceUsd.toFixed(2)}\n🇻🇪 Equivalente BCV: ${priceBs.toFixed(2)} Bs.\n\n🚀 ¡No te quedes sin el tuyo! Disponemos de ${prod.stock} unidades en stock.\n\nEscríbenos al privado para envíos rápidos a toda Caracas. 🛵💨 #RegioBiz #VentasVenezuela #HarinaPAN`;
      } else if (aiTone === "promotional") {
        copy = `🔥 ¡PROMO DE LA SEMANA EN REGIOBIZ! 🔥\n\nLlévate tu ${prod.name} fresco y al instante.\n\n💳 Formas de pago combinadas: Efectivo $, Pago Móvil, Punto de Venta o Zelle.\n\n💰 Precio Especial: $${prod.priceUsd.toFixed(2)} / ${priceBs.toFixed(2)} Bs. (Calculado a tasa oficial del día).\n\n⚠️ ¡Quedan pocas unidades en inventario! Escríbenos ya. 📲`;
      } else {
        copy = `📌 Catálogo RegioBiz: ${prod.name}\n\nDetalles del producto:\n• Precio base: $${prod.priceUsd.toFixed(2)}\n• Precio en bolívares: ${priceBs.toFixed(2)} Bs.\n• Estado de almacén: ${prod.stock} unidades listas.\n\nContamos con facturación fiscal para empresas. Consúltanos.`;
      }

      setGeneratedCopy(copy);
      setGeneratingCopy(false);
    }, 1200);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generatedCopy);
    setCopyCopied(true);
    setTimeout(() => setCopyCopied(false), 2000);
  };

  // Simulación de conectar/desconectar cuenta comercial
  const handleConnectInstagram = () => {
    setIsConnectingInstagram(true);
    setTimeout(() => {
      setInstagramAccountConnected(!instagramAccountConnected);
      setIsConnectingInstagram(false);
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Encabezado Principal Legible */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Hub de Redes Sociales & Marketing
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Supervisa estadísticas de Instagram en tiempo real, interactúa con tus clientes vía chat y genera contenido con Inteligencia Artificial.
          </p>
        </div>

        {/* Indicador de Estado de Conexión de API */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`w-2.5 h-2.5 rounded-full ${instagramAccountConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
            {instagramAccountConnected ? "Meta Graph API: Conectado" : "Meta Graph API: Desconectado"}
          </span>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN MODERNA */}
      <div className="flex bg-muted p-1.5 rounded-xl border border-border max-w-lg">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 py-2.5 px-3 text-center rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "analytics"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Instagram Analytics
        </button>
        <button
          onClick={() => setActiveTab("inbox")}
          className={`flex-1 py-2.5 px-3 text-center rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "inbox"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Bandeja de Entrada
          <span className="text-[8px] bg-red-500 text-white font-mono px-1.5 py-0.5 rounded-full">
            2
          </span>
        </button>
        <button
          onClick={() => setActiveTab("creative")}
          className={`flex-1 py-2.5 px-3 text-center rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "creative"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Redactor IA & Agenda
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN EL TAB ACTIVO */}
      
      {/* 1. INSTAGRAM ANALYTICS & INSIGHTS */}
      {activeTab === "analytics" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Tarjetas KPI de Redes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="premium-card p-5 bg-white relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Alcance Total (Vistas)</span>
                <h3 className="text-xl font-extrabold text-slate-900 font-mono mt-1">12,420</h3>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold mt-2">
                <TrendingUp className="w-3.5 h-3.5" />
                +18.4% vs semana anterior
              </div>
            </div>

            <div className="premium-card p-5 bg-white relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Seguidores Activos</span>
                <h3 className="text-xl font-extrabold text-slate-900 font-mono mt-1">3,450</h3>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold mt-2">
                <Users className="w-3.5 h-3.5" />
                +45 nuevos este mes
              </div>
            </div>

            <div className="premium-card p-5 bg-white relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Comentarios Recibidos</span>
                <h3 className="text-xl font-extrabold text-slate-900 font-mono mt-1">346</h3>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold mt-2">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                +9.2% de interacciones
              </div>
            </div>

            <div className="premium-card p-5 bg-white relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Tasa de Guardado (Saves)</span>
                <h3 className="text-xl font-extrabold text-slate-900 font-mono mt-1">215</h3>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-indigo-600 font-bold mt-2">
                <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
                Guardados por prospectos
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Gráfica de Vistas del Feed Semanal (7 Columnas) */}
            <div className="premium-card p-6 lg:col-span-7 space-y-6">
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Eye className="w-5 h-5 text-indigo-500" />
                    Vistas Diarias en Instagram (Impression Reach)
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">Historial del comportamiento de visualizaciones en la cuenta</p>
                </div>
              </div>

              {/* Gráfica SVG */}
              <div className="pt-2">
                <svg viewBox="0 0 500 150" className="w-full h-40 overflow-visible">
                  <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="140" x2="500" y2="140" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Curva de vistas */}
                  {/* Lun: 210, Mar: 450, Mie: 320, Jue: 580, Vie: 890, Sab: 1120, Dom: 750 */}
                  <path
                    d="M 30 130 L 100 100 L 170 115 L 240 85 L 310 60 L 380 30 L 450 70"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Nodos */}
                  {[210, 450, 320, 580, 890, 1120, 750].map((val, idx) => {
                    const x = 30 + idx * 70;
                    const y = 140 - (val / 1300 * 120);
                    const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
                    return (
                      <g key={idx}>
                        <circle cx={x} cy={y} r="4" fill="#ffffff" stroke="#a855f7" strokeWidth="2.5" />
                        <text x={x} y={y - 10} textAnchor="middle" fill="#701a75" className="text-[8px] font-mono font-extrabold">{val}</text>
                        <text x={x} y="152" textAnchor="middle" fill="#64748b" className="text-[9px] font-bold">{days[idx]}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* ¿Cómo se conecta a Instagram? Explicación de la API (5 Columnas) */}
            <div className="premium-card p-6 lg:col-span-5 space-y-4 flex flex-col justify-between bg-white border border-border">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-border pb-3">
                  <Info className="w-4.5 h-4.5 text-primary" />
                  ¿Cómo funciona la integración?
                </h3>
                
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Para obtener de forma real los datos de vistas, likes y comentarios, el sistema se conecta a los servidores de Meta mediante la <strong>Instagram Graph API</strong>.
                </p>

                <div className="space-y-2 text-[10px] text-slate-700 bg-muted/40 p-3 rounded-lg border border-border/80">
                  <p className="font-extrabold text-slate-900 uppercase tracking-wide">Paso a paso de la conexión:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 leading-relaxed">
                    <li>Se requiere una cuenta de <strong>Instagram Business</strong> vinculada a una Fanpage de Facebook.</li>
                    <li>Presionas el botón de enlace para autenticarte vía <strong>OAuth 2.0 (Facebook Login)</strong>.</li>
                    <li>Meta genera un <strong>Access Token</strong> que permite a RegioBiz consultar las estadísticas de tus posts.</li>
                  </ol>
                </div>

                <div className="text-[10px] text-slate-500 font-mono space-y-1 bg-slate-900 text-slate-200 p-2.5 rounded-lg border border-slate-800">
                  <p className="text-emerald-400 font-bold">// Llamada API de Meta:</p>
                  <p>GET /v19.0/me/insights?metric=impressions,reach</p>
                  <p>GET /v19.0/{`{post_id}`}/comments</p>
                </div>
              </div>

              {/* Botón de Enlace Real-Time */}
              <button
                onClick={handleConnectInstagram}
                disabled={isConnectingInstagram}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  instagramAccountConnected 
                    ? "bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-border" 
                    : "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white shadow-md hover:opacity-95"
                }`}
              >
                {isConnectingInstagram ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : instagramAccountConnected ? (
                  <>
                    Desconectar Instagram Business
                  </>
                ) : (
                  <>
                    Conectar con Instagram Business
                    <ExternalLink className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Listado de Posts de Instagram con Estadísticas detalladas */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Estadísticas Detalladas de Publicaciones del Feed</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((post) => (
                <div key={post.id} className="premium-card p-5 bg-white relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  {/* Cabecera del post */}
                  <div className="flex gap-3 justify-between items-start">
                    <div className="w-10 h-10 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-xl select-none shadow-sm">
                      {post.imageUrl}
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block font-mono font-bold uppercase">{post.postedDate}</span>
                      <span className="text-[8px] bg-pink-100 text-pink-700 border border-pink-200 font-extrabold px-1.5 py-0.5 rounded-md mt-1 inline-block uppercase tracking-wider">Feed Post</span>
                    </div>
                  </div>

                  {/* Cuerpo - Pie de foto */}
                  <p className="text-[11px] text-slate-700 line-clamp-3 mt-3 leading-relaxed">
                    {post.caption}
                  </p>

                  {/* Desglose de Interacciones (Likes, Comments, Saves, Views) */}
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border mt-4 text-[10px] font-bold text-slate-700 font-mono text-center">
                    <div className="bg-muted/40 p-1.5 rounded-lg border border-border/60">
                      <Heart className="w-3.5 h-3.5 text-rose-500 mx-auto mb-1" />
                      {post.likes}
                    </div>
                    <div className="bg-muted/40 p-1.5 rounded-lg border border-border/60">
                      <MessageCircle className="w-3.5 h-3.5 text-sky-500 mx-auto mb-1" />
                      {post.comments}
                    </div>
                    <div className="bg-muted/40 p-1.5 rounded-lg border border-border/60">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-500 mx-auto mb-1" />
                      {post.saves}
                    </div>
                    <div className="bg-muted/40 p-1.5 rounded-lg border border-border/60">
                      <Eye className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
                      {post.reach}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 2. INBOX UNIFICADO DE CLIENTES (CHAT) */}
      {activeTab === "inbox" && (
        <div className="premium-card overflow-hidden flex flex-col md:flex-row h-[550px] border border-border bg-white shadow-xl animate-in fade-in duration-200">
          
          {/* Columna Izquierda: Hilos de conversación */}
          <div className="w-full md:w-80 border-r border-border flex flex-col h-1/2 md:h-full flex-shrink-0 bg-white">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Inbox Unificado</span>
              <span className="text-[9px] bg-red-100 border border-red-200 text-red-600 font-mono px-2 py-0.5 rounded-full font-bold">
                {chats.filter(c => c.unread).length} sin leer
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    // Marcar como leído
                    setChats(chats.map(c => c.id === chat.id ? { ...c, unread: false } : c));
                  }}
                  className={`w-full p-4 text-left flex items-start gap-3 transition-all cursor-pointer ${
                    activeChatId === chat.id ? "bg-emerald-50/70 border-l-4 border-emerald-500" : "hover:bg-slate-50"
                  }`}
                >
                  <div className={`p-2 rounded-xl flex-shrink-0 border ${
                    chat.source === "whatsapp" 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                      : "bg-pink-50 text-pink-600 border-pink-200"
                  }`}>
                    {chat.source === "whatsapp" ? <Phone className="w-4 h-4" /> : <InstagramIcon className="w-4 h-4" />}
                  </div>
                  
                  <div className="overflow-hidden flex-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-xs font-black text-slate-800 truncate">{chat.client}</h4>
                      <span className="text-[8px] text-slate-400 font-mono font-bold uppercase">{chat.time}</span>
                    </div>
                    <p className={`text-[11px] mt-1 truncate ${chat.unread ? "text-slate-900 font-extrabold" : "text-slate-500"}`}>
                      {chat.lastMsg}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Columna Derecha: Chat Activo */}
          <div className="flex-1 flex flex-col h-1/2 md:h-full bg-slate-50/40">
            {/* Header del Chat */}
            <div className="p-4 border-b border-border bg-white flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900">{activeChat.client}</h4>
                <p className="text-[9px] text-slate-500 capitalize flex items-center gap-1.5 mt-0.5 font-bold uppercase tracking-wider">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeChat.source === "whatsapp" ? "bg-emerald-500" : "bg-pink-500"}`} />
                  Conectado vía {activeChat.source}
                </p>
              </div>
            </div>

            {/* Mensajes del Chat */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
              {activeChat.messages.map((msg, idx) => {
                const isMe = msg.sender === "user";
                return (
                  <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] p-3 rounded-2xl text-xs space-y-1 shadow-sm ${
                      isMe 
                        ? "bg-primary text-white rounded-tr-none" 
                        : "bg-white text-slate-800 border border-border rounded-tl-none"
                    }`}>
                      <p className="leading-relaxed font-medium">{msg.text}</p>
                      <p className={`text-[8px] text-right font-mono ${isMe ? "text-indigo-100" : "text-slate-400"}`}>{msg.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Envío de Mensaje */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-white flex gap-2">
              <input
                type="text"
                placeholder="Escribe una respuesta para el cliente..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="submit"
                className="p-2.5 bg-primary hover:bg-indigo-600 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      )}

      {/* 3. REDACTOR COMERCIAL IA & AGENDA EDITORIAL */}
      {activeTab === "creative" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-200">
          
          {/* Creador de copys */}
          <div className="premium-card p-6 xl:col-span-7 bg-white space-y-6">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                Redactor Comercial IA (Bimonetario)
              </h3>
              <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono px-2.5 py-0.5 rounded-full font-bold">
                GenAI
              </span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Selección de Producto */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase block tracking-wider">Seleccionar Producto Catalogo</label>
                <select
                  value={selectedProductCode}
                  onChange={(e) => setSelectedProductCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary cursor-pointer capitalize"
                >
                  {marketingProducts.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.name} (${p.priceUsd.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selección de Tono */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase block tracking-wider">Tono del Copywriter</label>
                <div className="grid grid-cols-3 gap-2 bg-muted/60 p-1.5 rounded-xl border border-border">
                  <button
                    onClick={() => setAiTone("creative")}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      aiTone === "creative" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Creativo
                  </button>
                  <button
                    onClick={() => setAiTone("promotional")}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      aiTone === "promotional" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Promocional
                  </button>
                  <button
                    onClick={() => setAiTone("formal")}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      aiTone === "formal" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Formal
                  </button>
                </div>
              </div>

              <button
                onClick={handleGenerateAICopy}
                disabled={generatingCopy}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all cursor-pointer text-xs uppercase tracking-wider"
              >
                {generatingCopy ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Cpu className="w-4 h-4 text-white" />
                )}
                Redactar Copy Asistido por IA
              </button>

              {/* Visualizador de Copy Generado */}
              {generatedCopy && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <textarea
                    value={generatedCopy}
                    onChange={(e) => setGeneratedCopy(e.target.value)}
                    rows={8}
                    className="w-full p-3.5 bg-white border border-border rounded-xl text-slate-800 font-mono leading-relaxed focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-xs"
                  />
                  <button
                    onClick={handleCopyText}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    {copyCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    {copyCopied ? "¡Copiado al Portapapeles!" : "Copiar Texto para Publicar"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Agenda semanal de contenidos */}
          <div className="premium-card p-6 xl:col-span-5 bg-white space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-border pb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-pink-500" />
              Calendario Editorial Semanal
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-border">
                <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold rounded text-[9px] uppercase font-mono">
                  Hoy
                </span>
                <div>
                  <p className="font-extrabold text-slate-900">Post de Café Fama de América (Instagram Feed)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Incluir tasa del día BCV: {exchangeRate.toFixed(2)} Bs.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-border">
                <span className="px-2 py-1 bg-slate-100 border border-border text-slate-500 font-bold rounded text-[9px] uppercase font-mono font-bold">
                  Mañana
                </span>
                <div>
                  <p className="font-extrabold text-slate-900">Historia de Stock de Nutella en Oferta (Instagram Stories)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Simular cupos limitados en el POS.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-border">
                <span className="px-2 py-1 bg-slate-100 border border-border text-slate-500 font-bold rounded text-[9px] uppercase font-mono font-bold">
                  Jueves
                </span>
                <div>
                  <p className="font-extrabold text-slate-900">Difusión de Combos Alimenticios (WhatsApp Broad)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Publicar precios netos en divisas y equivalentes.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

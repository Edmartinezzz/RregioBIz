"use client";

import React, { useState } from "react";
import { useApp, UserRole } from "@/lib/context/AppContext";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles, DollarSign } from "lucide-react";

export default function LoginPage() {
  const { login, user, loading: sessionLoading } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirigir al dashboard de forma automática si ya hay una sesión activa
  React.useEffect(() => {
    if (!sessionLoading && user) {
      router.push("/dashboard");
    }
  }, [user, sessionLoading, router]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Por favor ingresa tu usuario o correo electrónico corporativo");
      return;
    }

    const isMaster = email.toLowerCase() === "carlosmtinez" || email.toLowerCase() === "carlosmtinez321@gmail.com";

    if (!isMaster && (!password || password.length < 6)) {
      setError("La contraseña de seguridad debe tener al menos 6 caracteres");
      return;
    }

    if (isMaster && password !== "2002278") {
      setError("Contraseña incorrecta para el acceso de Super-Usuario");
      return;
    }

    setLoading(true);

    // Determinar rol de forma inteligente según el correo corporativo (Active Directory Simulation)
    let resolvedRole: UserRole = "vendedor";
    const emailLower = email.toLowerCase();
    
    if (emailLower.includes("carlos") || emailLower.includes("alejandra") || emailLower.includes("admin") || emailLower.includes("directora")) {
      resolvedRole = "admin";
    } else if (emailLower.includes("isabella") || emailLower.includes("marketing") || emailLower.includes("promo")) {
      resolvedRole = "marketing";
    } else if (emailLower.includes("valentina") || emailLower.includes("vendedor") || emailLower.includes("caja")) {
      resolvedRole = "vendedor";
    }

    // Simular un retardo de red corto para efectos visuales premium de autenticación SSL
    setTimeout(() => {
      const success = login(email, resolvedRole);
      setLoading(false);
      if (success) {
        router.push("/dashboard");
      } else {
        setError("Credenciales inválidas o cuenta inactiva");
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f4fcf8] animate-in fade-in duration-300">
      
      {/* COLUMNA IZQUIERDA: ILUSTRACIÓN CRISP & MENSAJES DE INSPIRACIÓN (Oculta en móviles, 60% en Desktop) */}
      <div className="hidden md:flex md:w-3/5 relative bg-slate-900 justify-center items-center overflow-hidden">
        
        {/* Imagen de Fondo de Oficina en Calidad Original (Sin difuminar) */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-10000 hover:scale-105"
          style={{ backgroundImage: "url('/login-bg.jpg')" }}
        />
        
        {/* Capa de tinte oscuro para dar contraste elegante al texto blanco */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/40 to-slate-950/20" />

        {/* Contenido Inspiracional */}
        <div className="relative z-10 max-w-xl p-12 text-white space-y-6 animate-in slide-in-from-left duration-500">
          
          <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.25em] text-emerald-400 bg-emerald-950/75 px-3.5 py-1.5 rounded-full border border-emerald-500/20">
            <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
            Tecnología Bimonetaria Inteligente
          </span>
          
          <h2 className="text-4xl font-black leading-tight tracking-tight drop-shadow-md">
            Impulsando el crecimiento comercial de tu negocio en Venezuela.
          </h2>
          
          <p className="text-sm text-slate-200 leading-relaxed font-semibold drop-shadow-sm border-l-2 border-emerald-500 pl-4 py-1 italic">
            "El éxito comercial no solo se trata de registrar ventas, sino de optimizar cada cierre de caja, auditar las tasas en tiempo real y empoderar a tu equipo para tomar decisiones estratégicas."
          </p>

          <div className="pt-4 flex gap-8 text-xs font-bold text-slate-300">
            <div>
              <p className="text-white text-base font-extrabold">100%</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Transparencia Fiscal</p>
            </div>
            <div>
              <p className="text-white text-base font-extrabold">Instantáneo</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Arqueo Bimonetario</p>
            </div>
            <div>
              <p className="text-white text-base font-extrabold">Seguro</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Control de Permisos</p>
            </div>
          </div>

        </div>

        {/* Marca de agua sutil abajo */}
        <div className="absolute bottom-6 left-12 text-[10px] text-slate-400 font-bold uppercase tracking-widest z-10">
          Alejandra POS & CRM Center © 2026
        </div>

      </div>

      {/* COLUMNA DERECHA: AREA DE LOGIN REAL (100% en móviles, 40% en Desktop) */}
      <div className="w-full md:w-2/5 flex items-center justify-center p-6 sm:p-12 bg-[#f4fcf8]">
        
        <div className="w-full max-w-sm space-y-6">
          
          {/* Cabecera / Branding sin logotipo de caja, con tipografía premium */}
          <div className="text-center md:text-left flex flex-col items-center md:items-start mb-2">
            <h1 className="text-4xl tracking-widest text-slate-900 font-light select-none">
              Regio<span className="font-extrabold text-primary">Biz</span>
            </h1>
            <p className="text-[9px] text-slate-500 font-bold mt-1.5 uppercase tracking-[0.2em]">
              Sistema Central de Ventas e Inventario
            </p>
          </div>

          {/* Tarjeta de Login Real Premium */}
          <div className="premium-card p-6 sm:p-8 relative overflow-hidden bg-white shadow-xl">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-primary via-emerald-400 to-indigo-600" />
            
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 border-b border-border pb-3">
              Iniciar Sesión
            </h2>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2 font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              
              {/* Campo Correo */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase block tracking-wider">Correo Electrónico</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alejandra@regiobiz.com"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono"
                    required
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-600 uppercase block tracking-wider">Contraseña</label>
                  <a href="#" className="text-[10px] text-primary font-bold hover:underline transition-all uppercase tracking-wider">¿Olvidaste tu clave?</a>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono"
                    required
                  />
                </div>
              </div>

              {/* Mensaje de Seguridad */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                Acceso restringido para personal autorizado
              </div>

              {/* Botón de Entrada */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all uppercase tracking-wider group cursor-pointer text-xs"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Autenticar e Ingresar
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer legal simulado */}
          <p className="text-center text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Conexión Segura SSL
          </p>
        </div>
      </div>
    </div>
  );
}

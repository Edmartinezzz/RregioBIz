"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/context/AppContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { 
  Package, 
  Plus, 
  Search, 
  AlertCircle, 
  TrendingUp, 
  DollarSign, 
  Layers,
  Lock,
  Check,
  X,
  ShieldCheck,
  Tag,
  Download,
  Upload,
  Trash2
} from "lucide-react";

interface ProductItem {
  id: string;
  code: string;
  name: string;
  category: string;
  costUsd: number;
  priceUsd: number;
  stock: number;
  taxCategory: "exempt" | "iva_16";
}

const initialProducts: ProductItem[] = [];

export default function InventarioPage() {
  const { user, exchangeRate, hasPermission } = useApp();
  
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);

  // Cargar inventario desde Supabase o LocalStorage (específico para el inquilino)
  useEffect(() => {
    if (!user) return;
    const tenantId = user.tenantId || "default";

    if (isSupabaseConfigured()) {
      const fetchSupabaseProducts = async () => {
        try {
          const { data, error } = await supabase!
            .from("products")
            .select("*")
            .eq("tenant_id", tenantId);
          if (data && !error) {
            const mapped: ProductItem[] = data.map((p: any) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              category: p.category.charAt(0).toUpperCase() + p.category.slice(1),
              costUsd: Number(p.cost_usd),
              priceUsd: Number(p.price_usd),
              stock: Number(p.stock),
              taxCategory: "exempt"
            }));
            setProducts(mapped);
          }
        } catch (err) {
          console.error("Error al cargar inventario de Supabase:", err);
        }
      };
      fetchSupabaseProducts();
    } else {
      const saved = localStorage.getItem(`regiobiz_products_${tenantId}`);
      if (saved) {
        try {
          setProducts(JSON.parse(saved));
        } catch (e) {
          setProducts([]);
        }
      } else {
        setProducts([]);
      }
    }
  }, [user]);

  // Persistir en localstorage cuando cambie el inventario (específico para el inquilino)
  useEffect(() => {
    if (!user) return;
    const tenantId = user.tenantId || "default";
    if (!isSupabaseConfigured()) {
      localStorage.setItem(`regiobiz_products_${tenantId}`, JSON.stringify(products));
    }
  }, [products, user]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Formulario de Producto Nuevo (Solo Directora)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCategory, setNewCategory] = useState("Alimentos");
  const [newCost, setNewCost] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newTax, setNewTax] = useState<"exempt" | "iva_16">("exempt");

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCode || !newPrice || !newStock) return;

    const newItem: ProductItem = {
      id: `p${products.length + 1}`,
      code: newCode,
      name: newName,
      category: newCategory,
      costUsd: parseFloat(newCost) || 0,
      priceUsd: parseFloat(newPrice),
      stock: parseInt(newStock),
      taxCategory: newTax
    };

    setProducts([newItem, ...products]);
    setShowAddModal(false);

    // Sincronizar con Supabase si está disponible
    if (isSupabaseConfigured()) {
      try {
        const tenantId = user?.tenantId || "default";
        await supabase!
          .from("products")
          .upsert({
            id: `${tenantId}_${newCode}`,
            tenant_id: tenantId,
            code: newCode,
            name: newName,
            category: newCategory.toLowerCase(),
            cost_usd: parseFloat(newCost) || 0,
            price_usd: parseFloat(newPrice),
            stock: parseInt(newStock),
            tax_category: newTax
          });
      } catch (err) {
        console.error("Error al sincronizar producto con Supabase:", err);
      }
    }
    
    // Limpiar campos
    setNewName("");
    setNewCode("");
    setNewCost("");
    setNewPrice("");
    setNewStock("");
  };

  // Descargar Plantilla CSV para Importación Masiva
  const downloadCSVTemplate = () => {
    const headers = "codigo,nombre,precio_usd,costo_usd,stock,categoria\n";
    const sample = "75910007,Harina de Maiz Kel 1kg,1.35,0.95,60,alimentos\n75910008,Mantequilla Mavesa 500g,2.20,1.45,40,alimentos\n";
    const blob = new Blob([headers + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "plantilla_inventario_regiobiz.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Importar Productos en Lote desde CSV o Excel XLSX (Mapeador Inteligente y Multidelimitador)
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress("Cargando y analizando hoja de cálculo...");

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isExcel = fileExtension === "xlsx" || fileExtension === "xls";

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        let headers: string[] = [];
        let rows: any[][] = [];

        if (isExcel) {
          setUploadProgress("Leyendo formato binario Excel y analizando hojas...");
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
          
          if (jsonRows.length < 2) {
            alert("El archivo Excel está vacío o no contiene filas de datos.");
            setIsUploading(false);
            setUploadProgress("");
            return;
          }

          setUploadProgress("Mapeando encabezados semánticos de Excel...");
          headers = jsonRows[0].map((h: any) => String(h || "").toLowerCase().trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " "));
          
          for (let i = 1; i < jsonRows.length; i++) {
            rows.push(jsonRows[i] || []);
          }
        } else {
          // Leer formato CSV
          const text = evt.target?.result as string;
          const lines = text.split(/\r?\n/);
          if (lines.length < 2) {
            alert("El archivo CSV está vacío o no contiene filas de datos.");
            return;
          }

          // Detectar delimitador automáticamente (Excel en español usa punto y coma ';')
          const firstLine = lines[0];
          const commaCount = (firstLine.match(/,/g) || []).length;
          const semicolonCount = (firstLine.match(/;/g) || []).length;
          const delimiter = semicolonCount > commaCount ? ";" : ",";

          headers = firstLine.toLowerCase().split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " "));
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            rows.push(line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, "")));
          }
        }

        // Smart Header Index Mapping
        let codeIdx = -1;
        let nameIdx = -1;
        let priceIdx = -1;
        let costIdx = -1;
        let stockIdx = -1;
        let categoryIdx = -1;

        const synonyms = {
          code: ["codigo", "code", "barcode", "barras", "codigo_de_barra", "codigo_de_barras", "codigo de barra", "codigo de barras", "upc", "sku", "id", "codigo", "clave"],
          name: ["nombre", "name", "descripcion", "descripcion", "producto", "product", "articulo", "articulo", "titulo", "titulo", "detalle"],
          price: ["precio", "price", "precio_usd", "price_usd", "precio_venta", "pvp", "venta", "precio de venta", "precio venta", "valor"],
          cost: ["costo", "cost", "costo_usd", "cost_usd", "costo_compra", "compra", "costo compra"],
          stock: ["stock", "cantidad", "existencia", "inventario", "cantidad existente", "cantidad_existente", "qty", "cant", "unidades"],
          category: ["categoria", "category", "categoria", "departamento", "depto", "grupo", "rubro", "tipo"]
        };

        headers.forEach((h, idx) => {
          // Normalizar quitando acentos y caracteres especiales
          const cleanH = h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          
          if (synonyms.code.some(s => cleanH.includes(s) || s.includes(cleanH))) codeIdx = idx;
          else if (synonyms.name.some(s => cleanH.includes(s) || s.includes(cleanH))) nameIdx = idx;
          else if (synonyms.price.some(s => cleanH.includes(s) || s.includes(cleanH))) priceIdx = idx;
          else if (synonyms.cost.some(s => cleanH.includes(s) || s.includes(cleanH))) costIdx = idx;
          else if (synonyms.stock.some(s => cleanH.includes(s) || s.includes(cleanH))) stockIdx = idx;
          else if (synonyms.category.some(s => cleanH.includes(s) || s.includes(cleanH))) categoryIdx = idx;
        });

        // Intentar mapeo directo secundario por concordancia exacta si quedaron pendientes
        headers.forEach((h, idx) => {
          if (h === "codigo" || h === "code" || h === "sku") { if (codeIdx === -1) codeIdx = idx; }
          else if (h === "nombre" || h === "name" || h === "producto") { if (nameIdx === -1) nameIdx = idx; }
          else if (h === "precio_usd" || h === "price" || h === "precio") { if (priceIdx === -1) priceIdx = idx; }
          else if (h === "costo_usd" || h === "cost" || h === "costo") { if (costIdx === -1) costIdx = idx; }
          else if (h === "stock" || h === "cantidad" || h === "qty") { if (stockIdx === -1) stockIdx = idx; }
          else if (h === "categoria" || h === "category" || h === "categoría") { if (categoryIdx === -1) categoryIdx = idx; }
        });

        // Si no se encuentra al menos nombre y código, alertar
        if (codeIdx === -1 || nameIdx === -1) {
          alert("No se pudo detectar automáticamente las columnas de 'Código de Barra' o 'Nombre' en el archivo. Por favor verifica los encabezados de tu Excel.");
          return;
        }

        const parsedProducts: ProductItem[] = [];
        const dbRowsToSync: any[] = [];
        const seenCodes = new Set<string>();

        for (let i = 0; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length === 0) continue;
          
          const code = (codeIdx !== -1 && cols[codeIdx] !== undefined) ? String(cols[codeIdx]).trim() : "";
          if (!code || seenCodes.has(code)) continue; // Evitar duplicados en el lote
          seenCodes.add(code);
          const name = (nameIdx !== -1 && cols[nameIdx] !== undefined) ? String(cols[nameIdx]).trim() : "";
          
          const rawPrice = (priceIdx !== -1 && cols[priceIdx] !== undefined) ? String(cols[priceIdx]).trim() : "0";
          const rawCost = (costIdx !== -1 && cols[costIdx] !== undefined) ? String(cols[costIdx]).trim() : "0";
          const rawStock = (stockIdx !== -1 && cols[stockIdx] !== undefined) ? String(cols[stockIdx]).trim() : "0";
          const category = (categoryIdx !== -1 && cols[categoryIdx] !== undefined) ? String(cols[categoryIdx]).trim() : "Alimentos";

          const price = parseFloat(rawPrice.replace(",", ".")) || 0;
          const cost = parseFloat(rawCost.replace(",", ".")) || 0;
          const stock = parseInt(rawStock) || 0;

          if (code && name) {
            const newId = `p_csv_${code}_${Math.random().toString(36).substring(2, 6)}`;
            parsedProducts.push({
              id: newId,
              code,
              name,
              category: category.charAt(0).toUpperCase() + category.slice(1),
              costUsd: isNaN(cost) ? 0 : cost,
              priceUsd: isNaN(price) ? 0 : price,
              stock: isNaN(stock) ? 0 : stock,
              taxCategory: "exempt"
            });

            const tenantId = user?.tenantId || "default";
            dbRowsToSync.push({
              id: `${tenantId}_${code}`,
              tenant_id: tenantId,
              code,
              name,
              category: category.toLowerCase(),
              cost_usd: isNaN(cost) ? 0 : cost,
              price_usd: isNaN(price) ? 0 : price,
              stock: isNaN(stock) ? 0 : stock,
              tax_category: "exempt"
            });
          }
        }

        if (parsedProducts.length > 0) {
          setProducts((prev) => {
            const filtered = prev.filter(p => !parsedProducts.some(newP => newP.code === p.code));
            return [...parsedProducts, ...filtered];
          });

          if (isSupabaseConfigured()) {
            setUploadProgress(`Sincronizando ${parsedProducts.length} productos con la base de datos de Supabase (por lotes)...`);
            let hasError = false;
            let lastErrorMessage = "";
            const chunkSize = 500;
            
            for (let i = 0; i < dbRowsToSync.length; i += chunkSize) {
              const chunk = dbRowsToSync.slice(i, i + chunkSize);
              const { error } = await supabase!
                .from("products")
                .upsert(chunk, { onConflict: "id" });
              
              if (error) {
                console.error(`Error en chunk ${i}-${i + chunkSize}:`, error);
                hasError = true;
                lastErrorMessage = error.message || JSON.stringify(error);
                break;
              }
            }

            if (hasError) {
              alert(`Error al sincronizar con Supabase: ${lastErrorMessage}\n\nPor favor envíame una captura de este mensaje para arreglarlo.`);
            } else {
              alert(`¡Espectacular! Se importaron ${parsedProducts.length} productos con éxito y se subieron a Supabase.`);
            }
          } else {
            alert(`¡Importación exitosa! Se cargaron ${parsedProducts.length} productos localmente en el Sandbox.`);
          }
        } else {
          alert("No se encontraron productos válidos para importar en el archivo.");
        }
        setIsUploading(false);
        setUploadProgress("");
      } catch (err) {
        console.error("Error al procesar el archivo:", err);
        alert("Ocurrió un error al leer el archivo. Verifica el formato e inténtalo de nuevo.");
        setIsUploading(false);
        setUploadProgress("");
      }
    };

    reader.onerror = () => {
      alert("Hubo un error de lectura del archivo.");
      setIsUploading(false);
      setUploadProgress("");
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Borrar todo el inventario de esta empresa
  const handleClearInventory = async () => {
    if (!user) return;
    const confirmDelete = window.confirm(
      "¿ESTÁS COMPLETAMENTE SEGURO? Esta acción eliminará permanentemente todo el inventario de tu empresa en Supabase y localmente. Esta acción no se puede deshacer."
    );
    if (!confirmDelete) return;

    const confirmText = window.prompt("Por seguridad, escribe 'BORRAR INVENTARIO' para confirmar:");
    if (confirmText !== "BORRAR INVENTARIO") {
      alert("Confirmación incorrecta. No se borró el inventario.");
      return;
    }

    const tenantId = user.tenantId || "default";
    
    // 1. Limpiar estado
    setProducts([]);

    // 2. Limpiar LocalStorage
    localStorage.removeItem(`regiobiz_products_${tenantId}`);

    // 3. Limpiar Supabase
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase!
          .from("products")
          .delete()
          .like("code", `${tenantId}_%`);
        if (error) {
          console.error("Error al borrar inventario en Supabase:", error);
          alert("Inventario local eliminado, pero hubo un error al sincronizar con Supabase.");
        } else {
          alert("¡Espectacular! Todo el inventario de tu empresa ha sido borrado permanentemente.");
        }
      } catch (err) {
        console.error("Error en conexión de Supabase:", err);
      }
    } else {
      alert("¡Sandbox local restablecido! Todo el inventario de tu empresa ha sido borrado.");
    }
  };

  // Filtrar productos por búsqueda y categoría
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.includes(searchTerm);
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Categorías de productos únicas
  const categories = ["all", ...Array.from(new Set(products.map(p => p.category)))];

  // Comprobar si el usuario tiene permiso para ver costos (Solo Admin/Directora)
  const canSeeCosts = user?.role === "admin";
  const canModify = hasPermission("inventario", "crear");

  // Selector visual de iconos según categoría
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "alimentos":
        return <Package className="w-5 h-5 text-emerald-600" />;
      case "bebidas":
        return <Layers className="w-5 h-5 text-sky-600" />;
      case "lácteos":
        return <TrendingUp className="w-5 h-5 text-amber-600" />;
      case "dulces":
        return <Tag className="w-5 h-5 text-purple-600" />;
      default:
        return <Package className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Control de Inventario
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Administra existencias, costos y precios bimonetarios calculados a la tasa del día.
          </p>
        </div>

        {/* Botones de Acción de Inventario Masivo */}
        {canModify && (
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Descargar Plantilla */}
            <button
              onClick={downloadCSVTemplate}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-border hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer select-none"
              title="Descargar Plantilla CSV"
            >
              <Download className="w-4 h-4 text-primary" />
              Plantilla CSV
            </button>

            {/* Subir Archivo */}
            <label className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer select-none">
              <Upload className="w-4 h-4 text-emerald-600" />
              Importar Excel / CSV
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleCSVImport}
                className="hidden"
              />
            </label>

            {/* Añadir Producto Manual */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer select-none"
            >
              <Plus className="w-4 h-4" />
              Añadir Producto
            </button>

            {/* Borrar Todo el Inventario */}
            {canSeeCosts && (
              <button
                onClick={handleClearInventory}
                className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 hover:bg-red-100 text-red-800 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer select-none"
                title="Borrar Todo el Inventario"
              >
                <Trash2 className="w-4.5 h-4.5 text-red-600 animate-pulse" />
                Borrar Inventario
              </button>
            )}
          </div>
        )}
      </div>

      {/* SECCIÓN DE BÚSQUEDA Y FILTROS INTERACTIVOS */}
      <div className="space-y-4">
        
        {/* Caja de Búsqueda Full Width */}
        <div className="premium-card p-3.5 flex items-center gap-3 w-full">
          <Search className="w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código de barra, SKU o nombre de producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs text-slate-900 placeholder-slate-400 focus:ring-0"
          />
        </div>

        {/* Pestañas de Navegación por Categoría */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer capitalize select-none whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "bg-slate-950 border-slate-950 text-white shadow-md shadow-slate-900/10 scale-102"
                    : "bg-white border-border hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                {cat === "all" ? "Todos los Productos" : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* CATÁLOGO DE PRODUCTOS EN CUADRÍCULA MODERNA (FLAT & HIGH CONTRAST) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => {
          const priceBs = product.priceUsd * exchangeRate;
          const margin = canSeeCosts ? ((product.priceUsd - product.costUsd) / product.priceUsd * 100).toFixed(0) : "";
          const isLowStock = product.stock <= 10;
          
          return (
            <div 
              key={product.id} 
              className="premium-card premium-card-hover p-6 flex flex-col justify-between space-y-4"
            >
              {/* Parte Superior: Icono de Categoría & Stock Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-muted border border-border flex items-center justify-center">
                    {getCategoryIcon(product.category)}
                  </div>
                  <div>
                    <span className="text-[10px] bg-muted border border-border text-slate-600 font-mono px-2 py-0.5 rounded">
                      {product.code}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold block mt-1 uppercase tracking-wider">
                      {product.category}
                    </span>
                  </div>
                </div>
                
                {/* Badge de Stock */}
                <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-1 rounded-xl uppercase tracking-wider ${
                  isLowStock 
                    ? "bg-red-50 text-red-600 border border-red-200 animate-pulse"
                    : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                }`}>
                  {isLowStock ? "Bajo Stock" : "Suficiente"}
                </span>
              </div>

              {/* Parte Media: Nombre del Producto (Legible e Impactante) */}
              <div className="space-y-1.5">
                <h3 className="text-md font-extrabold text-emerald-800 line-clamp-1">
                  {product.name}
                </h3>
                
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span className={`px-1.5 py-0.5 rounded ${
                    product.taxCategory === "exempt" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
                  }`}>
                    {product.taxCategory === "exempt" ? "Exento" : "IVA 16%"}
                  </span>
                  {canSeeCosts && (
                    <span className="text-emerald-600 font-mono">
                      Margen: +{margin}%
                    </span>
                  )}
                </div>
              </div>

              {/* Parte Inferior: Desglose de Precios Bimonetarios y Existencias */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                
                {/* Precio de Venta */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Precio Venta</span>
                  <div className="space-y-0.5">
                    <p className="text-base font-extrabold text-usd font-mono">
                      ${product.priceUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] font-bold text-bs font-mono">
                      {priceBs.toFixed(2)} Bs.
                    </p>
                  </div>
                </div>

                {/* Stock Numérico */}
                <div className="space-y-1 text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Existencia</span>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {product.stock}
                  </p>
                  {canSeeCosts ? (
                    <p className="text-[9px] font-bold text-slate-500 font-mono">
                      Costo: ${product.costUsd.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-[9px] font-bold text-slate-400 flex items-center justify-end gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Cifrado
                    </p>
                  )}
                </div>

              </div>

            </div>
          );
        })}
      </div>

      {/* SECCIÓN ADVERTENCIA PARA ROLES NO ADMINISTRADORES */}
      {!canSeeCosts && (
        <div className="p-4 rounded-xl bg-white border border-border flex items-center gap-3 text-xs text-slate-600">
          <Lock className="w-4 h-4 text-primary flex-shrink-0" />
          <p>
            Los costos de fábrica, proveedores y márgenes de ganancia se encuentran **cifrados y ocultos** de la vista pública debido a la matriz de permisos para los roles de Ventas y Marketing.
          </p>
        </div>
      )}

      {/* MODAL DE AGREGAR PRODUCTO (Solo Directora) */}
      {showAddModal && canModify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="premium-card w-full max-w-md p-6 space-y-6 relative border border-primary/30 bg-white">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Nuevo Producto de Inventario
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase block">Código SKU</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="7591000..."
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase block">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Alimentos">Alimentos</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Lácteos">Lácteos</option>
                    <option value="Dulces">Dulces</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold uppercase block">Nombre Comercial</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Café molido gourmet 250g..."
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase block">Costo USD ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase block">Precio USD ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase block">Cantidad</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-slate-600 font-bold uppercase block">Impuestos</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-slate-700 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="newTax"
                      checked={newTax === "exempt"}
                      onChange={() => setNewTax("exempt")}
                      className="text-primary focus:ring-0"
                    />
                    Exento (Cesta Básica)
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-700 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="newTax"
                      checked={newTax === "iva_16"}
                      onChange={() => setNewTax("iva_16")}
                      className="text-primary focus:ring-0"
                    />
                    IVA Gravado (16%)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-border hover:bg-slate-50 text-slate-600 font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-primary hover:bg-indigo-600 text-white font-bold rounded-lg cursor-pointer"
                >
                  Registrar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ventana de Carga de Importación Premium (Glassmorphism Overlay) */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-xl border border-white/20 p-8 rounded-2xl max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-200">
            {/* Concentric Modern Rotating Glow Spinner */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                Importando Inventario Real
              </h3>
              <p className="text-xs text-slate-600 font-bold px-2 leading-relaxed animate-pulse">
                {uploadProgress}
              </p>
            </div>

            <span className="text-[10px] text-primary font-extrabold tracking-widest uppercase bg-indigo-50 px-3 py-1 rounded-xl">
              RegioBiz ERP SaaS
            </span>
          </div>
        </div>
      )}

    </div>
  );
}

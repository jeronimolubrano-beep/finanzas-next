# Documentación: finanzas-next

**Sistema de gestión financiera para Grupo Lubrano — un family office argentino con 4 empresas**

---

## 📋 Tabla de contenidos

1. [Visión General](#visión-general)
2. [Problema que resuelve](#problema-que-resuelve)
3. [Características principales](#características-principales)
4. [Arquitectura técnica](#arquitectura-técnica)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Flujo de datos](#flujo-de-datos)
7. [Entidades de negocio](#entidades-de-negocio)
8. [Modelos de datos](#modelos-de-datos)
9. [Stack tecnológico](#stack-tecnológico)
10. [API Routes](#api-routes)
11. [Estados actuales y próximos pasos](#estados-actuales-y-próximos-pasos)

---

## 🎯 Visión General

**finanzas-next** es una plataforma SaaS de gestión financiera especializada en **family offices argentinos**. Permite a múltiples empresas (SADIA, Ñancul, IBC, EML) centralizar y analizar su información financiera en una única aplicación.

### En 30 segundos:
- 📊 **Dashboard financiero** con KPIs en tiempo real (ingresos, gastos, flujo neto)
- 📝 **Gestión de transacciones** con auto-categorización inteligente
- 📸 **OCR inteligente** para extraer datos de recibos/facturas (Claude Vision)
- 📄 **Importación de documentos** con parsing IA para PDFs y Excels
- 💰 **Reportes financieros** (Estado de Resultados, Flujo de Caja) con análisis por empresa
- 🤖 **Asistente IA** que responde preguntas sobre la salud financiera
- 🔄 **Soporte multimoneda** (ARS/USD) con tasas históricas de DolarAPI

---

## 🔍 Problema que resuelve

### Antes (sin la aplicación):
- ❌ Datos financieros dispersos en múltiples archivos Excel
- ❌ Dificultad para consolidar información de 4 empresas diferentes
- ❌ Manualmente ingresando cada transacción
- ❌ Imposibilidad de ver reportes en tiempo real
- ❌ Sin alertas para pagos vencidos
- ❌ Pérdida de tiempo buscando categorías correctas

### Después (con finanzas-next):
- ✅ **Centralización**: Todos los datos en una base de datos única
- ✅ **Automatización**: OCR, importación IA, auto-categorización
- ✅ **Visibilidad**: Dashboards y reportes en tiempo real
- ✅ **Alertas**: Notificaciones de pagos vencidos
- ✅ **Inteligencia**: Asistente IA responde preguntas financieras
- ✅ **Escalabilidad**: Soporta crecimiento de empresas

---

## 🚀 Características principales

### 1. **Gestión de Transacciones**
- Entrada manual de ingresos/gastos
- Editar/eliminar transacciones
- Filtrar por tipo, mes, empresa, estado, categoría
- Estado de pago (percibido = cobrado/pagado | devengado = pendiente)
- Soporte multimoneda (ARS/USD con cambio configurable)
- Campos: fecha, descripción, monto, empresa, categoría, cuenta, notas

### 2. **Importación inteligente (IA)**
- **Modo clásico**: Parsea PDFs de informe "Ingresos/Egresos" con estructura fija
- **Modo IA**: Claude extrae transacciones de cualquier PDF/Excel de forma semántica
  - Detecta período y TC automáticamente
  - Funciona incluso si la estructura del documento cambia
  - Modal de edición para corregir datos antes de guardar
- Importación en batch directo a BD

### 3. **OCR & Extracción visual**
- Subir fotos de recibos/facturas
- Claude Vision extrae: fecha, monto, concepto, comercio
- Autocompleta campos en formulario de transacción
- Guardado directo o edición manual

### 4. **Reportes financieros**
- **Estado de Resultados (P&L anual)**
  - Ingresos/gastos/neto por mes
  - Tasa de ahorro
  - Conversión USD con TC histórico
  - Sección de impuestos (tasa configurable)
- **Flujo de Caja (mensual)**
  - Segregación por tipo: Operacional, Inversión, Financiamiento
  - Distingue movimientos percibidos vs devengados
  - Saldo inicial y cierre por día
  - Exportable a CSV/Excel
- **Dashboard**
  - KPIs principales (income, expense, net, savings rate)
  - Top categorías de gasto
  - Cuentas por cobrar/pagar por vencimiento
  - Gráficos mensuales y por categoría

### 5. **Alertas & Notificaciones**
- 🔔 Campana en navbar con conteo de pagos urgentes
- Color-coded: 🔴 vencido | 🟡 próximo 7 días | 🟢 en fecha
- Marcar como pagado desde el listado de pendientes
- Toast notifications para acciones

### 6. **Gestión de Categorías**
- Crear, editar, eliminar categorías de ingreso/gasto
- Aplicables a transacciones
- Auto-categorización por keywords en descripción

### 7. **Configuración & Ajustes**
- **Tipo de cambio**: Configura ARS/USD
- **Histórico**: Consulta tasas oficiales (BNA) y blue vía DolarAPI
- **TC por período**: Selecciona Oficial/Blue para reportes antiguos

### 8. **Autenticación**
- Login con email/username + contraseña
- Signup con confirmación
- Password recovery
- Sesiones con Supabase SSR

---

## 🏗️ Arquitectura técnica

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                     │
│  React 19 + TypeScript + Tailwind CSS                   │
│  (SPA con server-side rendering vía Next.js)            │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────────────┐
│              API GATEWAY (Next.js)                       │
│  - App Router (pages)                                   │
│  - API Routes (/api/*)                                  │
│  - Server Actions (form submissions)                    │
│  - Middleware (auth, proxy)                             │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┼──────────┬─────────────┐
        │          │          │             │
┌───────▼──┐  ┌────▼────┐ ┌──▼────┐  ┌────▼─────┐
│ Supabase │  │ Anthropic│ │DolarAPI │ │ pdf-parse │
│(Postgres)│  │  Claude  │ │ (TC)   │ │  (PDF)   │
└──────────┘  └──────────┘ └────────┘  └──────────┘

Database: PostgreSQL (Supabase)
Auth: Supabase Auth
Files: Supabase Storage (transacciones OCR)
AI: Claude API (Sonnet, Haiku)
```

---

## 📁 Estructura del proyecto

```
finanzas-next/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # Formulario de login
│   │   │   ├── signup/page.tsx       # Registro de usuario
│   │   │   ├── forgot-password/      # Recuperación de contraseña
│   │   │   └── reset-password/       # Reset de contraseña
│   │   │
│   │   ├── dashboard/page.tsx        # Dashboard principal (KPIs, gráficos)
│   │   ├── transactions/
│   │   │   ├── page.tsx              # Listado de transacciones
│   │   │   ├── add/page.tsx          # Entrada manual
│   │   │   ├── [id]/edit/page.tsx    # Editar transacción
│   │   │   ├── ocr/page.tsx          # Subir recibo/factura
│   │   │   ├── pending/page.tsx      # Pagos pendientes
│   │   │   └── DeleteButton.tsx      # Componente de eliminación
│   │   │
│   │   ├── categories/
│   │   │   ├── page.tsx              # Gestión de categorías
│   │   │   ├── add/page.tsx          # Crear categoría
│   │   │   └── [id]/edit/page.tsx    # Editar categoría
│   │   │
│   │   ├── settings/
│   │   │   ├── page.tsx              # Configuración (TC, empresas)
│   │   │   └── SettingsForm.tsx      # Formulario de TC
│   │   │
│   │   ├── reports/
│   │   │   ├── cash-flow/
│   │   │   │   ├── page.tsx          # Estado de flujo de caja
│   │   │   │   ├── CashFlowChart.tsx # Gráfico de flujo
│   │   │   │   ├── ExportButtons.tsx # Exportar CSV/Excel
│   │   │   │   └── TransactionDetail.tsx
│   │   │   │
│   │   │   └── income-statement/
│   │   │       ├── page.tsx          # Estado de resultados (P&L)
│   │   │       └── TaxSection.tsx    # Cálculo y visualización de impuestos
│   │   │
│   │   ├── import/
│   │   │   └── page.tsx              # Importar transacciones (PDF/Excel)
│   │   │       └── actions.ts        # Server actions para guardar
│   │   │
│   │   ├── api/                      # API Routes
│   │   │   ├── ocr/route.ts          # POST: Extrae texto de imagen con Vision
│   │   │   ├── ai-parse/route.ts     # POST: Parsea documento con Claude
│   │   │   ├── ai-chat/route.ts      # POST: Chat financiero
│   │   │   ├── parse-pdf/route.ts    # POST: Extrae texto de PDF
│   │   │   ├── tc-history/route.ts   # GET: TC histórico
│   │   │   ├── dolar/route.ts        # GET: Cotización actual USD/ARS
│   │   │   └── pending-count/route.ts# GET: Conteo de pagos vencidos
│   │   │
│   │   ├── layout.tsx                # Root layout con navbar, styles
│   │   ├── page.tsx                  # Home / Landing
│   │   └── globals.css               # Estilos globales
│   │
│   ├── components/                   # Componentes reutilizables
│   │   ├── Navbar.tsx                # Navegación principal + campana
│   │   ├── AIChat.tsx                # Widget de chat IA
│   │   ├── KPICard.tsx               # Tarjeta de métrica
│   │   ├── Logo.tsx                  # Logo de Grupo Lubrano
│   │   └── TCSelector.tsx            # Selector de TC (Oficial/Blue)
│   │
│   ├── lib/                          # Lógica y utilidades
│   │   ├── supabase/
│   │   │   ├── server.ts             # Cliente Supabase (servidor)
│   │   │   ├── client.ts             # Cliente Supabase (cliente)
│   │   │   └── middleware.ts         # Middleware de auth
│   │   │
│   │   ├── ai-parser.ts              # Parser de documentos con Claude
│   │   ├── pdf-parser.ts             # Extracción de PDF estándar
│   │   ├── excel-parser.ts           # Parseo de Excel CASHFLOW
│   │   ├── tc-history.ts             # Fetch TC histórico (Bluelytics)
│   │   ├── categorizer.ts            # Auto-categorización
│   │   ├── db.ts                     # Queries de usuario_profiles
│   │   ├── types.ts                  # TypeScript interfaces
│   │   ├── utils.ts                  # Helpers (formato dinero, fechas)
│   │   └── constants.ts              # Constantes (colores, empresas)
│   │
│   ├── middleware.ts                 # Auth middleware
│   └── proxy.ts                      # Proxy settings
│
├── public/                           # Assets estáticos
├── package.json                      # Dependencias
├── tsconfig.json                     # Config TypeScript
├── tailwind.config.ts                # Config Tailwind
├── next.config.ts                    # Config Next.js
├── supabase/
│   └── migrations/                   # Migraciones SQL (si existen)
└── DOCUMENTACION.md                  # Este archivo
```

---

## 🔄 Flujo de datos

### 1. **Entrada manual de transacción**
```
Usuario → Formulario /transactions/add
  → Valida (fecha, monto, categoría)
  → POST /transactions (server action)
  → Inserta en BD
  → Toast "Guardado"
  → Redirect a /transactions
```

### 2. **OCR de recibo**
```
Usuario → /transactions/ocr
  → Sube foto
  → POST /api/ocr
  → Claude Vision extrae: fecha, monto, concepto
  → JSON response con datos pre-completados
  → Formulario pre-relleno
  → Editable antes de guardar
```

### 3. **Importación clásica (PDF estándar)**
```
Usuario → /import
  → Elige período + archivo PDF
  → POST /api/parse-pdf
  → pdf-parse extrae texto
  → Parser rígido busca subtotales/totales
  → Devuelve transacciones parseadas
  → Preview con edición modal
  → Batch insert a BD
```

### 4. **Importación IA (PDF/Excel flexible)**
```
Usuario → /import + toggle "Modo IA"
  → Elige período + archivo + TC
  → POST /api/ai-parse
  → Extrae texto (pdf-parse o XLSX)
  → Limita a 400k chars
  → POST a Claude Sonnet (system prompt + documento)
  → Claude devuelve JSON de transacciones
  → Detecta período/TC del documento
  → Muestra advertencias si difieren
  → Preview con edición modal
  → Batch insert a BD
```

### 5. **Generación de reportes**
```
Usuario → /reports/income-statement (año selectado)
  → Consulta BD: SELECT transactions WHERE fecha IN [año-01-01, año-12-31]
  → Agrupa por mes y por categoría
  → Calcula: income, expense, net, savings_rate
  → Renderiza tabla con cálculos
  → Si TC configurado: Convierte a USD
  → Muestra selector TC (Oficial/Blue/Configuración)
  → Export a CSV/XLSX
```

### 6. **Chat financiero**
```
Usuario → Widget AIChat
  → Pregunta: "¿Cuál fue mi gasto total en Sueldos en Oct?"
  → Frontend: GET /api/pending-count (contexto)
  → Fetch últimas 150 transacciones (contexto)
  → POST /api/ai-chat { pregunta, contexto transacciones }
  → Claude Haiku analiza transacciones
  → Devuelve respuesta en español
  → Renderiza con streaming
```

---

## 🏢 Entidades de negocio

### Grupo Lubrano (Family Office)

| Empresa | business_id | Descripción |
|---------|-------------|-------------|
| **SADIA** | 1 | Empresa principal |
| **Ñancul** | 2 | Propiedad inmobiliaria |
| **IBC** | 3 | Inversiones financieras |
| **EML** | 4 | Comercio/Retail |

Cada transacción se vincula a una empresa para análisis segregado.

---

## 💾 Modelos de datos

### **Tabla: transactions**
```sql
id              BIGINT PRIMARY KEY
date            DATE                   -- Fecha de la transacción
description     TEXT                   -- "Sueldos SADIA", "Pago AFIP", etc.
notes           TEXT                   -- Info adicional
type            ENUM('income', 'expense')
amount          NUMERIC(15,2)          -- En ARS o USD
currency        ENUM('ARS', 'USD')
exchange_rate   NUMERIC(10,2)          -- Si es USD, con qué TC se convirtió
status          ENUM('percibido', 'devengado')
                                       -- percibido: cobrado/pagado
                                       -- devengado: pendiente
category_id     BIGINT FK → categories.id
business_id     BIGINT FK → businesses.id
account_id      BIGINT FK → accounts.id
expense_type    ENUM('ordinario', 'extraordinario')
due_date        DATE                   -- Fecha de vencimiento (si aplica)
paid_date       DATE                   -- Fecha en que se pagó
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### **Tabla: categories**
```sql
id              BIGINT PRIMARY KEY
name            VARCHAR(255) UNIQUE    -- "Sueldos y Cargas Sociales"
type            ENUM('income', 'expense')
created_at      TIMESTAMP
```

### **Tabla: businesses**
```sql
id              BIGINT PRIMARY KEY
name            VARCHAR(255) UNIQUE    -- SADIA, Ñancul, IBC, EML
created_at      TIMESTAMP
```

### **Tabla: accounts**
```sql
id              BIGINT PRIMARY KEY
name            VARCHAR(255)           -- "Banco Santander", "Caja"
account_type    VARCHAR(50)            -- bank, cash, credit_card
business_id     BIGINT FK → businesses.id
created_at      TIMESTAMP
```

### **Tabla: settings**
```sql
key             VARCHAR(100) PRIMARY KEY
value           VARCHAR(500)
updated_at      TIMESTAMP

Ejemplos de keys:
- current_rate: "1030.50"
- rate_date: "2024-12-20"
- rate_type: "Blue"
```

### **Tabla: user_profiles** (via Supabase Auth)
```sql
id              UUID PRIMARY KEY (FK → auth.users)
username        VARCHAR(255) UNIQUE
email           VARCHAR(255)
created_at      TIMESTAMP
```

---

## 🛠️ Stack tecnológico

### **Frontend**
- **Next.js 16.2.1** — React framework con App Router SSR
- **React 19.2.4** — Librería de UI
- **TypeScript 5** — Type safety
- **Tailwind CSS 4** — Styling (utility-first)
- **PostCSS 8** — Procesamiento de CSS
- **Lucide React 1.7.0** — Librería de iconos
- **Recharts 3.8.1** — Gráficos (line, bar, pie)
- **React Hot Toast 2.6.0** — Notificaciones toast

### **Backend**
- **Next.js API Routes** — Serverless functions
- **Supabase** — PostgreSQL + Auth como servicio
  - `@supabase/supabase-js` — Cliente JavaScript
  - `@supabase/ssr` — Server-side rendering auth

### **AI & Document Processing**
- **@anthropic-ai/sdk** — SDK de Claude
  - `claude-sonnet-4-6` — Parsing inteligente de documentos
  - `claude-haiku-4-5-20251001` — Chat financiero (económico)
  - Vision — OCR de imágenes
- **pdf-parse 1.1.1** — Extracción de texto de PDFs
- **xlsx 0.18.5** — Lectura y escritura de Excel

### **External APIs**
- **DolarAPI** — Cotización USD/ARS actual
- **Bluelytics** — TC histórico (Oficial y Blue)

### **Development**
- **ESLint 9** — Linting
- **TypeScript Compiler** — Type checking

---

## 🔌 API Routes

### **POST /api/ocr**
Extrae texto de una imagen usando Claude Vision.

**Request:**
```json
{
  "file": File,                    // Imagen (JPEG/PNG)
  "period": "2024-12"
}
```

**Response:**
```json
{
  "date": "2024-12-15",
  "amount": 1500.00,
  "description": "Compra supermercado",
  "merchant": "Carrefour",
  "currency": "ARS"
}
```

---

### **POST /api/ai-parse**
Parsea un PDF o Excel con Claude (extracción semántica inteligente).

**Request:**
```json
{
  "file": File,                    // PDF o XLSX
  "period": "2024-10",
  "exchangeRate": 1030.5,
  "mode": "detail"                 // "summary" o "detail"
}
```

**Response:**
```json
{
  "transactions": [
    {
      "date": "2024-10-15",
      "description": "Sueldos octubre",
      "type": "expense",
      "amount": 150000.00,
      "businessId": 1,
      "businessName": "SADIA",
      "categoryName": "Sueldos y Cargas Sociales",
      "currency": "ARS",
      "exchangeRate": null
    }
  ],
  "detectedPeriod": "2024-10",
  "detectedExchangeRate": 1025.0,
  "notes": "Documento con estructura estándar, sin inconvenientes"
}
```

---

### **POST /api/ai-chat**
Chat financiero usando Claude Haiku.

**Request:**
```json
{
  "message": "¿Cuál fue mi gasto total en octubre?",
  "context": {
    "recentTransactions": [...],
    "selectedPeriod": "2024-10"
  }
}
```

**Response:**
```json
{
  "response": "En octubre, tu gasto total fue de $285,450 ARS..."
}
```

---

### **POST /api/parse-pdf**
Extrae texto de PDF con estructura estándar (legacy).

**Request:**
```json
{
  "file": File,
  "period": "2024-10",
  "exchangeRate": 1030.5,
  "mode": "detail"
}
```

---

### **GET /api/tc-history?period=2024-10**
Obtiene TC histórico (Oficial BNA y Blue).

**Response:**
```json
{
  "period": "2024-10",
  "oficial": 1025.50,
  "blue": 1206.00,
  "oficialFuente": "Bluelytics — BNA vendedor",
  "blueFuente": "Bluelytics — blue venta"
}
```

---

### **GET /api/dolar**
TC actual USD/ARS de DolarAPI.

**Response:**
```json
{
  "cotizacion": 1030.50,
  "moneda": "USD",
  "fecha": "2024-12-20"
}
```

---

### **GET /api/pending-count**
Conteo de pagos vencidos/próximos para navbar.

**Response:**
```json
{
  "overdue": 2,
  "dueSoon": 5,
  "total": 7
}
```

---

## 📊 Estados actuales y próximos pasos

### **Estado actual (v1.0)**

#### ✅ Funcional
- [x] Autenticación con Supabase
- [x] CRUD de transacciones (manual)
- [x] OCR con Claude Vision (recibos/facturas)
- [x] Importación clásica de PDF (estructura fija)
- [x] Importación IA (PDF/Excel flexible)
- [x] Auto-categorización por keywords
- [x] Gestión de categorías y empresas
- [x] Dashboard con KPIs
- [x] Estado de Resultados (P&L anual)
- [x] Flujo de Caja (mensual)
- [x] Alertas de pagos vencidos/próximos
- [x] TC configurables (Oficial/Blue/Configuración)
- [x] Chat financiero con Claude Haiku
- [x] Export a CSV/XLSX
- [x] Modal de edición en preview de importación
- [x] Selector de TC histórico en reportes

#### 🚧 En desarrollo
- [ ] Reconciliación bancaria automática
- [ ] Presupuestos y forecast
- [ ] Integración con bancos (open banking)
- [ ] Facturación electrónica argentina
- [ ] Reporting avanzado (drill-down, análisis)
- [ ] API pública para terceros
- [ ] Mobile app (iOS/Android)

#### ❌ No planeado
- Multi-tenant SaaS (solo Grupo Lubrano)
- Multi-idioma (solo español argentino)
- Blockchain/crypto

---

## 🎯 Cómo usar esta documentación

### Para **nuevos desarrolladores:**
1. Lee "Visión General" y "Problema que resuelve"
2. Explora "Estructura del proyecto"
3. Lee "Flujo de datos" para entender la arquitectura
4. Estudia "Modelos de datos" para entender la BD

### Para **product managers:**
1. Lee "Características principales"
2. Revisa "Estados actuales y próximos pasos"
3. Consulta "Entidades de negocio"

### Para **diseñadores:**
1. Lee "Stack tecnológico" (Tailwind, colores en globals.css)
2. Explora "Arquitectura técnica"
3. Revisa componentes en `src/components/`

### Para **investigar bugs:**
1. Localiza la feature en "Características principales"
2. Busca el código en "Estructura del proyecto"
3. Verifica el flujo en "Flujo de datos"
4. Revisa "API Routes" si es issue de backend

---

## 📞 Contacto & Soporte

- **GitHub**: [finanzas-next repository]
- **Documentación técnica**: Código comentado
- **Ambiente de desarrollo**: Vercel (deployments automáticos en main)

---

**Última actualización:** Diciembre 2024  
**Versión:** 1.0 (MVP)  
**Mantenedor:** Grupo Lubrano

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  LayoutDashboard,
  Package,
  Users,
  CreditCard,
  Receipt,
  ChartNoAxesCombined,
  Bot,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Menu,
  X,
  ArrowUpRight,
  MoreHorizontal,
  CalendarDays,
  Download,
  CircleHelp,
  Sparkles,
  LogOut,
  User,
  Eye,
  Copy,
  Check,
  Filter,
  Plus,
  RefreshCw,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// --------------------------------------------------
// API CONFIGURATION
// --------------------------------------------------

const API_ROOT = "/api";
const FINANCE_API = "/billing-api/finance";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Subscriptions", icon: CreditCard },
  { name: "Products & Plans", icon: Package },
  { name: "Customers", icon: Users },
  { name: "Invoices", icon: Receipt },
  { name: "Analytics", icon: ChartNoAxesCombined },
];

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "customer";
};

type Product = {
  id: string;
  name: string;
  type?: string;
  salesPrice: number;
  costPrice: number;
  notes?: string;
  variants?: {
    attribute: string;
    value: string;
    extraPrice: number;
  }[];
  active?: boolean;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  billingPeriod: "daily" | "weekly" | "monthly" | "yearly";
  minQuantity: number;
  availableFrom?: string;
  availableTo?: string;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  active?: boolean;
};

type Subscription = {
  id: string;
  subscriptionNumber: string;
  customerId?: string;
  planId: string;
  startDate: string;
  expiryDate?: string | null;
  status: "Draft" | "Quotation" | "Confirmed" | "Active" | "Closed";
  lines: {
    productId: string;
    quantity: number;
    unitPrice: number;
    tax: number;
    amount: number;
    variant?: string;
  }[];
};

type Invoice = {
  id: string;
  customer: string;
  initials: string;
  date: string;
  amount: string;
  status: string;
};

type FinanceSummary = {
  total_outstanding: string;
  total_overdue: string;
  unpaid_invoice_count: number;
  overdue_invoice_count: number;
};

type CustomerOutstanding = {
  customer_id: string;
  customer_name: string;
  outstanding_amount: string;
};

type OverdueInvoice = {
  invoice_number: string;
  customer: {
    name?: string;
    customer_id?: string;
  };
  balance_due: string;
  due_date: string;
  status: string;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const response = await fetch(`${API_ROOT}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail || `Request failed (${response.status})`
    );
  }

  return data as T;
}

const formatINR = (amount: string | number) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const revenueData = Array.from({ length: 365 }, (_, index) => {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (364 - index));

  return {
    date,
    label: date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    revenue: 1200 + ((index * 7919 + 137) % 2800),
  };
});

const initialInvoices: Invoice[] = [
  {
    id: "INV-1001",
    customer: "Acme Technologies",
    initials: "AT",
    date: "28 Oct 2026",
    amount: "₹12,000",
    status: "Paid",
  },
  {
    id: "INV-1002",
    customer: "Nova Solutions",
    initials: "NS",
    date: "27 Oct 2026",
    amount: "₹8,500",
    status: "Pending",
  },
  {
    id: "INV-1003",
    customer: "Pixel Studios",
    initials: "PS",
    date: "26 Oct 2026",
    amount: "₹15,000",
    status: "Paid",
  },
  {
    id: "INV-1004",
    customer: "CloudNine Pvt Ltd",
    initials: "CN",
    date: "25 Oct 2026",
    amount: "₹6,800",
    status: "Overdue",
  },
];

// --------------------------------------------------
// MAIN APP
// --------------------------------------------------

function App() {
  // Authentication
  const [token, setToken] = useState(
    () => localStorage.getItem("subscriptiq_token") || ""
  );

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Navigation
  const [activePage, setActivePage] = useState("Overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [menu, setMenu] = useState("");

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateRange, setDateRange] = useState("Last 30 days");

  // Main backend data
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const [mainApiLoading, setMainApiLoading] = useState(false);
  const [mainApiError, setMainApiError] = useState("");

  // Finance backend data
  const [financeSummary, setFinanceSummary] =
    useState<FinanceSummary | null>(null);

  const [customerOutstanding, setCustomerOutstanding] =
    useState<CustomerOutstanding[]>([]);

  const [overdueInvoices, setOverdueInvoices] =
    useState<OverdueInvoice[]>([]);

  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState("");

  // Modals and actions
  const [selectedInvoice, setSelectedInvoice] =
    useState<Invoice | null>(null);

  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);

  const [productForm, setProductForm] = useState({
    name: "",
    type: "",
    salesPrice: "",
    costPrice: "",
    notes: "",
  });

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);

  const [planForm, setPlanForm] = useState({
    name: "",
    price: "",
    billingPeriod: "monthly",
    minQuantity: "1",
  });

  // Subscription form
  const [showSubscriptionForm, setShowSubscriptionForm] =
    useState(false);

  const [subscriptionForm, setSubscriptionForm] = useState({
    planId: "",
    productId: "",
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    quantity: "1",
    tax: "0",
    customerId: "",
  });

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoginLoading(true);
    setAuthError("");

    try {
      const result = await apiRequest<{
        token: string;
        user: User;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      localStorage.setItem("subscriptiq_token", result.token);

      setCurrentUser(result.user);
      setToken(result.token);
      setLoginPassword("");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Login failed"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("subscriptiq_token");

    setToken("");
    setCurrentUser(null);

    setProducts([]);
    setPlans([]);
    setSubscriptions([]);

    setFinanceSummary(null);
    setCustomerOutstanding([]);
    setOverdueInvoices([]);

    setMenu("");
  };

  // --------------------------------------------------
  // LOAD MAIN BACKEND DATA
  // --------------------------------------------------

  const loadMainData = async (authToken: string) => {
    setMainApiLoading(true);
    setMainApiError("");

    try {
      const [userResult, productResult, planResult, subscriptionResult] =
        await Promise.all([
          apiRequest<{ user: User }>(
            "/auth/me",
            {},
            authToken
          ),

          apiRequest<{ items: Product[] }>(
            "/products?page=1&limit=100",
            {},
            authToken
          ),

          apiRequest<{ items: Plan[] }>(
            "/plans?page=1&limit=100",
            {},
            authToken
          ),

          apiRequest<{ items: Subscription[] }>(
            "/subscriptions?page=1&limit=100",
            {},
            authToken
          ),
        ]);

      setCurrentUser(userResult.user);
      setProducts(productResult.items || []);
      setPlans(planResult.items || []);
      setSubscriptions(subscriptionResult.items || []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load dashboard";

      setMainApiError(message);

      if (
        message.toLowerCase().includes("token") ||
        message.toLowerCase().includes("unauthorized")
      ) {
        logout();
      }
    } finally {
      setMainApiLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadMainData(token);
    }
  }, [token]);

  // --------------------------------------------------
  // LOAD FINANCE DATA
  // --------------------------------------------------

  const loadFinanceData = async () => {
    try {
      setFinanceLoading(true);
      setFinanceError("");

      const [
        summaryResponse,
        outstandingResponse,
        overdueResponse,
      ] = await Promise.all([
        fetch(`${FINANCE_API}/summary`),
        fetch(`${FINANCE_API}/outstanding`),
        fetch(`${FINANCE_API}/overdue`),
      ]);

      if (!summaryResponse.ok) {
        throw new Error(`Summary API returned ${summaryResponse.status}`);
      }

      if (!outstandingResponse.ok) {
        throw new Error(
          `Outstanding API returned ${outstandingResponse.status}`
        );
      }

      if (!overdueResponse.ok) {
        throw new Error(`Overdue API returned ${overdueResponse.status}`);
      }

      const [summary, outstanding, overdue] = await Promise.all([
        summaryResponse.json(),
        outstandingResponse.json(),
        overdueResponse.json(),
      ]);

      setFinanceSummary(summary);
      setCustomerOutstanding(outstanding);
      setOverdueInvoices(overdue);
    } catch (error) {
      setFinanceError(
        error instanceof Error
          ? error.message
          : "Unable to connect to finance service"
      );
    } finally {
      setFinanceLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadFinanceData();
    }
  }, [token]);

  // --------------------------------------------------
  // REFRESH
  // --------------------------------------------------

  const refreshAll = async () => {
    if (!token) return;

    await Promise.all([
      loadMainData(token),
      loadFinanceData(),
    ]);
  };

  // --------------------------------------------------
  // CREATE PRODUCT
  // --------------------------------------------------

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) return;

    setActionLoading(true);
    setActionError("");
    setSuccessMessage("");

    try {
      await apiRequest<Product>(
        "/products",
        {
          method: "POST",
          body: JSON.stringify({
            name: productForm.name,
            type: productForm.type,
            salesPrice: Number(productForm.salesPrice),
            costPrice: Number(productForm.costPrice),
            notes: productForm.notes,
            variants: [],
          }),
        },
        token
      );

      setProductForm({
        name: "",
        type: "",
        salesPrice: "",
        costPrice: "",
        notes: "",
      });

      setShowProductForm(false);
      setSuccessMessage("Product created successfully.");

      await loadMainData(token);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Product creation failed"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------
  // CREATE PLAN
  // --------------------------------------------------

  const createPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) return;

    setActionLoading(true);
    setActionError("");
    setSuccessMessage("");

    try {
      await apiRequest<Plan>(
        "/plans",
        {
          method: "POST",
          body: JSON.stringify({
            name: planForm.name,
            price: Number(planForm.price),
            billingPeriod: planForm.billingPeriod,
            minQuantity: Number(planForm.minQuantity),
            autoClose: false,
            closable: false,
            pausable: false,
            renewable: true,
          }),
        },
        token
      );

      setPlanForm({
        name: "",
        price: "",
        billingPeriod: "monthly",
        minQuantity: "1",
      });

      setShowPlanForm(false);
      setSuccessMessage("Plan created successfully.");

      await loadMainData(token);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Plan creation failed"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------
  // CREATE SUBSCRIPTION
  // --------------------------------------------------

  const createSubscription = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!token) return;

    setActionLoading(true);
    setActionError("");
    setSuccessMessage("");

    try {
      const selectedProduct = products.find(
        (product) => product.id === subscriptionForm.productId
      );

      if (!selectedProduct) {
        throw new Error("Please select a valid product.");
      }

      const payload = {
        planId: subscriptionForm.planId,
        startDate: subscriptionForm.startDate,
        ...(subscriptionForm.expiryDate
          ? { expiryDate: subscriptionForm.expiryDate }
          : {}),
        customerId: subscriptionForm.customerId || undefined,
        paymentTerms: "",
        lines: [
          {
            productId: selectedProduct.id,
            quantity: Number(subscriptionForm.quantity),
            tax: Number(subscriptionForm.tax),
          },
        ],
      };

      await apiRequest<Subscription>(
        "/subscriptions",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        token
      );

      setShowSubscriptionForm(false);

      setSubscriptionForm({
        planId: "",
        productId: "",
        startDate: new Date().toISOString().slice(0, 10),
        expiryDate: "",
        quantity: "1",
        tax: "0",
        customerId: "",
      });

      setSuccessMessage("Subscription created successfully.");

      await loadMainData(token);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Subscription creation failed"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------
  // UPDATE SUBSCRIPTION STATUS
  // --------------------------------------------------

  const updateSubscriptionStatus = async (
    subscription: Subscription,
    status: string
  ) => {
    if (!token) return;

    setActionLoading(true);
    setActionError("");
    setSuccessMessage("");

    try {
      await apiRequest<Subscription>(
        `/subscriptions/${encodeURIComponent(
          subscription.subscriptionNumber
        )}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
        token
      );

      setSuccessMessage(
        `Subscription status updated to ${status}.`
      );

      await loadMainData(token);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update subscription"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------
  // INVOICES
  // --------------------------------------------------

  const invoices: Invoice[] = useMemo(() => {
    return [
      ...initialInvoices,

      ...overdueInvoices.map((invoice) => {
        const customerName =
          invoice.customer?.name || "Unknown customer";

        return {
          id: invoice.invoice_number,
          customer: customerName,
          initials: initials(customerName),
          date: formatDate(invoice.due_date),
          amount: formatINR(invoice.balance_due),
          status: "Overdue",
        };
      }),
    ];
  }, [overdueInvoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.id.toLowerCase().includes(query) ||
        invoice.customer.toLowerCase().includes(query) ||
        invoice.status.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  // --------------------------------------------------
  // CHART
  // --------------------------------------------------

  const chartData = useMemo(() => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (dateRange === "This year") {
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      return revenueData.filter(
        (item) => item.date >= startOfYear && item.date <= today
      );
    }

    const days =
      dateRange === "Last 7 days"
        ? 7
        : dateRange === "Last 30 days"
          ? 30
          : 90;

    const startDate = new Date(today);

    startDate.setDate(today.getDate() - (days - 1));

    return revenueData.filter(
      (item) => item.date >= startDate && item.date <= today
    );
  }, [dateRange]);

  // --------------------------------------------------
  // PERMISSIONS
  // --------------------------------------------------

  const isAdmin = currentUser?.role === "admin";
  const canManageSubscriptions =
    currentUser?.role === "admin" ||
    currentUser?.role === "staff";

  // --------------------------------------------------
  // EXPORT
  // --------------------------------------------------

  const exportInvoices = () => {
    const headers = [
      "Invoice ID",
      "Customer",
      "Date",
      "Amount",
      "Status",
    ];

    const rows = filteredInvoices.map((invoice) => [
      invoice.id,
      invoice.customer,
      invoice.date,
      invoice.amount,
      invoice.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "subscriptiq-invoices.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const copyInvoiceId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);

      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy invoice ID:", id);
    }

    setMenu("");
  };

  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------

  const changePage = (page: string) => {
    setActivePage(page);
    setMobileSidebarOpen(false);
    setMenu("");
    setActionError("");
    setSuccessMessage("");
  };

  const pageDescription: Record<string, string> = {
    Overview: "Here's what's happening with your business today.",
    Subscriptions: "Monitor and manage your recurring subscriptions.",
    "Products & Plans": "Manage the products and plans offered to customers.",
    Customers: "Keep track of your customer relationships.",
    Invoices: "Review and manage your billing activity.",
    Analytics: "Explore your business performance.",
    "AI Assistant": "Your intelligent business assistant.",
    Settings: "Manage your workspace preferences.",
  };

  // --------------------------------------------------
  // LOGIN SCREEN
  // --------------------------------------------------

  if (!token || !currentUser) {
    return (
      <div
        className="app-layout"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <form
          onSubmit={login}
          className="invoice-card"
          style={{
            width: "100%",
            maxWidth: 420,
            padding: 32,
          }}
        >
          <div className="brand-name" style={{ marginBottom: 24 }}>
            subscript<span>iq</span>
          </div>

          <h1>Welcome back</h1>

          <p className="subtitle">
            Sign in to your workspace.
          </p>

          <label style={{ display: "block", marginTop: 22 }}>
            Email

            <input
              type="email"
              required
              value={loginEmail}
              onChange={(event) =>
                setLoginEmail(event.target.value)
              }
              placeholder="you@example.com"
              style={{
                width: "100%",
                display: "block",
                marginTop: 8,
                padding: 12,
              }}
            />
          </label>

          <label style={{ display: "block", marginTop: 18 }}>
            Password

            <input
              type="password"
              required
              value={loginPassword}
              onChange={(event) =>
                setLoginPassword(event.target.value)
              }
              placeholder="Enter your password"
              style={{
                width: "100%",
                display: "block",
                marginTop: 8,
                padding: 12,
              }}
            />
          </label>

          {authError && (
            <p role="alert" className="error-message">
              {authError}
            </p>
          )}

          <button
            className="export-button"
            type="submit"
            disabled={loginLoading}
            style={{
              width: "100%",
              marginTop: 24,
              justifyContent: "center",
            }}
          >
            {loginLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  // --------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------

  return (
    <div className="app-layout">

      {mobileSidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          mobileSidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-top">
          <button
            className="brand"
            onClick={() => changePage("Overview")}
            aria-label="SubscriptIQ home"
          >
            <div className="brand-mark">
              <span>S</span>
              <i />
            </div>

            <span className="brand-name">
              subscript<span>iq</span>
            </span>
          </button>

          <button
            className="sidebar-close"
            aria-label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-container">
          <button
            className="workspace-switcher"
            onClick={() =>
              setMenu(menu === "workspace" ? "" : "workspace")
            }
          >
            <div className="workspace-logo">B</div>

            <div className="workspace-details">
              <strong>Brightloop</strong>
              <span>Free workspace</span>
            </div>

            <ChevronDown size={16} />
          </button>

          {menu === "workspace" && (
            <div className="action-popover">
              <strong>Brightloop</strong>
              <p>Current workspace</p>

              <button onClick={() => setMenu("")}>
                Close menu
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">WORKSPACE</p>

          <nav
            className="sidebar-nav"
            aria-label="Main navigation"
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.name;

              return (
                <button
                  key={item.name}
                  className={`nav-link ${
                    isActive ? "active" : ""
                  }`}
                  onClick={() => changePage(item.name)}
                  aria-current={
                    isActive ? "page" : undefined
                  }
                >
                  <Icon size={18} strokeWidth={1.8} />

                  <span>{item.name}</span>

                  {item.name === "Invoices" && (
                    <span className="nav-count">
                      {invoices.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-section tools-section">
          <p className="sidebar-label">INTELLIGENCE</p>

          <button
            className={`nav-link ai-nav-link ${
              activePage === "AI Assistant" ? "active" : ""
            }`}
            onClick={() => changePage("AI Assistant")}
          >
            <Bot size={18} />
            <span>AI Assistant</span>
            <span className="ai-tag">AI</span>
          </button>

          <button
            className={`nav-link ${
              activePage === "Settings" ? "active" : ""
            }`}
            onClick={() => changePage("Settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>

        <div className="sidebar-spacer" />

        <button
          className="sidebar-help"
          onClick={() =>
            setMenu(menu === "help" ? "" : "help")
          }
        >
          <div className="help-icon">
            <CircleHelp size={17} />
          </div>

          <div>
            <strong>Need a hand?</strong>
            <span>Visit our help center</span>
          </div>

          <ArrowUpRight size={15} />
        </button>

        {menu === "help" && (
          <div className="action-popover">
            <strong>Help center</strong>
            <p>
              Contact your project administrator for assistance.
            </p>

            <button onClick={() => setMenu("")}>
              Close
            </button>
          </div>
        )}

        <div className="sidebar-profile">
          <div className="profile-avatar">
            {initials(currentUser.name)}
          </div>

          <div className="profile-details">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.role}</span>
          </div>

          <button
            className="profile-menu"
            aria-label="Profile menu"
            onClick={() =>
              setMenu(menu === "profile" ? "" : "profile")
            }
          >
            <MoreHorizontal size={19} />
          </button>

          {menu === "profile" && (
            <div className="action-popover profile-popover">
              <button onClick={() => changePage("Settings")}>
                <User size={15} />
                Account settings
              </button>

              <button onClick={logout}>
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />

              <input
                type="search"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);

                  if (activePage !== "Invoices") {
                    setActivePage("Invoices");
                  }
                }}
                aria-label="Search invoices"
              />

              <kbd>/</kbd>
            </label>

            <div className="topbar-divider" />

            <div className="top-action-container">
              <button
                className="notification-button"
                aria-label="Notifications"
                onClick={() =>
                  setMenu(
                    menu === "notifications"
                      ? ""
                      : "notifications"
                  )
                }
              >
                <Bell size={19} />
                <span className="notification-indicator" />
              </button>

              {menu === "notifications" && (
                <div className="action-popover">
                  <strong>Notifications</strong>

                  <p>
                    {financeSummary
                      ? `${financeSummary.unpaid_invoice_count} invoices awaiting payment.`
                      : "Finance notifications unavailable."}
                  </p>

                  <button
                    onClick={() => {
                      changePage("Invoices");
                      setStatusFilter("Pending");
                    }}
                  >
                    View pending invoices
                  </button>

                  <button onClick={() => setMenu("")}>
                    Close
                  </button>
                </div>
              )}
            </div>

            <button
              className="top-avatar"
              onClick={() =>
                setMenu(menu === "profile" ? "" : "profile")
              }
            >
              {initials(currentUser.name)}
            </button>
          </div>
        </header>

        {/* DASHBOARD */}

        <section className="dashboard">

          <div className="welcome-row">
            <div className="welcome-copy">
              <div className="eyebrow">
                <span className="eyebrow-dot" />

                {activePage === "Overview"
                  ? "BUSINESS OVERVIEW"
                  : activePage.toUpperCase()}
              </div>

              <h1>
                {activePage === "Overview" ? (
                  <>
                    Good morning, <span>{currentUser.name}.</span>
                  </>
                ) : (
                  activePage
                )}
              </h1>

              <p className="subtitle">
                {pageDescription[activePage]}
              </p>
            </div>

            <div className="welcome-actions">
              {activePage === "Overview" && (
                <label className="date-select">
                  <CalendarDays size={16} />

                  <select
                    value={dateRange}
                    onChange={(event) =>
                      setDateRange(event.target.value)
                    }
                    aria-label="Select date range"
                  >
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                    <option>Last 90 days</option>
                    <option>This year</option>
                  </select>

                  <ChevronDown size={15} />
                </label>
              )}

              <button
                className="export-button"
                onClick={refreshAll}
                disabled={mainApiLoading || financeLoading}
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>

              <button
                className="export-button"
                onClick={exportInvoices}
              >
                <Download size={16} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* CONNECTION STATUS */}

          <div className="demo-notice">
            <Sparkles size={15} />

            <span>
              {mainApiLoading || financeLoading
                ? "Connecting to backend services..."
                : mainApiError || financeError
                  ? "One or more backend services need attention."
                  : "Subscription and finance data connected to backend services."}
            </span>
          </div>

          {mainApiError && (
            <p role="alert" className="error-message">
              Main API: {mainApiError}
            </p>
          )}

          {financeError && (
            <p role="alert" className="error-message">
              Finance API: {financeError}
            </p>
          )}

          {actionError && (
            <p role="alert" className="error-message">
              {actionError}
            </p>
          )}

          {successMessage && (
            <p className="success-message" role="status">
              {successMessage}
            </p>
          )}

          {/* ==========================================
              OVERVIEW
          ========================================== */}

          {activePage === "Overview" && (
            <>

              <div className="stats-grid">

                {[
                  {
                    label: "Total products",
                    value: mainApiLoading ? "Loading..." : products.length,
                    description: "Active product records",
                    icon: Package,
                    accent: "lime",
                  },
                  {
                    label: "Active subscriptions",
                    value: mainApiLoading
                      ? "Loading..."
                      : subscriptions.filter(
                          (item) => item.status === "Active"
                        ).length,
                    description: "Live subscriptions",
                    icon: CreditCard,
                    accent: "blue",
                  },
                  {
                    label: "Available plans",
                    value: mainApiLoading ? "Loading..." : plans.length,
                    description: "Available plans",
                    icon: ChartNoAxesCombined,
                    accent: "violet",
                  },
                  {
                    label: "Outstanding invoices",
                    value: financeLoading
                      ? "Loading..."
                      : financeSummary
                        ? formatINR(financeSummary.total_outstanding)
                        : "Unavailable",
                    description: "Awaiting payment",
                    icon: Receipt,
                    accent: "orange",
                  },
                ].map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <article className="stat-card" key={stat.label}>
                      <div className="stat-card-top">
                        <span className="stat-label">
                          {stat.label}
                        </span>

                        <div className={`stat-icon ${stat.accent}`}>
                          <Icon size={18} />
                        </div>
                      </div>

                      <div className="stat-value">
                        {stat.value}
                      </div>

                      <div className="stat-footer">
                        <span className="stat-description">
                          {stat.description}
                        </span>
                      </div>
                    </article>
                  );
                })}

              </div>

              <div className="overview-grid">

                <section className="chart-card">
                  <div className="section-header">
                    <div>
                      <div className="section-kicker">
                        PERFORMANCE
                      </div>

                      <h2>Revenue overview</h2>

                      <p>
                        Sample revenue data for demonstration.
                      </p>
                    </div>

                    <button
                      className="icon-button"
                      aria-label="Chart options"
                      onClick={() =>
                        setMenu(menu === "chart" ? "" : "chart")
                      }
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </div>

                  {menu === "chart" && (
                    <div className="action-popover chart-popover">
                      <strong>Chart period</strong>

                      {[
                        "Last 7 days",
                        "Last 30 days",
                        "Last 90 days",
                        "This year",
                      ].map((period) => (
                        <button
                          key={period}
                          onClick={() => {
                            setDateRange(period);
                            setMenu("");
                          }}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="chart-summary">
                    <div className="chart-total">
                      ₹
                      {chartData
                        .reduce(
                          (sum, item) => sum + item.revenue,
                          0
                        )
                        .toLocaleString("en-IN")}
                    </div>

                    <div className="chart-growth">
                      Sample
                      <span>demo figures</span>
                    </div>
                  </div>

                  <div className="chart-container">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <AreaChart
                        data={chartData}
                        margin={{
                          top: 12,
                          right: 8,
                          left: -16,
                          bottom: 0,
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="revenueGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#55b8ac"
                              stopOpacity={0.25}
                            />

                            <stop
                              offset="95%"
                              stopColor="#55b8ac"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          stroke="#2b4142"
                          strokeDasharray="3 5"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="label"
                          interval={
                            dateRange === "Last 7 days"
                              ? 0
                              : dateRange === "Last 30 days"
                                ? 4
                                : dateRange === "Last 90 days"
                                  ? 13
                                  : "preserveStartEnd"
                          }
                          stroke="#9aabaa"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: "#9aabaa",
                            fontSize: 12,
                          }}
                          dy={10}
                        />

                        <YAxis
                          stroke="#9aabaa"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: "#9aabaa",
                            fontSize: 11,
                          }}
                          tickFormatter={(value) =>
                            `₹${value / 1000}k`
                          }
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#172629",
                            border: "1px solid #2b4142",
                            borderRadius: "10px",
                            color: "#edf4f2",
                            fontSize: "12px",
                          }}
                          labelFormatter={(label) =>
                            `Date: ${label}`
                          }
                          formatter={(value) => [
                            `₹${Number(value).toLocaleString("en-IN")}`,
                            "Sample revenue",
                          ]}
                        />

                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#55b8ac"
                          strokeWidth={2.5}
                          fill="url(#revenueGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-footer">
                    <span>
                      <i className="legend-dot" />
                      Sample revenue
                    </span>

                    <span>
                      Demo data · {chartData[0]?.label} –{" "}
                      {chartData[chartData.length - 1]?.label}
                    </span>
                  </div>
                </section>

                <aside className="insight-card">
                  <div className="insight-top">
                    <div className="insight-icon">
                      <Sparkles size={18} />
                    </div>

                    <span className="insight-label">
                      SUBSCRIPTIQ INSIGHTS
                    </span>

                    <span className="insight-status">
                      PREVIEW
                    </span>
                  </div>

                  <h3>A clearer picture of your business.</h3>

                  <p>
                    Bring subscriptions, revenue and billing activity
                    together in one place.
                  </p>

                  <div className="insight-divider" />

                  <div className="insight-metric">
                    <span>Active subscriptions</span>

                    <strong>
                      {subscriptions.filter(
                        (item) => item.status === "Active"
                      ).length}
                    </strong>
                  </div>

                  <div className="insight-metric">
                    <span>Unpaid invoices</span>

                    <strong>
                      {financeSummary?.unpaid_invoice_count ?? "—"}
                    </strong>
                  </div>

                  <div className="insight-metric">
                    <span>Overdue invoices</span>

                    <strong>
                      {financeSummary?.overdue_invoice_count ?? "—"}
                    </strong>
                  </div>

                  <div className="insight-metric">
                    <span>Total overdue</span>

                    <strong>
                      {financeSummary
                        ? formatINR(financeSummary.total_overdue)
                        : "—"}
                    </strong>
                  </div>

                  <div className="insight-bottom">
                    <span>Finance data from billing API</span>
                    <ArrowUpRight size={16} />
                  </div>
                </aside>

              </div>

              {/* OUTSTANDING CUSTOMERS */}

              <section className="invoice-card">
                <div className="section-header invoice-section-header">
                  <div>
                    <div className="section-kicker">
                      CUSTOMER FINANCE
                    </div>

                    <h2>Outstanding by customer</h2>

                    <p>
                      Customer-wise unpaid balances from billing database.
                    </p>
                  </div>
                </div>

                {financeLoading ? (
                  <div className="empty-state">
                    Loading customer balances...
                  </div>
                ) : customerOutstanding.length ? (
                  <div className="table-wrapper">
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th>CUSTOMER</th>
                          <th>CUSTOMER ID</th>
                          <th>OUTSTANDING</th>
                        </tr>
                      </thead>

                      <tbody>
                        {customerOutstanding.map((customer) => (
                          <tr key={customer.customer_id}>
                            <td>{customer.customer_name}</td>
                            <td>{customer.customer_id}</td>

                            <td className="invoice-amount">
                              {formatINR(
                                customer.outstanding_amount
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No outstanding customer balances found.
                  </div>
                )}
              </section>

              <InvoiceTable
                invoices={filteredInvoices}
                searchQuery={searchQuery}
                setSelectedInvoice={setSelectedInvoice}
                setMenu={setMenu}
                menu={menu}
                copyInvoiceId={copyInvoiceId}
                onViewAll={() => changePage("Invoices")}
              />

            </>
          )}

          {/* ==========================================
              SUBSCRIPTIONS
          ========================================== */}

          {activePage === "Subscriptions" && (
            <section className="invoice-card">

              <div className="section-header invoice-section-header">
                <div>
                  <div className="section-kicker">
                    SUBSCRIPTION MANAGEMENT
                  </div>

                  <h2>All subscriptions</h2>

                  <p>
                    Live subscription records from the backend.
                  </p>
                </div>

                {canManageSubscriptions && (
                  <button
                    className="export-button"
                    onClick={() => {
                      setActionError("");
                      setShowSubscriptionForm(!showSubscriptionForm);
                    }}
                  >
                    <Plus size={16} />
                    Create subscription
                  </button>
                )}
              </div>

              <div className="stats-grid">
                {[
                  ["Total", subscriptions.length],
                  [
                    "Active",
                    subscriptions.filter(
                      (item) => item.status === "Active"
                    ).length,
                  ],
                  [
                    "Draft",
                    subscriptions.filter(
                      (item) => item.status === "Draft"
                    ).length,
                  ],
                  [
                    "Closed",
                    subscriptions.filter(
                      (item) => item.status === "Closed"
                    ).length,
                  ],
                ].map(([label, value]) => (
                  <article className="stat-card" key={label}>
                    <span className="stat-label">{label}</span>
                    <div className="stat-value">{value}</div>
                    <span className="stat-description">
                      Backend records
                    </span>
                  </article>
                ))}
              </div>

              {showSubscriptionForm && (
                <form
                  className="invoice-card"
                  onSubmit={createSubscription}
                  style={{ padding: 20, marginBottom: 24 }}
                >
                  <h3>Create subscription</h3>

                  <label>
                    Plan

                    <select
                      required
                      value={subscriptionForm.planId}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          planId: event.target.value,
                        })
                      }
                    >
                      <option value="">Select plan</option>

                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — {formatINR(plan.price)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Product

                    <select
                      required
                      value={subscriptionForm.productId}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          productId: event.target.value,
                        })
                      }
                    >
                      <option value="">Select product</option>

                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Customer ID

                    <input
                      value={subscriptionForm.customerId}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          customerId: event.target.value,
                        })
                      }
                      placeholder="Customer ObjectId"
                    />
                  </label>

                  <label>
                    Start date

                    <input
                      type="date"
                      required
                      value={subscriptionForm.startDate}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          startDate: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Expiry date

                    <input
                      type="date"
                      value={subscriptionForm.expiryDate}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          expiryDate: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Quantity

                    <input
                      type="number"
                      min="1"
                      required
                      value={subscriptionForm.quantity}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          quantity: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Tax

                    <input
                      type="number"
                      min="0"
                      value={subscriptionForm.tax}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          tax: event.target.value,
                        })
                      }
                    />
                  </label>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="export-button"
                      type="submit"
                      disabled={actionLoading}
                    >
                      {actionLoading
                        ? "Creating..."
                        : "Create subscription"}
                    </button>

                    <button
                      type="button"
                      className="view-all-button"
                      onClick={() => setShowSubscriptionForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {mainApiLoading ? (
                <div className="empty-state">
                  Loading subscriptions...
                </div>
              ) : subscriptions.length ? (
                <div className="table-wrapper">
                  <table className="invoice-table">
                    <thead>
                      <tr>
                        <th>SUBSCRIPTION</th>
                        <th>PLAN ID</th>
                        <th>START DATE</th>
                        <th>EXPIRY DATE</th>
                        <th>STATUS</th>
                        <th>UPDATE STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {subscriptions.map((subscription) => (
                        <tr key={subscription.id}>
                          <td>
                            <strong>
                              {subscription.subscriptionNumber}
                            </strong>
                          </td>

                          <td>{subscription.planId}</td>

                          <td>
                            {formatDate(subscription.startDate)}
                          </td>

                          <td>
                            {formatDate(subscription.expiryDate)}
                          </td>

                          <td>
                            <span
                              className={`status ${subscription.status.toLowerCase()}`}
                            >
                              <i />
                              {subscription.status}
                            </span>
                          </td>

                          <td>
                            {canManageSubscriptions &&
                            subscription.status !== "Closed" ? (
                              <select
                                disabled={actionLoading}
                                value=""
                                onChange={(event) =>
                                  updateSubscriptionStatus(
                                    subscription,
                                    event.target.value
                                  )
                                }
                              >
                                <option value="">
                                  Change status
                                </option>

                                {(
                                  {
                                    Draft: ["Quotation"],
                                    Quotation: ["Confirmed"],
                                    Confirmed: ["Active"],
                                    Active: ["Closed"],
                                    Closed: [],
                                  } as Record<string, string[]>
                                )[subscription.status]?.map((status) => (
                                  <option
                                    key={status}
                                    value={status}
                                  >
                                    {status}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  No subscription records found.
                </div>
              )}

            </section>
          )}

          {/* ==========================================
              PRODUCTS AND PLANS
          ========================================== */}

          {activePage === "Products & Plans" && (
            <>

              <section className="invoice-card">

                <div className="section-header invoice-section-header">
                  <div>
                    <div className="section-kicker">
                      CATALOGUE MANAGEMENT
                    </div>

                    <h2>Products</h2>

                    <p>
                      Products loaded from the main backend.
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      className="export-button"
                      onClick={() => {
                        setActionError("");
                        setShowProductForm(!showProductForm);
                      }}
                    >
                      <Plus size={16} />
                      Add product
                    </button>
                  )}
                </div>

                {showProductForm && (
                  <form
                    onSubmit={createProduct}
                    className="invoice-card"
                    style={{ padding: 20, marginBottom: 24 }}
                  >
                    <h3>Create product</h3>

                    <label>
                      Product name

                      <input
                        required
                        value={productForm.name}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            name: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Product type

                      <input
                        value={productForm.type}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            type: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Sales price

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={productForm.salesPrice}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            salesPrice: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Cost price

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={productForm.costPrice}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            costPrice: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Notes

                      <textarea
                        value={productForm.notes}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            notes: event.target.value,
                          })
                        }
                      />
                    </label>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        className="export-button"
                        type="submit"
                        disabled={actionLoading}
                      >
                        {actionLoading
                          ? "Saving..."
                          : "Create product"}
                      </button>

                      <button
                        type="button"
                        className="view-all-button"
                        onClick={() => setShowProductForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {mainApiLoading ? (
                  <div className="empty-state">
                    Loading products...
                  </div>
                ) : products.length ? (
                  <div className="table-wrapper">
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th>PRODUCT</th>
                          <th>TYPE</th>
                          <th>SALES PRICE</th>
                          <th>COST PRICE</th>
                          <th>VARIANTS</th>
                        </tr>
                      </thead>

                      <tbody>
                        {products.map((product) => (
                          <tr key={product.id}>
                            <td>
                              <strong>{product.name}</strong>
                            </td>

                            <td>{product.type || "—"}</td>

                            <td>
                              {formatINR(product.salesPrice)}
                            </td>

                            <td>
                              {formatINR(product.costPrice)}
                            </td>

                            <td>
                              {product.variants?.length || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No products available.
                  </div>
                )}

              </section>

              <section className="invoice-card">

                <div className="section-header invoice-section-header">
                  <div>
                    <div className="section-kicker">
                      SUBSCRIPTION CONFIGURATION
                    </div>

                    <h2>Plans</h2>

                    <p>
                      Available plans from the main backend.
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      className="export-button"
                      onClick={() => {
                        setActionError("");
                        setShowPlanForm(!showPlanForm);
                      }}
                    >
                      <Plus size={16} />
                      Add plan
                    </button>
                  )}
                </div>

                {showPlanForm && (
                  <form
                    onSubmit={createPlan}
                    className="invoice-card"
                    style={{ padding: 20, marginBottom: 24 }}
                  >
                    <h3>Create plan</h3>

                    <label>
                      Plan name

                      <input
                        required
                        value={planForm.name}
                        onChange={(event) =>
                          setPlanForm({
                            ...planForm,
                            name: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Price

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={planForm.price}
                        onChange={(event) =>
                          setPlanForm({
                            ...planForm,
                            price: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Billing period

                      <select
                        value={planForm.billingPeriod}
                        onChange={(event) =>
                          setPlanForm({
                            ...planForm,
                            billingPeriod: event.target.value,
                          })
                        }
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>

                    <label>
                      Minimum quantity

                      <input
                        type="number"
                        min="1"
                        required
                        value={planForm.minQuantity}
                        onChange={(event) =>
                          setPlanForm({
                            ...planForm,
                            minQuantity: event.target.value,
                          })
                        }
                      />
                    </label>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        className="export-button"
                        type="submit"
                        disabled={actionLoading}
                      >
                        {actionLoading
                          ? "Saving..."
                          : "Create plan"}
                      </button>

                      <button
                        type="button"
                        className="view-all-button"
                        onClick={() => setShowPlanForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {mainApiLoading ? (
                  <div className="empty-state">
                    Loading plans...
                  </div>
                ) : plans.length ? (
                  <div className="table-wrapper">
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th>PLAN</th>
                          <th>PRICE</th>
                          <th>BILLING PERIOD</th>
                          <th>MIN QUANTITY</th>
                          <th>RENEWABLE</th>
                        </tr>
                      </thead>

                      <tbody>
                        {plans.map((plan) => (
                          <tr key={plan.id}>
                            <td>
                              <strong>{plan.name}</strong>
                            </td>

                            <td>{formatINR(plan.price)}</td>

                            <td>
                              {plan.billingPeriod}
                            </td>

                            <td>{plan.minQuantity}</td>

                            <td>
                              {plan.renewable ? "Yes" : "No"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No plans available.
                  </div>
                )}

              </section>
            </>
          )}

          {/* ==========================================
              CUSTOMERS
          ========================================== */}

          {activePage === "Customers" && (
            <section className="invoice-card">

              <div className="section-header invoice-section-header">
                <div>
                  <div className="section-kicker">
                    CUSTOMER MANAGEMENT
                  </div>

                  <h2>Customer overview</h2>

                  <p>
                    Available customer information from finance records.
                  </p>
                </div>
              </div>

              <div className="stats-grid">
                <article className="stat-card">
                  <span className="stat-label">
                    Customers with outstanding balance
                  </span>

                  <div className="stat-value">
                    {customerOutstanding.length}
                  </div>

                  <span className="stat-description">
                    Finance records
                  </span>
                </article>

                <article className="stat-card">
                  <span className="stat-label">
                    Total outstanding
                  </span>

                  <div className="stat-value">
                    {financeSummary
                      ? formatINR(financeSummary.total_outstanding)
                      : "Unavailable"}
                  </div>

                  <span className="stat-description">
                    Billing database
                  </span>
                </article>

                <article className="stat-card">
                  <span className="stat-label">
                    Unpaid invoices
                  </span>

                  <div className="stat-value">
                    {financeSummary?.unpaid_invoice_count ?? "—"}
                  </div>

                  <span className="stat-description">
                    Finance records
                  </span>
                </article>
              </div>

              <h2>Outstanding customers</h2>

              {financeLoading ? (
                <div className="empty-state">
                  Loading customers...
                </div>
              ) : customerOutstanding.length ? (
                <div className="table-wrapper">
                  <table className="invoice-table">
                    <thead>
                      <tr>
                        <th>CUSTOMER</th>
                        <th>CUSTOMER ID</th>
                        <th>OUTSTANDING</th>
                      </tr>
                    </thead>

                    <tbody>
                      {customerOutstanding.map((customer) => (
                        <tr key={customer.customer_id}>
                          <td>{customer.customer_name}</td>
                          <td>{customer.customer_id}</td>

                          <td className="invoice-amount">
                            {formatINR(
                              customer.outstanding_amount
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  No outstanding customer records found.
                  The backend currently does not expose a separate
                  customer-list endpoint.
                </div>
              )}

            </section>
          )}

          {/* ==========================================
              INVOICES
          ========================================== */}

          {activePage === "Invoices" && (
            <section className="invoice-card">

              <div className="section-header invoice-section-header">
                <div>
                  <div className="section-kicker">
                    BILLING ACTIVITY
                  </div>

                  <h2>Invoices</h2>

                  <p>
                    Backend overdue records and clearly labelled sample invoices.
                  </p>
                </div>

                <label className="date-select">
                  <Filter size={15} />

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                  >
                    <option>All</option>
                    <option>Paid</option>
                    <option>Pending</option>
                    <option>Overdue</option>
                  </select>

                  <ChevronDown size={15} />
                </label>
              </div>

              <InvoiceTable
                invoices={filteredInvoices}
                searchQuery={searchQuery}
                setSelectedInvoice={setSelectedInvoice}
                setMenu={setMenu}
                menu={menu}
                copyInvoiceId={copyInvoiceId}
              />

            </section>
          )}

          {/* ==========================================
              ANALYTICS
          ========================================== */}

          {activePage === "Analytics" && (
            <section className="invoice-card">

              <div className="section-header">
                <div>
                  <div className="section-kicker">
                    BUSINESS ANALYTICS
                  </div>

                  <h2>Billing analytics</h2>

                  <p>
                    Financial indicators from the billing database.
                  </p>
                </div>
              </div>

              <div className="stats-grid">
                {[
                  [
                    "Outstanding",
                    financeSummary
                      ? formatINR(financeSummary.total_outstanding)
                      : "Unavailable",
                  ],
                  [
                    "Overdue",
                    financeSummary
                      ? formatINR(financeSummary.total_overdue)
                      : "Unavailable",
                  ],
                  [
                    "Unpaid invoices",
                    financeSummary?.unpaid_invoice_count ?? "Unavailable",
                  ],
                  [
                    "Overdue invoices",
                    financeSummary?.overdue_invoice_count ?? "Unavailable",
                  ],
                  [
                    "Total subscriptions",
                    subscriptions.length,
                  ],
                  [
                    "Active subscriptions",
                    subscriptions.filter(
                      (item) => item.status === "Active"
                    ).length,
                  ],
                ].map(([label, value]) => (
                  <article className="stat-card" key={label}>
                    <span className="stat-label">{label}</span>

                    <div className="stat-value">
                      {value}
                    </div>

                    <span className="stat-description">
                      Backend data
                    </span>
                  </article>
                ))}
              </div>

              <div className="empty-state">
                Revenue analytics and subscription trends require
                additional backend reporting endpoints.
              </div>

            </section>
          )}

          {/* ==========================================
              AI ASSISTANT
          ========================================== */}

          {activePage === "AI Assistant" && (
            <section className="invoice-card">
              <div
                className="empty-state"
                style={{ padding: "50px 20px" }}
              >
                <Bot size={35} />

                <h3>SubscriptIQ AI Assistant</h3>

                <p>
                  AI-powered subscription insights and billing assistance.
                  Connect the AI agent backend to enable conversations.
                </p>
              </div>
            </section>
          )}

          {/* ==========================================
              SETTINGS
          ========================================== */}

          {activePage === "Settings" && (
            <section className="invoice-card">
              <div style={{ padding: 20 }}>
                <div className="section-kicker">
                  ACCOUNT SETTINGS
                </div>

                <h2>Workspace settings</h2>

                <div className="modal-details">
                  <p>
                    <span>Name</span>
                    <strong>{currentUser.name}</strong>
                  </p>

                  <p>
                    <span>Email</span>
                    <strong>{currentUser.email}</strong>
                  </p>

                  <p>
                    <span>Role</span>
                    <strong>{currentUser.role}</strong>
                  </p>

                  <p>
                    <span>Workspace</span>
                    <strong>Brightloop</strong>
                  </p>

                  <p>
                    <span>Backend</span>
                    <strong>Subscription and Finance API</strong>
                  </p>
                </div>

                <button
                  className="export-button"
                  onClick={logout}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </section>
          )}

          {/* FOOTER */}

          <footer className="dashboard-footer">
            <span>© 2026 SubscriptIQ</span>

            <span>
              Subscription management, made clearer.
            </span>
          </footer>

        </section>
      </main>

      {/* ==========================================
          INVOICE MODAL
      ========================================== */}

      {selectedInvoice && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedInvoice(null)}
        >
          <section
            className="invoice-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header">
              <div>
                <div className="section-kicker">
                  INVOICE DETAILS
                </div>

                <h2>{selectedInvoice.id}</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setSelectedInvoice(null)}
                aria-label="Close details"
              >
                <X size={19} />
              </button>
            </div>

            <div className="modal-details">
              <p>
                <span>Customer</span>
                <strong>{selectedInvoice.customer}</strong>
              </p>

              <p>
                <span>Issued on / Due date</span>
                <strong>{selectedInvoice.date}</strong>
              </p>

              <p>
                <span>Amount / Balance</span>
                <strong>{selectedInvoice.amount}</strong>
              </p>

              <p>
                <span>Status</span>
                <strong>{selectedInvoice.status}</strong>
              </p>
            </div>

            <button
              className="export-button"
              onClick={() =>
                copyInvoiceId(selectedInvoice.id)
              }
            >
              <Copy size={15} />
              Copy invoice ID
            </button>

            <button
              className="view-all-button"
              onClick={() => setSelectedInvoice(null)}
            >
              Close
            </button>
          </section>
        </div>
      )}

      {copied && (
        <div className="copy-feedback">
          <Check size={15} />
          Copied
        </div>
      )}

    </div>
  );
}

// --------------------------------------------------
// INVOICE TABLE
// --------------------------------------------------

function InvoiceTable({
  invoices,
  searchQuery,
  setSelectedInvoice,
  setMenu,
  menu,
  copyInvoiceId,
  onViewAll,
}: {
  invoices: Invoice[];
  searchQuery: string;
  setSelectedInvoice: (invoice: Invoice) => void;
  setMenu: (menu: string) => void;
  menu: string;
  copyInvoiceId: (id: string) => void;
  onViewAll?: () => void;
}) {
  return (
    <section className="invoice-card">

      <div className="section-header invoice-section-header">
        <div>
          <div className="section-kicker">
            BILLING ACTIVITY
          </div>

          <h2>Recent invoices</h2>

          <p>
            Sample invoices and backend overdue records.
          </p>
        </div>

        {onViewAll && (
          <button
            className="view-all-button"
            onClick={onViewAll}
          >
            View all invoices
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="invoice-table">
          <thead>
            <tr>
              <th>INVOICE</th>
              <th>CUSTOMER</th>
              <th>ISSUED ON / DUE</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {invoices.length ? (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <span className="invoice-id">
                      {invoice.id}
                    </span>
                  </td>

                  <td>
                    <div className="customer-cell">
                      <div className="customer-avatar">
                        {invoice.initials}
                      </div>

                      <span>{invoice.customer}</span>
                    </div>
                  </td>

                  <td className="invoice-date">
                    {invoice.date}
                  </td>

                  <td className="invoice-amount">
                    {invoice.amount}
                  </td>

                  <td>
                    <span
                      className={`status ${invoice.status.toLowerCase()}`}
                    >
                      <i />
                      {invoice.status}
                    </span>
                  </td>

                  <td>
                    <div className="row-action-container">
                      <button
                        className="row-action"
                        aria-label={`Actions for ${invoice.id}`}
                        onClick={() =>
                          setMenu(
                            menu === invoice.id ? "" : invoice.id
                          )
                        }
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {menu === invoice.id && (
                        <div className="action-popover row-popover">
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setMenu("");
                            }}
                          >
                            <Eye size={14} />
                            View details
                          </button>

                          <button
                            onClick={() =>
                              copyInvoiceId(invoice.id)
                            }
                          >
                            <Copy size={14} />
                            Copy ID
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty-state">
                  No invoices match "{searchQuery}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="invoice-footer">
        <span>
          Showing {invoices.length} records
        </span>

        <span>
          Includes sample records where marked
        </span>
      </div>

    </section>
  );
}

export default App;
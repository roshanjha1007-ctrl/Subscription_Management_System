
import { useMemo, useState } from "react";
import {
  LayoutDashboard, Package, Users, CreditCard, Receipt,
  ChartNoAxesCombined, Bot, Settings, Bell, Search,
  ChevronDown, Menu, X, ArrowUpRight,
  MoreHorizontal, CalendarDays, Download, CircleHelp,
  Sparkles, LogOut, User, Eye, Copy, Check, Filter
} from "lucide-react";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Subscriptions", icon: CreditCard },
  { name: "Products & Plans", icon: Package },
  { name: "Customers", icon: Users },
  { name: "Invoices", icon: Receipt },
  { name: "Analytics", icon: ChartNoAxesCombined },
];

// Generate 365 days of deterministic demo revenue data.
const revenueData = Array.from({ length: 365 }, (_, index) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (364 - index));

  const revenue = 1200 + ((index * 7919 + 137) % 2800);

  return {
    date,
    label: date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    revenue,
  };
});

const initialInvoices = [
  { id: "INV-1001", customer: "Acme Technologies", initials: "AT", date: "28 Oct 2026", amount: "₹12,000", status: "Paid" },
  { id: "INV-1002", customer: "Nova Solutions", initials: "NS", date: "27 Oct 2026", amount: "₹8,500", status: "Pending" },
  { id: "INV-1003", customer: "Pixel Studios", initials: "PS", date: "26 Oct 2026", amount: "₹15,000", status: "Paid" },
  { id: "INV-1004", customer: "CloudNine Pvt Ltd", initials: "CN", date: "25 Oct 2026", amount: "₹6,800", status: "Overdue" },
];

const stats = [
  { label: "Total revenue", value: "₹4,85,000", change: "+12.8%", description: "Compared to last month", icon: ArrowUpRight, accent: "lime" },
  { label: "Active subscriptions", value: "248", change: "+8.2%", description: "Compared to last month", icon: CreditCard, accent: "blue" },
  { label: "Monthly recurring revenue", value: "₹1,24,500", change: "+6.4%", description: "Compared to last month", icon: ChartNoAxesCombined, accent: "violet" },
  { label: "Outstanding invoices", value: "₹32,800", change: "4 invoices", description: "Awaiting payment", icon: Receipt, accent: "orange" },
];

type Invoice = typeof initialInvoices[number];

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("Last 30 days");
  const [menu, setMenu] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [copied, setCopied] = useState(false);

  const invoices = initialInvoices;

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.id.toLowerCase().includes(query) ||
        invoice.customer.toLowerCase().includes(query) ||
        invoice.status.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  // Filter daily revenue according to the selected date range.
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "This year") {
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      return revenueData.filter(
        item => item.date >= startOfYear && item.date <= today
      );
    }

    const days =
      dateRange === "Last 7 days" ? 7 :
      dateRange === "Last 30 days" ? 30 : 90;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));

    return revenueData.filter(
      item => item.date >= startDate && item.date <= today
    );
  }, [dateRange]);

  const exportInvoices = () => {
    const headers = ["Invoice ID", "Customer", "Date", "Amount", "Status"];

    const rows = filteredInvoices.map(invoice => [
      invoice.id,
      invoice.customer,
      invoice.date,
      invoice.amount,
      invoice.status
    ]);

    const csv = [headers, ...rows]
      .map(row =>
        row.map(value =>
          `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
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

  const changePage = (page: string) => {
    setActivePage(page);
    setMobileSidebarOpen(false);
    setMenu("");
  };

  const pageDescription: Record<string, string> = {
    "Overview": "Here's what's happening with your business today.",
    "Subscriptions": "Monitor and manage your recurring subscriptions.",
    "Products & Plans": "Manage the products and plans offered to customers.",
    "Customers": "Keep track of your customer relationships.",
    "Invoices": "Review and manage your billing activity.",
    "Analytics": "Explore your business performance.",
    "AI Assistant": "Your intelligent business assistant.",
    "Settings": "Manage your workspace preferences."
  };

  return (
    <div className="app-layout">

      {mobileSidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileSidebarOpen ? "sidebar-open" : ""}`}>

        <div className="sidebar-top">
          <button
            className="brand"
            onClick={() => changePage("Overview")}
            aria-label="SubscriptIQ home"
          >
            <div className="brand-mark"><span>S</span><i /></div>
            <span className="brand-name">subscript<span>iq</span></span>
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
            onClick={() => setMenu(menu === "workspace" ? "" : "workspace")}
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
              <button onClick={() => setMenu("")}>Close menu</button>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">WORKSPACE</p>

          <nav className="sidebar-nav" aria-label="Main navigation">
            {navigation.map(item => {
              const Icon = item.icon;
              const isActive = activePage === item.name;

              return (
                <button
                  key={item.name}
                  className={`nav-link ${isActive ? "active" : ""}`}
                  onClick={() => changePage(item.name)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.name}</span>

                  {item.name === "Invoices" && (
                    <span className="nav-count">{invoices.length}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-section tools-section">
          <p className="sidebar-label">INTELLIGENCE</p>

          <button
            className={`nav-link ai-nav-link ${activePage === "AI Assistant" ? "active" : ""}`}
            onClick={() => changePage("AI Assistant")}
          >
            <Bot size={18} />
            <span>AI Assistant</span>
            <span className="ai-tag">AI</span>
          </button>

          <button
            className={`nav-link ${activePage === "Settings" ? "active" : ""}`}
            onClick={() => changePage("Settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>

        <div className="sidebar-spacer" />

        <button
          className="sidebar-help"
          onClick={() => setMenu(menu === "help" ? "" : "help")}
        >
          <div className="help-icon"><CircleHelp size={17} /></div>
          <div>
            <strong>Need a hand?</strong>
            <span>Visit our help center</span>
          </div>
          <ArrowUpRight size={15} />
        </button>

        {menu === "help" && (
          <div className="action-popover">
            <strong>Help center</strong>
            <p>Contact your project administrator for assistance.</p>
            <button onClick={() => setMenu("")}>Close</button>
          </div>
        )}

        <div className="sidebar-profile">
          <div className="profile-avatar">YS</div>

          <div className="profile-details">
            <strong>Yatharth Saini</strong>
            <span>Administrator</span>
          </div>

          <button
            className="profile-menu"
            aria-label="Profile menu"
            onClick={() => setMenu(menu === "profile" ? "" : "profile")}
          >
            <MoreHorizontal size={19} />
          </button>

          {menu === "profile" && (
            <div className="action-popover profile-popover">
              <button onClick={() => changePage("Settings")}>
                <User size={15} /> Account settings
              </button>
              <button onClick={() => setMenu("")}>
                <LogOut size={15} /> Close menu
              </button>
            </div>
          )}
        </div>

      </aside>

      <main className="main-content">

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
                onChange={event => {
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
                onClick={() => setMenu(menu === "notifications" ? "" : "notifications")}
              >
                <Bell size={19} />
                <span className="notification-indicator" />
              </button>

              {menu === "notifications" && (
                <div className="action-popover">
                  <strong>Notifications</strong>
                  <p>
                    You have {invoices.filter(i => i.status !== "Paid").length}
                    {" "}invoices awaiting payment.
                  </p>
                  <button
                    onClick={() => {
                      changePage("Invoices");
                      setStatusFilter("Pending");
                    }}
                  >
                    View pending invoices
                  </button>
                  <button onClick={() => setMenu("")}>Close</button>
                </div>
              )}
            </div>

            <button
              className="top-avatar"
              onClick={() => setMenu(menu === "profile" ? "" : "profile")}
            >
              YS
            </button>

          </div>
        </header>

        <section className="dashboard">

          <div className="welcome-row">
            <div className="welcome-copy">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                {activePage === "Overview" ? "BUSINESS OVERVIEW" : activePage.toUpperCase()}
              </div>

              <h1>
                {activePage === "Overview"
                  ? <>Good morning, <span>Yatharth.</span></>
                  : activePage}
              </h1>

              <p className="subtitle">{pageDescription[activePage]}</p>
            </div>

            <div className="welcome-actions">

              {activePage === "Overview" && (
                <label className="date-select">
                  <CalendarDays size={16} />

                  <select
                    value={dateRange}
                    onChange={event => setDateRange(event.target.value)}
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

              <button className="export-button" onClick={exportInvoices}>
                <Download size={16} />
                <span>Export CSV</span>
              </button>

            </div>
          </div>

          <div className="demo-notice">
            <Sparkles size={15} />
            <span>You're viewing a demo workspace. Figures shown are sample data.</span>
          </div>

          {activePage === "Overview" && (
            <>

              <div className="stats-grid">
                {stats.map(stat => {
                  const Icon = stat.icon;

                  return (
                    <article className="stat-card" key={stat.label}>
                      <div className="stat-card-top">
                        <span className="stat-label">{stat.label}</span>
                        <div className={`stat-icon ${stat.accent}`}>
                          <Icon size={18} />
                        </div>
                      </div>

                      <div className="stat-value">{stat.value}</div>

                      <div className="stat-footer">
                        <span className="stat-change positive">
                          <ArrowUpRight size={14} />
                          {stat.change}
                        </span>
                        <span className="stat-description">{stat.description}</span>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="overview-grid">

                <section className="chart-card">

                  <div className="section-header">
                    <div>
                      <div className="section-kicker">PERFORMANCE</div>
                      <h2>Revenue overview</h2>
                      <p>Track how your revenue is growing over time.</p>
                    </div>

                    <button
                      className="icon-button"
                      aria-label="Chart options"
                      onClick={() => setMenu(menu === "chart" ? "" : "chart")}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </div>

                  {menu === "chart" && (
                    <div className="action-popover chart-popover">
                      <strong>Chart period</strong>

                      {["Last 7 days", "Last 30 days", "Last 90 days", "This year"].map(period => (
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
                      ₹{chartData.reduce((sum, item) => sum + item.revenue, 0).toLocaleString("en-IN")}
                    </div>

                    <div className="chart-growth">
                      <ArrowUpRight size={15} />
                      12.8%
                      <span>vs. previous month</span>
                    </div>
                  </div>

                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#55b8ac" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#55b8ac" stopOpacity={0} />
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
                            dateRange === "Last 7 days" ? 0 :
                            dateRange === "Last 30 days" ? 4 :
                            dateRange === "Last 90 days" ? 13 :
                            "preserveStartEnd"
                          }
                          stroke="#9aabaa"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#9aabaa", fontSize: 12 }}
                          dy={10}
                        />

                        <YAxis
                          stroke="#9aabaa"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#9aabaa", fontSize: 11 }}
                          tickFormatter={value => `₹${value / 1000}k`}
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#172629",
                            border: "1px solid #2b4142",
                            borderRadius: "10px",
                            color: "#edf4f2",
                            fontSize: "12px"
                          }}
                          labelFormatter={label => `Date: ${label}`}
                          formatter={value => [
                            `₹${Number(value).toLocaleString("en-IN")}`,
                            "Revenue"
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
                    <span><i className="legend-dot" />Revenue</span>
                    <span>
                      Sample data · {chartData[0]?.label} – {chartData[chartData.length - 1]?.label}
                    </span>
                  </div>

                </section>

                <aside className="insight-card">

                  <div className="insight-top">
                    <div className="insight-icon"><Sparkles size={18} /></div>
                    <span className="insight-label">SUBSCRIPTIQ INSIGHTS</span>
                    <span className="insight-status">PREVIEW</span>
                  </div>

                  <h3>A clearer picture of your business.</h3>
                  <p>
                    Bring subscriptions, revenue and billing activity together in one place.
                  </p>

                  <div className="insight-divider" />

                  <div className="insight-metric">
                    <span>Active subscriptions</span>
                    <strong>248</strong>
                  </div>

                  <div className="insight-metric">
                    <span>Pending invoices</span>
                    <strong>{invoices.filter(i => i.status === "Pending").length}</strong>
                  </div>

                  <div className="insight-metric">
                    <span>Monthly recurring revenue</span>
                    <strong>₹1.24L</strong>
                  </div>

                  <div className="insight-bottom">
                    <span>All figures are sample data</span>
                    <ArrowUpRight size={16} />
                  </div>

                </aside>

              </div>

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

          {activePage === "Invoices" && (
            <section className="invoice-card">

              <div className="section-header invoice-section-header">
                <div>
                  <div className="section-kicker">BILLING ACTIVITY</div>
                  <h2>All invoices</h2>
                  <p>Search, filter and inspect your sample invoices.</p>
                </div>

                <label className="date-select">
                  <Filter size={15} />

                  <select
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value)}
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

          {activePage !== "Overview" && activePage !== "Invoices" && (
            <section className="invoice-card">

              <div className="section-header">
                <div>
                  <div className="section-kicker">WORKSPACE</div>
                  <h2>{activePage}</h2>
                  <p>{pageDescription[activePage]}</p>
                </div>
              </div>

              <div className="empty-state" style={{ padding: "60px 20px" }}>
                <Sparkles size={25} />
                <h3>{activePage} module</h3>
                <p>
                  This section's interface is not connected yet.
                  It will need its own data and backend integration.
                </p>

                <button
                  className="view-all-button"
                  onClick={() => changePage("Overview")}
                >
                  Back to overview <ArrowUpRight size={15} />
                </button>
              </div>

            </section>
          )}

          <footer className="dashboard-footer">
            <span>© 2026 SubscriptIQ</span>
            <span>Subscription management, made clearer.</span>
          </footer>

        </section>

      </main>

      {selectedInvoice && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedInvoice(null)}
        >
          <section
            className="invoice-modal"
            onClick={event => event.stopPropagation()}
          >

            <div className="section-header">
              <div>
                <div className="section-kicker">INVOICE DETAILS</div>
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
              <p><span>Customer</span><strong>{selectedInvoice.customer}</strong></p>
              <p><span>Issued on</span><strong>{selectedInvoice.date}</strong></p>
              <p><span>Amount</span><strong>{selectedInvoice.amount}</strong></p>
              <p><span>Status</span><strong>{selectedInvoice.status}</strong></p>
            </div>

            <button
              className="export-button"
              onClick={() => copyInvoiceId(selectedInvoice.id)}
            >
              <Copy size={15} /> Copy invoice ID
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
          <Check size={15} /> Copied
        </div>
      )}

    </div>
  );
}

function InvoiceTable({
  invoices,
  searchQuery,
  setSelectedInvoice,
  setMenu,
  menu,
  copyInvoiceId,
  onViewAll
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
          <div className="section-kicker">BILLING ACTIVITY</div>
          <h2>Recent invoices</h2>
          <p>A quick look at your latest transactions.</p>
        </div>

        {onViewAll && (
          <button className="view-all-button" onClick={onViewAll}>
            View all invoices <ArrowUpRight size={15} />
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="invoice-table">

          <thead>
            <tr>
              <th>INVOICE</th>
              <th>CUSTOMER</th>
              <th>ISSUED ON</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {invoices.length ? (
              invoices.map(invoice => (
                <tr key={invoice.id}>

                  <td>
                    <span className="invoice-id">{invoice.id}</span>
                  </td>

                  <td>
                    <div className="customer-cell">
                      <div className="customer-avatar">{invoice.initials}</div>
                      <span>{invoice.customer}</span>
                    </div>
                  </td>

                  <td className="invoice-date">{invoice.date}</td>
                  <td className="invoice-amount">{invoice.amount}</td>

                  <td>
                    <span className={`status ${invoice.status.toLowerCase()}`}>
                      <i />
                      {invoice.status}
                    </span>
                  </td>

                  <td>
                    <div className="row-action-container">

                      <button
                        className="row-action"
                        aria-label={`Actions for ${invoice.id}`}
                        onClick={() => setMenu(menu === invoice.id ? "" : invoice.id)}
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
                            <Eye size={14} /> View details
                          </button>

                          <button onClick={() => copyInvoiceId(invoice.id)}>
                            <Copy size={14} /> Copy ID
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
        <span>Showing {invoices.length} sample invoices</span>
        <span>Demo data only</span>
      </div>

    </section>
  );
}

export default App;

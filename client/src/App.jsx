import React, { useState, useEffect } from 'react';
import './App.css';

// --- API Helper ---
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let errMsg = await res.text();
    try {
      const parsed = JSON.parse(errMsg);
      if (parsed.error) errMsg = parsed.error;
    } catch (e) { }
    throw new Error(errMsg);
  }
  return res.json();
}

// Helper to get local date string YYYY-MM-DD
const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
  const [view, setView] = useState('dashboard'); // dashboard, customers, daily, billing, settings
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [notification, setNotification] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const login = (u, p) => {
    fetchAPI('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
      .then(res => {
        setToken(res.token);
        localStorage.setItem('token', res.token);
        setView('dashboard');
      })
      .catch(() => alert('Invalid Credentials'));
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  const navigate = (v) => {
    setView(v);
    setIsSidebarOpen(false);
  };

  if (!token) return <Login onLogin={login} />;

  return (
    <div className="app-layout">
      {/* Sidebar Overlay/Backdrop */}
      {isSidebarOpen && <div className="backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

      <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? '✖' : '☰'}
      </button>

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>🥛 Milkman</h1>
        </div>

        <nav className="nav-links">
          <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>Dashboard</div>
          <div className={`nav-item ${view === 'daily' ? 'active' : ''}`} onClick={() => navigate('daily')}>Daily Log</div>
          <div className={`nav-item ${view === 'customers' ? 'active' : ''}`} onClick={() => navigate('customers')}>Customers</div>
          <div className={`nav-item ${view === 'billing' ? 'active' : ''}`} onClick={() => navigate('billing')}>Billing</div>
          <div className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>Settings</div>
        </nav>

        <div className="user-section" style={{ marginTop: 'auto' }}>
          <div className="flex-row" style={{ justifyContent: 'flex-start', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            <div className="user-profile">Logged in as Admin</div>
          </div>
          <button className="secondary" onClick={logout} style={{ width: '100%' }}>Logout</button>
        </div>
      </aside>

      {notification && (
        <div className="card fade-in" style={{
          padding: '1rem',
          background: 'rgba(16, 185, 129, 0.9)', // Success Green
          color: 'white',
          position: 'fixed', top: 20, right: 20, zIndex: 100,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {notification}
        </div>
      )}

      <main className="main-content">
        <div className="fade-in">
          {view === 'dashboard' && <Dashboard navigate={navigate} />}
          {view === 'customers' && <Customers showNotif={showNotification} />}
          {view === 'settings' && <Settings showNotif={showNotification} />}
          {view === 'daily' && <DailyLog showNotif={showNotification} />}
          {view === 'billing' && <Billing showNotif={showNotification} />}
        </div>
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-color)' }}>
      <div className="card" style={{ width: '320px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🥛</h1>
        <h2 style={{ marginBottom: '2rem' }}>Milkman Login</h2>
        <input placeholder="Username" value={u} onChange={e => setU(e.target.value)} />
        <input type="password" placeholder="Password" value={p} onChange={e => setP(e.target.value)} />
        <button className="primary" onClick={() => onLogin(u, p)} style={{ width: '100%', marginTop: '1rem' }}>Login</button>
        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          (Default: admin / admin123)
        </div>
      </div>
    </div>
  );
}

// --- Components ---
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

function Dashboard({ navigate }) {
  const [stats, setStats] = useState({ customers: 0, todayVolume: 0 });
  const [chartData, setChartData] = useState([]);
  const [price, setPrice] = useState('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [salesData, setSalesData] = useState([]);
  const [salesPeriod, setSalesPeriod] = useState('daily'); // daily, weekly, monthly

  useEffect(() => {
    Promise.all([
      fetchAPI('/customers'),
      fetchAPI(`/deliveries?date=${getTodayDate()}`),
      fetchAPI('/settings')
    ]).then(([custs, deliveries, settings]) => {
      const vol = deliveries.reduce((acc, d) => acc + (d.quantity || 0), 0);
      setStats({ customers: custs.length, todayVolume: vol });
      setPrice(settings.milk_price || '0');
      setNewPrice(settings.milk_price || '0');

      const delivered = deliveries.filter(d => d.is_delivered).length;
      const pending = deliveries.length - delivered;

      setChartData([
        { name: 'Delivered', value: delivered, color: '#34d399' }, // Brighter Green
        { name: 'Pending', value: pending, color: '#f87171' }     // Brighter Red
      ]);
    });
  }, []);

  useEffect(() => {
    fetchAPI(`/sales-history?period=${salesPeriod}`)
      .then(data => setSalesData(data))
      .catch(console.error);
  }, [salesPeriod]);

  const updatePrice = () => {
    fetchAPI('/settings', {
      method: 'POST',
      body: JSON.stringify({ key: 'milk_price', value: newPrice })
    }).then(() => {
      setPrice(newPrice);
      setIsEditingPrice(false);
      alert("Global Milk Price Updated!");
    });
  };

  return (
    <div>
      <h2 style={{ fontSize: '2rem' }}>Dashboard</h2>
      <div className="grid">
        <div className="card">
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase' }}>Total Customers</h3>
          <div className="stat-value">{stats.customers}</div>
        </div>
        <div className="card">
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase' }}>Today's Volume (L)</h3>
          <div className="stat-value">{stats.todayVolume}</div>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.8rem' }}>Based on defaults & overrides</p>
        </div>

        {/* Price Card */}
        <div className="card">
          <div className="flex-row">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', margin: 0 }}>Price / Liter</h3>
            {!isEditingPrice && (
              <button className="secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setIsEditingPrice(true)}>Edit</button>
            )}
          </div>

          {isEditingPrice ? (
            <div style={{ marginTop: '1rem' }}>
              <input
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold', padding: '0.5rem', textAlign: 'center' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="primary" style={{ flex: 1 }} onClick={updatePrice}>Save</button>
                <button className="secondary" style={{ flex: 1 }} onClick={() => setIsEditingPrice(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="stat-value">₹{price}</div>
          )}
        </div>

        {/* Daily Log Shortcut */}
        <div className="card" onClick={() => navigate('daily')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.4))' }}>📝</div>
          <h3 style={{ color: '#fff', margin: 0 }}>Daily Log</h3>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage Deliveries</p>
        </div>
      </div>

      {/* Sales Chart Section */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="flex-row" style={{ marginBottom: '1rem', alignItems: 'center' }}>
          <h3>Sales Overview</h3>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem', borderRadius: '12px' }}>
            {['daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setSalesPeriod(p)}
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.8rem',
                  background: salesPeriod === p ? 'var(--primary)' : 'transparent',
                  color: salesPeriod === p ? 'white' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  boxShadow: salesPeriod === p ? '0 0 15px rgba(139, 92, 246, 0.3)' : 'none',
                  border: 'none'
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(11, 15, 25, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                itemStyle={{ color: '#fff', fontSize: '0.9rem' }}
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
              />
              <Area type="monotone" dataKey="total_quantity" name="Liters Sold" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
          {salesData.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '-150px' }}>No sales data for this period</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Delivery Status (Today)</h3>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'rgba(11, 15, 25, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
                itemStyle={{ color: '#fff', fontWeight: 500 }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Settings({ showNotif }) {
  const [price, setPrice] = useState('');

  useEffect(() => {
    fetchAPI('/settings').then(data => setPrice(data.milk_price || ''));
  }, []);

  const save = () => {
    fetchAPI('/settings', {
      method: 'POST',
      body: JSON.stringify({ key: 'milk_price', value: price })
    }).then(() => showNotif("Price updated!"));
  };

  return (
    <div className="card" style={{ maxWidth: '500px' }}>
      <h2>Global Settings</h2>
      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Milk Price per Liter (₹)</label>
      <input type="number" value={price} onChange={e => setPrice(e.target.value)} />
      <button className="primary" onClick={save} style={{ width: '100%' }}>Save Price</button>
    </div>
  );
}

// --- Customers Component ---
function Customers({ showNotif }) {
  const [customers, setCustomers] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', mobile: '', area: '', default_quantity: 1 });
  const [addError, setAddError] = useState(null);
  const [editError, setEditError] = useState(null);
  const [editingCust, setEditingCust] = useState(null);

  const load = () => fetchAPI('/customers').then(setCustomers);
  useEffect(() => { load(); }, []);

  const addCustomer = () => {
    setAddError(null);
    if (!/^\d{10}$/.test(newCust.mobile)) {
      setAddError("Please enter a valid 10-digit mobile number.");
      return;
    }

    fetchAPI('/customers', { method: 'POST', body: JSON.stringify(newCust) })
      .then(() => {
        showNotif("Customer Added!");
        setIsAdding(false);
        setNewCust({ name: '', mobile: '', area: '', default_quantity: 1 });
        setAddError(null);
        load();
      })
      .catch(err => setAddError(err.message || "Failed to add customer"));
  };

  const updateDefault = (id, newQty) => {
    const date = prompt("Effective Date (YYYY-MM-DD):", getTodayDate());
    if (!date) return;

    fetchAPI(`/customers/${id}/update-quantity`, {
      method: 'POST',
      body: JSON.stringify({ new_quantity: newQty, effective_date: date })
    }).then(() => {
      showNotif("Quantity Updated!");
      load();
    });
  };

  const deleteCustomer = (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;

    fetchAPI(`/customers/${id}`, { method: 'DELETE' })
      .then(() => {
        showNotif("Customer Deleted");
        load();
      });
  };

  const startEdit = (c) => {
    setEditError(null);
    setEditingCust({ ...c });
  };

  const saveEdit = () => {
    setEditError(null);
    if (!/^\d{10}$/.test(editingCust.mobile)) {
      setEditError("Please enter a valid 10-digit mobile number.");
      return;
    }

    fetchAPI(`/customers/${editingCust.id}/update-info`, {
      method: 'POST',
      body: JSON.stringify({ name: editingCust.name, mobile: editingCust.mobile, area: editingCust.area })
    }).then(() => {
      showNotif("Info Updated!");
      setEditingCust(null);
      setEditError(null);
      load();
    })
      .catch(err => setEditError(err.message || "Failed to update"));
  };

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1rem' }}>
        <h2>Customers</h2>
        <button className="primary" onClick={() => { setIsAdding(!isAdding); setAddError(null); }}>{isAdding ? 'Cancel' : '+ Add Customer'}</button>
      </div>

      {isAdding && (
        <div className="card fade-in">
          <h3>New Customer</h3>
          {addError && (
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              ⚠️ {addError}
            </div>
          )}
          <div className="grid">
            <input placeholder="Name" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} />
            <input
              placeholder="Mobile (10 digits)"
              type="tel"
              maxLength="10"
              pattern="\d{10}"
              value={newCust.mobile}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length <= 10) setNewCust({ ...newCust, mobile: val });
              }}
            />
            <input placeholder="Area / Street Name" value={newCust.area} onChange={e => setNewCust({ ...newCust, area: e.target.value })} />
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Default Quantity (L)</label>
              <select value={newCust.default_quantity} onChange={e => setNewCust({ ...newCust, default_quantity: parseFloat(e.target.value) })}>
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3].map(q => (
                  <option key={q} value={q}>{q} L</option>
                ))}
              </select>
            </div>
          </div>
          <button className="primary" onClick={addCustomer} style={{ marginTop: '1rem', width: '100%' }}>Save Customer</button>
        </div>
      )}

      {editingCust && (
        <div className="card fade-in" style={{ border: '1px solid var(--primary)' }}>
          <h3>Edit Customer Info</h3>
          {editError && (
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              ⚠️ {editError}
            </div>
          )}
          <div className="grid">
            <input placeholder="Name" value={editingCust.name} onChange={e => setEditingCust({ ...editingCust, name: e.target.value })} />
            <input
              placeholder="Mobile (10 digits)"
              type="tel"
              maxLength="10"
              pattern="\d{10}"
              value={editingCust.mobile}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length <= 10) setEditingCust({ ...editingCust, mobile: val });
              }}
            />
            <input placeholder="Area / Street Name" value={editingCust.area} onChange={e => setEditingCust({ ...editingCust, area: e.target.value })} />
          </div>
          <div className="flex-row" style={{ justifyContent: 'flex-start' }}>
            <button className="primary" onClick={saveEdit}>Save Changes</button>
            <button className="secondary" onClick={() => { setEditingCust(null); setEditError(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Area</th>
              <th>Default Qty</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td style={{ color: 'var(--text-secondary)' }}>{c.customer_code}</td>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td>{c.mobile}</td>
                <td>{c.area || '-'}</td>
                <td>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{c.default_quantity} L</span>
                  <button className="secondary" style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    onClick={() => updateDefault(c.id, prompt("New Quantity:", c.default_quantity))}>
                    Change
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="secondary" style={{ padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => startEdit(c)}>✏️</button>
                    <button className="secondary" style={{ padding: '0.4rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => deleteCustomer(c.id, c.name)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Modal({ title, children, onConfirm, onCancel, confirmText = "Confirm" }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function DailyLog({ showNotif }) {
  const [date, setDate] = useState(getTodayDate());
  const [deliveries, setDeliveries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qtyInput, setQtyInput] = useState('');
  const [filter, setFilter] = useState('all');
  const dateInputRef = React.useRef(null);

  const handleDateClick = () => {
    if (dateInputRef.current && dateInputRef.current.showPicker) {
      try {
        dateInputRef.current.showPicker();
      } catch (e) {
        // Fallback for older browsers
      }
    }
  };

  const load = () => {
    fetchAPI(`/deliveries?date=${date}`).then(setDeliveries);
  };
  useEffect(() => { load(); }, [date]);

  const openConfirm = (d) => {
    setSelectedItem(d);
    setQtyInput(d.quantity);
    setModalType('confirm');
    setShowModal(true);
  };

  const openOverride = (d) => {
    setSelectedItem(d);
    setQtyInput(d.quantity);
    setModalType('override');
    setShowModal(true);
  };

  const openND = (d) => {
    setSelectedItem(d);
    setModalType('nd');
    setShowModal(true);
  };

  const handleConfirm = () => {
    if (modalType === 'nd') {
      fetchAPI('/deliveries/mark', {
        method: 'POST',
        body: JSON.stringify({ customer_id: selectedItem.id, date, quantity: 0, status: 'Not Delivered' })
      }).then(() => {
        showNotif("Marked as Not Delivered");
        closeModal();
        load();
      });
      return;
    }

    const val = parseFloat(qtyInput);
    if (isNaN(val)) {
      alert("Invalid Quantity");
      return;
    }

    if (val < 0) {
      alert("Quantity cannot be negative.");
      return;
    }

    if (modalType === 'confirm' && val === 0) {
      alert("Quantity cannot be zero. Please mark as 'Missed' if not delivered.");
      return;
    }

    if (modalType === 'confirm') {
      fetchAPI('/deliveries/mark', {
        method: 'POST',
        body: JSON.stringify({ customer_id: selectedItem.id, date, quantity: val })
      }).then(() => {
        showNotif("Marked as Delivered!");
        closeModal();
        load();
      });
    } else if (modalType === 'override') {
      fetchAPI('/overrides', {
        method: 'POST',
        body: JSON.stringify({ customer_id: selectedItem.id, date, quantity: val })
      }).then(() => {
        showNotif("Override Set!");
        closeModal();
        load();
      });
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setQtyInput('');
  };

  const totalVolume = deliveries.reduce((acc, d) => acc + (d.quantity || 0), 0);
  const deliveredVolume = deliveries.filter(d => d.is_delivered).reduce((acc, d) => acc + (d.quantity || 0), 0);
  const pendingVolume = deliveries.filter(d => !d.is_delivered && d.delivery_status !== 'Not Delivered').reduce((acc, d) => acc + (d.quantity || 0), 0);
  const missedVolume = deliveries.filter(d => d.delivery_status === 'Not Delivered').reduce((acc, d) => acc + (d.quantity || 0), 0);

  const filteredDeliveries = deliveries.filter(d => {
    if (filter === 'all') return true;
    if (filter === 'delivered') return d.is_delivered;
    if (filter === 'pending') return !d.is_delivered && d.delivery_status !== 'Not Delivered';
    if (filter === 'missed') return d.delivery_status === 'Not Delivered';
    return true;
  });
  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
  };

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Daily Delivery Log</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)' }} onClick={() => changeDate(-1)}>◀</button>
          
          <div onClick={handleDateClick} style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.5rem 1.5rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', cursor: 'pointer', minWidth: '160px', overflow: 'hidden' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', pointerEvents: 'none' }}>
              {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px', fontWeight: 'bold', textTransform: 'uppercase', pointerEvents: 'none' }}>
              {date === getTodayDate() ? 'Today' : '🗓️ Change Date'}
            </div>
            <input 
              ref={dateInputRef}
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              style={{ position: 'absolute', bottom: 0, right: 0, width: '1px', height: '1px', opacity: 0, border: 'none', padding: 0 }} 
            />
          </div>

          <button style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)' }} onClick={() => changeDate(1)}>▶</button>
          
          {date !== getTodayDate() && (
            <button className="secondary fade-in" style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', marginLeft: '0.5rem', whiteSpace: 'nowrap' }} onClick={() => setDate(getTodayDate())}>
              Go to Today
            </button>
          )}
        </div>
      </div>

      <div className="grid" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', margin: 0 }}>Total Planned (L)</h3>
          <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>{totalVolume}</div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{deliveries.length} Customers</p>
        </div>
        <div className="card" style={{ padding: '1rem', borderTop: '4px solid #34d399' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', margin: 0 }}>Delivered (L)</h3>
          <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '0.5rem', color: '#34d399' }}>{deliveredVolume}</div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{deliveries.filter(d => d.is_delivered).length} Customers</p>
        </div>
        <div className="card" style={{ padding: '1rem', borderTop: '4px solid #f87171' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', margin: 0 }}>Pending (L)</h3>
          <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '0.5rem', color: '#f87171' }}>{pendingVolume}</div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{deliveries.filter(d => !d.is_delivered && d.delivery_status !== 'Not Delivered').length} Customers</p>
        </div>
        <div className="card" style={{ padding: '1rem', borderTop: '4px solid #64748b' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', margin: 0 }}>Missed (L)</h3>
          <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '0.5rem', color: '#cbd5e1' }}>{missedVolume}</div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{deliveries.filter(d => d.delivery_status === 'Not Delivered').length} Customers</p>
        </div>
      </div>

      <div className="flex-row" style={{ marginBottom: '1rem', gap: '0.5rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button className={filter === 'all' ? 'primary' : 'secondary'} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '20px' }} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'delivered' ? 'primary' : 'secondary'} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '20px' }} onClick={() => setFilter('delivered')}>Delivered</button>
        <button className={filter === 'pending' ? 'primary' : 'secondary'} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '20px' }} onClick={() => setFilter('pending')}>Pending</button>
        <button className={filter === 'missed' ? 'primary' : 'secondary'} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '20px' }} onClick={() => setFilter('missed')}>Missed</button>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Plan (L)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.map(d => (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Code: {d.customer_code}</div>
                </td>
                <td>
                  {d.quantity} L
                  {d.is_override && <span style={{ color: 'var(--accent)', marginLeft: '5px', fontWeight: 'bold' }}>*</span>}
                </td>
                <td>
                  {d.is_delivered ?
                    <span className="badge success">Delivered</span> :
                    (d.delivery_status === 'Not Delivered' ?
                      <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.3)', color: '#cbd5e1' }}>Missed</span> :
                      <span className="badge pending">Pending</span>
                    )
                  }
                </td>
                <td>
                  {!d.is_delivered && d.delivery_status !== 'Not Delivered' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => openConfirm(d)}>Confirm</button>
                      <button className="secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => openND(d)}>❌</button>

                    </div>
                  )}
                  {(d.is_delivered || d.delivery_status === 'Not Delivered') && (
                    <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                      {d.delivery_status === 'Not Delivered' ? 'Marked Absent' : new Date(d.delivered_at).toLocaleTimeString()}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '1rem', fontSize: '0.8em', color: 'var(--text-muted)' }}>* Indicates planned override</div>
      </div>

      {showModal && (
        <Modal
          title={modalType === 'confirm' ? 'Confirm Delivery' : (modalType === 'nd' ? 'Mark Not Delivered' : 'Adjust Quantity')}
          confirmText={modalType === 'confirm' ? 'Mark Delivered' : (modalType === 'nd' ? 'Confirm Missed' : 'Save Override')}
          onConfirm={handleConfirm}
          onCancel={closeModal}
        >
          {modalType === 'nd' ? (
            <div>
              <div style={{ fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 600 }}>{selectedItem?.name}</div>
              <p style={{ color: 'var(--text-secondary)' }}>Mark as unavailable? Quantity will be 0L.</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 600 }}>{selectedItem?.name}</div>
              <p>Enter quantity for {date}:</p>
              <input type="number" className="modal-input" autoFocus value={qtyInput} onChange={e => setQtyInput(e.target.value)} step="0.25" min="0" />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Billing({ showNotif }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [bills, setBills] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const generate = () => {
    fetchAPI('/bill/generate', {
      method: 'POST',
      body: JSON.stringify({ month, year })
    }).then(res => {
      setBills(res);
      showNotif("Bills Generated & Sent (Mock)!");
    });
  };

  const openPayModal = (bill) => {
    setSelectedBill(bill);
    setShowPayModal(true);
  };

  const handlePay = () => {
    if (!selectedBill) return;
    fetchAPI(`/bill/${selectedBill.id}/pay`, { method: 'POST' }).then(() => {
      showNotif("Marked Paid & Notification Sent");
      setShowPayModal(false);
      setSelectedBill(null);
      generate();
    });
  };

  return (
    <div>
      <h2>Monthly Billing</h2>
      <div className="card">
        <div className="flex-row" style={{ justifyContent: 'flex-start' }}>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ width: '180px' }}>
            {monthNames.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: '120px' }} />
          <button className="primary" onClick={generate}>Generate Bills</button>
        </div>
      </div>

      {bills && (
        <div className="card table-container">
          <h3 style={{ marginBottom: '1rem' }}>Summary for {monthNames[month - 1]} {year}</h3>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Total Milk (L)</th>
                <th>Amount (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td>{b.total_quantity} L</td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>₹{b.total_amount}</td>
                  <td>
                    {b.status === 'Paid' ?
                      <span className="badge success">Paid</span> :
                      <span className="badge pending">Pending</span>
                    }
                  </td>
                  <td>
                    {b.status !== 'Paid' && (
                      <button className="primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => openPayModal(b)}>
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPayModal && (
        <Modal
          title="Confirm Payment"
          onConfirm={handlePay}
          onCancel={() => setShowPayModal(false)}
          confirmText="Mark as Paid"
        >
          <div style={{ textAlign: 'center' }}>
            <p>Customer: <strong>{selectedBill?.name}</strong></p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0', color: 'var(--success)' }}>
              ₹{selectedBill?.total_amount}
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              This will send a WhatsApp confirmation (mock).
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;

import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { BarChart3, BriefcaseBusiness, CalendarClock, ChevronLeft, LayoutDashboard, LogOut, Menu, Users, UserRoundPlus } from 'lucide-react';
import api from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/customers.jsx';
import Leads from './pages/leads.jsx';
import Deals from './pages/Deals.jsx';
import FollowUps from './pages/FollowUPs.jsx';

const links = [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }, { to: '/customers', label: 'Customers', icon: Users }, { to: '/leads', label: 'Leads', icon: UserRoundPlus }, { to: '/deals', label: 'Deals', icon: BriefcaseBusiness }, { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock }];
function Shell({ user, onLogout }) {
  const [compact, setCompact] = useState(false); const navigate = useNavigate();
  async function logout() { await api.post('/auth/logout').catch(() => {}); onLogout(); navigate('/login'); }
  return <div className={`app-shell ${compact ? 'compact' : ''}`}><aside className="sidebar"><div className="brand"><BarChart3 /><span>Simple CRM</span></div><nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon /><span>{label}</span></NavLink>)}</nav><button className="sidebar-toggle" onClick={() => setCompact(!compact)} aria-label="Toggle sidebar">{compact ? <Menu /> : <ChevronLeft />}<span>Collapse</span></button><div className="account"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.email}</small></div><button aria-label="Log out" onClick={logout}><LogOut /></button></div></aside><main className="content"><header className="topbar"><button className="mobile-menu" onClick={() => setCompact(!compact)}><Menu /></button><div><p>Welcome back, {user.name?.split(' ')[0]}!</p><span>Here is what is happening with your business.</span></div></header><Outlet /></main></div>;
}
function Protected({ user, onLogout }) { return user ? <Shell user={user} onLogout={onLogout} /> : <Navigate to="/login" replace />; }
export default function App() { const [user, setUser] = useState(null); const [loading, setLoading] = useState(true); const [toast, setToast] = useState(null); useEffect(() => { api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => {}).finally(() => setLoading(false)); }, []); useEffect(() => { const handler = (event) => { setToast(event.detail); setTimeout(() => setToast(null), 2800); }; window.addEventListener('crm:notice', handler); return () => window.removeEventListener('crm:notice', handler); }, []); if (loading) return <div className="screen-loader"><div className="spinner" />Loading Simple CRM…</div>; return <>{toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}<Routes><Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onAuth={setUser} />} /><Route element={<Protected user={user} onLogout={() => setUser(null)} />}><Route path="/" element={<Dashboard />} /><Route path="/customers" element={<Customers />} /><Route path="/leads" element={<Leads />} /><Route path="/deals" element={<Deals />} /><Route path="/follow-ups" element={<FollowUps />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></>; }

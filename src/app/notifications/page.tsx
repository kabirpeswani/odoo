'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  timestamp: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'notifications' | 'logs'>('notifications');
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notifTypeFilter, setNotifTypeFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [logSearch, setLogSearch] = useState<string>('');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');

  // Simulator state
  const [simulatingType, setSimulatingType] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications and logs');
      const json = await res.json();
      setNotifications(json.notifications || []);
      setLogs(json.logs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_READ', payload: { notificationId: id } })
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_ALL_READ' })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAR_ALL' })
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulate = async (type: 'overdue' | 'maintenance' | 'allocation' | 'booking' | 'audit') => {
    try {
      setSimulatingType(type);
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIMULATE', payload: { type } })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimulatingType(null);
    }
  };

  if (loading && notifications.length === 0 && logs.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Syncing Activity Logs & Notifications...</p>
        </div>
      </div>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--accent-red)' }}>
          <p style={{ color: 'var(--accent-red)', marginBottom: '16px' }}>{error}</p>
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-purple)', color: 'white', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  // Filter logic
  const filteredNotifications = notifications.filter(n => {
    const matchesRead =
      notifFilter === 'all'
        ? true
        : notifFilter === 'unread'
        ? !n.isRead
        : n.isRead;
    const matchesType =
      notifTypeFilter === 'all' ? true : n.type === notifTypeFilter;
    return matchesRead && matchesType;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      l.details.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.userName.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.action.toLowerCase().includes(logSearch.toLowerCase());
    const matchesAction =
      logActionFilter === 'all' ? true : l.action === logActionFilter;
    return matchesSearch && matchesAction;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const getNotifColors = (type: AppNotification['type']) => {
    switch (type) {
      case 'success':
        return { border: '1px solid var(--accent-green)', bg: 'var(--accent-green-glow)', text: 'var(--accent-green)', badgeBg: '#10b981', dotColor: '#10b981' };
      case 'warning':
        return { border: '1px solid var(--accent-yellow)', bg: 'var(--accent-yellow-glow)', text: '#d97706', badgeBg: '#f59e0b', dotColor: '#f59e0b' };
      case 'error':
        return { border: '1px solid var(--accent-red)', bg: 'var(--accent-red-glow)', text: 'var(--accent-red)', badgeBg: '#ef4444', dotColor: '#ef4444' };
      default:
        return { border: '1px solid var(--border)', bg: 'rgba(113, 75, 103, 0.03)', text: 'var(--accent-purple)', badgeBg: 'var(--accent-purple)', dotColor: 'var(--accent-purple)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* TOP HEADER */}
      <header style={{ height: '64px', backgroundColor: 'var(--bg-header)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', letterSpacing: '-0.3px', cursor: 'pointer' }}>AssetFlow</h1>
        </Link>
      </header>

      {/* BODY CONTAINER */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR */}
        <aside style={{ width: '240px', borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg-sidebar)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Dashboard
            </div>
          </Link>

          <Link href="/setup" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Organization setup
            </div>
          </Link>
          
          <Link href="/assets" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Assets</div>
          </Link>

          <Link href="/allocation" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Allocation & Transfer
            </div>
          </Link>

          <Link href="/booking" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Resource Booking
            </div>
          </Link>

          <Link href="/maintenance" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Maintenance
            </div>
          </Link>

          <Link href="/audit" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Audit
            </div>
          </Link>

          <Link href="/reports" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Reports</div>
          </Link>

          {/* Notifications highlighted active link with Unread Badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '10px 14px', 
            borderRadius: '6px', 
            color: 'var(--accent-purple)', 
            fontWeight: 600, 
            background: 'var(--accent-purple-glow)', 
            border: '1px solid var(--accent-purple)',
            cursor: 'default'
          }}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                backgroundColor: 'var(--accent-purple)', 
                color: 'white', 
                borderRadius: '10px', 
                padding: '2px 6px',
                lineHeight: '1.2'
              }}>
                {unreadCount}
              </span>
            )}
          </div>

        </aside>

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Activity Logs & Notifications</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Track system alerts, returns, audits, and employee actions</p>
            </div>

            {/* Simulated actions panel inside header */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Simulate Alert:</span>
              <button 
                onClick={() => handleSimulate('overdue')} 
                disabled={simulatingType !== null}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--accent-yellow)', backgroundColor: 'var(--accent-yellow-glow)', color: '#d97706', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Overdue
              </button>
              <button 
                onClick={() => handleSimulate('maintenance')} 
                disabled={simulatingType !== null}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--accent-green)', backgroundColor: 'var(--accent-green-glow)', color: 'var(--accent-green)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Maintenance
              </button>
              <button 
                onClick={() => handleSimulate('allocation')} 
                disabled={simulatingType !== null}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--accent-purple)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Allocation
              </button>
              <button 
                onClick={() => handleSimulate('booking')} 
                disabled={simulatingType !== null}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--accent-blue)', backgroundColor: 'var(--accent-blue-glow)', color: 'var(--accent-blue)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Booking
              </button>
              <button 
                onClick={() => handleSimulate('audit')} 
                disabled={simulatingType !== null}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--accent-red)', backgroundColor: 'var(--accent-red-glow)', color: 'var(--accent-red)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Audit Fail
              </button>
            </div>
          </div>

          {/* DUAL TAB SWITCHER */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '24px' }}>
            <button 
              onClick={() => setActiveTab('notifications')}
              style={{
                padding: '12px 4px',
                border: 'none',
                background: 'none',
                fontSize: '15px',
                fontWeight: activeTab === 'notifications' ? 700 : 500,
                color: activeTab === 'notifications' ? 'var(--accent-purple)' : 'var(--text-muted)',
                borderBottom: activeTab === 'notifications' ? '3px solid var(--accent-purple)' : '3px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              Notifications
              {unreadCount > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--accent-purple)', color: 'white', borderRadius: '10px', padding: '2px 6px' }}>
                  {unreadCount} new
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              style={{
                padding: '12px 4px',
                border: 'none',
                background: 'none',
                fontSize: '15px',
                fontWeight: activeTab === 'logs' ? 700 : 500,
                color: activeTab === 'logs' ? 'var(--accent-purple)' : 'var(--text-muted)',
                borderBottom: activeTab === 'logs' ? '3px solid var(--accent-purple)' : '3px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              System Audit Logs
            </button>
          </div>

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Filter controls bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  
                  {/* Read status filter */}
                  <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
                    <button 
                      onClick={() => setNotifFilter('all')}
                      style={{ padding: '6px 12px', border: 'none', background: notifFilter === 'all' ? 'var(--accent-purple-glow)' : 'none', color: notifFilter === 'all' ? 'var(--accent-purple)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      All
                    </button>
                    <button 
                      onClick={() => setNotifFilter('unread')}
                      style={{ padding: '6px 12px', border: 'none', background: notifFilter === 'unread' ? 'var(--accent-purple-glow)' : 'none', color: notifFilter === 'unread' ? 'var(--accent-purple)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Unread
                    </button>
                    <button 
                      onClick={() => setNotifFilter('read')}
                      style={{ padding: '6px 12px', border: 'none', background: notifFilter === 'read' ? 'var(--accent-purple-glow)' : 'none', color: notifFilter === 'read' ? 'var(--accent-purple)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Read
                    </button>
                  </div>

                  {/* Type Filter */}
                  <select 
                    value={notifTypeFilter} 
                    onChange={(e) => setNotifTypeFilter(e.target.value as any)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="all">All Alert Types</option>
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>

                </div>

                {/* Clear / Mark Read actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={handleMarkAllRead}
                    disabled={unreadCount === 0}
                    style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: unreadCount === 0 ? 0.5 : 1 }}
                  >
                    Mark all read
                  </button>
                  <button 
                    onClick={handleClearAll}
                    disabled={notifications.length === 0}
                    style={{ padding: '8px 16px', border: '1px solid var(--accent-red)', borderRadius: '6px', backgroundColor: 'var(--accent-red-glow)', color: 'var(--accent-red)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: notifications.length === 0 ? 0.5 : 1 }}
                  >
                    Clear all alerts
                  </button>
                </div>
              </div>

              {/* Notifications Grid / List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map(notif => {
                    const colors = getNotifColors(notif.type);
                    return (
                      <div 
                        key={notif.id}
                        onClick={() => !notif.isRead && handleMarkRead(notif.id)}
                        style={{
                          padding: '16px 20px',
                          borderRadius: '8px',
                          border: colors.border,
                          backgroundColor: notif.isRead ? 'var(--bg-secondary)' : colors.bg,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '16px',
                          cursor: notif.isRead ? 'default' : 'pointer',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                          opacity: notif.isRead ? 0.8 : 1
                        }}
                        className="glow-card"
                      >
                        {/* Unread indicator dot */}
                        {!notif.isRead && (
                          <div style={{
                            position: 'absolute',
                            left: '8px',
                            top: '22px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: colors.dotColor
                          }} />
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, paddingLeft: !notif.isRead ? '8px' : '0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{notif.title}</strong>
                            <span style={{ 
                              fontSize: '9px', 
                              fontWeight: 800, 
                              textTransform: 'uppercase', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              backgroundColor: colors.badgeBg,
                              color: 'white'
                            }}>
                              {notif.type}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{notif.message}</p>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(notif.timestamp)}</span>
                        </div>

                        {/* Actions */}
                        {!notif.isRead && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id); }}
                            style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border)', 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No alerts found matching the filters.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* SYSTEM AUDIT LOGS TAB */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Filter / Search logs control */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Search Input */}
                <div style={{ display: 'flex', flex: 1, minWidth: '240px', position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Search logs by employee, action details, or keyword..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  {logSearch && (
                    <button 
                      onClick={() => setLogSearch('')}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Filter logs by action */}
                <select 
                  value={logActionFilter} 
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', minWidth: '160px' }}
                >
                  <option value="all">All Actions Types</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              {/* Logs Table / Timeline */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Table Header */}
                  <div style={{ display: 'flex', padding: '12px 20px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '180px', flexShrink: 0 }}>Timestamp</div>
                    <div style={{ width: '140px', flexShrink: 0 }}>User / Employee</div>
                    <div style={{ width: '180px', flexShrink: 0 }}>Action Code</div>
                    <div style={{ flex: 1 }}>Details & Metadata</div>
                  </div>

                  {/* Table Rows */}
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log, index) => (
                      <div 
                        key={log.id} 
                        style={{ 
                          display: 'flex', 
                          padding: '14px 20px', 
                          borderBottom: index === filteredLogs.length - 1 ? 'none' : '1px solid var(--border)',
                          fontSize: '13px', 
                          color: 'var(--text-primary)',
                          alignItems: 'center',
                          backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)'
                        }}
                      >
                        <div style={{ width: '180px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
                          {formatDate(log.timestamp)}
                        </div>
                        <div style={{ width: '140px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{log.userName}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ID: {log.userId}</span>
                        </div>
                        <div style={{ width: '180px', flexShrink: 0 }}>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            fontFamily: 'monospace',
                            backgroundColor: 'var(--border)', 
                            color: 'var(--text-secondary)',
                            padding: '3px 8px',
                            borderRadius: '4px'
                          }}>
                            {log.action}
                          </span>
                        </div>
                        <div style={{ flex: 1, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {log.details}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                      <p style={{ fontSize: '14px', fontWeight: 500 }}>No audit logs match the filters or search term.</p>
                    </div>
                  )}

                </div>
              </div>

            </div>
          )}

        </main>

      </div>

    </div>
  );
}

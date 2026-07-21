import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../utils/api';
import styles from './SolderPasteManagement.module.css';
import { FlaskConical, List, X, Plus, Edit2, Trash2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Timer, Zap, ChevronRight, ChevronDown } from 'lucide-react';

interface Can { 
  id: string; 
  master_id: string; 
  model: string; 
  make: string; 
  can_id: string; 
  manufacturing_date: string; 
  expiry_date: string; 
  total_weight_g: number; 
  used_weight_g: number; 
  remaining_weight_g: number; 
  min_thawing_hours: number; 
  max_working_hours: number; 
  is_active: boolean; 
  is_expired: boolean; 
}

interface Session { 
  id: string; 
  can_id: string; 
  removed_at: string; 
  thawing_ready_at: string; 
  working_expires_at: string; 
  operator: string; 
}

interface CanForm { 
  master_id: string;
  model: string; 
  make: string; 
  can_id: string; 
  manufacturing_date: string; 
  expiry_date: string; 
  total_weight_g: string; 
  used_weight_g: string; 
  min_thawing_hours: string; 
  max_working_hours: string; 
  is_active: boolean; 
}

const fmtDT = (d: Date) => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtMs = (ms: number) => { 
  if (ms <= 0) return '0s'; 
  const h = Math.floor(ms / 3600000), 
        m = Math.floor((ms % 3600000) / 60000), 
        s = Math.floor((ms % 60000) / 1000); 
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`; 
};
const pct = (u: number, t: number) => t > 0 ? Math.min(100, Math.round((u / t) * 100)) : 0;

const EMPTY: CanForm = { 
  master_id: '',
  model: '', 
  make: '', 
  can_id: '', 
  manufacturing_date: '', 
  expiry_date: '', 
  total_weight_g: '', 
  used_weight_g: '0', 
  min_thawing_hours: '4', 
  max_working_hours: '8', 
  is_active: true 
};

const api = {
  models: () => apiFetch('/api/smt/sp-master/models'),
  updateModel: (id: string, b: any) => apiFetch(`/api/smt/sp-master/models/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  fifo: (model: string) => apiFetch(`/api/smt/sp-master/fifo?model=${encodeURIComponent(model)}`),
  latestSession: (cid: string) => apiFetch(`/api/smt/sp-master/sessions/latest?canId=${cid}`),
  startSession: (b: any) => apiFetch('/api/smt/sp-master/sessions', { method: 'POST', body: JSON.stringify(b) }),
  consume: (b: any) => apiFetch('/api/smt/sp-master/consume', { method: 'POST', body: JSON.stringify(b) }),
  getCans: (s: string, f: string, sort: string, pg: number) => apiFetch(`/api/smt/sp-master/cans?search=${encodeURIComponent(s)}&filter=${f}&sort=${sort}&page=${pg}&limit=100`),
  createCan: (b: any) => apiFetch('/api/smt/sp-master/cans', { method: 'POST', body: JSON.stringify(b) }),
  updateCan: (id: string, b: any) => apiFetch(`/api/smt/sp-master/cans/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteCan: (id: string) => apiFetch(`/api/smt/sp-master/cans/${id}`, { method: 'DELETE' }),
};

// ─── Operation View ──────────────────────────────────────────────────────────
const OperationView: React.FC<{ onMasterList: () => void }> = ({ onMasterList }) => {
  const [models, setModels] = useState<{ id: string; model: string; make: string }[]>([]);
  const [selModel, setSelModel] = useState('');
  const [can, setCan] = useState<Can | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(new Date());
  const [consumeW, setConsumeW] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
  const [startingSession, setStartingSession] = useState(false);

  useEffect(() => { 
    api.models()
      .then((data: any) => {
        // Unique model strings list
        const distinctModels: { id: string; model: string; make: string }[] = [];
        const seen = new Set();
        data.forEach((item: any) => {
          if (!seen.has(item.model)) {
            seen.add(item.model);
            distinctModels.push(item);
          }
        });
        setModels(distinctModels);
      })
      .catch(() => {}); 
  }, []);

  useEffect(() => { 
    const t = setInterval(() => setNow(new Date()), 1000); 
    return () => clearInterval(t); 
  }, []);

  const loadCanAndSession = useCallback(async (model: string) => {
    if (!model) { 
      setCan(null); 
      setSession(null); 
      return; 
    }
    setLoading(true); 
    setMsg(null);
    try {
      const c = await api.fifo(model);
      setCan(c);
      try {
        const s = await api.latestSession(c.id);
        setSession(s);
      } catch {
        setSession(null);
      }
    } catch (e: any) {
      setCan(null);
      setSession(null);
      setMsg({ type: 'warn', text: e.message || 'No Available Solder Paste Can' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { 
    loadCanAndSession(selModel); 
  }, [selModel, loadCanAndSession]);

  const handleStartSession = async () => {
    if (!can) return;
    setStartingSession(true); 
    setMsg(null);
    try {
      const d = await api.startSession({ can_id: can.id, operator: 'Operator' });
      setMsg({ type: 'success', text: `Session started for Can ID ${d.data.can_id || can.can_id} – timers are running` });
      // Reload session
      await loadCanAndSession(selModel);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed' });
    }
    setStartingSession(false);
  };

  const handleConsume = async () => {
    if (!can || !consumeW) return;
    const w = parseFloat(consumeW);
    if (isNaN(w) || w <= 0) { 
      setMsg({ type: 'error', text: 'Enter a valid positive weight' }); 
      return; 
    }
    setLoading(true); 
    setMsg(null);
    try {
      const d = await api.consume({ 
        can_id: can.id, 
        session_id: session?.id || null, 
        weight_consumed_g: w, 
        consumed_by: 'Operator' 
      });
      setMsg({ type: 'success', text: `${w}g recorded. Remaining: ${d.can_remaining_weight_g.toFixed(1)}g` });
      setConsumeW('');
      if (d.can_exhausted) {
        setMsg({ type: 'warn', text: 'Can exhausted! Switching to next FIFO can...' });
        setTimeout(() => loadCanAndSession(selModel), 1500);
      } else {
        await loadCanAndSession(selModel);
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed' });
    }
    setLoading(false);
  };

  // Status calculations
  const nowMs = now.getTime();
  const expiryDate = can ? new Date(can.expiry_date) : null;
  const isExpired = expiryDate ? now > expiryDate : false;
  const thawReadyAt = session ? new Date(session.thawing_ready_at) : null;
  const workExpAt = session ? new Date(session.working_expires_at) : null;
  const isThawDone = thawReadyAt ? nowMs >= thawReadyAt.getTime() : false;
  const isWorkExp = workExpAt ? nowMs >= workExpAt.getTime() : false;
  const thawRemMs = thawReadyAt ? Math.max(0, thawReadyAt.getTime() - nowMs) : 0;
  const workRemMs = workExpAt ? Math.max(0, workExpAt.getTime() - nowMs) : 0;
  const workUsedMs = thawReadyAt && isThawDone ? Math.min(nowMs - thawReadyAt.getTime(), workExpAt ? workExpAt.getTime() - thawReadyAt.getTime() : 0) : 0;
  const usedPct = can ? pct(can.used_weight_g, can.total_weight_g) : 0;
  const barCls = usedPct > 90 ? styles.weightBarFillCritical : usedPct > 70 ? styles.weightBarFillLow : styles.weightBarFill;
  const canBlock = !isExpired && (!isWorkExp || !session);

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><FlaskConical size={22}/></div>
          <div>
            <p className={styles.headerTitle}>Solder Paste Management</p>
            <p className={styles.headerSub}>FIFO-based automatic can selection</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={`${styles.btnNav}`} onClick={onMasterList}><List size={15}/> Master List</button>
        </div>
      </div>
      <div className={styles.body}>
        {msg && (
          <div className={`${styles.alertBox} ${msg.type === 'error' ? styles.alertError : msg.type === 'success' ? styles.alertSuccess : styles.alertWarning}`}>
            {msg.type === 'error' ? <XCircle size={16}/> : <CheckCircle2 size={16}/>}
            {msg.text}
          </div>
        )}
        <div className={styles.opGrid}>
          {/* Left Panel */}
          <div>
            <div className={styles.card}>
              <p className={styles.cardTitle}><ChevronRight size={16}/> Select Model</p>
              <div className={styles.modelLabel}>Solder Paste Model</div>
              <select className={styles.modelSelect} value={selModel} onChange={e => { setSelModel(e.target.value); setSession(null); }}>
                <option value=''>-- Select Model --</option>
                {models.map(m => <option key={m.id} value={m.model}>{m.model} – {m.make}</option>)}
              </select>
              {can && (
                <div className={styles.removalTime}>
                  <div className={styles.removalLabel}><Clock size={12} style={{ display: 'inline', marginRight: 4 }}/>Current Date & Time</div>
                  <div className={styles.removalVal}>{fmtDT(now)}</div>
                  {session && <div style={{ fontSize: '0.75rem', color: '#1d4ed8', marginTop: '0.3rem' }}>Removed: {fmtDT(new Date(session.removed_at))}</div>}
                </div>
              )}
            </div>
            {can && (
              <div className={styles.card} style={{ marginTop: '1rem' }}>
                <p className={styles.cardTitle}><FlaskConical size={16}/> Can Details (FIFO)</p>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}><div className={styles.detailKey}>Make</div><div className={styles.detailVal}>{can.make}</div></div>
                  <div className={styles.detailItem}>
                    <div className={styles.detailKey}>Can ID</div>
                    <div className={`${styles.detailVal} ${styles.detailValGreen}`}>
                      {can.can_id} <span className={styles.fifoBadge}>🟢 FIFO</span>
                    </div>
                  </div>
                  <div className={styles.detailItem}><div className={styles.detailKey}>Mfg Date</div><div className={styles.detailVal}>{fmtDate(can.manufacturing_date)}</div></div>
                  <div className={styles.detailItem}><div className={styles.detailKey}>Expiry</div><div className={`${styles.detailVal} ${isExpired ? styles.detailValRed : styles.detailValGreen}`}>{fmtDate(can.expiry_date)}</div></div>
                  <div className={styles.detailItem}><div className={styles.detailKey}>Total</div><div className={styles.detailVal}>{Number(can.total_weight_g).toFixed(1)}g</div></div>
                  <div className={styles.detailItem}><div className={styles.detailKey}>Used</div><div className={styles.detailVal}>{Number(can.used_weight_g).toFixed(1)}g</div></div>
                  <div className={`${styles.detailItem}`} style={{ gridColumn: '1/-1' }}>
                    <div className={styles.detailKey}>Remaining Weight</div>
                    <div className={`${styles.detailVal} ${styles.detailValGreen}`}>{Number(can.remaining_weight_g).toFixed(1)}g ({100 - usedPct}%)</div>
                    <div className={styles.weightBar}><div className={barCls} style={{ width: `${usedPct}%` }}/></div>
                  </div>
                  <div className={styles.detailItem}><div className={styles.detailKey}>Min Thawing</div><div className={styles.detailVal}>{can.min_thawing_hours}h</div></div>
                  <div className={styles.detailItem}><div className={styles.detailKey}>Max Working</div><div className={styles.detailVal}>{can.max_working_hours}h</div></div>
                </div>
              </div>
            )}
          </div>
          {/* Right Panel */}
          <div>
            {can && !session && !isExpired && (
              <div className={styles.card}>
                <p className={styles.cardTitle}>Start Session</p>
                <div className={styles.confirmBlock}>
                  <div className={styles.confirmText}>Click below to record refrigerator removal and start thawing timer.</div>
                  <button className={styles.btnPrimary} onClick={handleStartSession} disabled={startingSession}>{startingSession ? 'Starting...' : 'Confirm Removal from Refrigerator'}</button>
                </div>
              </div>
            )}
            {can && (
              <div className={styles.statusRow} style={{ marginTop: session ? '0' : '1rem' }}>
                <div className={`${styles.statusCard} ${isExpired ? styles.statusCardRed : styles.statusCardGreen}`}>
                  <div className={`${styles.statusIcon} ${isExpired ? styles.statusIconRed : styles.statusIconGreen}`}>{isExpired ? <XCircle size={22}/> : <CheckCircle2 size={22}/>}</div>
                  <div className={styles.statusTitle}>Expiry Status</div>
                  <div className={styles.statusMain}>{isExpired ? 'Paste Expired' : 'Paste Allowed'}</div>
                  <div className={styles.statusSub}>Exp: {fmtDate(can.expiry_date)}</div>
                </div>
                <div className={`${styles.statusCard} ${!session ? styles.statusCardNeutral : isThawDone ? styles.statusCardGreen : styles.statusCardRed}`}>
                  <div className={`${styles.statusIcon} ${!session ? '' : isThawDone ? styles.statusIconGreen : styles.statusIconRed}`}><Clock size={22}/></div>
                  <div className={styles.statusTitle}>Thawing Status</div>
                  <div className={styles.statusMain}>{!session ? 'No Session' : isThawDone ? 'Ready to Use' : 'Not Ready'}</div>
                  <div className={styles.statusSub}>{!session ? '-' : isThawDone ? 'Thawing complete' : `${fmtMs(thawRemMs)} remaining`}</div>
                </div>
                <div className={`${styles.statusCard} ${!session || !isThawDone ? styles.statusCardNeutral : isWorkExp ? styles.statusCardRed : styles.statusCardGreen}`}>
                  <div className={`${styles.statusIcon} ${!session || !isThawDone ? '' : isWorkExp ? styles.statusIconRed : styles.statusIconGreen}`}><Timer size={22}/></div>
                  <div className={styles.statusTitle}>Working Time</div>
                  <div className={styles.statusMain}>{!session || !isThawDone ? 'Waiting' : isWorkExp ? 'Expired' : `${fmtMs(workRemMs)} left`}</div>
                  <div className={styles.statusSub}>{session && isThawDone ? `Used: ${fmtMs(workUsedMs)}` : '-'}</div>
                </div>
              </div>
            )}
            {session && canBlock && (
              <div className={styles.card} style={{ marginTop: '1rem' }}>
                <p className={styles.cardTitle}><Zap size={16}/> Record Consumption</p>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.65rem' }}>Enter the weight of solder paste consumed from this can.</div>
                <div className={styles.consumeRow}>
                  <input className={styles.consumeInput} type='number' min='0.1' step='0.1' placeholder='Weight consumed' value={consumeW} onChange={e => setConsumeW(e.target.value)}/>
                  <span className={styles.consumeUnit}>grams</span>
                  <button className={styles.btnPrimary} onClick={handleConsume} disabled={loading || !consumeW}>Record</button>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.5rem' }}>Remaining: {Number(can?.remaining_weight_g || 0).toFixed(1)}g</div>
              </div>
            )}
            {selModel && !can && !loading && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>⚠️</div>
                <div className={styles.emptyText} style={{ fontWeight: 700, color: '#dc2626', fontSize: '1.2rem' }}>
                  No Available Solder Paste Can
                </div>
                <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.5rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                  There are no eligible solder paste cans for this model (all cans are fully consumed, expired, or deactivated). Please contact materials management.
                </div>
              </div>
            )}
            {!selModel && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🧴</div>
                <div className={styles.emptyText}>Select a Model to begin operations</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Master List View ─────────────────────────────────────────────────────────
const MasterListView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [cans, setCans] = useState<Can[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('expiry_asc');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Modals state
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit' | 'editModel'; id?: string }>({ open: false, mode: 'add' });
  const [form, setForm] = useState<CanForm>(EMPTY);
  const [modelForm, setModelForm] = useState({ id: '', model: '', make: '' });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Group Expand/Collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getCans(search, filter, sort, page);
      setCans(d.data || []);
    } catch {}
    setLoading(false);
  }, [search, filter, sort, page]);

  useEffect(() => { 
    load(); 
  }, [load]);

  const openAddGlobal = () => {
    setForm(EMPTY);
    setFormErr('');
    setModal({ open: true, mode: 'add' });
  };

  const openAddForGroup = (masterId: string, model: string, make: string) => {
    setForm({
      ...EMPTY,
      master_id: masterId,
      model,
      make
    });
    setFormErr('');
    setModal({ open: true, mode: 'add' });
  };

  const openEdit = (c: Can) => {
    setForm({
      master_id: c.master_id,
      model: c.model,
      make: c.make,
      can_id: c.can_id,
      manufacturing_date: c.manufacturing_date.split('T')[0],
      expiry_date: c.expiry_date.split('T')[0],
      total_weight_g: String(c.total_weight_g),
      used_weight_g: String(c.used_weight_g),
      min_thawing_hours: String(c.min_thawing_hours),
      max_working_hours: String(c.max_working_hours),
      is_active: c.is_active
    });
    setFormErr('');
    setModal({ open: true, mode: 'edit', id: c.id });
  };

  const openEditModel = (masterId: string, model: string, make: string) => {
    setModelForm({ id: masterId, model, make });
    setFormErr('');
    setModal({ open: true, mode: 'editModel', id: masterId });
  };

  const handleDelete = async (id: string, cid: string) => {
    if (!window.confirm(`Deactivate can ${cid}?`)) return;
    try {
      await api.deleteCan(id);
      setMsg({ type: 'success', text: 'Can deactivated' });
      load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed' });
    }
  };

  const handleSave = async () => {
    setFormErr(''); 
    setSaving(true);
    try {
      const body = { 
        ...form, 
        total_weight_g: parseFloat(form.total_weight_g), 
        used_weight_g: parseFloat(form.used_weight_g || '0'), 
        min_thawing_hours: parseFloat(form.min_thawing_hours), 
        max_working_hours: parseFloat(form.max_working_hours) 
      };
      const d = modal.mode === 'add' ? await api.createCan(body) : await api.updateCan(modal.id!, body);
      setMsg({ type: 'success', text: d.message || 'Saved successfully' });
      setModal({ open: false, mode: 'add' });
      load();
    } catch (e: any) {
      setFormErr(e.message || 'Validation failed');
    }
    setSaving(false);
  };

  const handleSaveModel = async () => {
    setFormErr(''); 
    setSaving(true);
    try {
      await api.updateModel(modelForm.id, { model: modelForm.model, make: modelForm.make });
      setMsg({ type: 'success', text: 'Model and Make updated successfully' });
      setModal({ open: false, mode: 'add' });
      load();
    } catch (e: any) {
      setFormErr(e.message || 'Failed to update model');
    }
    setSaving(false);
  };

  const toggleGroup = (masterId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(masterId)) {
        next.delete(masterId);
      } else {
        next.add(masterId);
      }
      return next;
    });
  };

  const tf = (f: Partial<CanForm>) => setForm(p => ({ ...p, ...f }));
  const rem = (tw: string, uw: string) => {
    const t = parseFloat(tw) || 0, u = parseFloat(uw) || 0;
    return Math.max(0, t - u).toFixed(2);
  };

  // Group cans by master_id on the client side
  interface GroupedData {
    master_id: string;
    model: string;
    make: string;
    cans: Can[];
    stats: {
      total: number;
      available: number;
      expired: number;
      consumed: number;
    };
    fifoCanId: string | null;
  }

  const groupsMap = new Map<string, GroupedData>();

  cans.forEach(c => {
    if (!groupsMap.has(c.master_id)) {
      groupsMap.set(c.master_id, {
        master_id: c.master_id,
        model: c.model,
        make: c.make,
        cans: [],
        stats: { total: 0, available: 0, expired: 0, consumed: 0 },
        fifoCanId: null
      });
    }
    const g = groupsMap.get(c.master_id)!;
    g.cans.push(c);
    g.stats.total++;

    const isAvailable = c.is_active && !c.is_expired && Number(c.remaining_weight_g) > 0;
    if (!c.is_active) {
      // Inactive is not tracked separately in badges, but counted in total
    } else if (c.is_expired) {
      g.stats.expired++;
    } else if (Number(c.remaining_weight_g) <= 0) {
      g.stats.consumed++;
    } else if (isAvailable) {
      g.stats.available++;
    }
  });

  // For each group, find the FIFO eligible can:
  // FIFO rule: ordered by expiry date ASC, can_id ASC.
  // First matching row: is_active = true, remaining_weight > 0, is_expired = false.
  groupsMap.forEach(g => {
    const sortedCans = [...g.cans].sort((a, b) => {
      const expA = new Date(a.expiry_date).getTime();
      const expB = new Date(b.expiry_date).getTime();
      if (expA !== expB) return expA - expB;
      return a.can_id.localeCompare(b.can_id);
    });

    const fifoCandidate = sortedCans.find(c => c.is_active && !c.is_expired && Number(c.remaining_weight_g) > 0);
    if (fifoCandidate) {
      g.fifoCanId = fifoCandidate.id;
    }
  });

  const groupedList = Array.from(groupsMap.values()).sort((a, b) => a.model.localeCompare(b.model));

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><List size={22}/></div>
          <div>
            <p className={styles.headerTitle}>Solder Paste – Master List</p>
            <p className={styles.headerSub}>Manage solder paste models and can units</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnNav} onClick={onBack}><FlaskConical size={15}/> Operation</button>
          <button className={`${styles.btnPrimary}`} onClick={openAddGlobal}><Plus size={15}/> Create New Model & Can</button>
        </div>
      </div>
      <div className={styles.body}>
        {msg && (
          <div className={`${styles.alertBox} ${msg.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
            {msg.type === 'error' ? <XCircle size={15}/> : <CheckCircle2 size={15}/>}
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14}/></button>
          </div>
        )}
        <div className={styles.toolbar}>
          <input className={styles.searchBox} placeholder='Search model, make, can ID…' value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
          <select className={styles.filterSelect} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value=''>All Cans</option>
            <option value='active'>Active</option>
            <option value='available'>Available (FIFO eligible)</option>
            <option value='expired'>Expired</option>
            <option value='consumed'>Fully Consumed</option>
          </select>
          <select className={styles.filterSelect} value={sort} onChange={e => setSort(e.target.value)}>
            <option value='expiry_asc'>Expiry ↑ (FIFO default)</option>
            <option value='expiry_desc'>Expiry ↓</option>
            <option value='model_asc'>Model A-Z</option>
            <option value='created_desc'>Newest First</option>
          </select>
          <button className={styles.btnSecondary} onClick={load}><RefreshCw size={14}/> Refresh</button>
        </div>
        {loading ? (
          <div className={styles.spinner}><div className={styles.spinnerRing}/></div>
        ) : (
          <div>
            {groupedList.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📦</div>
                <div className={styles.emptyText}>No models or cans found</div>
              </div>
            )}
            {groupedList.map(g => {
              const isCollapsed = collapsedGroups.has(g.master_id);
              return (
                <div key={g.master_id} className={styles.groupWrapper}>
                  {/* Expandable Group Header */}
                  <div className={styles.groupHeader}>
                    <div className={styles.groupHeaderLeft} onClick={() => toggleGroup(g.master_id)}>
                      {isCollapsed ? <ChevronRight size={18} style={{ color: '#475569' }}/> : <ChevronDown size={18} style={{ color: '#475569' }}/>}
                      <span className={styles.groupHeaderTitle}>
                        {g.model} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>({g.make})</span>
                      </span>
                      <div className={styles.groupStats}>
                        <span className={styles.statBadge}>Total: {g.stats.total}</span>
                        {g.stats.available > 0 && <span className={`${styles.statBadge} ${styles.statBadgeAvailable}`}>Available: {g.stats.available}</span>}
                        {g.stats.expired > 0 && <span className={`${styles.statBadge} ${styles.statBadgeExpired}`}>Expired: {g.stats.expired}</span>}
                        {g.stats.consumed > 0 && <span className={`${styles.statBadge} ${styles.statBadgeConsumed}`}>Consumed: {g.stats.consumed}</span>}
                      </div>
                    </div>
                    <div className={styles.groupActions}>
                      <button className={`${styles.btnGroupAction} ${styles.btnGroupEdit}`} onClick={() => openEditModel(g.master_id, g.model, g.make)}>
                        <Edit2 size={13}/> Edit Model
                      </button>
                      <button className={`${styles.btnGroupAction} ${styles.btnGroupAdd}`} onClick={() => openAddForGroup(g.master_id, g.model, g.make)}>
                        <Plus size={13}/> Add Can
                      </button>
                    </div>
                  </div>
                  {/* Cans Table */}
                  {!isCollapsed && (
                    <div className={styles.tableWrap} style={{ border: 'none', borderRadius: 0 }}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Can ID</th>
                            <th>Mfg Date</th>
                            <th>Expiry Date</th>
                            <th>Total (g)</th>
                            <th>Used (g)</th>
                            <th>Remaining (g)</th>
                            <th>Thaw (h)</th>
                            <th>Work (h)</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.cans.map(c => {
                            const exp = c.is_expired;
                            const avail = c.is_active && !exp && Number(c.remaining_weight_g) > 0;
                            const isFifo = g.fifoCanId === c.id;
                            return (
                              <tr key={c.id}>
                                <td>
                                  <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ marginRight: '0.5rem' }}>{c.can_id}</span>
                                  {isFifo && <span className={styles.fifoBadge}>🟢 CURRENT FIFO</span>}
                                </td>
                                <td>{fmtDate(c.manufacturing_date)}</td>
                                <td><span className={`${styles.badge} ${exp ? styles.badgeRed : styles.badgeGreen}`}>{fmtDate(c.expiry_date)}</span></td>
                                <td>{Number(c.total_weight_g).toFixed(1)}</td>
                                <td>{Number(c.used_weight_g).toFixed(1)}</td>
                                <td><strong>{Number(c.remaining_weight_g).toFixed(1)}</strong></td>
                                <td>{c.min_thawing_hours}h</td>
                                <td>{c.max_working_hours}h</td>
                                <td>
                                  {!c.is_active && <span className={`${styles.badge} ${styles.badgeGray}`}>Inactive</span>}
                                  {c.is_active && exp && <span className={`${styles.badge} ${styles.badgeRed}`}>Expired</span>}
                                  {avail && <span className={`${styles.badge} ${styles.badgeGreen}`}>Available</span>}
                                  {c.is_active && !exp && Number(c.remaining_weight_g) <= 0 && <span className={`${styles.badge} ${styles.badgeAmber}`}>Consumed</span>}
                                </td>
                                <td>
                                  <div className={styles.actionsCell}>
                                    <button className={styles.btnSecondary} onClick={() => openEdit(c)} title='Edit'><Edit2 size={13}/></button>
                                    <button className={styles.btnDanger} onClick={() => handleDelete(c.id, c.can_id)} title='Deactivate'><Trash2 size={13}/></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Can Modal */}
      {modal.open && (modal.mode === 'add' || modal.mode === 'edit') && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setModal({ open: false, mode: 'add' }); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{modal.mode === 'add' ? 'Add New Can' : 'Edit Can Details'}</h3>
              <button className={styles.modalClose} onClick={() => setModal({ open: false, mode: 'add' })}><X size={16}/></button>
            </div>
            <div className={styles.modalBody}>
              {formErr && <div className={`${styles.alertBox} ${styles.alertError}`}><AlertTriangle size={15}/>{formErr}</div>}
              <div className={styles.formGrid}>
                {/* Parent attributes group */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Model *</label>
                  <input 
                    className={`${styles.formInput} ${form.master_id ? styles.readOnlyInput : ''}`} 
                    value={form.model} 
                    onChange={e => tf({ model: e.target.value })} 
                    placeholder='e.g. M705'
                    readOnly={!!form.master_id}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Make *</label>
                  <input 
                    className={`${styles.formInput} ${form.master_id ? styles.readOnlyInput : ''}`} 
                    value={form.make} 
                    onChange={e => tf({ make: e.target.value })} 
                    placeholder='e.g. Alpha'
                    readOnly={!!form.master_id}
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.formLabel}>Can ID * (must be unique)</label>
                  <input className={styles.formInput} value={form.can_id} onChange={e => tf({ can_id: e.target.value })} placeholder='e.g. CAN-001'/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Manufacturing Date *</label>
                  <input className={styles.formInput} type='date' value={form.manufacturing_date} onChange={e => tf({ manufacturing_date: e.target.value })}/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Expiry Date *</label>
                  <input className={styles.formInput} type='date' value={form.expiry_date} onChange={e => tf({ expiry_date: e.target.value })}/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Total Weight (g) *</label>
                  <input className={styles.formInput} type='number' min='0.1' step='0.1' value={form.total_weight_g} onChange={e => tf({ total_weight_g: e.target.value })}/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Used Weight (g)</label>
                  <input className={styles.formInput} type='number' min='0' step='0.1' value={form.used_weight_g} onChange={e => tf({ used_weight_g: e.target.value })}/>
                </div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.formLabel}>Remaining Weight (Auto)</label>
                  <div className={styles.calcField}>{rem(form.total_weight_g, form.used_weight_g)} g</div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Min Thawing Hours *</label>
                  <input className={styles.formInput} type='number' min='0' step='0.5' value={form.min_thawing_hours} onChange={e => tf({ min_thawing_hours: e.target.value })}/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Max Working Hours *</label>
                  <input className={styles.formInput} type='number' min='0.5' step='0.5' value={form.max_working_hours} onChange={e => tf({ max_working_hours: e.target.value })}/>
                </div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                    <input type='checkbox' checked={form.is_active} onChange={e => tf({ is_active: e.target.checked })} style={{ width: 16, height: 16 }}/>
                    Active (included in FIFO selection)
                  </label>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal({ open: false, mode: 'add' })}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Can'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Model Modal */}
      {modal.open && modal.mode === 'editModel' && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setModal({ open: false, mode: 'add' }); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Model Details</h3>
              <button className={styles.modalClose} onClick={() => setModal({ open: false, mode: 'add' })}><X size={16}/></button>
            </div>
            <div className={styles.modalBody}>
              {formErr && <div className={`${styles.alertBox} ${styles.alertError}`}><AlertTriangle size={15}/>{formErr}</div>}
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Model *</label>
                  <input 
                    className={styles.formInput} 
                    value={modelForm.model} 
                    onChange={e => setModelForm(prev => ({ ...prev, model: e.target.value }))} 
                    placeholder='e.g. M705'
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Make *</label>
                  <input 
                    className={styles.formInput} 
                    value={modelForm.make} 
                    onChange={e => setModelForm(prev => ({ ...prev, make: e.target.value }))} 
                    placeholder='e.g. Alpha'
                  />
                </div>
              </div>
              <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                ⚠️ Editing the Model or Make will automatically update all child cans in this group.
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal({ open: false, mode: 'add' })}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSaveModel} disabled={saving}>{saving ? 'Saving…' : 'Save Model'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────
const SolderPasteManagement: React.FC = () => {
  const [view, setView] = useState<'operation' | 'masterList'>('operation');
  return view === 'masterList'
    ? <MasterListView onBack={() => setView('operation')}/>
    : <OperationView onMasterList={() => setView('masterList')}/>;
};

export default SolderPasteManagement;

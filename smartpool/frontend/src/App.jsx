import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Car, Navigation, LayoutDashboard, ArrowRight, ArrowUpRight, ShieldCheck, Leaf, Users, Route, BarChart3, SlidersHorizontal, Wallet, Radio, Zap, Play, Pause, RotateCcw, Check, X, Clock, Loader2, MapPin, Info } from 'lucide-react';
import { normalizeDispatch, getError } from './apiAdapter';
import RouteMap from './components/RouteMap';
import { Badge, Empty, Stat, Timeline, Fare, BookingForm, money } from './components/UI';
import Admin from './components/Admin';
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
async function api(path, body) {
  const res = await fetch(base + path, { ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(await getError(res));
  return res.json();
}
export default function App() {
  const [mode, setMode] = useState('passenger'), [tab, setTab] = useState('dispatch');
  const [online, setOnline] = useState(false), [ws, setWs] = useState(false), [queue, setQueue] = useState([]), [nodes, setNodes] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', origin: 'Pune (Kiwale)', destination: 'Mumbai', seats: 1, cap: 15 });
  const [trip, setTrip] = useState(null), [myRequest, setMyRequest] = useState(null), [myTrip, setMyTrip] = useState(null);
  const [passengerTab, setPassengerTab] = useState('book'), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [step, setStep] = useState(-1), [playing, setPlaying] = useState(false), [rejection, setRejection] = useState(null), [benchmark, setBenchmark] = useState(null), [overlay, setOverlay] = useState(false);
  const requestRef = useRef(null), busyRef = useRef(false);
  const syncQueue = useCallback(async () => { const q = await api('/api/rides/queue'); setQueue(q.requests); }, []);
  useEffect(() => {
    let live = true;
    const poll = async () => {
      try { await api('/api/health'); if (live) setOnline(true); const [q, n] = await Promise.all([api('/api/rides/queue'), api('/api/corridor-nodes')]); if (live) { setQueue(q.requests); setNodes(previous => JSON.stringify(previous) === JSON.stringify(n.milestones) ? previous : n.milestones); } }
      catch { if (live) setOnline(false); }
    }; poll(); const timer = setInterval(poll, 8000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    let socket, timer, active = true;
    const connect = () => {
      const url = base ? base.replace(/^http/, 'ws') + '/ws/corridor' : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/corridor`;
      socket = new WebSocket(url);
      socket.onopen = () => { if (active) setWs(true); };
      socket.onmessage = e => { try { const msg = JSON.parse(e.data); if (msg.event === 'BATCH_TICK') syncQueue().catch(() => {}); } catch {} };
      socket.onclose = () => { if (active) { setWs(false); timer = setTimeout(connect, 5000); } };
      socket.onerror = () => { if (active) setWs(false); };
    }; connect(); return () => { active = false; clearTimeout(timer); socket?.close(); };
  }, [syncQueue]);
  useEffect(() => {
    if (!playing || !trip) return;
    const t = setInterval(() => setStep(s => { if (s >= trip.stops.length - 1) { setPlaying(false); return s; } return s + 1; }), 2300);
    return () => clearInterval(t);
  }, [playing, trip]);
  async function perform(key, fn) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(key); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e.message || 'Unable to reach the backend. Please try again.'); } finally { busyRef.current = false; setBusy(''); }
  }
  function book(e) {
    e.preventDefault();
    if (myRequest && queue.some(r => r.request_id === myRequest.request_id)) { setPassengerTab('trip'); setError('Your request is already queued. Dispatch it before creating another.'); return; }
    perform('book', async () => {
      if (!form.name.trim()) throw Error('Please enter your name.');
      const payload = { passenger_name: form.name.trim(), passenger_phone: form.phone.trim(), origin_name: form.origin, destination_name: form.destination, seats_requested: form.seats, max_detour_percent: form.cap };
      const fingerprint = JSON.stringify(payload);
      if (!requestRef.current || requestRef.current.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: `r-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      payload.request_id = requestRef.current.id;
      await api('/api/rides/book', payload);
      setMyRequest(payload); setMyTrip(null); setPassengerTab('trip'); setNotice('Your request is queued. Matching starts when the batch is dispatched.');
      await syncQueue(); requestRef.current = null;
    });
  }
  function dispatch() { perform('dispatch', async () => {
    const result = await api('/api/rides/batch/dispatch-now', {});
    const data = normalizeDispatch(result.dispatch, result.requests);
    setTrip(data); setQueue(result.remaining_queue); setStep(-1); setPlaying(false);
    if (myRequest && result.requests.some(r => r.request_id === myRequest.request_id)) { setMyTrip(data); setPassengerTab('trip'); }
    setNotice(`Route ready for ${result.matched_requests} passenger request${result.matched_requests === 1 ? '' : 's'}. This is a demo dispatch, not a vehicle reservation.`);
  }); }
  function golden() { perform('golden', async () => {
    if (queue.length) throw Error('The Golden demo replaces the queue. Dispatch the current requests first to preserve them.');
    const result = await api('/api/demo/load-golden-queue', {}); setQueue(result.requests); setNotice('Rahul, Priya and Aman are queued. Select Dispatch batch to calculate their route and fares.');
  }); }
  function testRejection() { perform('rejection', async () => { setRejection(await api('/api/demo/rejection')); }); }
  function runBenchmark() { perform('benchmark', async () => { setBenchmark(await api('/api/benchmark')); }); }
  const rider = myTrip?.commuters.find(r => r.name === myRequest?.passenger_name);
  const navItems = [['dispatch', 'Dispatch & booking', LayoutDashboard], ['map', 'Live corridor map', MapPin], ['shield', 'Convenience Shield', ShieldCheck], ['fairness', 'Fairness Lab', Wallet], ['sandbox', 'What-If Sandbox', SlidersHorizontal], ['benchmark', 'Benchmark scorecard', BarChart3]];
  const toggleSimulation = () => { if (step >= (trip?.stops.length || 0) - 1) setStep(-1); setPlaying(p => !p); };
  const simulation = <div className="simulation"><button className="primary" disabled={!trip} onClick={toggleSimulation}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? 'Pause' : 'Play'} simulation</button><button className="icon-button" title="Reset simulation" aria-label="Reset simulation" onClick={() => { setPlaying(false); setStep(-1); }}><RotateCcw size={17}/></button><span>Illustrative movement · no live GPS</span></div>;
  const mapProps = { nodes, trip, dark: true, step, overlay };
  return <div className={`app ${mode}`}>
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setMode('passenger'); }}><span className="brand-icon"><Route size={25}/></span>smartpool<span className="brand-period">.</span></a><nav className="mode-switch" aria-label="Experience">{[['passenger','Ride',Car],['driver','Drive',Navigation],['admin','Dispatch',LayoutDashboard]].map(([id,label,Icon]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}><Icon size={17}/>{label}</button>)}</nav><div className="connection"><span className={online ? 'status-dot' : 'status-dot offline'}/><span>{online ? 'Engine connected' : 'Engine offline'}</span><span className="avatar">SP</span></div></header>
    {(error || notice) && <div className={`alert ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><Info size={18}/><span>{error || notice}</span><button aria-label="Dismiss notification" onClick={() => { setError(''); setNotice(''); }}><X size={17}/></button></div>}
    {mode === 'passenger' && <main className="passenger-main"><div className="passenger-intro"><div><div className="eyebrow"><span/> A BETTER WAY TOGETHER</div><h1>Your route. <span>Our ride.</span></h1><p>Share the journey, not the extra miles.</p></div><div className="corridor-pill"><MapPin size={18}/><span>Pune <ArrowRight size={14}/> Mumbai<small>Expressway corridor</small></span></div></div><div className="passenger-layout"><section className="booking-panel"><nav className="panel-tabs"><button className={passengerTab === 'book' ? 'active' : ''} onClick={() => setPassengerTab('book')}>Book a ride</button><button className={passengerTab === 'trip' ? 'active' : ''} onClick={() => setPassengerTab('trip')}>Your trip {myRequest && <span className="tiny-dot"/>}</button></nav>{passengerTab === 'book' ? <><div className="panel-heading"><h2>Where are you going?</h2><p>A little company. A fairer fare.</p></div><BookingForm form={form} setForm={setForm} nodes={nodes} onSubmit={book} busy={!!busy}/></> : <div className="trip-content">{rider ? <><Badge tone="green"><Check size={13}/> Route ready · demo dispatch</Badge><h2>{myTrip.commuters.length > 1 ? 'Better, together.' : 'Your route is ready.'}</h2><p>{rider.origin} <ArrowRight size={13}/> {rider.destination}</p><Fare rider={rider}/><div className="trip-protection"><ShieldCheck size={20}/><div><strong>{rider.detourPercent}% extra travel time</strong><small>{rider.actualTimeMin} min shared · {rider.directTimeMin} min direct</small></div></div><h3>Your travel companions</h3>{myTrip.commuters.filter(r => r.name !== rider.name).map(r => <div className="companion" key={r.id}><span className="avatar">{r.name[0]}</span><span><b>{r.name}</b><small>{r.origin} → {r.destination}</small></span></div>)}{myTrip.commuters.length === 1 && <p>No co-passengers in this dispatch. The backend calculated a single-rider route.</p>}<details><summary>View optimized stops</summary><Timeline trip={myTrip}/></details><button className="secondary wide" onClick={() => { setMyRequest(null); setMyTrip(null); setPassengerTab('book'); }}>Book another ride</button></> : myRequest ? <><div className="matching-orbit"><Car size={32}/></div><h2>{queue.some(r => r.request_id === myRequest.request_id) ? 'You’re in the queue.' : 'Request status unavailable'}</h2><p>{myRequest.origin_name} → {myRequest.destination_name}</p><div className="matching-status"><Clock size={18}/><span>Waiting for manual dispatch<small>{queue.length} requests in the current queue</small></span></div><p className="micro">This demo does not auto-dispatch. Use the button below to ask the engine to match the current batch.</p><button className="primary wide" disabled={!!busy || !queue.length} onClick={dispatch}>{busy === 'dispatch' ? <Loader2 className="spin" size={18}/> : <Zap size={18}/>} Match current batch</button><p className="micro">If no compatible match is found, your request stays in the queue. If another browser dispatched it, this API cannot retrieve that trip.</p><button className="text-button" onClick={() => setPassengerTab('book')}>Back to booking</button></> : <Empty title="No trip yet">Find a shared ride to start your journey.</Empty>}</div>}</section><div className="passenger-map"><RouteMap nodes={nodes} trip={passengerTab === 'trip' ? myTrip : null} pickup={form.origin} destination={form.destination}/><div className="map-floating-card"><span className="leaf-icon"><Leaf size={21}/></span><div><strong>A smarter way to go</strong><p>One shared route. Fewer cars on the road.</p></div><ArrowUpRight size={20}/></div></div></div><div className="benefits"><div><ShieldCheck/><span><strong>Your time, protected</strong><small>Maximum 15% detour</small></span></div><div><Wallet/><span><strong>A fare that’s fair</strong><small>Based on your route contribution</small></span></div><div><Leaf/><span><strong>More company. Less impact.</strong><small>Share miles, reduce vehicle travel</small></span></div></div><footer>Made for the journey between Pune & Mumbai.<span>SmartPool · Hackathon demonstration</span></footer></main>}
    {mode === 'driver' && <main className="driver-main"><div className="page-heading"><div><div className="eyebrow">DRIVER CONSOLE / CORRIDOR 01</div><h1>Keep moving <span>forward.</span></h1><p>One route. Every passenger accounted for.</p></div><Badge tone="cyan"><Radio size={13}/> {trip ? 'Demo route loaded' : 'Awaiting dispatch'}</Badge></div><div className="driver-layout"><section className="driver-map"><RouteMap {...mapProps}/>{trip && <div className="next-stop"><Navigation size={28}/><div><small>{step >= trip.stops.length - 1 ? 'SIMULATION FINISHED' : 'NEXT MODELLED STOP'} · NO TURN-BY-TURN</small><h2>{trip.stops[Math.min(step + 1, trip.stops.length - 1)]?.node}</h2><p>{trip.stops[Math.min(step + 1, trip.stops.length - 1)]?.rider}</p></div></div>}{simulation}</section><aside className="driver-panel">{trip ? <><div className="driver-panel-head"><span className="cab-icon"><Car size={29}/></span><div><h2>Your route plan</h2><p>{trip.stops.length} optimized stops</p></div></div><div className="seat-meter"><span>Simulated occupancy</span><strong>{step < 0 ? 0 : trip.stops[step]?.seatsOccupied} / 4</strong><div>{[0,1,2,3].map(i => <span key={i} className={i < (step < 0 ? 0 : trip.stops[step]?.seatsOccupied) ? 'filled' : ''}><Users size={17}/></span>)}</div></div><Timeline trip={trip} step={step}/><div className="driver-payout"><span>Total route fare</span><strong>{money(trip.summary.driverPayout)}</strong><small>Backend fare calculation · payment not collected</small></div></> : <><Empty title="Ready when your route is">Dispatch a batch to load the actual stop sequence and seat plan.</Empty><button className="primary wide" onClick={() => { setMode('admin'); setTab('dispatch'); }}>Open dispatch <ArrowRight size={16}/></button></>}</aside></div></main>}
    {mode === 'admin' && <div className="admin-layout"><aside className="sidebar"><div className="eyebrow">OPERATIONS</div><nav aria-label="Admin sections">{navItems.map(([id,label,Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18}/>{label}{tab === id && <span/>}</button>)}</nav><div className="sidebar-bottom"><ShieldCheck size={23}/><strong>Intelligence in every mile.</strong><p>Route optimization.<br/>Detour protection.<br/>Fair fare allocation.</p><Badge tone={ws ? 'green' : ''}>{ws ? 'WebSocket connected' : 'Polling queue'}</Badge></div></aside><main className="admin-main"><div className="page-heading"><div><div className="eyebrow">SMARTPOOL / OPERATIONS</div><h1>{navItems.find(n => n[0] === tab)[1]}</h1><p>Real engine results. A clear view of every decision.</p></div><button className="secondary" disabled={!!busy} onClick={golden}><Zap size={16}/> Golden Corridor</button></div><Admin {...{tab, trip, queue, form, setForm, nodes, book, busy, dispatch, golden, rejection, testRejection, benchmark, runBenchmark, api, perform, mapProps, simulation, overlay, setOverlay}}/></main></div>}
  </div>;
}

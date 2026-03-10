import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  pushGpsUpdate,
  writeTelemetry,
  markBusStopped,
} from '../services/driverService';
/* ─── Types ─────────────────────────────────── */
interface DriverSession {
  uid: string;
  name: string;
  busId: string;
  busNumber: string;
  routeId: string | null;
  routeOrigin: string;
  routeDestination: string;
}
interface LogItem {
  id: number;
  msg: string;
  type: 'ok' | 'warn' | 'err';
  time: string;
}
type StatusType = 'idle' | 'active' | 'error';
type BusStatus = 'Active' | 'Idle' | 'Delayed' | 'Offline';
/* ─── Constants ──────────────────────────────── */
const UPDATE_INTERVAL = 3000; // 3s per GPS push
const MIN_MOVING_SPEED = 5; // km/h
const STOP_DELAY_MS = 240000; // 4 minutes
const MAX_LOG = 12;
/** Helper for distance calculation */
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
/* ─── Component ──────────────────────────────── */
export default function DriverDashboardPage() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState<DriverSession | null>(null);
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('pp_driver') || 'null');
      if (!d) {
        navigate('/login');
        return;
      }
      setDriver(d);
    } catch {
      navigate('/login');
    }
  }, [navigate]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusType, setStatusType] = useState<StatusType>('idle');
  const [statusIcon, setStatusIcon] = useState('😴');
  const [statusTitle, setStatusTitle] = useState('Not Started');
  const [statusSub, setStatusSub] = useState('Tap the green button to go live');
  const [speedVal, setSpeedVal] = useState('—');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [toast, setToast] = useState({ msg: '', type: '', show: false });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showPermOverlay, setShowPermOverlay] = useState(false);
  const [, setLogCounter] = useState(0);
  const geoWatchRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const lastSpeedRef = useRef(0);
  const lastMoveTimeRef = useRef(Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  /* Online/Offline */
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => {
      setIsOnline(false);
      addLog('📡 No internet connection', 'err');
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      // Cleanup geolocation on unmount
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
      }
    };
  }, []);
  /* Permission check */
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as any }).then((r) => {
        if (r.state === 'denied') setShowPermOverlay(true);
      });
    }
  }, []);
  const addLog = useCallback((msg: string, type: 'ok' | 'warn' | 'err' = 'ok') => {
    const now = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogCounter((c: number) => {
      const id = c + 1;
      setLogs((prev: LogItem[]) =>
        [{ id, msg, type, time: now }, ...prev].slice(0, MAX_LOG)
      );
      return id;
    });
  }, []);
  /* Welcome log once driver loads */
  useEffect(() => {
    if (driver) addLog(`👋 Welcome, ${driver.name}! Ready to start.`, 'ok');
  }, [driver, addLog]);
  const showToast = useCallback((msg: string, type = '') => {
    setToast({ msg, type, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast((t: typeof toast) => ({ ...t, show: false })),
      2800
    );
  }, []);
  function setStatusBanner(
    type: StatusType,
    icon: string,
    title: string,
    sub: string
  ) {
    setStatusType(type);
    setStatusIcon(icon);
    setStatusTitle(title);
    setStatusSub(sub);
  }
  /* Firestore GPS send */
  async function sendToFirestore(
    lat: number,
    lng: number,
    actualSpeed: number
  ) {
    if (!driver) return;
    // Better Idle detection using speed & distance
    const distSinceLast = lastPosRef.current ? getDistanceKm(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng) : 0;
    const isMoving = actualSpeed >= MIN_MOVING_SPEED || distSinceLast > 0.01;
    if (isMoving) {
      lastMoveTimeRef.current = Date.now();
    }
    const isIdle = (Date.now() - lastMoveTimeRef.current) >= STOP_DELAY_MS;
    const status: BusStatus = isIdle ? 'Idle' : 'Active';
    try {
      // Positional arguments fixed as requested. 
      // Rule compliance: speed info goes into telemetry ONLY to satisfy rules whitelist (lastLocation, lastUpdated, status).
      await pushGpsUpdate(driver.busId, lat, lng, actualSpeed, status);
      await writeTelemetry(driver.busId, lat, lng, actualSpeed).catch(() => {});
      setStatusType(status === 'Active' ? 'active' : 'idle');
      addLog(`📡 Location sent · ${actualSpeed.toFixed(0)} km/h`, 'ok');
      showToast('✅ Location updated!', 't-ok');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setStatusBanner('error', '⚠️', 'Sync Error', 'Check connection');
      addLog(`❌ Sync Failed: ${msg}`, 'err');
      showToast('❌ Sync failed', 't-err');
    }
  }
  /* GPS implementation matching positional signature and fixing flaws */
  function startGPS() {
    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
    }
    
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const timeDiffMs = now - lastUpdateRef.current;
        
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let rawSpd = pos.coords.speed !== null ? pos.coords.speed * 3.6 : -1;
        
        // Correct fallback speed using actual time diff
        if (rawSpd === -1 && lastPosRef.current && timeDiffMs > 0) {
          const dist = getDistanceKm(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
          rawSpd = dist / (timeDiffMs / 3600000);
        }
        
        if (rawSpd < 0 || isNaN(rawSpd)) rawSpd = 0;
        rawSpd = Math.min(rawSpd, 120); // Speed clamp
        // Weighted smoothing (0.7 current / 0.3 last)
        const smoothedSpd = lastSpeedRef.current === 0 ? rawSpd : (rawSpd * 0.7 + lastSpeedRef.current * 0.3);
        setSpeedVal(smoothedSpd.toFixed(0));
        lastSpeedRef.current = smoothedSpd;
        lastPosRef.current = { lat, lng };
        if (timeDiffMs >= UPDATE_INTERVAL || lastUpdateRef.current === 0) {
          lastUpdateRef.current = now;
          sendToFirestore(lat, lng, smoothedSpd);
        }
      },
      (err) => {
        addLog(`❌ GPS Error: ${err.message}`, 'err');
        setStatusBanner('error', '❌', 'GPS Error', err.message);
        showToast('GPS error — check settings', 't-err');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }
  function stopGPS() {
    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }
    if (!driver) return;
    markBusStopped(driver.busId).catch(() => {});
  }
  /* Toggle */
  function toggleTracking() {
    if (!isRunning) {
      if (!navigator.geolocation) {
        showToast('GPS not supported', 't-err');
        return;
      }
      setIsRunning(true);
      lastMoveTimeRef.current = Date.now();
      setStatusBanner(
        'active',
        '🟢',
        'Live – Sharing Location',
        'Students can see your location now'
      );
      addLog('▶ Trip started — tracking ON', 'ok');
      showToast('📍 Live tracking started!', 't-ok');
      startGPS();
    } else {
      setIsRunning(false);
      stopGPS();
      lastSpeedRef.current = 0;
      setSpeedVal('—');
      setStatusBanner(
        'idle',
        '😴',
        'Trip Ended',
        'Tap green button to start a new trip'
      );
      addLog('⏹ Trip ended — tracking stopped', 'warn');
      showToast('Trip ended', '');
    }
  }
  /* Logout */
  async function doLogout() {
    if (isRunning) {
      if (!confirm('You are still tracking. Stop and logout?')) return;
      stopGPS();
    }
    localStorage.removeItem('pp_driver');
    try {
      await signOut(auth);
    } catch { /* ignore */ }
    navigate('/login');
  }
  function requestLocation() {
    setShowPermOverlay(false);
    navigator.geolocation.getCurrentPosition(
      () => {
        addLog('📍 Location permission granted', 'ok');
        showToast('📍 GPS Ready!', 't-ok');
      },
      () => {
        setShowPermOverlay(true);
        showToast('Please allow location access', 't-err');
      }
    );
  }
  if (!driver) return null;
  const statusBg: Record<StatusType, string> = {
    idle: '#f0f4ff',
    active: 'rgba(62,201,124,0.12)',
    error: 'rgba(224,82,82,0.1)',
  };
  const statusBorder: Record<StatusType, string> = {
    idle: '1.5px solid #d8e0f0',
    active: '1.5px solid rgba(62,201,124,0.3)',
    error: '1.5px solid rgba(224,82,82,0.3)',
  };
  const statusTitleColor: Record<StatusType, string> = {
    idle: '#1a2540',
    active: '#1d8c52',
    error: '#E05252',
  };
  return (
    <div style={styles.page}>
      {showPermOverlay && (
        <div style={styles.permOverlay}>
          <div style={styles.permCard}>
            <span style={{ fontSize: '72px', display: 'block', marginBottom: '14px' }}>📍</span>
            <h3 style={styles.permTitle}>Allow Location</h3>
            <p style={styles.permText}>PathPulse needs your GPS location to show students where you are.</p>
            <button style={styles.permBtn} onClick={requestLocation}>📍 &nbsp;Allow Location Access</button>
          </div>
        </div>
      )}
      {!isOnline && <div style={styles.offBadge}>📡 No Internet</div>}
      <div style={styles.topbar}>
        <div style={styles.tbLeft}>
          <div style={styles.tbAvatar}>👨‍✈️</div>
          <div>
            <div style={styles.tbName}>{driver.name}</div>
            <div style={styles.tbBus}>{driver.busNumber}</div>
          </div>
        </div>
        <div style={styles.tbRight}>
          <div style={styles.tbLogo}>PATH<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginLeft: '2px' }}>PULSE</span></div>
          <button style={styles.logoutBtn} onClick={doLogout}>Logout</button>
        </div>
      </div>
      <div style={{ ...styles.statusBanner, background: statusBg[statusType], border: statusBorder[statusType] }}>
        <span style={{ fontSize: '30px', flexShrink: 0 }}>{statusIcon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ ...styles.sbTitle, color: statusTitleColor[statusType] }}>{statusTitle}</div>
          <div style={styles.sbSub}>{statusSub}</div>
        </div>
        {statusType === 'active' && <div style={styles.liveDot} />}
      </div>
      <div style={styles.routeCard}>
        <div style={styles.rcLabel}>Your Route</div>
        <div style={styles.rcRoute}>{driver.busNumber}</div>
        <div style={styles.rcPath}>
          <div style={{ ...styles.rcDot, background: '#FF8A80' }} />
          <span>{driver.routeOrigin}</span>
          <span style={{ opacity: 0.4 }}>→</span>
          <div style={{ ...styles.rcDot, background: '#A5D6A7' }} />
          <span>{driver.routeDestination}</span>
        </div>
      </div>
      <div style={styles.infoRow}>
        <div style={styles.infoCard}>
          <div style={{ fontSize: '24px', marginBottom: '5px' }}>🚀</div>
          <div style={styles.icVal}>{speedVal}</div>
          <div style={styles.icLabel}>km/h</div>
        </div>
      </div>
      <div style={styles.bigBtnArea}>
        <p style={styles.btnHint}>{isRunning ? 'Sharing live! Press to stop 🔴' : 'Press to start sharing your location 👇'}</p>
        <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRunning && (
            <>
              <div style={{ ...styles.ripple, animationDelay: '0s' }} />
              <div style={{ ...styles.ripple, animationDelay: '0.4s' }} />
              <div style={{ ...styles.ripple, animationDelay: '0.8s' }} />
            </>
          )}
          <button style={isRunning ? styles.stopBtn : styles.startBtn} onClick={toggleTracking}>
            <span style={{ fontSize: '52px', lineHeight: 1 }}>{isRunning ? '⏹' : '▶'}</span>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '16px' }}>{isRunning ? 'STOP' : 'START'}</span>
            <span style={{ fontSize: '11px', opacity: 0.75, fontWeight: 600 }}>{isRunning ? 'End Trip' : 'Share Location'}</span>
          </button>
        </div>
      </div>
      <div style={styles.updatesSection}>
        <div style={styles.secTitle}>📋 Recent Updates</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {logs.length === 0 ? (
            <div style={styles.emptyLog}>📋 Updates will appear here once you start</div>
          ) : (
            logs.map((item: LogItem) => (
              <div key={item.id} style={styles.logItem}>
                <div style={{ ...styles.logDot, background: item.type === 'ok' ? '#3EC97C' : item.type === 'warn' ? '#F5A623' : '#E05252' }} />
                <div>
                  <div style={styles.logText}>{item.msg}</div>
                  <div style={styles.logTime}>{item.time}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{
        ...styles.toast,
        opacity: toast.show ? 1 : 0,
        transform: toast.show ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100px)',
        background: toast.type === 't-ok' ? '#3EC97C' : toast.type === 't-err' ? '#E05252' : '#1a2540'
      }}>
        {toast.msg}
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }
        @keyframes rippleOut { 0% { transform:scale(0.6); opacity:0.6; } 100% { transform:scale(1.5); opacity:0; } }
        @keyframes itemIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'DM Sans', sans-serif", background: '#F0F4FF', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', paddingBottom: '24px', color: '#1a2540' },
  topbar: { background: '#2F3E66', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' },
  tbLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  tbAvatar: { width: '40px', height: '40px', background: 'rgba(255,255,255,0.14)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' },
  tbName: { fontSize: '13px', fontWeight: 600, color: '#fff' },
  tbBus: { fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '1px' },
  tbRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  tbLogo: { fontFamily: "'Sora',sans-serif", fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '1px' },
  logoutBtn: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' },
  statusBanner: { margin: '18px 16px 0', padding: '14px 18px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.3s' },
  sbTitle: { fontFamily: "'Sora',sans-serif", fontSize: '15px', fontWeight: 700 },
  sbSub: { fontSize: '12px', color: '#7a8aaa', marginTop: '2px' },
  liveDot: { width: '9px', height: '9px', background: '#3EC97C', borderRadius: '50%', flexShrink: 0, marginLeft: 'auto', animation: 'pulse 1.4s ease infinite' },
  routeCard: { margin: '14px 16px 0', padding: '20px', background: '#2F3E66', borderRadius: '18px', color: '#fff', position: 'relative', overflow: 'hidden' },
  rcLabel: { fontSize: '11px', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' },
  rcRoute: { fontFamily: "'Sora',sans-serif", fontSize: '22px', fontWeight: 800, letterSpacing: '0.5px' },
  rcPath: { fontSize: '13px', opacity: 0.75, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' },
  rcDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  infoRow: { display: 'grid', gridTemplateColumns: '1fr', gap: '10px', margin: '12px 16px 0' },
  infoCard: { background: '#fff', borderRadius: '14px', padding: '14px 12px', boxShadow: '0 2px 10px rgba(47,62,102,0.07)', border: '1px solid #d8e0f0', textAlign: 'center' },
  icVal: { fontFamily: "'Sora',sans-serif", fontSize: '18px', fontWeight: 800, color: '#2F3E66' },
  icLabel: { fontSize: '10px', color: '#7a8aaa', marginTop: '3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' },
  bigBtnArea: { margin: '20px 16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  btnHint: { fontSize: '13px', color: '#7a8aaa', marginBottom: '14px', textAlign: 'center' },
  ripple: { position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(62,201,124,0.15)', animation: 'rippleOut 2.4s ease-out infinite', pointerEvents: 'none' },
  startBtn: { width: '172px', height: '172px', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', border: 'none', background: 'linear-gradient(145deg,#3EC97C,#2da866)', color: '#fff', boxShadow: '0 12px 40px rgba(62,201,124,0.45)', transition: 'all 0.28s', position: 'relative', zIndex: 2 },
  stopBtn: { width: '172px', height: '172px', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', border: 'none', background: 'linear-gradient(145deg,#E05252,#c03030)', color: '#fff', boxShadow: '0 12px 40px rgba(224,82,82,0.45)', transition: 'all 0.28s', position: 'relative', zIndex: 2 },
  updatesSection: { margin: '20px 16px 0' },
  secTitle: { fontFamily: "'Sora',sans-serif", fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#7a8aaa', marginBottom: '12px' },
  logItem: { background: '#fff', borderRadius: '12px', padding: '12px 14px', border: '1px solid #d8e0f0', display: 'flex', alignItems: 'flex-start', gap: '10px', animation: 'itemIn 0.3s ease both' },
  logDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px' },
  logText: { fontSize: '13px', lineHeight: 1.5, color: '#1a2540' },
  logTime: { fontSize: '11px', color: '#7a8aaa', marginTop: '2px' },
  emptyLog: { textAlign: 'center', padding: '24px', color: '#7a8aaa', fontSize: '14px' },
  toast: { position: 'fixed', bottom: '28px', left: '50%', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 999, whiteSpace: 'nowrap', transition: 'all 0.32s cubic-bezier(.22,1,.36,1)' },
  offBadge: { position: 'fixed', top: '72px', left: '50%', transform: 'translateX(-50%)', background: '#F5A623', color: '#2F3E66', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '99px', zIndex: 100, boxShadow: '0 4px 12px rgba(245,166,35,0.4)' },
  permOverlay: { position: 'fixed', inset: 0, background: 'rgba(26,37,64,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
  permCard: { background: '#fff', borderRadius: '24px', padding: '36px 28px', textAlign: 'center', maxWidth: '320px', width: '90%' },
  permTitle: { fontFamily: "'Sora',sans-serif", fontSize: '20px', fontWeight: 800, color: '#2F3E66', marginBottom: '8px' },
  permText: { fontSize: '14px', color: '#7a8aaa', lineHeight: 1.6, marginBottom: '22px' },
  permBtn: { width: '100%', padding: '16px', background: '#2F3E66', color: '#fff', fontFamily: "'Sora',sans-serif", fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 6px 20px rgba(47,62,102,0.3)' },
};

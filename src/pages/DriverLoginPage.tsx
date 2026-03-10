import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { getDriverInfo } from '../services/driverService';
/**
 * Short-code login flow:
 * 1. Driver enters Bus Number (e.g. "Bus 07") + PIN (e.g. "1234")
 * 2. App constructs email: "driver_bus_07@pathpulse.app"
 * 3. Calls signInWithEmailAndPassword(email, pin)
 * 4. On success, fetches driver profile from Firestore
 */
function buildDriverEmail(busNumber: string): string {
  const slug = busNumber
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  return `driver_${slug}@pathpulse.app`;
}
export default function DriverLoginPage() {
  const navigate = useNavigate();
  const [busInput, setBusInput] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function doLogin() {
    setError('');
    if (!busInput.trim() || !pin.trim()) {
      setError('Please enter Bus Number and PIN');
      return;
    }
    setBusy(true);
    try {
      const email = buildDriverEmail(busInput);
      const cred = await signInWithEmailAndPassword(auth, email, pin.trim());
      const uid = cred.user.uid;
      // Fetch driver profile + bus + route from Firestore
      const info = await getDriverInfo(uid);
      // Store in localStorage for dashboard persistence
      localStorage.setItem(
        'pp_driver',
        JSON.stringify({
          uid: info.uid,
          name: info.name,
          busId: info.busId,
          busNumber: info.busNumber,
          routeId: info.routeId,
          routeOrigin: info.routeOrigin,
          routeDestination: info.routeDestination,
        })
      );
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (
        msg.includes('user-not-found') ||
        msg.includes('invalid-credential')
      ) {
        setError('Invalid Bus Number or PIN. Contact admin.');
      } else if (msg.includes('wrong-password')) {
        setError('Wrong PIN. Try again.');
      } else if (msg.includes('Driver profile not found')) {
        setError('Driver profile missing. Contact admin.');
      } else {
        setError('Login failed. Check your connection.');
      }
      setBusy(false);
    }
  }
  return (
    <div style={styles.body}>
      <div style={styles.bgBus}>🚌</div>
      <div style={styles.orb1} />
      <div style={styles.orb2} />
      <div style={styles.road}>
        <div style={styles.roadLine} />
      </div>
      <div style={styles.card}>
        {/* Brand row */}
        <div style={styles.brandRow}>
          <div style={styles.brandIcon}>🚌</div>
          <div>
            <div style={styles.brandTitle}>PATHPULSE</div>
            <div style={styles.brandSub}>Driver Portal</div>
          </div>
        </div>
        {/* Hero */}
        <div style={styles.hero}>
          <span style={styles.heroEmoji}>👨‍✈️</span>
          <h2 style={styles.heroTitle}>Namaste, Captain!</h2>
          <p style={styles.heroSub}>
            Login below to share your
            <br />
            live location with students
          </p>
        </div>
        {/* Error */}
        {error && (
          <div style={styles.err}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {/* Bus Number */}
        <div style={styles.field}>
          <div style={styles.fieldLbl}>
            <span>🚌</span> Bus Number
          </div>
          <div style={styles.inpWrap}>
            <span style={styles.icoLeft}>🪪</span>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Bus 07"
              value={busInput}
              onChange={(e) => setBusInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                document.getElementById('pin-input')?.focus()
              }
            />
          </div>
        </div>
        {/* PIN */}
        <div style={styles.field}>
          <div style={styles.fieldLbl}>
            <span>🔒</span> PIN
          </div>
          <div style={styles.inpWrap}>
            <span style={styles.icoLeft}>🔑</span>
            <input
              id="pin-input"
              style={styles.input}
              type="password"
              placeholder="Enter your PIN"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doLogin()}
            />
          </div>
        </div>
        {/* Button */}
        <button
          style={{ ...styles.btnLogin, ...(busy ? styles.btnBusy : {}) }}
          onClick={doLogin}
          disabled={busy}
        >
          {busy ? (
            <span style={styles.spinEl} />
          ) : (
            <span>🚀 &nbsp;Login &amp; Start Driving</span>
          )}
        </button>
        <p style={styles.help}>Your admin provides the Bus Number &amp; PIN.</p>
      </div>
      <style>{`
        @keyframes floatbus {
          0%,100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(-16px) rotate(-1deg); }
        }
        @keyframes road {
          to { transform: translateY(-50%) translateX(96px); }
        }
        @keyframes cardUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wave {
          0%,60%,100% { transform: rotate(0); }
          10%  { transform: rotate(14deg); }
          20%  { transform: rotate(-8deg); }
          30%  { transform: rotate(14deg); }
          40%  { transform: rotate(-4deg); }
          50%  { transform: rotate(10deg); }
        }
        @keyframes spinAnim {
          to { transform: rotate(360deg); }
        }
        input:focus {
          border-color: #2F3E66 !important;
          background: #fff !important;
          box-shadow: 0 0 0 4px rgba(47,62,102,0.09) !important;
          outline: none;
        }
      `}</style>
    </div>
  );
}
const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily: "'DM Sans', sans-serif",
    background: '#2F3E66',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    overflow: 'hidden',
    position: 'relative',
  },
  bgBus: {
    position: 'absolute',
    bottom: '-40px',
    right: '-60px',
    fontSize: '300px',
    opacity: 0.06,
    pointerEvents: 'none',
    animation: 'floatbus 7s ease-in-out infinite',
  },
  orb1: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    top: '-120px',
    left: '-100px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute',
    width: '200px',
    height: '200px',
    bottom: '60px',
    right: '10%',
    background: 'rgba(245,166,35,0.06)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  road: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52px',
    background: '#111d30',
    zIndex: 1,
  },
  roadLine: {
    position: 'absolute',
    top: '50%',
    left: '-96px',
    right: 0,
    height: '4px',
    background:
      'repeating-linear-gradient(90deg,#F5A623 0 52px,transparent 52px 96px)',
    transform: 'translateY(-50%)',
    animation: 'road 1.5s linear infinite',
  },
  card: {
    background: '#fff',
    borderRadius: '28px',
    padding: '40px 32px 36px',
    width: 'min(400px, 92vw)',
    boxShadow: '0 40px 100px rgba(0,0,0,0.35)',
    position: 'relative',
    zIndex: 10,
    animation: 'cardUp 0.65s cubic-bezier(.22,1,.36,1) both',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px',
  },
  brandIcon: {
    width: '52px',
    height: '52px',
    background: '#2F3E66',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    boxShadow: '0 6px 16px rgba(47,62,102,0.35)',
  },
  brandTitle: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '18px',
    fontWeight: 800,
    color: '#2F3E66',
    letterSpacing: '1px',
  },
  brandSub: { fontSize: '11px', color: '#7a8aaa', marginTop: '1px' },
  hero: { textAlign: 'center', marginBottom: '28px' },
  heroEmoji: {
    fontSize: '80px',
    display: 'block',
    animation: 'wave 2.2s ease-in-out infinite',
    transformOrigin: '70% 80%',
  },
  heroTitle: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '22px',
    fontWeight: 800,
    color: '#2F3E66',
    margin: '10px 0 5px',
  },
  heroSub: { fontSize: '14px', color: '#7a8aaa', lineHeight: 1.5 },
  err: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(224,82,82,0.09)',
    border: '1.5px solid rgba(224,82,82,0.22)',
    color: '#E05252',
    fontSize: '13px',
    fontWeight: 500,
    padding: '10px 14px',
    borderRadius: '10px',
    marginBottom: '14px',
  },
  field: { marginBottom: '15px' },
  fieldLbl: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: '#7a8aaa',
    marginBottom: '7px',
  },
  inpWrap: { position: 'relative' },
  icoLeft: {
    position: 'absolute',
    left: '15px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '18px',
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '15px 15px 15px 48px',
    border: '2px solid #d8e0f0',
    borderRadius: '12px',
    fontSize: '16px',
    fontFamily: "'DM Sans', sans-serif",
    color: '#1a2540',
    background: '#f6f8ff',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  btnLogin: {
    width: '100%',
    padding: '17px',
    background: '#2F3E66',
    color: '#fff',
    fontFamily: "'Sora', sans-serif",
    fontSize: '17px',
    fontWeight: 700,
    letterSpacing: '0.3px',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.22s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 8px 24px rgba(47,62,102,0.32)',
  },
  btnBusy: { opacity: 0.72, cursor: 'not-allowed' },
  spinEl: {
    width: '20px',
    height: '20px',
    border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spinAnim 0.7s linear infinite',
    display: 'inline-block',
  },
  help: {
    textAlign: 'center',
    marginTop: '16px',
    fontSize: '13px',
    color: '#7a8aaa',
  },
};

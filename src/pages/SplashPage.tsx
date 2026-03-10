import { useEffect } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
export default function SplashPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 4400);
    return () => clearTimeout(timer);
  }, [navigate]);
  const letters = ['P', 'A', 'T', 'H', ' ', 'P', 'U', 'L', 'S', 'E'];
  return (
    <div style={styles.body}>
      <div
        style={{
          ...styles.bgCircle,
          width: 200,
          height: 200,
          animationDelay: '0s',
        }}
      />
      <div
        style={{
          ...styles.bgCircle,
          width: 400,
          height: 400,
          animationDelay: '0.6s',
        }}
      />
      <div
        style={{
          ...styles.bgCircle,
          width: 600,
          height: 600,
          animationDelay: '1.2s',
        }}
      />
      <div
        style={{
          ...styles.bgCircle,
          width: 800,
          height: 800,
          animationDelay: '1.8s',
        }}
      />
      <div style={styles.roadLines} />
      <div style={styles.busRunner}>🚌</div>
      <div style={styles.logoWrap}>
        <div style={styles.collegeLogo}>
          <img
            src="/logo-professional.png"
            alt="Logo"
            style={{ width: '275%', height: '275%', objectFit: 'contain' }}
          />
          <div style={styles.logoRing} />
        </div>
      </div>
      <div style={styles.collegeName}>Vardhaman College of Engineering</div>
      <div style={styles.brandText}>
        {letters.map((letter, i) => (
          <span
            key={i}
            style={{
              ...styles.brandLetter,
              color: i >= 5 ? 'var(--accent)' : '#fff',
              animationDelay: `${1.2 + i * 0.1}s`,
              marginRight: i === 4 ? '8px' : '0',
            }}
          >
            {letter}
          </span>
        ))}
      </div>
      <div style={styles.tagline}>Your bus. Your route. Live.</div>
      <div style={styles.progressWrap}>
        <div style={styles.progressBar} />
      </div>
      <div style={styles.loadingText}>LOADING…</div>
      <style>{`
        @keyframes expandCircle {
          0%   { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 0;   transform: scale(1.2); }
        }
        @keyframes roadMove {
          from { transform: translateX(0); }
          to   { transform: translateX(-80px); }
        }
        @keyframes logoAppear {
          from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes letterIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressFill {
          from { width: 0; }
          to   { width: 100%; }
        }
        @keyframes busRun {
          0%   { left: -60px; opacity: 0; }
          10%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { left: calc(100% + 60px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily: "'DM Sans', sans-serif",
    background: 'var(--primary)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.05)',
    animation: 'expandCircle 4s ease-out infinite',
  },
  roadLines: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    background:
      'repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 40px, transparent 40px, transparent 80px)',
    animation: 'roadMove 2s linear infinite',
  },
  busRunner: {
    position: 'absolute',
    bottom: '20px',
    fontSize: '28px',
    animation: 'busRun 3.5s cubic-bezier(.4,0,.2,1) 1s forwards',
    opacity: 0,
  },
  logoWrap: {
    position: 'relative',
    marginBottom: '32px',
    opacity: 0,
    animation: 'logoAppear 0.8s cubic-bezier(.22,1,.36,1) 0.3s forwards',
  },
  collegeLogo: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
    border: '2px solid rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    position: 'relative',
  },
  logoRing: {
    position: 'absolute',
    inset: '-8px',
    borderRadius: '50%',
    border: '2px solid transparent',
    borderTopColor: 'var(--accent)',
    animation: 'spinRing 2s linear infinite',
  },
  collegeName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '2.5px',
    marginBottom: '16px',
    opacity: 0,
    animation: 'fadeSlideUp 0.6s ease 1.0s forwards',
  },
  brandText: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
  },
  brandLetter: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '48px',
    fontWeight: 800,
    letterSpacing: '2px',
    opacity: 0,
    transform: 'translateY(20px)',
    display: 'inline-block',
    animation: 'letterIn 0.4s cubic-bezier(.22,1,.36,1) forwards',
  },
  tagline: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.5px',
    opacity: 0,
    animation: 'fadeSlideUp 0.6s ease 2.5s forwards',
    marginBottom: '48px',
  },
  progressWrap: {
    width: '200px',
    height: '3px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '99px',
    overflow: 'hidden',
    opacity: 0,
    animation: 'fadeSlideUp 0.4s ease 2.6s forwards',
  },
  progressBar: {
    height: '100%',
    width: 0,
    background: 'linear-gradient(90deg, var(--accent), var(--success))',
    borderRadius: '99px',
    animation: 'progressFill 1.2s cubic-bezier(.4,0,.2,1) 2.8s forwards',
  },
  loadingText: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '10px',
    letterSpacing: '1px',
    opacity: 0,
    animation: 'fadeSlideUp 0.4s ease 2.6s forwards',
  },
};

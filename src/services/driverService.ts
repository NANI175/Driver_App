// ─────────────────────────────────────────────────────────────
// PathPulse Driver – Driver Service (Firestore)
// Queries assigned bus, fetches route, and handles GPS updates.
// ─────────────────────────────────────────────────────────────
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
// ── Types ────────────────────────────────────────────────────
export interface DriverInfo {
  uid: string;
  name: string;
  phone: string;
  busId: string;
  busNumber: string;
  routeId: string | null;
  routeOrigin: string;
  routeDestination: string;
}
export interface RouteInfo {
  routeNumber: string;
  routeName: string;
  origin: string;
  destination: string;
  stops: {
    order: number;
    name: string;
    lat: number;
    lng: number;
    type: string;
  }[];
}
// ── Fetch assigned bus for this driver UID ────────────────────
export async function getDriverInfo(uid: string): Promise<DriverInfo> {
  const driverSnap = await getDoc(doc(db, 'drivers', uid));
  if (!driverSnap.exists()) throw new Error('Driver profile not found');
  const driverData = driverSnap.data();
  const busId = driverData.assignedBusId as string;
  const busSnap = await getDoc(doc(db, 'buses', busId));
  if (!busSnap.exists()) throw new Error('Assigned bus not found');
  const busData = busSnap.data();
  const routeId = (busData.assignedRouteId as string) || null;
  let routeOrigin = '—';
  let routeDestination = '—';
  if (routeId) {
    const routeSnap = await getDoc(doc(db, 'routes', routeId));
    if (routeSnap.exists()) {
      const rd = routeSnap.data();
      const stops = (rd.stops as { name: string; type: string }[]) || [];
      const org = stops.find((s) => s.type === 'origin');
      const dest = stops.find((s) => s.type === 'destination');
      routeOrigin = org?.name || stops[0]?.name || '—';
      routeDestination = dest?.name || stops[stops.length - 1]?.name || '—';
    }
  }
  return {
    uid,
    name: driverData.name as string,
    phone: driverData.phone as string,
    busId,
    busNumber: busData.busNumber as string,
    routeId,
    routeOrigin,
    routeDestination,
  };
}
// ── Fetch full route data ────────────────────────────────────
export async function getRouteInfo(routeId: string): Promise<RouteInfo | null> {
  const routeSnap = await getDoc(doc(db, 'routes', routeId));
  if (!routeSnap.exists()) return null;
  const rd = routeSnap.data();
  const stops = (rd.stops as RouteInfo['stops']) || [];
  return {
    routeNumber: rd.routeNumber as string,
    routeName: rd.routeName as string,
    origin: stops.find((s) => s.type === 'origin')?.name || stops[0]?.name || '—',
    destination: stops.find((s) => s.type === 'destination')?.name || stops[stops.length - 1]?.name || '—',
    stops,
  };
}
// ── Push GPS update to Firestore ─────────────────────────────
// Positional arguments as requested.
// CRITICAL: Strict compliance with Firestore rules: 
// Only ['lastLocation', 'lastUpdated', 'status'] permitted in /buses update.
export async function pushGpsUpdate(
  busId: string,
  lat: number,
  lng: number,
  _speed: number, // Marked as unused for Netlify deployment (Strict Rule Compliance)
  status: 'Active' | 'Idle' | 'Delayed' | 'Offline'
): Promise<void> {
  void _speed; // Explicitly mark as intentionally unused
  if (!busId) throw new Error('Missing bus ID');
  await updateDoc(doc(db, 'buses', busId), {
    lastLocation: { lat, lng },
    lastUpdated: serverTimestamp(),
    status,
    // Note: 'speed' and 'lastMovedTime' removed from this specific update 
    // to satisfy the strict 'hasOnly' rule provided by the user.
  });
}
// ── Write telemetry history (optional) ───────────────────────
// Telemetry allows 'speed' field, so we write speed here.
export async function writeTelemetry(
  busId: string,
  lat: number,
  lng: number,
  speed: number
): Promise<void> {
  await addDoc(collection(db, 'buses', busId, 'telemetry'), {
    lat,
    lng,
    speed: Math.round(speed || 0),
    timestamp: serverTimestamp(),
  });
}
// ── Mark bus as stopped ──────────────────────────────────────
export async function markBusStopped(busId: string): Promise<void> {
  await updateDoc(doc(db, 'buses', busId), {
    status: 'Offline',
    lastUpdated: serverTimestamp(),
  });
}

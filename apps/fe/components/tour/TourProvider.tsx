import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { nextStep, readTourStep, readTourStepSync, writeTourStep, type TourStep } from '../../lib/tour';

export type TourTargetId = 'ring' | 'button' | 'friendsIcon' | 'groupsIcon' | 'friendsQr' | 'groupsCreate' | 'dummy';

type TourValue = {
  /** Aktuální krok, nebo `null`, když průvodce neběží (nikdy nezačal / je `done`). */
  step: TourStep | null;
  /** Posune průvodce dál, ale jen pokud je právě na kroku `from` - volání je tak idempotentní a pozdní/dvojí volání nic nerozbije. */
  advance: (from: TourStep) => void;
  /** Skočí rovnou na konkrétní krok (pokračování po handoffu, přeskočení části A). */
  goTo: (step: TourStep) => void;
  skip: () => void;
  registerTarget: (id: TourTargetId, ref: React.RefObject<View | null>) => () => void;
  getTarget: (id: TourTargetId) => React.RefObject<View | null> | undefined;
};

const TourContext = createContext<TourValue | null>(null);

/**
 * Stav průvodce po registraci (task 0019). Musí být uvnitř AuthProvider -
 * krok se ukládá per uživatel. Sám nic nevykresluje; nápovědy kreslí
 * TourOverlay na jednotlivých obrazovkách a úvodní kroky `app/onboarding.tsx`.
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const { status, me } = useAuth();
  const userId = status === 'signedIn' && me ? String(me.userID) : null;

  const [raw, setRaw] = useState<TourStep | null>(() =>
    userId ? (readTourStepSync(userId) ?? null) : null,
  );
  const targets = useRef(new Map<TourTargetId, React.RefObject<View | null>>());

  useEffect(() => {
    if (!userId) {
      setRaw(null);
      return;
    }
    const sync = readTourStepSync(userId);
    if (sync !== undefined) {
      setRaw(sync);
      return;
    }
    let alive = true;
    readTourStep(userId).then(s => {
      if (alive) setRaw(s);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const set = useCallback(
    (update: (cur: TourStep | null) => TourStep | null) => {
      setRaw(cur => {
        const next = update(cur);
        if (next !== cur && next != null && userId) writeTourStep(userId, next);
        return next;
      });
    },
    [userId],
  );

  const advance = useCallback((from: TourStep) => set(cur => (cur === from ? nextStep(cur) : cur)), [set]);
  const goTo = useCallback((step: TourStep) => set(() => step), [set]);
  const skip = useCallback(() => set(cur => (cur == null ? cur : 'done')), [set]);

  const registerTarget = useCallback((id: TourTargetId, ref: React.RefObject<View | null>) => {
    targets.current.set(id, ref);
    return () => {
      if (targets.current.get(id) === ref) targets.current.delete(id);
    };
  }, []);
  const getTarget = useCallback((id: TourTargetId) => targets.current.get(id), []);

  const value = useMemo<TourValue>(
    () => ({
      step: raw === 'done' ? null : raw,
      advance,
      goTo,
      skip,
      registerTarget,
      getTarget,
    }),
    [raw, advance, goTo, skip, registerTarget, getTarget],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

/** Ref pro prvek, na který má průvodce ukázat. Připoj ho na `View` (s `collapsable={false}` kvůli Androidu). */
export function useTourTarget(id: TourTargetId): React.RefObject<View | null> {
  const { registerTarget } = useTour();
  const ref = useRef<View | null>(null);
  useEffect(() => registerTarget(id, ref), [id, registerTarget]);
  return ref;
}

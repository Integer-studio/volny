import { useCallback, useEffect, useRef, useState } from 'react';
import { api, PresetInput } from '../lib/api';
import { readCacheSync, writeCache } from '../lib/cache';
import { DEFAULT_PRESETS, PresetDef } from '../components/TimeRing/presets';
import { useAutoRefresh } from './useAutoRefresh';

const CACHE_KEY = 'presets';

function cached(): PresetDef[] | null {
  const userId = api.getCurrentUserId();
  if (userId == null) return null;
  return readCacheSync<PresetDef[]>(String(userId), CACHE_KEY)?.data ?? null;
}

function persist(defs: PresetDef[]): void {
  const userId = api.getCurrentUserId();
  if (userId != null) writeCache(String(userId), CACHE_KEY, defs);
}

/**
 * Uživatelovy presety (task 0009). Drží je backend, aby byly stejné na webu
 * i v mobilu; tady se zrcadlí do cache, takže prstenec má kotvy hned při
 * prvním vykreslení. Úplně poprvé (bez cache) se do odpovědi serveru ukazují
 * výchozí presety - jsou stejné, jaké backend nový účet osadí.
 *
 * Úpravy se nezapisují optimisticky, s výjimkou mazání: editor čeká na
 * odpověď, protože 409 ("na tenhle čas už preset máš") patří do formuláře
 * k políčku, ne do toastu po zavření. Mazání naopak zmizí hned a vrací se
 * přes "Vrátit" v toastu.
 */
export function usePresets() {
  const [seed] = useState(cached);
  const [defs, setDefs] = useState<PresetDef[]>(seed ?? DEFAULT_PRESETS);
  // Výchozí náhrada nemá serverová id, takže ji nejde upravovat - editace
  // se odemkne až se skutečným seznamem (z cache nebo ze serveru).
  const [ready, setReady] = useState(seed != null);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // Načtení, které vyrazilo před poslední úpravou, nesmí její výsledek
  // přepsat starým stavem ze serveru.
  const generation = useRef(0);

  const commit = useCallback((next: PresetDef[]) => {
    generation.current++;
    setDefs(next);
    persist(next);
  }, []);

  const reload = useCallback(() => {
    const myGeneration = generation.current;
    api.getPresets()
      .then((fresh) => {
        if (!alive.current || myGeneration !== generation.current) return;
        setDefs(fresh);
        setReady(true);
        persist(fresh);
      })
      // Bez sítě zůstane, co je - cache nebo výchozí kotvy. Prstenec tím
      // funguje dál, jen editace počká.
      .catch(() => {});
  }, []);

  // Úpravy z druhého zařízení se dotáhnou po návratu do appky.
  useAutoRefresh(reload, { intervalMs: 5 * 60_000 });

  // Funkční aktualizace přes ref: mezi odesláním a odpovědí se `defs` může
  // změnit (třeba smazání jiného presetu), a zavřená hodnota by ho vrátila.
  const defsRef = useRef(defs);
  defsRef.current = defs;

  const create = useCallback(async (input: PresetInput) => {
    const created = await api.createPreset(input);
    commit([...defsRef.current, created]);
    return created;
  }, [commit]);

  const update = useCallback(async (id: string, input: PresetInput) => {
    const updated = await api.updatePreset(id, input);
    commit(defsRef.current.map((d) => (d.id === id ? updated : d)));
    return updated;
  }, [commit]);

  /** Zmizí hned; když server odmítne, vrátí se a chyba se vyhodí volajícímu. */
  const remove = useCallback(async (def: PresetDef) => {
    commit(defsRef.current.filter((d) => d.id !== def.id));
    try {
      await api.deletePreset(def.id);
    } catch (e) {
      commit([...defsRef.current, def]);
      throw e;
    }
  }, [commit]);

  /** "Vrátit" po smazání - založí preset znovu, server mu dá nové id. */
  const restore = useCallback(
    (def: PresetDef) => create({ name: def.name, icon: def.icon, minute: def.minute }),
    [create],
  );

  const reset = useCallback(async () => {
    commit(await api.resetPresets());
  }, [commit]);

  return { presets: defs, ready, create, update, remove, restore, reset };
}

export type PresetsApi = ReturnType<typeof usePresets>;

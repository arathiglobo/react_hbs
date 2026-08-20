import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import axiosInstance from "../components/AxiosInstance";
import { DEFAULT_FEATURE_FLAGS } from "./featureFlags";

// Backend-driven feature flags. The provider fetches /api/config/features
// exactly once on app boot and caches the result in React state. Old
// backends do not ship that endpoint — the catch below keeps the defaults
// (all false), so the app silently behaves as if the new feature never
// existed on those backends. No frontend build swap required.
const FeatureFlagsContext = createContext({
  flags: DEFAULT_FEATURE_FLAGS,
  loaded: false,
});

export function FeatureFlagsProvider({ children }) {
  const [state, setState] = useState({
    flags: DEFAULT_FEATURE_FLAGS,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/api/config/features")
      .then((res) => {
        if (cancelled) return;
        setState({
          flags: { ...DEFAULT_FEATURE_FLAGS, ...(res?.data || {}) },
          loaded: true,
        });
      })
      .catch(() => {
        // Old backend: endpoint missing (404) or unreachable. Keep the
        // defaults so date pickers stay on the legacy <input type="date">
        // path and RateCalendar never mounts (so it never tries to hit
        // /api/hotel-search/rate-calendar and produce console noise).
        if (!cancelled) {
          setState({ flags: DEFAULT_FEATURE_FLAGS, loaded: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={state}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlag(name) {
  const { flags } = useContext(FeatureFlagsContext);
  return flags[name];
}

export function useFeatureFlagsLoaded() {
  return useContext(FeatureFlagsContext).loaded;
}

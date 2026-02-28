import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

export function useFetch(url, params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const paramsKey = JSON.stringify(params);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await api.get(url, { params });
      if (mountedRef.current) {
        setData(res.data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.response?.data?.error || err.message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

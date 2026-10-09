import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import * as api from './api';

const POLL_MS = 1000;

/** Owns the workbench state. Everything shown comes from the backend, nothing is cached or invented. */
const useKillChain = () => {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [lastRun, setLastRun] = useState(null);
  const [examples, setExamples] = useState(null);
  const [models, setModels] = useState({ default: '', available: false, models: [] });
  const lastEvent = useRef(0);

  useEffect(() => {
    lastEvent.current = (state?.events || []).reduce((top, e) => Math.max(top, e.id), 0);
  }, [state]);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getState();
      setState(next);
      setError('');
      return next;
    } catch (e) {
      setError(api.errorText(e, 'Could not load the lab.'));
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    api.getExamples().then(setExamples).catch(() => {});
    api.getModels().then(setModels).catch(() => {});
  }, [refresh]);

  /** Run a long action and stream trace events while it works. */
  const live = useCallback(async (label, work) => {
    setBusy(label);
    setNotice(null);
    const timer = setInterval(async () => {
      try {
        const { events } = await api.getEvents(lastEvent.current);
        if (!events.length) return;
        setState((current) => {
          if (!current) return current;
          const seen = new Set(current.events.map((e) => e.id));
          return { ...current, events: [...current.events, ...events.filter((e) => !seen.has(e.id))] };
        });
      } catch {
        /* the final refresh below reports any real problem */
      }
    }, POLL_MS);
    try {
      return await work();
    } catch (e) {
      setNotice({ severity: 'error', message: api.errorText(e) });
      return null;
    } finally {
      clearInterval(timer);
      await refresh();
      setBusy('');
    }
  }, [refresh]);

  const quick = useCallback(async (label, work, success) => {
    setBusy(label);
    setNotice(null);
    try {
      const result = await work();
      if (success) setNotice({ severity: 'success', message: typeof success === 'function' ? success(result) : success });
      return result;
    } catch (e) {
      setNotice({ severity: 'error', message: api.errorText(e) });
      return null;
    } finally {
      await refresh();
      setBusy('');
    }
  }, [refresh]);

  const changeMode = (mode) => quick('mode', () => api.setMode(mode), `Mode set to ${mode}. Memory was not touched.`);

  const submitReview = (body) => quick('review', () => api.postReview(body), (r) => (
    r.connector_memory_id
      ? `Review ${r.review_id} stored. Extracted into connector memory CM-${r.connector_memory_id}.`
      : `Review ${r.review_id} stored. Nothing hidden was found.`
  ));

  const createTicket = (form) => quick('ticket', () => api.postTicket(form), (r) => (
    r.attachment?.connector_memory_id
      ? `Ticket ${r.ticket_id} created. The attachment was extracted into connector memory CM-${r.attachment.connector_memory_id}.`
      : `Ticket ${r.ticket_id} created.`
  ));

  const attach = (ticketId, form) => quick('ticket', () => api.postAttachment(ticketId, form), (r) => (
    r.connector_memory_id
      ? `Attachment stored. Extracted into connector memory CM-${r.connector_memory_id}.`
      : 'Attachment stored. Nothing hidden was found.'
  ));

  const runTurn = (message, model) => live('turn', async () => {
    const run = await api.postTurn(message, model);
    setLastRun(run);
    return run;
  });

  const decide = (id, decision) => live('decision', async () => {
    const run = await api.postDecision(id, decision);
    setLastRun(run);
    return run;
  });

  // A shopper's coupon attempt. It only reads lab data and adds one trace row.
  const storefront = (code, product) => quick('storefront', () => api.postStorefrontCoupon(code, product));

  const cleanup = (kind, success) => quick(kind, async () => {
    const out = await api.postCleanup(kind);
    setState(out.state);
    if (kind === 'hard_reset') setLastRun(null);
    return out;
  }, success);

  return {
    state, error, notice, setNotice, busy, lastRun, examples, models, refresh,
    changeMode, submitReview, createTicket, attach, runTurn, decide, cleanup, storefront,
  };
};

export default useKillChain;

'use client';

import { useEffect, useRef, useState } from 'react';
import type { EidolonEvent } from '@/lib/api';

const MAX_EVENTS = 80;

export function useEidolonEvents(): EidolonEvent[] {
  const [events, setEvents] = useState<EidolonEvent[]>([]);
  const retryMs = useRef(1000);

  useEffect(() => {
    let stopped = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      es = new EventSource('/v1/eidolon/events');
      es.onopen = () => { retryMs.current = 1000; };
      es.onmessage = (msg) => handle(msg.data);
      // Register all known event kinds as named SSE listeners. The backend may
      // send events as named types (`event: agent.moved`) which bypass
      // `onmessage`. Covering every kind ensures nothing is silently dropped.
      [
        'market.listing_published','market.order_paid','market.fulfilled',
        'market.refunded','market.task_created','market.task_completed',
        'treasury.credit','treasury.debit',
        'agent.spawned','agent.retired','agent.profile_updated',
        'agent.tokens_earned','agent.moved','agent.built_structure',
        'agent.parcel_acquired','agent.avatar_changed','agent.anomaly_detected',
        'agent.report_generated','agent.message_sent',
        'agent.business_created','agent.business_activated','agent.business_deactivated',
        'oversight.command_issued',
        'crew.created','crew.member_added',
        'goal.progress','goal.completed',
        'publishing.project_created','publishing.stage_advanced',
        'publishing.review_submitted','publishing.book_published',
        'world.tick','world.parcel_interaction',
        'infra.node_change','heartbeat',
      ].forEach((k) => es?.addEventListener(k, (msg: MessageEvent) => handle(msg.data)));
      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        timer = setTimeout(connect, retryMs.current);
        retryMs.current = Math.min(retryMs.current * 2, 15000);
      };
    };

    const handle = (raw: string) => {
      try {
        const ev = JSON.parse(raw) as EidolonEvent;
        setEvents((prev) => [ev, ...prev].slice(0, MAX_EVENTS));
      } catch {
        /* ignore malformed frame */
      }
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  return events;
}

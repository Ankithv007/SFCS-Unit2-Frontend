import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../utils/api';

export interface PreviousStageUnit {
    id: number | string;
    serial_number: string;
    work_order_id: string;
    side: string;
    current_stage: string;
    previous_stage: string;
    status: string;
    scanned_by: string;
    scanned_at: string;
}

interface UsePreviousStagePassedOptions {
    workOrderId: string | null | undefined;
    side: string | null | undefined;
    stage: string; // e.g. 'SPI', 'Pre-AOI', 'Post-AOI', 'Rework', 'SMT-FG'
    sessionId?: string | null | undefined;
    enabled?: boolean;
    pollingIntervalMs?: number; // default 3500ms
}

export function usePreviousStagePassed({
    workOrderId,
    side,
    stage,
    sessionId,
    enabled = true,
    pollingIntervalMs = 3500
}: UsePreviousStagePassedOptions) {
    const [units, setUnits] = useState<PreviousStageUnit[]>([]);
    const [count, setCount] = useState<number>(0);
    const [previousStage, setPreviousStage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Track active abort controller and latest request ID to prevent race conditions
    const abortControllerRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef<number>(0);
    const isMountedRef = useRef<boolean>(true);

    const isPrinting = (stage || '').toUpperCase().replace(/[\s\-_]/g, '') === 'PRINTING';

    const fetchPreviousStagePassed = useCallback(async (isPolling = false) => {
        if (!enabled || isPrinting || !workOrderId || !side) {
            if (isMountedRef.current) {
                setUnits([]);
                setCount(0);
                setPreviousStage(null);
                setLoading(false);
                setError(null);
            }
            return;
        }

        // Cancel existing in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const currentReqId = ++requestIdRef.current;

        if (!isPolling && isMountedRef.current) {
            setLoading(true);
            setError(null);
        }

        try {
            const queryParams = new URLSearchParams({
                workOrderId: workOrderId.trim(),
                side: side.trim(),
                stage: stage.trim()
            });
            if (sessionId) {
                queryParams.set('sessionId', sessionId);
            }

            const res = await apiFetch(`/api/smt/previous-stage-passed?${queryParams.toString()}`, {
                signal: controller.signal
            });

            // If another request was started while this was pending, ignore this result
            if (currentReqId !== requestIdRef.current || !isMountedRef.current) {
                return;
            }

            if (res && res.success !== false) {
                const fetchedUnits: PreviousStageUnit[] = res.units || res.data || [];
                const fetchedCount: number = typeof res.count === 'number' ? res.count : fetchedUnits.length;
                const fetchedPrevStage: string = res.previousStage || '';

                setUnits(fetchedUnits);
                setCount(fetchedCount);
                setPreviousStage(fetchedPrevStage);
                setError(null);
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                // Request was intentionally cancelled, do not set error
                return;
            }
            if (currentReqId === requestIdRef.current && isMountedRef.current) {
                // Don't clear existing data on intermittent polling failure
                if (!isPolling) {
                    setError(err.message || 'Failed to fetch previous stage passed data.');
                }
            }
        } finally {
            if (currentReqId === requestIdRef.current && isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [enabled, isPrinting, workOrderId, side, stage, sessionId]);

    // Context changes (WO, side, stage): immediately clear old data & fetch new
    useEffect(() => {
        isMountedRef.current = true;

        // Reset state immediately on context change so stale data is never shown
        setUnits([]);
        setCount(0);
        setError(null);

        fetchPreviousStagePassed(false);

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [workOrderId, side, stage, sessionId, enabled, fetchPreviousStagePassed]);

    // Live update Polling & Visibility Revalidation
    useEffect(() => {
        if (!enabled || isPrinting || !workOrderId || !side) return;

        let intervalId: NodeJS.Timeout | null = null;

        const startPolling = () => {
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(() => {
                // Only poll if document is visible
                if (typeof document !== 'undefined' && !document.hidden) {
                    fetchPreviousStagePassed(true);
                }
            }, pollingIntervalMs);
        };

        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && !document.hidden) {
                // Revalidate immediately on tab focus
                fetchPreviousStagePassed(true);
            }
        };

        startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (intervalId) clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, isPrinting, workOrderId, side, pollingIntervalMs, fetchPreviousStagePassed]);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const refetch = useCallback(() => {
        return fetchPreviousStagePassed(false);
    }, [fetchPreviousStagePassed]);

    return {
        units,
        count,
        previousStage,
        loading,
        error,
        refetch
    };
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { agentAPI } from '@/lib/api';

type AgentRun = {
  id: string;
  input: string;
  status: string;
  model?: string;
  latencyMs?: number;
  startedAt: string;
  completedAt?: string;
  _count?: { steps?: number; confirmations?: number };
};

type AgentStep = {
  id: string;
  type: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  durationMs?: number;
  createdAt: string;
};

type AgentMemory = {
  id: string;
  type: string;
  content: string;
  source: string;
  confidence: number;
  status: string;
  updatedAt: string;
};

type AgentConfirmation = {
  id: string;
  runId: string;
  toolName: string;
  summary: string;
  status: string;
  createdAt: string;
};

const panelStyle: React.CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.22)',
  background: 'rgba(15, 23, 42, 0.72)',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.24)',
};

const mutedStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 13,
};

export default function AgentDebugPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [confirmations, setConfirmations] = useState<AgentConfirmation[]>([]);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [profile, setProfile] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId),
    [runs, selectedRunId],
  );

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [runsResult, confirmationsResult, memoriesResult, profileResult] = await Promise.all([
        agentAPI.getRuns(20),
        agentAPI.getConfirmations({ status: 'pending', limit: 20 }),
        agentAPI.getMemories(),
        agentAPI.getProfile(),
      ]);

      const nextRuns = runsResult.data || [];
      setRuns(nextRuns);
      setConfirmations(confirmationsResult.data?.confirmations || []);
      setMemories(memoriesResult.data || []);
      setProfile(profileResult.data || null);
      setSelectedRunId((current) => current || nextRuns[0]?.id || '');
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load agent debug data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setSteps([]);
      return;
    }

    let cancelled = false;
    agentAPI.getRunSteps(selectedRunId)
      .then((result) => {
        if (!cancelled) {
          setSteps(result.data?.steps || []);
        }
      })
      .catch((loadError: any) => {
        if (!cancelled) {
          setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load run steps');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  return (
    <main style={{
      minHeight: '100vh',
      padding: '40px 20px',
      color: '#e5edf7',
      background: 'radial-gradient(circle at top left, rgba(20, 184, 166, 0.18), transparent 34%), linear-gradient(135deg, #07111f 0%, #111827 54%, #0f172a 100%)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div>
            <p style={{ ...mutedStyle, margin: '0 0 8px' }}>Agent Debug Console</p>
            <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.04em' }}>Agent runtime debug</h1>
            <p style={{ ...mutedStyle, margin: '10px 0 0' }}>Inspect runs, steps, confirmations, memories, and profile data.</p>
          </div>
          <button type="button" onClick={loadOverview} style={{ border: '1px solid rgba(45, 212, 191, 0.36)', background: 'rgba(20, 184, 166, 0.16)', color: '#ccfbf1', borderRadius: 999, padding: '12px 18px', cursor: 'pointer', fontWeight: 700 }}>Refresh</button>
        </header>

        {error && <section style={{ ...panelStyle, borderColor: 'rgba(248, 113, 113, 0.45)', color: '#fecaca' }}>{error}</section>}

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(360px, 0.9fr)', gap: 20 }}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Recent runs</h2>
            {loading ? <p style={mutedStyle}>Loading...</p> : runs.length === 0 ? <p style={mutedStyle}>No agent runs yet.</p> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {runs.map((run) => (
                  <button key={run.id} type="button" onClick={() => setSelectedRunId(run.id)} style={{ textAlign: 'left', border: selectedRunId === run.id ? '1px solid rgba(45, 212, 191, 0.72)' : '1px solid rgba(148, 163, 184, 0.18)', background: selectedRunId === run.id ? 'rgba(20, 184, 166, 0.12)' : 'rgba(30, 41, 59, 0.72)', color: '#e5edf7', borderRadius: 16, padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong>{run.status}</strong>
                      <span style={mutedStyle}>{run.latencyMs ? run.latencyMs + 'ms' : 'pending'}</span>
                    </div>
                    <p style={{ margin: '8px 0 0', lineHeight: 1.5 }}>{run.input}</p>
                    <p style={{ ...mutedStyle, margin: '8px 0 0' }}>steps {run._count?.steps ?? 0} ? confirmations {run._count?.confirmations ?? 0} ? {new Date(run.startedAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Selected run</h2>
            {selectedRun ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ margin: 0 }}>{selectedRun.input}</p>
                <p style={mutedStyle}>ID: {selectedRun.id}</p>
                <p style={mutedStyle}>Model: {selectedRun.model || 'unknown'}</p>
                <p style={mutedStyle}>Status: {selectedRun.status}</p>
              </div>
            ) : <p style={mutedStyle}>Select a run.</p>}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Run steps</h2>
          {steps.length === 0 ? <p style={mutedStyle}>No steps.</p> : (
            <div style={{ display: 'grid', gap: 12 }}>
              {steps.map((step, index) => (
                <details key={step.id} style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 16, padding: 14, background: 'rgba(15, 23, 42, 0.58)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{index + 1}. {step.type} ? {step.status} {step.durationMs ? '? ' + step.durationMs + 'ms' : ''}</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', color: '#cbd5e1', fontSize: 12 }}>{JSON.stringify({ input: step.input, output: step.output, error: step.error }, null, 2)}</pre>
                </details>
              ))}
            </div>
          )}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Pending confirmations</h2>
            {confirmations.length === 0 ? <p style={mutedStyle}>No pending confirmations.</p> : confirmations.map((item) => (
              <div key={item.id} style={{ marginTop: 10, padding: 12, borderRadius: 14, background: 'rgba(30, 41, 59, 0.72)' }}>
                <strong>{item.toolName}</strong>
                <p style={{ margin: '8px 0 0' }}>{item.summary}</p>
              </div>
            ))}
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Long-term memory</h2>
            {memories.length === 0 ? <p style={mutedStyle}>No memories.</p> : memories.slice(0, 8).map((memory) => (
              <div key={memory.id} style={{ marginTop: 10, padding: 12, borderRadius: 14, background: 'rgba(30, 41, 59, 0.72)' }}>
                <strong>{memory.type}</strong>
                <p style={{ margin: '8px 0 0' }}>{memory.content}</p>
                <p style={{ ...mutedStyle, margin: '8px 0 0' }}>{memory.status} ? confidence {memory.confidence}</p>
              </div>
            ))}
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Profile</h2>
            <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', color: '#cbd5e1', fontSize: 12 }}>{JSON.stringify(profile, null, 2)}</pre>
          </div>
        </section>
      </div>
    </main>
  );
}

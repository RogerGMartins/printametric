/** React adapter owns text drafts; the worker client owns accepted model revisions. */
import { useEffect, useRef, useState } from 'react';
import { downloadBytes } from '../../../shared/export/download.ts';
import { DEFAULT_PARAMETERS, parameterDigest, type ParameterName } from '../model/parameters.ts';
import { parseDesign, serializeDesign } from '../model/design-file.ts';
import { DesignError, LIMITS } from '../model/budget.ts';
import { WallArtClient, type EditorSnapshot } from './worker-client.ts';
import { parseDrafts, toDrafts } from './state.ts';

export function useWallArt() {
  const [snapshot, setSnapshot] = useState<EditorSnapshot>({ accepted: null, status: 'starting', error: null, exporting: null });
  const [drafts, setDrafts] = useState(() => toDrafts({ ...DEFAULT_PARAMETERS }));
  const [inputError, setInputError] = useState<{ message: string; field?: string } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const client = useRef<WallArtClient | null>(null);
  const pendingImport = useRef<Uint8Array | null>(null);
  const loadSequence = useRef(0);
  const draftRef = useRef(drafts); draftRef.current = drafts;
  useEffect(() => {
    const controller = new WallArtClient(() => new Worker(new URL('../geometry/worker.ts', import.meta.url), { type: 'module' }), state => {
      setSnapshot(state);
      if (pendingImport.current && state.accepted?.originalBytes === pendingImport.current) {
        setDrafts(toDrafts(state.accepted.parameters)); pendingImport.current = null; setInputError(null);
      } else if (state.error) pendingImport.current = null;
    }, (bytes, format, revision) => downloadBytes(bytes, `wall-art-r${revision}-mm.${format === '3mf' ? 'model.3mf' : format}`, format === '3mf' ? 'model/3mf' : 'application/octet-stream'));
    client.current = controller; controller.start();
    return () => { loadSequence.current++; controller.dispose(); if (client.current === controller) client.current = null; };
  }, []);
  function report(error: unknown) {
    setInputError({ message: error instanceof Error ? error.message : 'The design could not be loaded.', ...(error instanceof DesignError && error.field ? { field: error.field } : {}) });
  }
  function change(name: ParameterName, value: string) {
    loadSequence.current++; setLoadingFile(false); pendingImport.current = null;
    const next = { ...draftRef.current, [name]: value }; draftRef.current = next; setDrafts(next);
  }
  function commit() {
    try {
      const parameters = parseDrafts(draftRef.current); setInputError(null);
      if (parameterDigest(parameters) === snapshot.accepted?.result.digest && snapshot.status === 'ready') { client.current?.clearError(); return; }
      client.current?.submit(parameters);
    } catch (error) { report(error); }
  }
  async function load(file: File | undefined) {
    if (!file) return;
    const sequence = ++loadSequence.current; setLoadingFile(true);
    try {
      if (file.size > LIMITS.fileBytes) throw new DesignError('FILE_SIZE', 'Design files must be at most 1 MiB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (sequence !== loadSequence.current) return;
      const parameters = parseDesign(bytes); pendingImport.current = bytes;
      client.current?.submit(parameters, bytes); setInputError(null);
    } catch (error) { if (sequence === loadSequence.current) { pendingImport.current = null; report(error); } }
    finally { if (sequence === loadSequence.current) setLoadingFile(false); }
  }
  function revert() {
    loadSequence.current++; setLoadingFile(false); pendingImport.current = null;
    const next = toDrafts(snapshot.accepted?.parameters ?? { ...DEFAULT_PARAMETERS }); draftRef.current = next; setDrafts(next); setInputError(null);
    if (snapshot.status !== 'ready') client.current?.cancelGeneration(); else client.current?.clearError();
  }
  let validDraft = null;
  try { validDraft = parseDrafts(drafts); } catch { /* Invalid text remains editable. */ }
  const dirty = !validDraft || parameterDigest(validDraft) !== snapshot.accepted?.result.digest;
  const ready = Boolean(snapshot.accepted && snapshot.status === 'ready' && !snapshot.exporting && !snapshot.error && !inputError && !dirty && !loadingFile);
  function save(ungenerated = false) {
    try {
      const parameters = ungenerated ? parseDrafts(draftRef.current) : snapshot.accepted?.parameters;
      if (!parameters || (!ungenerated && !ready)) return;
      downloadBytes(serializeDesign(parameters), `wall-art${ungenerated ? '-ungenerated' : ''}.json`, 'application/json');
    } catch (error) { report(error); }
  }
  return { snapshot, drafts, inputError, loadingFile, dirty, ready, validDraft, change, commit, load, revert, save,
    exportModel: (format: 'step' | 'stl' | '3mf') => { if (ready) client.current?.export(format); },
    retry: () => client.current?.retry(), cancelExport: () => client.current?.cancelExport() };
}
export type WallArtEditor = ReturnType<typeof useWallArt>;

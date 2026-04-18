import { supabase } from '../lib/supabaseClient';

const LOG_PREFIX = '[runtime-monitor]';

async function logRuntimeError(message, metadata = {}) {
  if (!supabase) {
    return;
  }

  try {
    await supabase.rpc('beca_log_runtime_error', {
      p_message: String(message || 'unknown-error'),
      p_metadata: metadata,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} failed to send`, error);
  }
}

export function startRuntimeMonitor() {
  const onError = (event) => {
    const message = event?.message || event?.error?.message || 'window-error';
    void logRuntimeError(message, {
      type: 'error',
      file: event?.filename || null,
      line: event?.lineno || null,
      column: event?.colno || null,
      stack: event?.error?.stack || null,
    });
  };

  const onRejection = (event) => {
    const reason = event?.reason;
    void logRuntimeError(
      reason?.message || String(reason || 'unhandled-rejection'),
      {
        type: 'unhandledrejection',
        stack: reason?.stack || null,
      }
    );
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

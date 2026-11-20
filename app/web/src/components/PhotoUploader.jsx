import { useRef, useState } from 'react';
import { Camera, Check, LoaderCircle, X } from 'lucide-react';
import { ALLOWED_PHOTO_TYPES, uploadPhoto } from '../lib/api.js';

/** Envia até `max` fotos para um caso. Cada foto passa pela quarentena da API. */
export function PhotoUploader({ sightingId, max = 3, onUploaded }) {
  const input = useRef(null);
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(false);
  const remaining = max - items.filter((i) => i.status !== 'erro').length;

  async function handle(files) {
    const list = [...files].slice(0, Math.max(0, remaining));
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      setItems((cur) => [...cur, { key, name: file.name, preview, status: 'enviando' }]);
      try {
        await uploadPhoto(sightingId, file);
        setItems((cur) => cur.map((i) => (i.key === key ? { ...i, status: 'ok' } : i)));
        onUploaded?.();
      } catch (err) {
        setItems((cur) => cur.map((i) => (i.key === key ? { ...i, status: 'erro', error: err.message } : i)));
      }
    }
  }

  return (
    <div>
      {remaining > 0 && (
        <div
          className={`dropzone${drag ? ' drag' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
        >
          <Camera size={28} style={{ margin: '0 auto 8px' }} />
          <div className="label">Arraste as fotos ou clique para escolher</div>
          <div className="field-hint">JPEG, PNG ou WEBP · até 5 MB · faltam {remaining}. Metadados como GPS são removidos.</div>
          <input ref={input} type="file" accept={ALLOWED_PHOTO_TYPES.join(',')} multiple hidden
            onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {items.length > 0 && (
        <div className="upload-list">
          {items.map((i) => (
            <div key={i.key} className="upload-item">
              <img src={i.preview} alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                <div className={i.status === 'erro' ? 'field-error' : 'field-hint'}>
                  {i.status === 'enviando' && 'Enviando e verificando…'}
                  {i.status === 'ok' && 'Recebida. Aguardando o moderador.'}
                  {i.status === 'erro' && i.error}
                </div>
              </div>
              {i.status === 'enviando' && <LoaderCircle size={20} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} />}
              {i.status === 'ok' && <Check size={20} color="var(--ok)" />}
              {i.status === 'erro' && <X size={20} color="var(--stamp)" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

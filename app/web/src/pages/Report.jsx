import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Crosshair, LocateFixed } from 'lucide-react';
import { api, useApi } from '../lib/api.js';
import { todayIso, UFS } from '../lib/format.js';
import { PhotoUploader } from '../components/PhotoUploader.jsx';

const empty = { cryptidId: null, title: '', description: '', city: '', uf: '', seenAt: '', latitude: '', longitude: '' };

export default function Report() {
  const cryptids = useApi('/cryptids');
  const [form, setForm] = useState(empty);
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setForm((f) => ({
        ...f, latitude: pos.coords.latitude.toFixed(5), longitude: pos.coords.longitude.toFixed(5),
      })),
      () => setError('Não foi possível pegar sua localização. Preencha à mão ou deixe em branco.'),
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!form.cryptidId) { setError('Escolha qual criptídeo você viu.'); return; }
    setSending(true);
    const payload = {
      cryptidId: form.cryptidId,
      title: form.title,
      description: form.description,
      city: form.city,
      uf: form.uf,
      seenAt: form.seenAt,
      ...(form.latitude && form.longitude
        ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
        : {}),
    };
    try {
      const res = await api.post('/sightings', payload);
      setCreated(res);
      setStep(2);
    } catch (err) {
      setError(err.message);
      if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.campo, d.mensagem])));
    } finally {
      setSending(false);
    }
  }

  if (step === 3) {
    return (
      <div className="container">
        <div className="mission">
          <div className="hud dim" style={{ marginBottom: 12 }}>Relato enviado para análise</div>
          <div className="display mission-title">Missão cumprida</div>
          <p style={{ maxWidth: 520, margin: '16px auto 28px' }}>
            Seu caso entrou no arquivo. Um moderador vai verificar o relato e as evidências antes de publicar.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/meus-casos" className="btn btn-primary">Acompanhar meus casos</Link>
            <button type="button" className="btn" onClick={() => { setForm(empty); setCreated(null); setStep(1); }}>
              Reportar outro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container briefing">
      <span className="section-kicker hud"><Crosshair size={14} style={{ verticalAlign: -2 }} /> Briefing</span>
      <h1 className="display section-title" style={{ marginBottom: 20 }}>
        {step === 1 ? 'Reportar avistamento' : 'Anexar evidências'}
      </h1>
      <div className="steps" aria-hidden="true">
        <div className="step done" /><div className={`step${step >= 2 ? ' done' : ''}`} /><div className="step" />
      </div>

      {step === 1 && (
        <form className="briefing-card form-grid" onSubmit={submit} noValidate>
          <div className="field">
            <label id="pick-label">O que você viu?</label>
            <div className="cryptid-pick" role="group" aria-labelledby="pick-label">
              {cryptids.data?.items.map((c) => (
                <button key={c.id} type="button" className="cryptid-option" aria-pressed={form.cryptidId === c.id}
                  title={c.description} onClick={() => setForm((f) => ({ ...f, cryptidId: c.id }))}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="title">Título do caso</label>
            <input id="title" className="input" required minLength={3} maxLength={120} value={form.title} onChange={set('title')}
              placeholder="Vulto enorme atravessando a estrada" />
            {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
          </div>

          <div className="field">
            <label htmlFor="description">Relato</label>
            <textarea id="description" className="textarea" required minLength={10} maxLength={4000}
              value={form.description} onChange={set('description')}
              placeholder="Conte o que aconteceu: horário, tamanho, sons, cheiro, como reagiu…" />
            <span className="field-hint">{form.description.length}/4000</span>
            {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="city">Cidade</label>
              <input id="city" className="input" required maxLength={80} value={form.city} onChange={set('city')} placeholder="Rio do Sul" />
            </div>
            <div className="field">
              <label htmlFor="uf">Estado</label>
              <select id="uf" className="select" required value={form.uf} onChange={set('uf')}>
                <option value="">Selecione</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="seenAt">Data do avistamento</label>
              <input id="seenAt" type="date" className="input" required max={todayIso()} value={form.seenAt} onChange={set('seenAt')} />
              {fieldErrors.seenAt && <span className="field-error">{fieldErrors.seenAt}</span>}
            </div>
          </div>

          <div className="form-row" style={{ alignItems: 'end' }}>
            <div className="field">
              <label htmlFor="lat">Latitude (opcional)</label>
              <input id="lat" className="input mono" inputMode="decimal" value={form.latitude} onChange={set('latitude')} placeholder="-27.2142" />
            </div>
            <div className="field">
              <label htmlFor="lng">Longitude (opcional)</label>
              <input id="lng" className="input mono" inputMode="decimal" value={form.longitude} onChange={set('longitude')} placeholder="-49.6431" />
            </div>
            <button type="button" className="btn" onClick={locate}><LocateFixed size={16} /> Usar minha posição</button>
          </div>

          {error && <div className="alert" role="alert">{error}</div>}
          <div>
            <button className="btn btn-primary" disabled={sending}>
              {sending ? 'Enviando…' : <>Enviar relato <ArrowRight size={16} /></>}
            </button>
          </div>
        </form>
      )}

      {step === 2 && created && (
        <div className="briefing-card form-grid">
          <p style={{ margin: 0 }}>
            Relato registrado. Tem fotos? Elas passam por verificação automática (formato, tamanho e remoção
            de metadados) antes de ir para o moderador.
          </p>
          <PhotoUploader sightingId={created.id} />
          <div><button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Concluir <ArrowRight size={16} /></button></div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useClientStore } from '../store/clientStore';
import { automationApi } from '../api/automation';
import api from '../api/client';
import { toast } from '../components/ui/Toast';

// ── Icons ────────────────────────────────────────────────────────────────────

const IconComment = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const IconDM = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
);
const IconLink = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconBolt = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-color bg-surface">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
          <IconBolt />
        </div>
        <div>
          <p className="text-sm font-medium text-primary-color">{label}</p>
          {description && <p className="text-xs text-muted-color">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
          checked ? 'bg-blue-600' : 'bg-gray-200'
        )}
      >
        <span className={clsx(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
          checked && 'translate-x-5'
        )} />
      </button>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  return (
    <div className="flex gap-1 mb-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'h-1.5 flex-1 rounded-full transition-colors',
            i < current ? 'bg-blue-600' : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  );
}

// ── Wizard Modal ──────────────────────────────────────────────────────────────

const STEP_LABELS = ['TRIGGER', 'POST / ACCOUNT', 'MATCHING', 'AUTO-REPLY'];
const TOTAL_STEPS = 4;

function WizardModal({ clientId, accounts, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    trigger_type: '',
    social_account_id: '',
    media_id: '',
    media_url: '',
    media_thumbnail: '',
    keyword: '',
    match_any: false,
    reply_every: false,
    ignore_own: true,
    confirm_text: "Hey! Thanks for being part of my community 😊\n\nClick below and I'll send you the details in just a sec ✨",
    confirm_button: 'Send me the link!',
    link_text: 'Here is the link you requested! ✨',
    link_url: '',
  });
  const [reels, setReels] = useState([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const igAccounts = accounts.filter(a => a.platform === 'instagram');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const loadReels = async (accountId) => {
    setReelsLoading(true);
    try {
      const res = await automationApi.getReels(accountId);
      setReels(res.data.reels || []);
    } catch {
      toast.error('Could not load posts');
    } finally {
      setReelsLoading(false);
    }
  };

  const canNext = () => {
    if (step === 1) return !!form.trigger_type;
    if (step === 2) {
      if (!form.social_account_id) return false;
      if (form.trigger_type === 'comment') return !!form.media_id;
      return true;
    }
    if (step === 3) return form.match_any || !!form.keyword.trim();
    if (step === 4) return !!form.link_text.trim();
    return true;
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else handleSave();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await automationApi.createTrigger({ ...form, clientId });
      toast.success('Automation created!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create automation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-color flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-primary-color">Create Automation</h2>
              <p className="text-xs text-blue-600 font-semibold tracking-widest mt-0.5">{STEP_LABELS[step - 1]}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-tertiary text-muted-color transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <ProgressBar current={step} total={TOTAL_STEPS} />
          <p className="text-xs text-muted-color mt-1">Step {step} of {TOTAL_STEPS}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 1 — Trigger type */}
          {step === 1 && (
            <div>
              <h3 className="text-base font-semibold text-primary-color mb-4">Select a trigger</h3>
              <div className="space-y-3">
                {[
                  {
                    value: 'comment',
                    label: 'Comment on Post',
                    desc: 'Automatically DM anyone who comments a keyword on your post or reel.',
                    icon: <IconComment />,
                    badge: 'COMMENT TRIGGER',
                  },
                  {
                    value: 'dm',
                    label: 'Direct DM Automation',
                    desc: 'This rule will apply to anyone who sends you a DM directly, regardless of which post they saw.',
                    icon: <IconDM />,
                    badge: 'DM TRIGGER',
                  },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('trigger_type', opt.value)}
                    className={clsx(
                      'w-full text-left p-5 rounded-2xl border-2 transition-all',
                      form.trigger_type === opt.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-color bg-surface hover:border-blue-300'
                    )}
                  >
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className={clsx(
                        'w-14 h-14 rounded-2xl flex items-center justify-center',
                        form.trigger_type === opt.value ? 'bg-blue-600 text-white' : 'bg-surface-tertiary text-muted-color'
                      )}>
                        {opt.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-primary-color">{opt.label}</p>
                        <p className="text-xs text-muted-color mt-1">{opt.desc}</p>
                      </div>
                      <span className={clsx(
                        'text-xs font-bold px-3 py-1 rounded-full',
                        form.trigger_type === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-surface-tertiary text-muted-color'
                      )}>
                        {opt.badge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Account + Post picker */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-primary-color mb-3">Select Instagram account</h3>
                <div className="space-y-2">
                  {igAccounts.length === 0 && (
                    <p className="text-sm text-muted-color">No Instagram accounts connected for this client.</p>
                  )}
                  {igAccounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        set('social_account_id', String(acc.id));
                        if (form.trigger_type === 'comment') loadReels(acc.id);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        String(form.social_account_id) === String(acc.id)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-color hover:border-blue-300'
                      )}
                    >
                      {acc.profile_pic_url
                        ? <img src={acc.profile_pic_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                        : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">{acc.account_name?.[0]}</div>
                      }
                      <div className="text-left">
                        <p className="text-sm font-medium text-primary-color">{acc.account_name}</p>
                        <p className="text-xs text-muted-color">@{acc.username}</p>
                      </div>
                      {String(form.social_account_id) === String(acc.id) && (
                        <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {form.trigger_type === 'comment' && form.social_account_id && (
                <div>
                  <h3 className="text-base font-semibold text-primary-color mb-3">Select post / reel</h3>
                  {reelsLoading ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array(6).fill(0).map((_, i) => (
                        <div key={i} className="aspect-square rounded-xl bg-surface-tertiary animate-pulse" />
                      ))}
                    </div>
                  ) : reels.length === 0 ? (
                    <p className="text-sm text-muted-color">No posts found.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {reels.map(reel => {
                        const thumb = reel.thumbnail_url || reel.media_url;
                        const isVideo = reel.media_type === 'VIDEO' || reel.media_type === 'REELS';
                        return (
                          <button
                            key={reel.id}
                            type="button"
                            onClick={() => {
                              set('media_id', reel.id);
                              set('media_url', reel.permalink || '');
                              set('media_thumbnail', thumb || '');
                            }}
                            className={clsx(
                              'relative aspect-square rounded-xl overflow-hidden border-3 transition-all',
                              form.media_id === reel.id ? 'border-blue-600 ring-2 ring-blue-600' : 'border-transparent'
                            )}
                          >
                            {thumb
                              ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full bg-surface-tertiary flex items-center justify-center text-muted-color text-xs">No preview</div>
                            }
                            {isVideo && (
                              <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5">
                                <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                              </div>
                            )}
                            {form.media_id === reel.id && (
                              <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-4 h-4"><polyline points="20 6 9 17 4 12" /></svg>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Matching */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-primary-color">
                When someone {form.trigger_type === 'comment' ? 'comments' : 'DMs'} me…
              </h3>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => set('match_any', false)}
                  className={clsx(
                    'w-full text-left p-4 rounded-xl border-2 transition-all',
                    !form.match_any ? 'border-blue-600 bg-blue-50' : 'border-color hover:border-blue-300'
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={clsx('w-4 h-4 rounded-full border-2 flex items-center justify-center', !form.match_any ? 'border-blue-600' : 'border-gray-300')}>
                      {!form.match_any && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    <span className="text-sm font-medium text-primary-color">A specific word or words</span>
                  </div>
                  {!form.match_any && (
                    <div>
                      <input
                        type="text"
                        placeholder="Enter a word or multiple..."
                        value={form.keyword}
                        onChange={e => set('keyword', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full px-3 py-2 rounded-lg border border-color bg-surface text-sm text-primary-color placeholder-muted-color focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-xs text-muted-color mt-1.5 uppercase tracking-wider">Use commas to separate words</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['Price', 'Link', 'Shop', 'Info'].map(w => (
                          <button
                            key={w}
                            type="button"
                            onClick={e => { e.stopPropagation(); set('keyword', form.keyword ? `${form.keyword}, ${w}` : w); }}
                            className="text-xs px-3 py-1 rounded-full border border-color text-muted-color hover:border-blue-400 hover:text-blue-600 transition-colors"
                          >
                            + {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => set('match_any', true)}
                  className={clsx(
                    'w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3',
                    form.match_any ? 'border-blue-600 bg-blue-50' : 'border-color hover:border-blue-300'
                  )}
                >
                  <div className={clsx('w-4 h-4 rounded-full border-2 flex items-center justify-center', form.match_any ? 'border-blue-600' : 'border-gray-300')}>
                    {form.match_any && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                  <span className="text-sm font-medium text-primary-color">Any word</span>
                </button>
              </div>

              <div className="space-y-2 pt-2">
                <Toggle
                  checked={form.reply_every}
                  onChange={v => set('reply_every', v)}
                  label="Reply to every message"
                  description="Respond even if they keep messaging"
                />
                <Toggle
                  checked={form.ignore_own}
                  onChange={v => set('ignore_own', v)}
                  label="Ignore my own replies"
                  description="Prevents self-automation in DMs"
                />
              </div>
            </div>
          )}

          {/* Step 4 — Messages + Link */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-primary-color mb-1">They will get…</h3>
                <p className="text-xs text-muted-color mb-3">First message sent when they trigger the automation</p>
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconBolt />
                    <span className="text-sm font-semibold text-blue-700">DM Message</span>
                    <div className="ml-auto w-8 h-4 rounded-full bg-blue-600 flex items-center justify-end px-0.5">
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={form.confirm_text}
                    onChange={e => set('confirm_text', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm text-primary-color focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Hey! Thanks for your interest..."
                  />
                  <div className="mt-2">
                    <p className="text-xs text-muted-color uppercase tracking-wider mb-1.5">Button Text</p>
                    <input
                      type="text"
                      value={form.confirm_button}
                      onChange={e => set('confirm_button', e.target.value.slice(0, 20))}
                      className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm text-primary-color focus:outline-none focus:border-blue-500"
                      placeholder="Send me the link! ✨"
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-color mt-1">{form.confirm_button.length}/20 characters</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-primary-color mb-1">And then, they will get…</h3>
                <p className="text-xs text-muted-color mb-3">Final reward sent after they tap the button</p>
                <div className="rounded-xl border-2 border-color p-4 space-y-3">
                  <div className="flex items-center gap-2 text-muted-color mb-1">
                    <IconLink />
                    <span className="text-xs font-semibold uppercase tracking-wider">Final Reward (The Link)</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-color uppercase tracking-wider mb-1.5">Final Message</p>
                    <textarea
                      rows={2}
                      value={form.link_text}
                      onChange={e => set('link_text', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-color bg-surface text-sm text-primary-color focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Here is the link you requested! ✨"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-color uppercase tracking-wider mb-1.5">Destination URL</p>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-color bg-surface">
                      <IconLink />
                      <input
                        type="url"
                        value={form.link_url}
                        onChange={e => set('link_url', e.target.value)}
                        className="flex-1 bg-transparent text-sm text-primary-color focus:outline-none placeholder-muted-color"
                        placeholder="https://yourwebsite.com/guide"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-color flex gap-3 flex-shrink-0">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-color text-sm font-medium text-secondary-color hover:bg-surface-tertiary transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext() || saving}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
              canNext() && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {saving ? 'Launching…' : step === TOTAL_STEPS ? 'Launch Automation' : 'Next'}
            {!saving && step < TOTAL_STEPS && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="9 18 15 12 9 6" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trigger Card ──────────────────────────────────────────────────────────────

function TriggerCard({ trigger, onDelete, onToggle }) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this automation?')) return;
    setDeleting(true);
    try {
      await automationApi.deleteTrigger(trigger.id);
      onDelete(trigger.id);
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await automationApi.toggleTrigger(trigger.id);
      onToggle(trigger.id, res.data.is_active);
    } catch {
      toast.error('Failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const isComment = trigger.trigger_type === 'comment';

  return (
    <div className={clsx(
      'bg-surface border border-color rounded-2xl p-4 transition-all',
      !trigger.is_active && 'opacity-60'
    )}>
      <div className="flex items-start gap-3">
        {trigger.media_thumbnail ? (
          <img src={trigger.media_thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            isComment ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
          )}>
            {isComment ? <IconComment /> : <IconDM />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={clsx(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              isComment ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            )}>
              {isComment ? 'COMMENT' : 'DM'}
            </span>
            <span className={clsx(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              trigger.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            )}>
              {trigger.is_active ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>

          <p className="text-sm font-semibold text-primary-color truncate">
            {trigger.match_any ? 'Any word' : `"${trigger.keyword}"`}
          </p>

          <p className="text-xs text-muted-color truncate mt-0.5">
            {trigger.account_name} · {trigger.link_url || trigger.link_text?.slice(0, 40)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={trigger.is_active ? 'Pause' : 'Activate'}
            className={clsx(
              'relative w-10 h-5 rounded-full transition-colors',
              trigger.is_active ? 'bg-brand-green' : 'bg-gray-200'
            )}
          >
            <span className={clsx(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
              trigger.is_active && 'translate-x-5'
            )} />
          </button>
          <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-lg text-muted-color hover:text-red-600 hover:bg-red-50 transition-colors">
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Automation() {
  const { activeClientId: clientId } = useClientStore();
  const [triggers, setTriggers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [tRes, aRes] = await Promise.all([
        automationApi.getTriggers(clientId),
        api.get(`/clients/${clientId}`),
      ]);
      setTriggers(tRes.data.triggers || []);
      setAccounts(aRes.data.accounts || []);
    } catch {
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleDelete = (id) => setTriggers(t => t.filter(x => x.id !== id));
  const handleToggle = (id, is_active) => setTriggers(t => t.map(x => x.id === id ? { ...x, is_active } : x));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-primary-color">Automation</h1>
            <p className="text-sm text-muted-color mt-0.5">Auto-reply to comments & DMs with keywords</p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <IconPlus />
            Create Automation
          </button>
        </div>

        {/* Webhook info banner */}
        <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-1">Setup Required</p>
          <p className="text-xs text-amber-700">
            Register this webhook URL in your Meta App Dashboard:
          </p>
          <code className="text-xs bg-white rounded px-2 py-1 mt-1 block text-amber-900 font-mono break-all">
            https://posting.officialaiagent.in/api/automation/webhook
          </code>
          <p className="text-xs text-amber-700 mt-1">Verify token: <strong>odm-webhook-2026</strong> — Subscribe to: <strong>comments, messages</strong></p>
        </div>

        {/* Trigger list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-surface-tertiary animate-pulse" />)}
          </div>
        ) : triggers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-500">
              <IconBolt />
            </div>
            <h3 className="text-base font-semibold text-primary-color mb-1">No automations yet</h3>
            <p className="text-sm text-muted-color mb-4">Create your first automation to auto-reply to comments and DMs.</p>
            <button
              onClick={() => setShowWizard(true)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Create First Automation
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {triggers.map(t => (
              <TriggerCard key={t.id} trigger={t} onDelete={handleDelete} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>

      {showWizard && (
        <WizardModal
          clientId={clientId}
          accounts={accounts}
          onClose={() => setShowWizard(false)}
          onSave={() => { setShowWizard(false); load(); }}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ApiError, apiRequest } from '../services/api';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function SubscriptionPage({ token, user }) {
  const [subscription, setSubscription] = useState(null);
  const [active, setActive] = useState(false);
  const [planType, setPlanType] = useState('free');
  const [loading, setLoading] = useState(true);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  async function loadSubscriptionState() {
    setLoading(true);
    setNotice({ type: '', text: '' });

    try {
      const activeResult = await apiRequest('/subscriptions/my/active', { token });
      setActive(Boolean(activeResult?.active));

      try {
        const details = await apiRequest('/subscriptions/my', { token });
        setSubscription(details);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setSubscription(null);
        } else {
          throw error;
        }
      }
    } catch (error) {
      setNotice({ type: 'error', text: `Failed to load subscription data: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscriptionState();
  }, []);

  async function handleSubscribe(event) {
    event.preventDefault();
    setSubmitBusy(true);
    setNotice({ type: '', text: '' });

    try {
      await apiRequest('/subscriptions/subscribe', {
        method: 'POST',
        token,
        body: {
          plan_type: planType
        }
      });

      setNotice({ type: 'success', text: 'Subscription activated successfully.' });
      await loadSubscriptionState();
    } catch (error) {
      setNotice({ type: 'error', text: `Subscription failed: ${error.message}` });
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <div className="stack fade">
      <div className="hero-strip">
        <h2>Subscription</h2>
        <p>Manage your host subscription and check current activation status.</p>
      </div>

      {notice.text ? <div className={`notice ${notice.type || 'info'}`}>{notice.text}</div> : null}

      <section className="card stack">
        <div className="card-title-row">
          <h3 className="section-title">Current Status</h3>
          <span className={`pill ${active ? 'ok' : 'warn'}`}>{active ? 'Active' : 'Inactive'}</span>
        </div>

        {loading ? (
          <div className="notice info">Loading subscription details...</div>
        ) : subscription ? (
          <div className="stack" style={{ gap: '0.4rem' }}>
            <p><strong>Plan:</strong> {subscription.plan_type}</p>
            <p><strong>User ID:</strong> {subscription.user_id}</p>
            <p><strong>Expiry:</strong> {formatDate(subscription.expiry_date)}</p>
            <p><strong>Created:</strong> {formatDate(subscription.created_at)}</p>
          </div>
        ) : (
          <div className="notice info">No subscription found for your account yet.</div>
        )}
      </section>

      <section className="card stack">
        <h3 className="section-title">Activate / Renew</h3>
        <p className="section-subtitle">
          Subscriptions are currently mocked and used for host entitlement checks.
        </p>

        <form className="stack" onSubmit={handleSubscribe}>
          <div className="field">
            <label htmlFor="plan_type">Plan Type</label>
            <select id="plan_type" value={planType} onChange={(event) => setPlanType(event.target.value)}>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={submitBusy || loading}>
              {submitBusy ? 'Submitting...' : 'Subscribe'}
            </button>
            <button className="btn btn-muted" type="button" onClick={loadSubscriptionState} disabled={loading}>
              Refresh Status
            </button>
          </div>
        </form>

        {user?.role !== 'host' ? (
          <div className="notice info">
            You are currently a {user?.role} account. Host-only dashboard sections stay hidden unless your auth role is host.
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default SubscriptionPage;

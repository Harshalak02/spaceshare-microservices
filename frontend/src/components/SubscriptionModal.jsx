import { useState } from 'react';
import { apiRequest } from '../services/api';

const PLANS = [
  {
    name: 'Free',
    type: 'free',
    price: 0,
    listings: 2,
    features: ['2 active listings', 'Basic support']
  },
  {
    name: 'Basic',
    type: 'basic',
    price: 4.99,
    listings: 5,
    features: ['5 active listings', 'Priority support', 'Analytics dashboard']
  },
  {
    name: 'Pro',
    type: 'pro',
    price: 14.99,
    listings: 10,
    features: ['10 active listings', '24/7 priority support', 'Advanced analytics', 'Marketing tools']
  }
];

function SubscriptionModal({ isOpen, onClose, onSubscribe, token, userId }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubscribe() {
    if (!selectedPlan) {
      setError('Please select a plan');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiRequest('/subscriptions/subscribe', {
        method: 'POST',
        token,
        body: {
          user_id: userId,
          plan_type: selectedPlan
        }
      });

      if (onSubscribe) {
        onSubscribe(selectedPlan);
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to subscribe');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="subscription-modal fade" role="dialog" aria-modal="true" aria-label="Choose subscription plan">
        <h2 className="subscription-modal-title">Choose a Plan</h2>
        <p className="subscription-modal-subtitle">Select a subscription plan to start listing your spaces.</p>

        {error ? <div className="notice error">{error}</div> : null}

        <div className="subscription-plan-grid">
          {PLANS.map((plan) => (
            <div
              key={plan.type}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedPlan(plan.type)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedPlan(plan.type);
                }
              }}
              className={`subscription-plan-card ${selectedPlan === plan.type ? 'selected' : ''}`}
            >
              <div className="subscription-plan-head">
                <h3>{plan.name}</h3>
                <input
                  type="radio"
                  checked={selectedPlan === plan.type}
                  onChange={() => setSelectedPlan(plan.type)}
                />
              </div>

              <div className="subscription-plan-price-row">
                <div className="subscription-plan-price">${plan.price === 0 ? 'Free' : plan.price.toFixed(2)}</div>
                {plan.price > 0 ? <div className="subscription-plan-period">/month</div> : null}
              </div>

              <div className="subscription-plan-limit">{plan.listings} listings</div>

              <ul className="subscription-plan-features">
                {plan.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="btn-row subscription-modal-actions">
          <button className="btn btn-muted" type="button" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={handleSubscribe} disabled={loading || !selectedPlan}>
            {loading ? 'Subscribing...' : 'Subscribe'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionModal;

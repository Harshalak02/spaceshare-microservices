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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 8,
        padding: 32,
        maxWidth: 900,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Choose a Plan</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>Select a subscription plan to start listing your spaces</p>

        {error && <div style={{ color: '#d32f2f', marginBottom: 16, padding: 8, background: '#ffebee', borderRadius: 4 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
          {PLANS.map(plan => (
            <div
              key={plan.type}
              onClick={() => setSelectedPlan(plan.type)}
              style={{
                border: selectedPlan === plan.type ? '2px solid #1976d2' : '1px solid #e0e0e0',
                borderRadius: 8,
                padding: 20,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: selectedPlan === plan.type ? '#f5f5f5' : '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>{plan.name}</h3>
                <input
                  type="radio"
                  checked={selectedPlan === plan.type}
                  onChange={() => setSelectedPlan(plan.type)}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1976d2' }}>
                  ${plan.price === 0 ? 'Free' : plan.price.toFixed(2)}
                </div>
                {plan.price > 0 && <div style={{ fontSize: 12, color: '#999' }}>/month</div>}
              </div>

              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333' }}>{plan.listings} listings</div>
              </div>

              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{ marginBottom: 8, color: '#666' }}>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: '1px solid #ccc',
              background: '#fff',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubscribe}
            disabled={loading || !selectedPlan}
            style={{
              padding: '10px 20px',
              background: selectedPlan ? '#1976d2' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: loading || !selectedPlan ? 'not-allowed' : 'pointer',
              opacity: loading || !selectedPlan ? 0.6 : 1
            }}
          >
            {loading ? 'Subscribing...' : 'Subscribe'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionModal;

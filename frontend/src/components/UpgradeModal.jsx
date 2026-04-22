function UpgradeModal({ isOpen, onClose, onUpgrade, currentPlan }) {
  if (!isOpen) return null;

  const getPlanUpgrade = () => {
    if (currentPlan === 'free') return 'basic';
    if (currentPlan === 'basic') return 'pro';
    return 'pro';
  };

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
        maxWidth: 500,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        textAlign: 'center'
      }}>
        <h2 style={{ marginTop: 0, color: '#d32f2f' }}>Listing Limit Reached</h2>
        <p style={{ color: '#666', fontSize: 16, marginBottom: 24 }}>
          You've reached your listing limit on the <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan.
        </p>

        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, marginBottom: 24 }}>
          <p style={{ margin: 0, color: '#333', fontSize: 14 }}>
            Upgrade to unlock more listings and premium features!
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #ccc',
              background: '#fff',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onUpgrade}
            style={{
              padding: '10px 20px',
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;

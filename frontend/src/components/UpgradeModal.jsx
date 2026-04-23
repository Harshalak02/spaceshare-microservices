function UpgradeModal({ isOpen, onClose, onUpgrade, currentPlan }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="upgrade-modal fade" role="dialog" aria-modal="true" aria-label="Upgrade subscription plan">
        <h2 className="upgrade-modal-title">Listing Limit Reached</h2>
        <p className="upgrade-modal-text">
          You've reached your listing limit on the <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan.
        </p>

        <div className="upgrade-modal-note">
          <p>
            Upgrade to unlock more listings and premium features!
          </p>
        </div>

        <div className="btn-row upgrade-modal-actions">
          <button className="btn btn-muted" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={onUpgrade}>Upgrade Plan</button>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;

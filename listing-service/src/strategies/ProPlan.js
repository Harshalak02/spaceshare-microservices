// strategies/ProPlan.js
const PlanStrategy = require('./PlanStrategy');

class ProPlan extends PlanStrategy {
    getListingLimit() {
        return 10;
    }

    getCommission() {
        return 5;
    }
}

module.exports = ProPlan;
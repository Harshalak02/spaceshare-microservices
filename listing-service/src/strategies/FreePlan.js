// strategies/FreePlan.js
const PlanStrategy = require('./PlanStrategy');

class FreePlan extends PlanStrategy {
    getListingLimit() {
        return 2;
    }

    getCommission() {
        return 30;
    }
}

module.exports = FreePlan;
// strategies/BasicPlan.js
const PlanStrategy = require('./PlanStrategy');

class BasicPlan extends PlanStrategy {
    getListingLimit() {
        return 5;
    }

    getCommission() {
        return 15;
    }
}

module.exports = BasicPlan;
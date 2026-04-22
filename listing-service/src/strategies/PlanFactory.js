// strategies/PlanFactory.js
const FreePlan = require('./FreePlan');
const BasicPlan = require('./BasicPlan');
const ProPlan = require('./ProPlan');

function getPlan(planName) {
    switch (planName) {
        case 'basic':
            return new BasicPlan();
        case 'pro':
            return new ProPlan();
        default:
            return new FreePlan();
    }
}

module.exports = { getPlan };
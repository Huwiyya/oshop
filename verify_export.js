
const actions = require('./src/lib/fixed-assets-actions-v2.ts');
console.log('Exports:', Object.keys(actions));
if (actions.calculateMonthlyDepreciationV2) {
    console.log('calculateMonthlyDepreciationV2 found');
} else {
    console.error('calculateMonthlyDepreciationV2 NOT found');
    process.exit(1);
}

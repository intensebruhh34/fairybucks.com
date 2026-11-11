export const stages = ['workshop', 'packaging', 'flying', 'arriving', 'landed'];
export const deliveryLabels = {workshop:'🛠️ In the fairy workshop',packaging:'🎁 Being packaged',flying:'🧚 In the air',arriving:'✨ Arriving soon',landed:'🏡 Package landed',refunded:'🪙 Fairy Bucks returned'};
export function deliveryText(request) {
 const stage = request.delivery_stage || (request.status === 'approved' ? 'workshop' : request.status === 'fulfilled' ? 'landed' : null);
 return deliveryLabels[stage] || '';
}

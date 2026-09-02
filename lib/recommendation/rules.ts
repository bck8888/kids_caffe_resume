export type RecommendableFacility={id:string;name:string;equipmentTags?:string[]};
export type FacilityRecommendation={facilityId:string;score:number;reasons:string[];algorithmVersion:"rules-v1"};

export function recommendFacilities(facilities:RecommendableFacility[],preferredEquipment:string[],favoriteIds:string[],limit=3):FacilityRecommendation[]{
  const preferred=new Set(preferredEquipment);
  if(!preferred.size) return [];
  return facilities.map(facility=>{
    const matches=(facility.equipmentTags??[]).filter(tag=>preferred.has(tag));
    const favoriteBonus=favoriteIds.includes(facility.id)?0.15:0;
    const score=Math.min(1,matches.length/preferred.size+favoriteBonus);
    const reasons=[...matches.map(tag=>`선호 기구 '${tag}' 포함`),...(favoriteBonus?["자주 가는 시설"]:[])];
    return {facilityId:facility.id,score,reasons,algorithmVersion:"rules-v1" as const};
  }).filter(result=>result.reasons.some(reason=>reason.startsWith("선호 기구"))).sort((a,b)=>b.score-a.score||a.facilityId.localeCompare(b.facilityId)).slice(0,limit);
}

export const alphaFacilities = [
  { id:"SCALPHA01",name:"알파 테스트 키즈카페 A",district:"테스트구",address:"서울 알파로 1",latitude:"37.5665",longitude:"126.9780",age:"3–7세",phone:"",operatingDays:"화–일",closedDays:"월",equipmentTags:["클라이밍","블록"] },
  { id:"SCALPHA02",name:"알파 테스트 키즈카페 B",district:"테스트구",address:"서울 알파로 2",latitude:"37.5710",longitude:"126.9820",age:"2–6세",phone:"",operatingDays:"화–일",closedDays:"월",equipmentTags:["트램펄린","볼풀"] },
  { id:"SCALPHA03",name:"알파 테스트 키즈카페 C",district:"샘플구",address:"서울 샘플로 3",latitude:"37.5610",longitude:"126.9900",age:"4–8세",phone:"",operatingDays:"수–일",closedDays:"월·화",equipmentTags:["클라이밍","트램펄린"] },
  { id:"SCALPHA04",name:"알파 테스트 키즈카페 D",district:"샘플구",address:"서울 샘플로 4",latitude:"37.5580",longitude:"126.9850",age:"2–5세",phone:"",operatingDays:"화–토",closedDays:"일·월",equipmentTags:["볼풀","블록"] }
];

export function alphaSlots(facilityId:string,date:string){
  return [
    {id:`${facilityId}-1`,type:"개인",startTime:"10:00",endTime:"12:00",capacity:12,reserved:4,remaining:8,waitingCapacity:2,waiting:0,cancellationDeadline:`${date} 09:00`,careAvailable:false,careCapacity:0,careReserved:0,program:""},
    {id:`${facilityId}-2`,type:"개인",startTime:"13:00",endTime:"15:00",capacity:12,reserved:10,remaining:2,waitingCapacity:2,waiting:0,cancellationDeadline:`${date} 12:00`,careAvailable:false,careCapacity:0,careReserved:0,program:""},
    {id:`${facilityId}-3`,type:"개인",startTime:"15:30",endTime:"17:30",capacity:12,reserved:12,remaining:0,waitingCapacity:2,waiting:1,cancellationDeadline:`${date} 14:30`,careAvailable:false,careCapacity:0,careReserved:0,program:""},
    {id:`${facilityId}-4`,type:"개인",startTime:"18:00",endTime:"19:30",capacity:12,reserved:5,remaining:7,waitingCapacity:2,waiting:0,cancellationDeadline:`${date} 17:00`,careAvailable:false,careCapacity:0,careReserved:0,program:""}
  ];
}

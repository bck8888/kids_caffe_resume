"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type MapFacility = { id: string; name: string; latitude: string; longitude: string };
type Props = { facilities: MapFacility[]; selectedId: string; onSelect: (id: string) => void };

export default function KakaoMap({ facilities, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  useEffect(() => {
    if (!ready || !containerRef.current || !window.kakao?.maps) return;
    window.kakao.maps.load(() => {
      const valid = facilities.filter((facility) => Number(facility.latitude) && Number(facility.longitude));
      const selected = valid.find((facility) => facility.id === selectedId) ?? valid[0];
      const center = selected ? new window.kakao.maps.LatLng(Number(selected.latitude), Number(selected.longitude)) : new window.kakao.maps.LatLng(37.5665, 126.978);
      const map = new window.kakao.maps.Map(containerRef.current, { center, level: 8 });
      valid.forEach((facility) => {
        const marker = new window.kakao.maps.Marker({ map, position: new window.kakao.maps.LatLng(Number(facility.latitude), Number(facility.longitude)), title: facility.name });
        window.kakao.maps.event.addListener(marker, "click", () => onSelect(facility.id));
      });
    });
  }, [facilities, onSelect, ready, selectedId]);
  if (!key) return <p className="message error">카카오 JavaScript 키가 설정되지 않았습니다.</p>;
  return <><Script src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`} strategy="afterInteractive" onLoad={() => setReady(true)} /><div ref={containerRef} className="map" role="img" aria-label="서울형 키즈카페 위치 지도" /></>;
}

declare global { interface Window { kakao?: any } }

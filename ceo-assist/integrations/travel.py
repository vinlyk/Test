"""
Travel planning via Amadeus API.

Covers:
  - Flight search (cheapest dates, specific routes)
  - Hotel search by city / location
  - Airport lookup

Free Amadeus test credentials available at: https://developers.amadeus.com
Switch AMADEUS_BASE_URL to https://api.amadeus.com for production.
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from config.settings import settings
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


class TravelClient:

    def __init__(self) -> None:
        self._api_key = settings.amadeus_api_key
        self._api_secret = settings.amadeus_api_secret
        self._base = settings.amadeus_base_url
        self._access_token: Optional[str] = None

    def _available(self) -> bool:
        return bool(self._api_key and self._api_secret)

    async def _get_token(self) -> Optional[str]:
        if self._access_token:
            return self._access_token
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"{self._base}/v1/security/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._api_key,
                    "client_secret": self._api_secret,
                },
            )
        if resp.status_code != 200:
            return None
        self._access_token = resp.json().get("access_token")
        return self._access_token

    async def _get(self, path: str, params: dict = None) -> Any:
        if not self._available():
            return {
                "error": (
                    "Amadeus travel API not configured. Add AMADEUS_API_KEY and "
                    "AMADEUS_API_SECRET to .env to enable flight/hotel search."
                )
            }
        token = await self._get_token()
        if not token:
            return {"error": "Amadeus authentication failed. Check API credentials."}
        audit_logger.log_api_call("amadeus", path)
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{self._base}{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params or {},
                timeout=20,
            )
        if resp.status_code != 200:
            return {"error": resp.text}
        return resp.json()

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: Optional[str] = None,
        adults: int = 1,
        travel_class: str = "BUSINESS",
        max_results: int = 5,
    ) -> List[dict]:
        """
        Search for flights.
        origin/destination: IATA airport codes (e.g., SIN, LHR, JFK)
        departure_date: YYYY-MM-DD
        travel_class: ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST
        """
        params = {
            "originLocationCode": origin.upper(),
            "destinationLocationCode": destination.upper(),
            "departureDate": departure_date,
            "adults": adults,
            "travelClass": travel_class,
            "max": max_results,
            "currencyCode": "USD",
        }
        if return_date:
            params["returnDate"] = return_date
        data = await self._get("/v2/shopping/flight-offers", params)
        if "error" in data:
            return [data]
        offers = data.get("data", [])
        results = []
        for offer in offers[:max_results]:
            price = offer.get("price", {})
            itineraries = offer.get("itineraries", [])
            result = {
                "total_price_usd": price.get("total"),
                "currency": price.get("currency", "USD"),
                "itineraries": [],
            }
            for itin in itineraries:
                segments = itin.get("segments", [])
                legs = []
                for seg in segments:
                    legs.append({
                        "departure": f"{seg.get('departure', {}).get('iataCode')} {seg.get('departure', {}).get('at', '')}",
                        "arrival": f"{seg.get('arrival', {}).get('iataCode')} {seg.get('arrival', {}).get('at', '')}",
                        "carrier": seg.get("carrierCode"),
                        "flight_number": seg.get("number"),
                        "duration": seg.get("duration"),
                    })
                result["itineraries"].append({
                    "duration": itin.get("duration"),
                    "stops": len(segments) - 1,
                    "legs": legs,
                })
            results.append(result)
        return results

    async def search_hotels(
        self,
        city_code: str,
        check_in: str,
        check_out: str,
        adults: int = 1,
        max_results: int = 5,
    ) -> List[dict]:
        """
        Search hotels in a city.
        city_code: IATA city code (e.g., SIN, LON, NYC)
        dates: YYYY-MM-DD
        """
        # Step 1: Get hotel IDs for the city
        hotels_data = await self._get(
            "/v1/reference-data/locations/hotels/by-city",
            {"cityCode": city_code.upper(), "radius": 5, "radiusUnit": "KM", "ratings": "4,5"},
        )
        if "error" in hotels_data:
            return [hotels_data]

        hotel_ids = [h["hotelId"] for h in hotels_data.get("data", [])[:20]]
        if not hotel_ids:
            return [{"error": f"No hotels found in {city_code}"}]

        # Step 2: Get offers for those hotels
        offers_data = await self._get(
            "/v3/shopping/hotel-offers",
            {
                "hotelIds": ",".join(hotel_ids[:10]),
                "checkInDate": check_in,
                "checkOutDate": check_out,
                "adults": adults,
                "currency": "USD",
                "bestRateOnly": True,
            },
        )
        if "error" in offers_data:
            return [offers_data]

        results = []
        for hotel in offers_data.get("data", [])[:max_results]:
            h = hotel.get("hotel", {})
            offers = hotel.get("offers", [{}])
            best = offers[0] if offers else {}
            results.append({
                "name": h.get("name"),
                "rating": h.get("rating"),
                "address": h.get("address", {}).get("lines", []),
                "price_per_night_usd": best.get("price", {}).get("total"),
                "room_type": best.get("room", {}).get("typeEstimated", {}).get("category"),
                "check_in": best.get("checkInDate"),
                "check_out": best.get("checkOutDate"),
            })
        return results

    async def get_airport_info(self, keyword: str) -> List[dict]:
        """Look up airport codes by city/airport name."""
        data = await self._get(
            "/v1/reference-data/locations",
            {"keyword": keyword, "subType": "AIRPORT", "page[limit]": 5},
        )
        if "error" in data:
            return [data]
        return [
            {
                "iata": loc.get("iataCode"),
                "name": loc.get("name"),
                "city": loc.get("address", {}).get("cityName"),
                "country": loc.get("address", {}).get("countryName"),
            }
            for loc in data.get("data", [])
        ]


travel_client = TravelClient()

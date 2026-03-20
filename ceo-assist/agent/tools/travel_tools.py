"""Travel tool implementations."""
import logging
from typing import List, Optional

from integrations.travel import travel_client
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: Optional[str] = None,
    travel_class: str = "BUSINESS",
    adults: int = 1,
) -> str:
    audit_logger.log_tool_call("search_flights", {"origin": origin, "destination": destination})
    # Resolve city names to IATA codes if needed
    origin_code = await _resolve_iata(origin)
    dest_code = await _resolve_iata(destination)
    try:
        offers = await travel_client.search_flights(
            origin=origin_code,
            destination=dest_code,
            departure_date=departure_date,
            return_date=return_date,
            adults=adults,
            travel_class=travel_class,
        )
        if not offers:
            return f"No flights found from {origin} to {destination} on {departure_date}."
        if "error" in offers[0]:
            return offers[0]["error"]
        lines = [f"**Flight options: {origin} → {destination} on {departure_date}**\n"]
        lines.append(f"Class: {travel_class}  |  Passengers: {adults}\n")
        for i, offer in enumerate(offers, 1):
            lines.append(f"**Option {i}:** USD {offer.get('total_price_usd')}")
            for j, itin in enumerate(offer.get("itineraries", [])):
                direction = "Outbound" if j == 0 else "Return"
                stops = itin.get("stops", 0)
                stop_label = "direct" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"
                lines.append(f"  {direction}: {itin.get('duration', '')} ({stop_label})")
                for leg in itin.get("legs", []):
                    lines.append(f"    {leg.get('departure')} → {leg.get('arrival')}")
                    lines.append(f"    Flight: {leg.get('carrier')}{leg.get('flight_number')}  Duration: {leg.get('duration', '')}")
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error searching flights: {exc}"


async def search_hotels(city: str, check_in: str, check_out: str, adults: int = 1) -> str:
    audit_logger.log_tool_call("search_hotels", {"city": city})
    city_code = await _resolve_iata(city)
    try:
        hotels = await travel_client.search_hotels(
            city_code=city_code,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
        )
        if not hotels:
            return f"No hotels found in {city} for those dates."
        if "error" in hotels[0]:
            return hotels[0]["error"]
        lines = [f"**Hotels in {city}: {check_in} to {check_out}**\n"]
        for h in hotels:
            name = h.get("name", "Unknown hotel")
            rating = "⭐" * int(h.get("rating", 0) or 0)
            price = h.get("price_per_night_usd")
            room = h.get("room_type", "")
            address = ", ".join(h.get("address", []))
            lines.append(f"**{name}** {rating}")
            if price:
                lines.append(f"  Price: USD {price} total")
            if room:
                lines.append(f"  Room: {room}")
            if address:
                lines.append(f"  Address: {address}")
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error searching hotels: {exc}"


async def get_airport_code(location: str) -> str:
    audit_logger.log_tool_call("get_airport_code", {"location": location})
    try:
        airports = await travel_client.get_airport_info(location)
        if not airports:
            return f"No airport found for '{location}'."
        if "error" in airports[0]:
            return airports[0]["error"]
        lines = [f"**Airports matching '{location}':**\n"]
        for a in airports:
            lines.append(f"• **{a.get('iata')}** — {a.get('name')}, {a.get('city')}, {a.get('country')}")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error looking up airport: {exc}"


async def _resolve_iata(location: str) -> str:
    """If location looks like a 3-letter IATA code, return it as-is. Otherwise look it up."""
    if len(location) == 3 and location.isalpha():
        return location.upper()
    # Try to resolve
    airports = await travel_client.get_airport_info(location)
    if airports and isinstance(airports, list) and airports[0].get("iata"):
        return airports[0]["iata"]
    return location[:3].upper()

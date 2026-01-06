"""
Quendoo API HTTP client wrapper
"""
import httpx
from typing import Dict, Any, Optional


class QuendooAPIClient:
    """
    HTTP client for Quendoo PMS API

    Handles authentication and request formatting for all Quendoo API endpoints
    """

    BASE_URL = "https://www.platform.quendoo.com/api/pms/v1"

    def __init__(self, api_key: str):
        """
        Initialize Quendoo API client

        Args:
            api_key: Quendoo API key for authentication
        """
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json"
        }

    async def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request to Quendoo API

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (e.g., "/Property/getPropertySettings")
            params: Query parameters
            json_data: JSON request body

        Returns:
            API response as dictionary

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        url = f"{self.BASE_URL}{endpoint}"

        # Add API key to params (Quendoo uses query parameter authentication)
        if params is None:
            params = {}
        params["api_key"] = self.api_key

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=self.headers,
                params=params,
                json=json_data
            )

            response.raise_for_status()
            return response.json()

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """GET request to Quendoo API"""
        return await self.request("GET", endpoint, params=params)

    async def post(self, endpoint: str, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST request to Quendoo API"""
        return await self.request("POST", endpoint, json_data=json_data)

    async def put(self, endpoint: str, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """PUT request to Quendoo API"""
        return await self.request("PUT", endpoint, json_data=json_data)

    async def delete(self, endpoint: str) -> Dict[str, Any]:
        """DELETE request to Quendoo API"""
        return await self.request("DELETE", endpoint)

    # Convenience methods for common Quendoo API endpoints

    async def get_property_settings(self, api_lng: Optional[str] = None, names: Optional[str] = None) -> Dict[str, Any]:
        """Get property settings"""
        params = {}
        if api_lng:
            params["api_lng"] = api_lng
        if names:
            params["names"] = names
        return await self.get("/Property/getPropertySettings", params=params)

    async def get_rooms_details(self, api_lng: Optional[str] = None, room_id: Optional[int] = None) -> Dict[str, Any]:
        """Get detailed room information"""
        params = {}
        if api_lng:
            params["api_lng"] = api_lng
        if room_id:
            params["room_id"] = room_id
        return await self.get("/Property/getRoomsDetails", params=params)

    async def get_availability(self, date_from: str, date_to: str, sysres: str) -> Dict[str, Any]:
        """Get availability for date range"""
        params = {
            "date_from": date_from,
            "date_to": date_to,
            "sysres": sysres
        }
        return await self.get("/Availability/getAvailability", params=params)

    async def update_availability(self, values: list) -> Dict[str, Any]:
        """Update availability values"""
        return await self.post("/Availability/updateAvailability", json_data={"values": values})

    async def get_bookings(self) -> Dict[str, Any]:
        """List all bookings"""
        return await self.get("/Booking/getBookings")

    async def get_booking_offers(
        self,
        date_from: str,
        nights: int,
        bm_code: Optional[str] = None,
        api_lng: Optional[str] = None,
        guests: Optional[list] = None,
        currency: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get booking offers"""
        # Auto-detect booking module if not provided
        if not bm_code:
            settings = await self.get_property_settings(names="booking_modules")
            booking_modules = settings.get("data", {}).get("booking_modules", [])
            active_modules = [m for m in booking_modules if m.get("is_active")]
            if not active_modules:
                return {"error": "No active booking modules found. Please configure booking modules in Quendoo."}
            bm_code = active_modules[0]["code"]

        params = {
            "bm_code": bm_code,
            "date_from": date_from,
            "nights": nights
        }

        if api_lng:
            params["api_lng"] = api_lng
        if currency:
            params["currency"] = currency

        # Format guests as query params: guests[0][adults]=2&guests[0][children_by_ages][0]=5
        if guests:
            for room_idx, guest_room in enumerate(guests):
                if "adults" in guest_room:
                    params[f"guests[{room_idx}][adults]"] = guest_room["adults"]
                if "children_by_ages" in guest_room and guest_room["children_by_ages"]:
                    for child_idx, age in enumerate(guest_room["children_by_ages"]):
                        params[f"guests[{room_idx}][children_by_ages][{child_idx}]"] = age

        return await self.get("/Property/getBookingOffers", params=params)

    async def ack_booking(self, booking_id: int, revision_id: str) -> Dict[str, Any]:
        """Acknowledge a booking"""
        return await self.post("/Booking/ackBooking", json_data={
            "booking_id": booking_id,
            "revision_id": revision_id
        })

    async def post_room_assignment(self, booking_id: int, revision_id: str) -> Dict[str, Any]:
        """Send room assignment for a booking"""
        return await self.post("/Booking/postRoomAssignment", json_data={
            "booking_id": booking_id,
            "revision_id": revision_id
        })

    async def post_external_property_data(self, data: dict) -> Dict[str, Any]:
        """Send external property mapping data"""
        return await self.post("/Property/postExternalPropertyData", json_data=data)

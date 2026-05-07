"""WhatsApp Bridge proxy endpoints — proxy management requests to the local Baileys bridge."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx
import os

router = APIRouter()

BRIDGE_URL = os.getenv("WHATSAPP_BRIDGE_URL", "http://127.0.0.1:3001")
TIMEOUT = 10.0


@router.get("/status")
async def whatsapp_status():
    """Proxy status from the WhatsApp bridge."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(f"{BRIDGE_URL}/status")
            r.raise_for_status()
            return r.json()
    except httpx.ConnectError:
        return {"connected": False, "phone": None, "has_session": False, "bridge_running": False}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {str(e)}")


@router.get("/qr")
async def whatsapp_qr():
    """Proxy QR code PNG from the WhatsApp bridge."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(f"{BRIDGE_URL}/qr")
            if r.status_code == 404:
                raise HTTPException(status_code=404, detail="No QR code available")
            r.raise_for_status()
            return StreamingResponse(
                r.aiter_bytes(),
                media_type="image/png",
                headers={"Cache-Control": "no-cache"},
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="WhatsApp bridge not running")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {str(e)}")


@router.post("/logout")
async def whatsapp_logout():
    """Proxy logout to disconnect and clear WhatsApp session."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(f"{BRIDGE_URL}/logout")
            r.raise_for_status()
            return r.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="WhatsApp bridge not running")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {str(e)}")

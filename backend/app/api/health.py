from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check_get() -> dict[str, str]:
    return {"status": "ok"}


@router.head("")
def health_check_head() -> Response:
    return Response(status_code=200)
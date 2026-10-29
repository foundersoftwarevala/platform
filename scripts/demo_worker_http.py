"""HTTP helpers shared by the internal demo workers."""

INTERNAL_APP_HOST = "softwarevala.net"


def internal_api_headers(token):
    """Use the canonical Host when calling the local app through loopback."""
    return {
        "content-type": "application/json",
        "x-internal-token": token,
        "Host": INTERNAL_APP_HOST,
    }
